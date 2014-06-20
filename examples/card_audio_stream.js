/*********************************************
This SD Card Module demo sends audio from card
to Audio Module output, by piping file stream.
*********************************************/

// NOTE: this is not working, currently in development…


var tessel = require('tessel');

var sdcard = require('../').use(tessel.port['A'], {getFilesystems:true}),
    audio = require('audio-vs1053b');//.use(tessel.port['B']);


var fileStream = null,
    playStream = null;

sdcard.on('ready', function (fss) {
    var fs = fss[0];
    fileStream = fs.createReadStream("sample.m4a");
    if (playStream) playAudio();
});

audio.on('ready', function () {
  audio.setOutput('headphone', function () {
      playStream = audio.createPlayStream();
      if (fileStream) playAudio();
  });
});

function playAudio() {
    fileStream.pipe(playStream);
}
