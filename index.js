// Copyright © 2014 Nathan Vander Wilt. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the BSD 2-Clause License
// <LICENSE-FREEBSD or http://opensource.org/licenses/BSD-2-Clause>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var events = require('events'),
    fifolock = require('fifolock'),
    parsetition = require('parsetition'),
    fatfs = require('fatfs'),
    queue = require('queue-async'),
    extend = require('xok');

var _dbgLevel = 0,//-5;
    _prevDbg = Date.now();

function log(level) {
  var now = Date.now(), diff = now - _prevDbg;
  _prevDbg = now;
  if (level >= _dbgLevel) {
    arguments[0] = ((diff > 75) ? diff.toFixed(0) : "  <75ms")
    console.log.apply(console, arguments);
    //Array.prototype.slice.call(arguments, 1));
  }
}

// HACK/WORKAROUND: https://github.com/tessel/runtime/issues/722
if (Math.ceil(2.5) === 2) Math.ceil = function (n) { return (n % 1) ? Math.round(n+0.5) : n; };


log.DBG = -4;
log.INFO = -3;
log.WARN = -2;
log.ERR = -1;


// see http://elm-chan.org/docs/mmc/mmc_e.html
// and http://www.dejazzer.com/ee379/lecture_notes/lec12_sd_card.pdf
// and http://www.cs.ucr.edu/~amitra/sdcard/ProdManualSDCardv1.9.pdf
// and http://wiki.seabright.co.nz/wiki/SdCardProtocol.html

var CMD = {
    GO_IDLE_STATE: {index:0, format:'r1'},
    SEND_IF_COND: {index:8, format:'r7'},
    READ_OCR: {index:58, format:'r3'},
    STOP_TRANSMISSION: {index:12, format:'r1b'},
    SET_BLOCKLEN: {index:16, format:'r1'},
    READ_SINGLE_BLOCK: {index:17, format:'r1'},
    READ_MULTIPLE_BLOCK: {index:18, format:'r1'},
    WRITE_BLOCK: {index:24, format:'r1'},
    WRITE_MULTIPLE_BLOCK: {index:25, format:'r1'},
    CRC_ON_OFF: {index:59, format:'r1'},
    
    APP_CMD: {index:55, format:'r1'},
    SET_WR_BLOCK_ERASE_COUNT: {app_cmd:true, index:23, format:'r1'},
    APP_SEND_OP_COND: {app_cmd:true, index:41, format:'r1'}
};

var RESP_LEN = {r1:1, r1b:1, r3:5, r7:5};

var R1_FLAGS = {
    IDLE_STATE: 0x01,
    ERASE_RESET: 0x02,
    ILLEGAL_CMD: 0x04,
    CRC_ERROR: 0x08,
    ERASE_SEQ: 0x10,
    ADDR_ERROR: 0x20,
    PARAM_ERROR: 0x40
};

R1_FLAGS._ANY_ERROR_ = R1_FLAGS.ILLEGAL_CMD | R1_FLAGS.CRC_ERROR | R1_FLAGS.ERASE_SEQ | R1_FLAGS.ADDR_ERROR| R1_FLAGS.PARAM_ERROR;

// CRC7 via https://github.com/hazelnusse/crc7/blob/master/crc7.cc
var crcTable = function (poly) {
  var table = new Buffer(256);
  for (var i = 0; i < 256; ++i) {
    table[i] = (i & 0x80) ? i ^ poly : i;
    for (var j = 1; j < 8; ++j) {
      table[i] <<= 1;
      if (table[i] & 0x80) {
        table[i] ^= poly;
      }
    }
  }
  return table;
}(0x89);
// spot check a few values, via http://www.cs.fsu.edu/~baker/devices/lxr/http/source/linux/lib/crc7.c
if (crcTable[0] !== 0x00 || crcTable[7] !==  0x3f || crcTable[8] !== 0x48 || crcTable[255] !== 0x79) {
  throw Error("Wrong CRC7 table generated!");
}

function crcAdd(crc, byte) {
  return crcTable[(crc << 1) ^ byte];
}

// via http://www.digitalnemesis.com/info/codesamples/embeddedcrc16/gentable.c
var crcTable16 = function (poly) {
  var table = new Array(256);
  for (var i = 0; i < 256; ++i) {
    table[i] = i << 8;
    for (var j = 0; j < 8; ++j) {
      if (table[i] & 0x8000) {
        table[i] = (table[i] << 1) & 0xFFFF ^ poly;
      } else {
        table[i] = (table[i] << 1) & 0xFFFF;
      }  
    }
  }
  return table;
}(0x1021);
// spot check a few values, via http://lxr.linux.no/linux+v2.6.32/lib/crc-itu-t.c
if (crcTable16[0] !== 0x00 || crcTable16[7] !==  0x70e7 || crcTable16[8] !== 0x8108 || crcTable16[255] !== 0x1ef0) {
  throw Error("Wrong CRC16 table generated!");
}

function crcAdd16(crc, byte) {
  return ((crc << 8) ^ crcTable16[((crc >>> 8) ^ byte) & 0xff]) & 0xFFFF;
}

// WORKAROUND: https://github.com/tessel/beta/issues/335
function reduceBuffer(buf, start, end, fn, res) {
  // NOTE: does not handle missing `res` like Array.prototype.reduce would
  for (var i = start; i < end; ++i) {
    res = fn(res, buf[i]);
  }
  return res;
}

exports.use = function (port, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = null;
  }
  opts = extend({
    getFilesystems: false,
    waitForCard: true,
    watchCard: false
  }, opts);
  
  var card = new events.EventEmitter(),
    spi = null,         // re-initialized to various settings until card is ready
    csn = port.pin.G1,
    ppn = port.pin.G2,      // "physically present (negated)"
    CRC = false;
  
  csn.output();
  ppn.input();
  
  if (callback) card.on('error', callback).on('ready', callback.bind(card, null));
  
  var ready, waiting;
  card.restart = function () {
    ready = false;
    
    var present = card.isPresent();
    if (present) {
      emitWhenReady();
    } else if (opts.waitForCard) {
      ppn.once('fall', setTimeout.bind(null, emitWhenReady, 1));     // spec requires 1ms after powerup before init sequence
    } else {
      process.nextTick(function () {
        emit('error', new Error("No SD card is physically present."));
      });
    }
  };
  
  var emitWhenReady = getCardReady.bind(null, function (err) {
    if (err) {
      card.emit('error', err);
    } else {
      ready = true;
      if (opts.getFilesystems) {
        card.getFilesystems(function (err,d) {
          if (err) card.emit('error', err);
          else card.emit('ready', d);
        });
      } else {
        card.emit('ready');
      }
    }
  });
  
  if (opts.watchCard) {
    ppn.on('change', function () {
      var cardPresent = card.isPresent(),
        event = (cardPresent) ? 'inserted' : 'removed';
      log(log.INFO, "Card status:", event);
      card.emit(event);
    });
  }
  
  card.isPresent = function () {
    return !ppn.read();
  };
  
  card.getFilesystems = function (opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    card.readBlock(0, function (err, d) {
      if (err) {
        callback(err);
      }
      var info;
      try {
          info = parsetition.parse(d);
      } catch (err) {
          return callback(err);
      }
      if (info.sectorSize !== BLOCK_SIZE) {
        return callback(new Error("Sector size mismatch!"));
      }
      
      var q = queue();
      info.partitions.forEach(function (p) {
        var vol = {
          sectorSize: info.sectorSize,
          numSectors: p.numSectors,
          readSectors: function (i, dest, callback) {
            if (i > p.numSectors) {
              throw Error("Invalid sector request!");
            }
            if (dest.length === card.BLOCK_SIZE) {
              card.readBlock(p.firstSector+i, function (err,d) {
                if (!err) {
                  d.copy(dest);
                }
                callback(err);
              });
            } else {
              card.readBlocks(p.firstSector+i, dest, function (err) {
                callback(err);
              });
            }
          },
          writeSectors: function (i, data, callback) {
            if (i > p.numSectors) {
              throw Error("Invalid sector request!");
            }
            if (data.length === card.BLOCK_SIZE) {
              card.writeBlock(p.firstSector+i, data, callback);
            } else {
              card.writeBlocks(p.firstSector+i, data, callback);
            }
          }
        };
        if (opts.volumesOnly) {
          q.defer(function (callback) {
            callback(null, vol);
          });
        } else if (p.type.indexOf('fat') === 0) {
          q.defer(initFS, vol);       // TODO: less fragile type detection
        }
      });
      function initFS(vol, callback) {
        var fs = fatfs.createFileSystem(vol, function (err) {
          if (err) {
            callback(err); 
          } else {
            callback(null, fs);
          }
        });
      }
      // TODO: if one `fs` fails do we really want to error them all?
      q.awaitAll(callback);
    });
  };
  
  
  // ---- CORE SPI/COMMAND HELPERS ----
  
  // WORKAROUND: https://github.com/tessel/beta/issues/336
  // (and now to handle https://github.com/tessel/firmware/issues/109 too)
  var lockedSPI = null,
    spiIdle = false;
  function spi_transfer(d, callback) {
    if (lockedSPI) {
      lockedSPI.rawTransfer(d, callback);
    } else {
      spi.transfer(d, callback);
    }
  }
  function spi_send(d, callback) {
    return spi_transfer(d, callback);
  }
  function spi_receive(n, callback) {
    var d = Buffer(n);
    d.fill(0xFF);
    return spi_transfer(d, callback);
  }
  
  function configureSPI(speed, callback) {           // 'pulse', 'init', 'fullspeed'
    spi = new port.SPI({
      clockSpeed: (speed === 'fast') ? 2*1000*1000 : 200*1000
    });
    //spi.on('ready', callback);
    process.nextTick(callback);
  }
  
  function _parseR1(r1) {
    var flags = [];
    Object.keys(R1_FLAGS).forEach(function (k) {
      if (k[0] !== '_' && r1 & R1_FLAGS[k]) {
        flags.push(k);
      }
    });
    return flags;
  }
  
  var spiQueue = fifolock(),
    _dbgTransactionNumber = 0;
  function SPI_TRANSACTION_WRAPPER(callback, fn, _nested) {
    var dbgTN = _dbgTransactionNumber;
    if (!_nested) {
      dbgTN = _dbgTransactionNumber++;
      log(log.DBG, "----- SPI QUEUE REQUESTED -----", '#'+dbgTN);
    }
    
    return spiQueue.TRANSACTION_WRAPPER.call({
      postAcquire: function (proceed) {
        spi.lock(function (e, lock) {
          log(log.DBG, "----- SPI QUEUE ACQUIRED -----", '#'+dbgTN);
          lockedSPI = lock;
          csn.output(false);
          proceed();
        });
      },
      preRelease: function (finish) {
        csn.output(true);
        spi_receive(1, function () {
          spiIdle = true;
          log(log.DBG, "----- RELEASING SPI QUEUE -----", '#'+dbgTN);
          lockedSPI.release(function () {
            lockedSPI = null;
            finish();
          });
        });
      }
    }, callback, fn, _nested);
  }
  
  function sendCommand(cmd, arg, callback, _nested) {
    if (typeof arg === 'function') {
      _nested = callback;
      callback = arg;
      arg = 0x00000000;
    }
  callback = SPI_TRANSACTION_WRAPPER(callback, function () {
    log(log.DBG, 'sendCommand', cmd, arg);
    
    var command = CMD[cmd];
    if (command.app_cmd) {
      _sendCommand(CMD.APP_CMD.index, 0, function (err) {
        if (err) {
          callback(err);
        } else {
          _sendCommand(command.index, arg, callback);
        }
      });
    } else _sendCommand(command.index, arg, callback);
    
    function _sendCommand(idx, arg, callback) {
      // cycling CSN here before every new command prevents receiving a mis-aligned response back
      // NOTE: http://www.lpcware.com/content/forum/sd-card-interfacing pessimistic re. alignment,
      //       but I've only ever seen misalignment when forgetting to handle this resync properly!
      if (!spiIdle) {
          log(log.DBG, "Re-syncronizing SPI bus before new command");
          csn.output(true);
          spi_receive(1, function () {
              csn.output(false);
              __sendCommand(idx, arg, callback);
          });
      } else {
        __sendCommand(idx, arg, callback);
      }
      spiIdle = false;
    }
    
    function __sendCommand(idx, arg, callback) {
      log(log.DBG, '_sendCommand', idx, '0x'+arg.toString(16));
      var cmdBuffer = new Buffer(6);
      cmdBuffer[0] = 0x40 | idx;
      cmdBuffer.writeUInt32BE(arg, 1);
      //cmdBuffer[5] = Array.prototype.reduce.call(cmdBuffer.slice(0,5), crcAdd, 0) << 1 | 0x01;
      if (CRC) {
        cmdBuffer[5] = reduceBuffer(cmdBuffer, 0, 5, crcAdd, 0) << 1 | 0x01;
      } else if (idx === 0 && arg === 0x0000) {
        cmdBuffer[5] = 0x95;      // these two need CRCs
      } else if (idx === 8 && arg === 0x01AA) {
        cmdBuffer[5] = 0x87;      // …but they're known!
      }
      cmdBuffer.fill(0xFF, 6);
      log(log.DBG, "* sending data:", cmdBuffer);
      spi_transfer(cmdBuffer, function (err, d) {
        log(log.DBG, "TRANSFER RESULT", d);
        if (err) {
          callback(err);
        } else if (cmd === 'STOP_TRANSMISSION') {
          // NOTE: can't find in spec, but supposedly need to ignore a byte after CMD12…
          spi_receive(1, function () {
            waitForResponse(8);
          });
        } else {
          waitForResponse(8);
        }
        
        function waitForResponse(tries) {
          if (!tries) {
            callback(new Error("Timed out waiting for reponse."));
          } else {
            spi_receive(1, function (err, rd) {
              log(log.DBG, "while waiting for response got", rd);
              if (err) {
                callback(err);
              } else if (rd[0] & 0x80) {
                waitForResponse(tries-1);
              } else {
                finish(rd[0]);
              }
            });
          }
        }
        function finish(r1) {
          var additionalBytes = RESP_LEN[command.format]-1;
          if (r1 & R1_FLAGS._ANY_ERROR_) {
            callback(new Error("Error flag(s) set: "+_parseR1(r1)), r1);
          } else if (command.format === 'r1b') {
            waitForIdle(100, function (err) {
              callback(err, r1);
            });
          } else if (additionalBytes) {
            spi_receive(additionalBytes, function (err, d) {
              callback(err, r1, d);
            });
          } else {
            callback(null, r1);
          }
        }
      });
    }
  }, _nested); }
  
  
  // ---- INITIALIZATION DANCE ----
  
  var BLOCK_SIZE = 512;           // NOTE: code expects this to remain 512 for compatibility w/SDv2+block
  card.BLOCK_SIZE = BLOCK_SIZE;
  
  function getCardReady(callback) {
    // see http://elm-chan.org/docs/mmc/gx1/sdinit.png
    // and https://www.sdcard.org/downloads/pls/simplified_specs/part1_410.pdf Figure 7-2
    // and http://eet.etec.wwu.edu/morrowk3/code/mmcbb.c
    
    var cardType = null;
    
    function checkVoltage(callback) {
      var condValue = 0x1AA;
      sendCommand('SEND_IF_COND', condValue, function (err, d, b) {
        var oldCard = (d & R1_FLAGS._ANY_ERROR_) === R1_FLAGS.ILLEGAL_CMD;
        if (err && !oldCard) {
          return callback(new Error("Uknown card."));
        } else if (oldCard) {
          cardType = 'SDv1';            // TODO: or 'MMCv3'!
        }
        
        var echoedValue = (b.readUInt16BE(2) & 0xFFF);
        if (echoedValue !== condValue) {
          callback(new Error("Bad card voltage response."));
        } else {
          callback(null);
        }
      });
    }
    
    function waitForReady(tries, callback) {
      if (tries > 100) {
        callback(new Error("Timed out before card was ready."));
      }
      sendCommand('APP_SEND_OP_COND', 1 << 30, function (err, d, b) {
        if (err) {
          callback(err);
        } else if (d) {
          setTimeout(waitForReady.bind(null,tries+1,callback), 0);
        } else {
          callback(null, b);
        }
      });
    }
    
    configureSPI('slow', function () {
      // need to pull MOSI _and_ CS high for minimum 74 clock cycles at 100–400kHz
      log(log.DBG, "Initial SPI ready, triggering native command mode.");
      var initLen = Math.ceil(74/8),
          initBuf = new Buffer(initLen);
      initBuf.fill(0xFF);
      csn.output(true);
      spi_send(initBuf, function () {
        sendCommand('GO_IDLE_STATE', function (err, d) {
          if (err) {
            callback(new Error("Unknown or missing card. " + err));
          } else checkVoltage(function (err) {
            if (err) {
              callback(err);
            } else waitForReady(0, function (err) {
              if (err) {
                callback(err);
              } else if (CRC) {
                sendCommand('CRC_ON_OFF', 0x01, function (err) {
                  if (err) {
                    callback(new Error("Couldn't re-enable bus checksumming."));
                  } else {
                    homestretch();
                  }
                });
              } else {
                homestretch();
              }
              function homestretch() {
                if (cardType) {
                  fullSteamAhead();
                } else {
                  sendCommand('READ_OCR', function (err, d, b) {
                    if (err) {
                      callback(new Error("Unexpected error reading card size!"));
                    }
                    cardType = (b[0] & 0x40) ? 'SDv2+block' : 'SDv2';
                    if (cardType === 'SDv2') {
                      sendCommand('SET_BLOCKLEN', BLOCK_SIZE, function (err) {
                        if (err) {
                          callback(new Error("Unexpected error settings block length!"));
                        } else {
                          fullSteamAhead();
                        }
                      });
                    } else {
                      fullSteamAhead();
                    }
                  });
                }
                function fullSteamAhead() {
                  log(log.DBG, "Init complete, switching SPI to full speed.");
                  configureSPI('fast', function () {
                    // now card should be ready!
                    log(log.DBG, "full steam ahead!");
                    callback(null, cardType);
                    // ARROW'ED!
                  });
                }
              }
            });
          });
        });
      });
    });
  }
  
  card.restart();
  
  
  // ---- NORMAL COMMUNICATIONS STUFF ----
  
  function waitForIdle(tries, callback) {
    log(log.DBG, "Waiting for idle,", tries, "more tries.");
    if (!tries) {
      callback(new Error("No more tries left waiting for idle."));
    } else {
      spi_receive(1, function (err, d) {
        if (err) {
          callback(err);
        } else if (d[0] === 0xFF) {
          callback();
        } else {
          waitForIdle(tries-1, callback);
        }
      });
    }
  }
  
  function waitForData(tries, callback) {
    if (!tries) {
      callback(new Error("Timed out waiting for data response."));
    } else {
      spi_receive(1, function (err, d) {
        log(log.DBG, "While waiting for data, got", '0x' + d[0].toString(16), "on try", tries);
        if (~d[0] & 0x80) {
          callback(new Error("Card read error: "+d[0]));
        } else if (d[0] !== 0xFE) {
          waitForData(tries-1, callback);
        } else {
          spi_receive(BLOCK_SIZE+2, function (err, d) {
            var crcError = CRC && reduceBuffer(d, 0, d.length, crcAdd16, 0);
            if (crcError) {
              callback(new Error("Checksum error on data transfer!"));
            } else {
              callback(null, d.slice(0,d.length-2), i);       // WORKAROUND: https://github.com/tessel/beta/issues/339
            }
          });
        }
      });
    }
  }
  
  function readBlock(i, callback, _nested) { callback = SPI_TRANSACTION_WRAPPER(callback, function () {
    var addr = (cardType === 'SDv2+block') ? i : i * BLOCK_SIZE;
    sendCommand('READ_SINGLE_BLOCK', addr, function (err, d) {
      if (err) {
        callback(err);
      } else {
        waitForData(100, callback);
      }
    }, true);
  }, _nested); }
  
  function readBlocks(i, dest, callback, _nested) { callback = SPI_TRANSACTION_WRAPPER(callback, function () {
    var n = Math.ceil(dest.length / BLOCK_SIZE),
      addr = (cardType === 'SDv2+block') ? i : i * BLOCK_SIZE;
    log(log.DBG, "Reading",n,"blocks into destination of length",dest.length);
    sendCommand('READ_MULTIPLE_BLOCK', addr, function (err, d) {
      if (err) {
        callback(err);
      } else {
        readAllData(0);
      }
      function readAllData(j) {
        if (j < n) {
          waitForData(100, function (err, d) {
            if (err) {
              callback(err);
            } else {
              d.copy(dest, j*BLOCK_SIZE), readAllData(j+1);
            }
          });
        } else {
          sendCommand('STOP_TRANSMISSION', function () {
            // NOTE: already have data, so ignoring any error…
            callback(null, dest.length, dest);
          }, true);
        }
      }
    }, true);
  }, _nested); }
  
  function sendData(tok, data, callback) {
    log(log.DBG, "Sending data packet to card.");
    spi_send(new Buffer([0xFF, tok]), function () {         // NOTE: stuff byte prepended, for card's timing needs
      spi_send(data, function () {
        var crc = Buffer([0xFF, 0xFF]);
        if (CRC) {
          crc.writeUInt16BE(reduceBuffer(data, 0, data.length, crcAdd16, 0), 0);
        }
        spi_send(crc, function () {
          // TODO: why do things lock up here if `spi_receive(>8 bytes, …)` (?!)
          // NOTE: above comment was https://github.com/tessel/beta/issues/359
          spi_receive(1 + 1, function (err, d) {    // data response + timing byte
            log(log.DBG, "Data response was:", d);
            
            var dr = d[0] & 0x1f;
            if (dr !== 0x05) {
              callback(new Error("Data rejected: "+d[0].toString(16)));
              // TODO: proper timeout values (here and elsewhere; based on CSR?)
            } else {
              waitForIdle(100, callback);     // TODO: we could actually release SPI to *other* users while waiting
            }
          });
        });
      });
    });
  }
  
  function writeBlock(i, data, callback, _nested) { callback = SPI_TRANSACTION_WRAPPER(callback, function () {
    if (data.length !== BLOCK_SIZE) {
      throw Error("Must write exactly "+BLOCK_SIZE+" bytes.");
    }
    var addr = (cardType === 'SDv2+block') ? i : i * BLOCK_SIZE;
    sendCommand('WRITE_BLOCK', addr, function (err) {
      if (err) {
        callback(err);
      } else {
        sendData(0xFE, data,callback);
      }
    }, true);
  }, _nested); }
  
  function writeBlocks(i, data, callback, _nested) {
    callback = SPI_TRANSACTION_WRAPPER(callback, function () {
      if (data.length % BLOCK_SIZE) {
        throw Error("Must write a multiple of "+BLOCK_SIZE+" bytes.");
      }
      var n = data.length / BLOCK_SIZE,
        addr = (cardType === 'SDv2+block') ? i : i * BLOCK_SIZE;
      
      sendCommand('SET_WR_BLOCK_ERASE_COUNT', n, function (err) {
        if (err) {
          callback(err);
        } else {
          sendCommand('WRITE_MULTIPLE_BLOCK', addr, function (err) {
            if (err) {
              callback(err);
            } else {
              sendAllData(0);
            }
            function sendAllData(j) {
              if (j < n) {
                sendData(0xFC, data.slice(j*BLOCK_SIZE, (j+1)*BLOCK_SIZE), function (err) {
                  if (err) {
                    callback(err);
                  } else {
                    sendAllData(j+1);
                  }
                });
              } else {
                log(log.DBG, "Sending end-of-transfer token to card."),
                spi_send(new Buffer([0xFF, 0xFD, 0xFF]), waitForIdle.bind(null, 100, callback));
              }
            }
          }, true);
        }
      }, true);
    }, _nested);
  }
  
  
  function modifyBlock(i,fn,callback) {
    callback = SPI_TRANSACTION_WRAPPER(callback, function () {
      readBlock(i, function (err, d) {
        if (err) {
          callback(err);
        } else {
          try {
            var syncData = fn(d, finish);
            if (syncData) finish(null, d);
          } catch (err) {
            callback(err);
          }
          function finish(err, d) {
            if (err) {
              callback(err);
            } else {
              writeBlock(i, d, callback, true);
            }
          }
        }
      }, true);
    });
  }
  
  // NOTE: these are wrapped to make *sure* caller doesn't accidentally opt-in to _nested flag
  card.readBlock = function (i, callback) {
    if (!ready) {
      throw Error("Wait for 'ready' event before using SD Card!");
    }
    return readBlock(i,callback);
  };
  card.readBlocks = function (i, dest, callback) {
    if (!ready) {
      throw Error("Wait for 'ready' event before using SD Card!");
    }
    return readBlocks(i,dest,callback);
  };
  
  card.writeBlock = function (i, data, callback) {
    if (!ready) {
      throw Error("Wait for 'ready' event before using SD Card!");
    }
    return writeBlock(i,data,callback);
  };
  card.writeBlocks = function (i, data, callback) {
    if (!ready) {
      throw Error("Wait for 'ready' event before using SD Card!");
    }
    return writeBlocks(i,data,callback);
  };
  
  card._modifyBlock = modifyBlock;
  
  return card;
}