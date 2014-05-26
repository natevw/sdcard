// Copyright © 2014 Nathan Vander Wilt. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the BSD 2-Clause License
// <LICENSE-FREEBSD or http://opensource.org/licenses/BSD-2-Clause>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var events = require('events');

// TODO: card insertion status


// see http://elm-chan.org/docs/mmc/mmc_e.html
// and http://www.dejazzer.com/ee379/lecture_notes/lec12_sd_card.pdf
// and http://www.cs.ucr.edu/~amitra/sdcard/ProdManualSDCardv1.9.pdf
// and http://wiki.seabright.co.nz/wiki/SdCardProtocol.html

var CMD = {
    GO_IDLE_STATE: {index:0, format:'r1'},
    SEND_IF_COND: {index:8, format:'r7'},
    READ_OCR: {index:58, format:'r3'},
    SET_BLOCKLEN: {index:16, format:'r1'},
    READ_SINGLE_BLOCK: {index:17, format:'r1'},
    WRITE_BLOCK: {index:24, format:'r1'},
    CRC_ON_OFF: {index:59, format:'r1'},
    
    APP_CMD: {index:55, format:'r1'},
    APP_SEND_OP_COND: {app_cmd:true, index:41, format:'r1'}
};

var RESP_LEN = {r1:1, r3:5, r7:5};

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
            if (table[i] & 0x80) table[i] ^= poly;
        }
    }
    return table;
}(0x89);
// spot check a few values, via http://www.cs.fsu.edu/~baker/devices/lxr/http/source/linux/lib/crc7.c
if (crcTable[0] !== 0x00 || crcTable[7] !==  0x3f || crcTable[8] !== 0x48 || crcTable[255] !== 0x79) throw Error("Wrong CRC7 table generated!")

function crcAdd(crc, byte) {
    return crcTable[(crc << 1) ^ byte];
}

// via http://www.digitalnemesis.com/info/codesamples/embeddedcrc16/gentable.c
var crcTable16 = function (poly) {
    var table = new Array(256);
    for (var i = 0; i < 256; ++i) {
        table[i] = i << 8;
        for (var j = 0; j < 8; ++j) {
            if (table[i] & 0x8000) table[i] = (table[i] << 1) & 0xFFFF ^ poly;
            else table[i] = (table[i] << 1) & 0xFFFF;
            
        }
    }
    return table;
}(0x1021);
// spot check a few values, via http://lxr.linux.no/linux+v2.6.32/lib/crc-itu-t.c
if (crcTable16[0] !== 0x00 || crcTable16[7] !==  0x70e7 || crcTable16[8] !== 0x8108 || crcTable16[255] !== 0x1ef0) throw Error("Wrong CRC16 table generated!")

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


exports.use = function (port, cb) {
    var card = new events.EventEmitter(),
        spi = null,         // re-initialized to various settings until card is ready
        csn = port.digital[1],
        ppn = port.digital[2];      // "physically present (negated)"
    
    if (cb) card.on('error', cb).on('ready', cb.bind(null, null));
    
    var BLOCK_SIZE = 512;           // NOTE: code expects this to remain 512 for compatibility w/SDv2+block
    card.BLOCK_SIZE = BLOCK_SIZE;
    
    // WORKAROUND: https://github.com/tessel/beta/issues/336
    function spi_send(d, cb) {
        return spi.transfer(d, cb);
    }
    function spi_receive(n, cb) {
        var d = Buffer(n);
        d.fill(0xFF);
        return spi.transfer(d, cb);
    }
    
    var _dbgLevel = 0;//-5;
    function log(level) {
        if (level >= _dbgLevel) console.log.apply(console, Array.prototype.slice.call(arguments, 1));
    }
    log.DBG = -4;
    log.INFO = -3;
    log.WARN = -2;
    log.ERR = -1;
    
    function configureSPI(speed, cb) {           // 'pulse', 'init', 'fullspeed'
        spi = new port.SPI({
            clockSpeed: (speed === 'fast') ? 2*1000*1000 : 200*1000
        });
        spi.on('ready', cb);
    }
    
    function findResponse(d, opts) {
        opts || (opts = {});
        var idx = opts.start || 0, len = d.length,
            size = opts.size, tok = opts.token;
        if (tok) while (idx < len) {          // data response token varies
             if (d[idx] === tok) break;
             else if (d[idx] & 0x80) ++idx;
             else {     // error token!
                 size = 1;
                 break;
            }
        }
        else while (idx < len && d[idx] & 0x80) ++idx;          // command responses when 0 in MSB
        return (idx < len) ? d.slice(idx, idx+size) : Buffer(0);        // WORKAROUND: https://github.com/tessel/beta/issues/338
    }
    
    function _parseR1(r1) {
        var flags = [];
        Object.keys(R1_FLAGS).forEach(function (k) {
            if (k[0] !== '_' && r1 & R1_FLAGS[k]) flags.push(k);
        });
        return flags;
    }
    
    function _serialQueue() {
        // quick-and-dirty simple serial queue, calls fn
        var q = {},
            tasks = [];
        function runNext() {
            tasks[0](function () {
                tasks.shift();         // TODO: avoid
                if (tasks.length) runNext();
            });
        }
        q.acquire = function (fn) {
            var len = tasks.push(fn);
            if (len === 1) process.nextTick(runNext);
        };
        return q;
    }
    
    var spiQueue = _serialQueue();
    
    // executes `fn(cb)` after start; must end with `cb()`
    var _dbgTransactionNumber = 0;
    function spiTransaction(fn) {
        var dbgTN = _dbgTransactionNumber++;
        log(log.DBG, "----- SPI QUEUE REQUESTED -----", '#'+dbgTN);
        spiQueue.acquire(function (releaseQueue) {
            log(log.DBG, "----- SPI QUEUE ACQUIRED -----", '#'+dbgTN);
            csn.output(false);
            fn(function () {
                csn.output(true);
                spi_receive(1, function () {
                    log(log.DBG, "----- RELEASING SPI QUEUE -----", '#'+dbgTN);
                    releaseQueue();
                });
            });
        });
    }
    
    // usage: `cb = SPI_TRANSACTION_WRAPPER(cb, function () { …code… });`
    function SPI_TRANSACTION_WRAPPER(cb, fn, _nested) {
        if (_nested) {
            log(log.DBG, "[nested transaction]");
            process.nextTick(fn);
            return cb;
        }
        
        var _releaseSPI;
        spiTransaction(function (releaseSPI) {
            _releaseSPI = releaseSPI;
            fn();
        });
        return function _cb() {
            _releaseSPI();
            cb.apply(this, arguments);
        };
    }
    
    var cmdBuffer = new Buffer(6 + 8 + 5);
    function sendCommand(cmd, arg, cb, _nested) {
        if (typeof arg === 'function') {
            _nested = cb;
            cb = arg;
            arg = 0x00000000;
        }
    cb = SPI_TRANSACTION_WRAPPER(cb, function () {
        log(log.DBG, 'sendCommand', cmd, arg);
        
        var command = CMD[cmd];
        if (command.app_cmd) {
            _sendCommand(CMD.APP_CMD.index, 0, function (e) {
                if (e) cb(e);
                else _sendCommand(command.index, arg, cb);
            });
        } else _sendCommand(command.index, arg, cb);
        
        function _sendCommand(idx, arg, cb) {
            log(log.DBG, '_sendCommand', idx, '0x'+arg.toString(16));
            cmdBuffer[0] = 0x40 | idx;
            cmdBuffer.writeUInt32BE(arg, 1);
            //cmdBuffer[5] = Array.prototype.reduce.call(cmdBuffer.slice(0,5), crcAdd, 0) << 1 | 0x01;
            cmdBuffer[5] = reduceBuffer(cmdBuffer, 0, 5, crcAdd, 0) << 1 | 0x01;        // crc
            cmdBuffer.fill(0xFF, 6);
            log(log.DBG, "* sending data:", cmdBuffer);
            spi.transfer(cmdBuffer, function (e,d) {
                log(log.DBG, "TRANSFER RESULT", d);
                
                // response not sent until after command; it will start with a 0 bit
                d = findResponse(d, {start:6, size:RESP_LEN[command.format]});
                if (!d.length) return cb(new Error("No response from card!"));
                
                var r1 = d[0];
                if (r1 & R1_FLAGS._ANY_ERROR_) cb(new Error("Error flag(s) set: "+_parseR1(r1)), r1);
                else cb(null, r1, d.slice(1));
            });
        }
    }, _nested); }
    
    function getCardReady(cb) {
        // see http://elm-chan.org/docs/mmc/gx1/sdinit.png
        // and https://www.sdcard.org/downloads/pls/simplified_specs/part1_410.pdf Figure 7-2
        // and http://eet.etec.wwu.edu/morrowk3/code/mmcbb.c
        
        var cardType = null;
        
        function checkVoltage(cb) {
            var condValue = 0x1AA;
            sendCommand('SEND_IF_COND', condValue, function (e,d,b) {
                var oldCard = (d & R1_FLAGS._ANY_ERROR_) === R1_FLAGS.ILLEGAL_CMD;
                if (e && !oldCard) return cb(new Error("Uknown card."));
                else if (oldCard) cardType = 'SDv1';            // TODO: or 'MMCv3'!
                
                var echoedValue = (b.readUInt16BE(2) & 0xFFF);
                if (echoedValue !== condValue) cb(new Error("Bad card voltage response."));
                else cb(null);
            });
        }
        
        function waitForReady(tries, cb) {
            if (tries > 100) cb(new Error("Timed out before card was ready."));
            sendCommand('APP_SEND_OP_COND', 1 << 30, function (e,d,b) {
                if (e) cb(e);
                else if (d) setTimeout(waitForReady.bind(null,tries+1,cb), 0);
                else cb(null, b);
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
                sendCommand('GO_IDLE_STATE', function (e,d) {
                    if (e) cb(new Error("Unknown or missing card. "+e));
                    else checkVoltage(function (e) {
                        if (e) cb(e);
                        else waitForReady(0, function (e) {
                            if (e) cb(e);
                            else sendCommand('CRC_ON_OFF', 0x01, function (e) {
                                if (e) cb(new Error("Couldn't re-enable bus checksumming."));
                                else if (cardType) fullSteamAhead();
                                else sendCommand('READ_OCR', function (e,d,b) {
                                    if (e) cb(new Error("Unexpected error reading card size!"));
                                    cardType = (b[0] & 0x40) ? 'SDv2+block' : 'SDv2';
                                    if (cardType === 'SDv2') sendCommand('SET_BLOCKLEN', BLOCK_SIZE, function (e) {
                                        if (e) cb(new Error("Unexpected error settings block length!"));
                                        else fullSteamAhead();
                                    }); else fullSteamAhead();
                                });
                                function fullSteamAhead() {
                                    log(log.DBG, "Init complete, switching SPI to full speed.");
                                    configureSPI('fast', function () {
                                        // now card should be ready!
                                        log(log.DBG, "full steam ahead!");
                                        cb(null, cardType);
                                            // ARROW'ED!
                                    });
                                }
                            });
                        });
                    });
                });
            });
        });
    }
    getCardReady(function (e,d) {
        if (e) card.emit('error', e);
        else card.emit('ready');
    });
    
    
    function waitForIdle(tries, cb) {
        log(log.DBG, "Waiting for idle,", tries, "more tries.");
        if (!tries) cb(new Error("No more tries left waiting for idle."));
        else spi_receive(1, function (e,d) {
            if (e) cb(e);
            else if (d[0] === 0xFF) cb();
            else waitForIdle(tries-1, cb);
        });
    }
    
    function readBlock(n, cb, _nested) { cb = SPI_TRANSACTION_WRAPPER(cb, function () {
        var addr = (cardType === 'SDv2+block') ? n : n * BLOCK_SIZE;
        sendCommand('READ_SINGLE_BLOCK', addr, function (e,d) {
            if (e) cb(e);
            else waitForData(0);
            function waitForData(tries) {
                if (tries > 100) cb(new Error("Timed out waiting for data response."));
                else spi_receive(1, function (e,d) {
                    log(log.DBG, "While waiting for data, got", '0x'+d[0].toString(16), "on try", tries);
                    if (~d[0] & 0x80) cb(new Error("Card read error: "+d[0]));
                    else if (d[0] !== 0xFE) waitForData(tries+1);
                    else spi_receive(BLOCK_SIZE+2, function (e,d) {
                        /*var crc0 = d.readUInt16BE(d.length-2),
                            crc1 = reduceBuffer(d, 0, d.length-2, crcAdd16, 0),
                            crcError = (crc0 !== crc1);*/
                        var crcError = reduceBuffer(d, 0, d.length, crcAdd16, 0);
                        if (crcError) cb(new Error("Checksum error on data transfer!"));
                        else cb(null, d.slice(0,d.length-2), n);       // WORKAROUND: https://github.com/tessel/beta/issues/339
                    });
                });
            }
        }, true);
    }, _nested); }
    
    var _WRITE0_TOK = Buffer([0xFF, 0xFE]);         // NOTE: stuff byte prepended, for card's timing needs
    function writeBlock(n, data, cb, _nested) { cb = SPI_TRANSACTION_WRAPPER(cb, function () {
        if (data.length !== BLOCK_SIZE) throw Error("Must write exactly "+BLOCK_SIZE+" bytes.");
        var addr = (cardType === 'SDv2+block') ? n : n * BLOCK_SIZE;
        sendCommand('WRITE_BLOCK', addr, function (e) {
            if (e) cb(e);
            else spi_send(_WRITE0_TOK, function () {         
                spi_send(data, function () {
                    var crc = Buffer(2);
                    crc.writeUInt16BE(reduceBuffer(data, 0, data.length, crcAdd16, 0), 0);
                    spi_send(crc, function () {
                        // TODO: why do things lock up here if `spi_receive(>8 bytes, …)` (?!)
                        spi_receive(1+1, function (e,d) {    // data response + timing byte
                            log(log.DBG, "Data response was:", d);
                            
                            var dr = d[0] & 0x1f;
                            if (dr !== 0x05) cb(new Error("Data rejected: "+d[0].toString(16)));
                            // TODO: proper timeout values (here and elsewhere; based on CSR?)
                            else waitForIdle(100, cb);     // TODO: we could actually release SPI to *other* users while waiting
                        });
                    });
                });
            });
        }, true);
    }, _nested); }
    
    function modifyBlock(n,fn,cb) { cb = SPI_TRANSACTION_WRAPPER(cb, function () {
        readBlock(n, function (e, d) {
            if (e) cb(e);
            else try {
                var syncData = fn(d, finish);
                if (syncData) finish(null, d);
            } catch (e) {
                cb(e);
            }
            function finish(e, d) {
                if (e) cb(e);
                else writeBlock(n, d, cb, true);
            }
        }, true);
    }); }
    
    // NOTE: these are wrapped to make *sure* caller doesn't accidentally opt-in to _nested flag
    card.readBlock = function (n, cb) {
        return readBlock(n,cb);
    };
    card.writeBlock = function (n, data, cb) {
        return writeBlock(n,data,cb);
    };
    card._modifyBlock = modifyBlock;
    
    // TODO: readBlocks/writeBlocks/erase (i.e. bulk/multi support)
    
    return card;
};
