var tessel = require('tessel'),
    sdcard = require("./index.js"),
    queue = require('queue-async');

function h(n, pad) {
    return (pad+1+n).toString(16).slice(1);
}


var card = sdcard.use(tessel.port['A']);
card.on('ready', function () {
    console.log("CARD READY");
    
    for (var i = 0; i < 512; ++i) readBlock(i);
    //for (var i = 4; i > 0; --i) readBlock(i-1);
    function readBlock(n) {
        card._readBlock(n, function (e,d) {
            if (e) return console.error("Read error", e);
            //console.log("Data read at block", n);
            for (var off = 0x000; off < 0x200; off += 0x040) {
                console.log(d.slice(off, off+0x040).toString('hex'), h(n,0xFFFF), h(off,0xFFFF));
            }
        });
    }
});