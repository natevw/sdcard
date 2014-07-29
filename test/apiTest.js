var test = require('tinytap');
// test.count(361);
var async = require('async');

var portname = process.argv[2] || 'A';
var tessel = require('tessel');
var sdcardLib = require('../');
var sdcard;

/***************************
Currently untested:

sdcard.on('inserted')
sdcard.on('removed')

Options for sdcard.use:
#getFilesystems
#waitForCard
#watchCard

readBlock
readBlocks
writeBlock
writeBlocks


***************************/

async.series([
  test('Connecting to module, checking for ready event', function (t) {
    sdcard = sdcardLib.use(tessel.port[portname], function (err, sdcard) {
      t.ok(sdcard, 'The sdcard module object was not returned');
      t.equal(err, undefined, 'There was an error connecting');
      // Test events
      var timeout = 1000;
      // ready
      var readyTimer = setTimeout(function () {
        t.ok(false, 'failed to emit ready event in a reasonable amount of time');
        t.end();
      }, timeout);
      sdcard.on('ready', function () {
        clearTimeout(readyTimer);
        sdcard.removeAllListeners('ready');
        t.ok(true, 'ready was emitted');
        t.end();
      });
      // error
      // Fail if we get an error
      sdcard.on('error', function (err) {
        t.ok(false, 'error caught: ' + err);
        t.end();
      });
    });
  }),
  
  test('Testing restart function, should emit ready again', function (t) {
    // Set up and start timer
    var timeout = 1000;
    var readyTimer = setTimeout(function () {
      t.ok(false, 'failed to emit ready event in a reasonable amount of time');
      t.end();
    }, timeout);
    // Restart
    sdcard.restart();
    // Wait for ready event
    sdcard.on('ready', function () {
      clearTimeout(readyTimer);
      sdcard.removeAllListeners('ready');
      t.ok(true, 'ready was emitted');
      t.end();
    });
  }),
  
  test('Making sure a card is inserted', function (t) {
    t.ok(sdcard.isPresent(), 'No SD card present. Insert an SD card.');
  }),
  
  test('Checking method getFileSystems, writing and reading back', function (t) {
    sdcard.getFilesystems(function(err, fss) {
      var fs = fss[0];
      var message = 'Hey Tessel SDCard!';
      fs.writeFile('testFile.txt', message, function(err) {
        t.equal(err, undefined, 'Error writing to filesystem.');
        fs.readFile('someFile.txt', function(err, data) {
          t.equal(err, undefined, 'Error reading from filesystem.');
          t.equal(data.toString(), message, 'Message read from file did not match message written to file.');
        });
      });
    });
  })
  
  ]);
