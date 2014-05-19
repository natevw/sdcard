var tessel = require('tessel'),
    sdcard = require("./index.js");

var card = sdcard.use(tessel.port['A']);
card.on('ready', function () {
    var block = 1;
    card._readBlock(block, function (e,d) {
        if (e) console.error("Read error", e);
        
        console.log("Read data at block", block);
        console.log("data 1/2:", d.slice(0, 256).toString('hex'));
        console.log("data 2/2:", d.slice(256, 512).toString('hex'));
    });
});