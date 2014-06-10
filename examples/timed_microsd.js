// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

/*********************************************
This MicroSD card example writes a text file
to the sd card, then reads the file to the
console.
*********************************************/

var _start = Date.now();

var tessel = require('tessel'),
    sdcardlib = require('../'); // Replace '../' with 'sdcard' in your own code.

sdcardlib.use(tessel.port['A'], {getFilesystems:true}, function(e, fss) {
    if (e) throw e;

    var fs = fss[0],
        start = Date.now();
    console.log("_time_", start - _start);
    console.log('Writing...');
    fs.writeFile('someFile.txt', 'Hey Tessel SDCard!', function(err) {
        console.log('Write complete. Reading...');
        fs.readFile('someFile.txt', function(err, data) {
            console.log('Read:\n', data.toString());
            console.log(":TIME:", Date.now()-start);
        });
    });
});
