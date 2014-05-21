var tessel = require('tessel'),
    sdcard = require("./index.js"),
    queue = require('queue-async');

var card = sdcard.use(tessel.port['A']);
card.on('ready', function () {
    console.log("CARD READY");
    
    for (var i = 0; i < 1024; ++i) readBlock(i);
    //for (var i = 4; i > 0; --i) readBlock(i-1);
    function readBlock(n) {
        card._readBlock(n, function (e,d) {
            if (e) return console.error("Read error", e);
            console.log("Data read at block", n);
            console.log("data 1/2:", d.slice(0, 256).toString('hex'));
            console.log("data 2/2:", d.slice(256, 512).toString('hex'));
        });
    }
});