// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

/*********************************************
This MicroSD card example reads a big binary
file (which is expected to be on the card).
*********************************************/

var tessel = require('tessel'),
    sdcardlib = require('../'); // Replace '../' with 'sdcard' in your own code.

var _start = Date.now();

sdcardlib.use(tessel.port['A'], {getFilesystems:true}, function(e, fss) {
    if (e) throw e;
    
    var fs = fss[0],
        start = Date.now();
    console.log("_time_", start - _start);
    console.log("Reading...");
    fs.readFile("medFile.bin", function(err, data) {
        if (err) throw err;
        console.log("Read:\n", data.length, "bytes");
        console.log(":TIME:", Date.now()-start);
    });
});
