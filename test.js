var tessel = require('tessel'),
    sdcard = require("./index.js");

var card = sdcard.use(tessel.port['A']);
card.on('ready', function () {
    var block = 0;
    card._readBlock(block, function (e,d) {
        if (e) console.error("Read error", e);
        //console.log("GOT DATA?????", d.length, d.slice(0,12), d.slice(500));
        console.log("data @", block, "/", d.length, "bytes", d.slice(500), d.toString('hex'));
    });
});