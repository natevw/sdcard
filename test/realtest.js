var tessel = require('tessel'),
    sdcard = require("../"),
    queue = require('queue-async'),
    _fat = require('fatfs/test');

function h(n, pad) {
    return (pad+1+n).toString(16).slice(1);
}

var card = sdcard.use(tessel.port['A'], {watchCard:true});

console.log("Card", (card.isPresent()) ? "present" : "absent", "at startup.");
card.on('ready', function () {
    console.log("Card now ready!");
    
    card.getFilesystems({volumesOnly:true}, function (e,arr) {
        if (e) throw e;
        else if (!arr.length) throw Error("No filesystems found!");
        else _fat.startTests(arr[0], 600e3);
    });
    
    // attempt to throw a wrench; shouldn't affect SD communications though!
/*
    var otherSPI = tessel.port["B"].SPI();
    setInterval(function () {
        otherSPI.transfer(Buffer(7), function (e,d) {
            console.log("[otherSPI transfer done]");
        });
    }, Math.random() * 10);
*/
});

card.on('error', function (e) {
    console.error("Couldn't initialize card.", e);
});

card.on('removed', function () {
    console.log("Card removed, waiting for it again…");
    card.restart();
});
