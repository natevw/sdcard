/*********************************************
Playing with multiple-block reads and writes.
*********************************************/

var OKAY_TO_WRITE_CARD = false;


var tessel = require('tessel');
var sdcard = require('../').use(tessel.port['A'], function (e) {
    if (e) throw e;
    
    sdcard.readBlocks(0, Buffer(1042), function (e,n,d) {
        if (e) throw e;
        else console.log("Blocks contain:", d.slice(0,64), d.slice(512,576));
    });
    
//    var zeroes = new Buffer(sdcard.BLOCK_SIZE);
//    zeroes.fill(0);
//    if (OKAY_TO_WRITE_CARD) sdcard.writeBlock(1, zeroes, function (e,d) {
//        if (e) console.error("Write failed!", e);
//        else console.log("Zeroed out the second sector…");
//    });
//    else console.warn("Skipped write; set OKAY_TO_WRITE_CARD to `true` if you'd like.");
});