var tessel = require('tessel'),
    sdcard = require("./index.js");

var card = sdcard.use(tessel.port['A']);
card.on('ready', function () {
    card._readBlock(2, function (e,d) {
        if (e) console.error("Read error", e);
        console.log("GOT DATA?????", d);
    });
});