/*********************************************
This MicroSD card example writes a text file
to the sd card, then reads the file to the
console.
*********************************************/

var tessel = require('tessel');
var sdcard = require('../').use(tessel.port['A']);

sdcard.on('ready', function() {
  sdcard.getFilesystems(function(err, fss) {
    var fat = fss[0];
    console.log('Writing...');
    fat.writeFile('someFile.txt', 'Hey Tessel SDCard!', function(err) {
      console.log('Write complete. Reading...');
      fat.readFile('someFile.txt', function(err, data) {
        console.log('Read:\n', data.toString());
      });
    });
  });
});
