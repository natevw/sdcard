/*********************************************
This SD Card Module demo sends audio from card
to Audio Module output, by piping file stream.
*********************************************/

var tessel = require('tessel'),
    sdlib = require('../'),     // use 'sdcard' in your own code
    aulib = require('audio-vs1053b');

sdlib.use(tessel.port['A'], {getFilesystems:true}, function (e,arr) {
    if (e) throw e;
    
    var fs = arr[0];
    fs.readFile("sample.mp3", function (e,d) {
        if (e) throw e;
        
        console.log("Read file,", d.length, "bytes");
        
        fs = null;          // NOTE: audio lib breaks sdcard still!
        var audio = aulib.use(tessel.port['B']);
        audio.on('ready', function () {
            audio.setOutput('headphone', function () {
                console.log("Audio ready, playing file.");
                audio.play(d, function () {
                    console.log("play said:", arguments);
                });
            });
        });
    });
});
