var tessel = require('tessel'),
    sdcard = require("./index.js"),
    queue = require('queue-async');

function h(n, pad) {
    return (pad+1+n).toString(16).slice(1);
}


var card = sdcard.use(tessel.port['A']);
card.on('ready', function () {
    console.log("CARD READY");
    
    var b = Buffer(512);
    //b.fill(42);
    card._writeBlock(2, b, function (e) {
        if (e) console.error("READ FAILED", e);
        else card._readBlock(2, function (e,d) {
            console.log(b.slice(0, 16), b.slice(496));
            console.log(d.slice(0, 16), d.slice(496));
        });
    
    });
    /*
    for (var i = 0; i < 16; ++i) readBlock(i);
    function readBlock(n) {
        card._readBlock(n, function (e,d) {
            if (e) return console.error("Read error", e);
            //console.log("Data read at block", n);
            for (var off = 0x000, wid = 0x040; off < 0x200; off += wid) {
                console.log(d.slice(off, off+wid).toString('hex'), h(n,0xFFFF), h(off,0xFFFF));
            }
        });
    }
    */
});