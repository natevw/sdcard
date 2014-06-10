// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

/*********************************************
Shows a bit more advanced reading and writing.
*********************************************/

var OKAY_TO_WRITE_CARD = false;

var tessel = require('tessel');
var sdcardlib = require('../'); // Replace '../' with 'sdcard' in your own code.

var sdcard = sdcardlib.use(tessel.port['A']);

var cardReady = false;
sdcard.on('error', function (e) {
    console.error("Couldn't connect to card:", e);
}).on('ready', function () {
    cardReady = true;
    useTheCard();
});

function useTheCard() {
    readData(510, 2, function (e,d) {
        if (e) console.error("Couldn't read magic numbers!", e);
        else if (d[0] === 0x55 && d[1] === 0xAA) console.log("Card has magic boot sector numbers");
        else console.log("Card does not appear to be formatted, instead of boot sector got:", d);
    });
    
    var message = Buffer("Kilroy was here.");
    writeData(516, message, function (e) {
        if (e) console.error("Couldn't deface the drive!", e);
        else console.log("Wrote message over the second sector.");
        
        // NOTE: individual sdcard requests are serialized, but our writeData helper is not!
        readData(516, message.length, function (e,d) {
            if (e) console.error("Couldn't read back message!", e);
            else console.log(d.toString());
        });
    });
}


function readData(byteOffset, len, cb) {
    if (!cardReady) throw Error("Card not ready!");
    var pos = _calc(byteOffset);
    if (pos.offset+len > sdcard.BLOCK_SIZE) throw Error("Request spans multiple blocks!");
    sdcard.readBlock(pos.block, function (e, d) {
        if (e) cb(e);
        else cb(null, d.slice(pos.offset, pos.offset+len));
    });
}

function writeData(byteOffset, data, cb) {
    if (!cardReady) throw Error("Card not ready!");
    var pos = _calc(byteOffset);
    if (pos.offset+data.length > sdcard.BLOCK_SIZE) throw Error("Request spans multiple blocks!");
    sdcard.readBlock(pos.block, function (e, origData) {
        // TODO/CAUTION: this code assumes no other writes to `pos.block` have been queued meanwhile…!
        if (e) return cb(e);
        data.copy(origData, pos.offset);
        if (OKAY_TO_WRITE_CARD) sdcard.writeBlock(pos.block, origData, cb);
        else console.warn("Skipping actual write, modify example and set OKAY_TO_WRITE_CARD if you'd like.");
    });
}

function _calc(bytes) {
    var _off = bytes % sdcard.BLOCK_SIZE,
        _blk = (bytes - _off) / sdcard.BLOCK_SIZE
    return {block:_blk, offset:_off};
}
