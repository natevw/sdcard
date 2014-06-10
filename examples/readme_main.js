//depreciated

// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

/*********************************************
This is ± the same example as the README shows.
*********************************************/

var OKAY_TO_WRITE_CARD = false;


var tessel = require('tessel');
var sdcardlib = require('../'); // Replace '../' with 'sdcard' in your own code.

var sdcard = sdcardlib.use(tessel.port['A'], function (e) {
    if (e) throw e;
    
    sdcard.readBlock(0, function (e,d) {
        if (e) throw e;
        else console.log("First sector contents:", d);
    });
    
    var zeroes = new Buffer(sdcard.BLOCK_SIZE);
    zeroes.fill(0);
    if (OKAY_TO_WRITE_CARD) sdcard.writeBlock(1, zeroes, function (e,d) {
        if (e) console.error("Write failed!", e);
        else console.log("Zeroed out the second sector…");
    });
    else console.warn("Skipped write; set OKAY_TO_WRITE_CARD to `true` if you'd like.");
});