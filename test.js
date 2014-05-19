var tessel = require('tessel'),
    sdcard = require("./index.js"),
    queue = require('queue-async');

var card = sdcard.use(tessel.port['A']);
card.on('ready', function () {
    console.log("CARD READY");
    
    var q = queue(1);
    for (var i = 0; i < 2; ++i) q.defer(card._readBlock, i);
    q.awaitAll(function (e, blocks) {
        if (e) console.error("Read error", e);
        else blocks.forEach(function (d, block) {
            console.log("Data read at block", block);
            console.log("data 1/2:", d.slice(0, 256).toString('hex'));
            console.log("data 2/2:", d.slice(256, 512).toString('hex'));
        });
    });
});