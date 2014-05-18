// Copyright © 2014 Nathan Vander Wilt. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the BSD 2-Clause License
// <LICENSE-FREEBSD or http://opensource.org/licenses/BSD-2-Clause>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var events = require('events');

/*
var _ = require('struct-fu');
var cmdStruct = _.struct([
    _.bool('start'),
    _.bool('tx'),
    _.ubit('command', 6),
    _.uint32('argument'),
    _.ubit('crc', 7),
    _.bool('end')
]);
*/

var CMD = {
    GO_IDLE_STATE: {index:0},
};

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
//if (crcTable[0] !== 0x00 || crcTable[7] !==  0x3f || crcTable[8] !== 0x48 || crcTable[255] !== 0x79) throw Error("Wrong table!")

function crcAdd(crc, byte) {
    return crcTable[(crc << 1) ^ byte];
}


// WORKAROUND: https://github.com/tessel/beta/issues/335
function reduceBuffer(buf, start, end, fn, res) {
    // NOTE: does not handle missing `res` like Array.prototype.reduce would
    for (var i = start; i < end; ++i) {
        res = fn(res, buf[i]);
    }
    return res;
}


exports.use = function (port) {
    var card = new events.EventEmitter(),
        spi = null;         // re-initialized to various settings until card is ready
    
    function configureSPI(mode, cb) {           // 'pulse', 'init', 'fullspeed'
        var pin = port.digital[1],
            cfg = { chipSelect: pin };
        if (mode === 'pulse') {
            // during pulse, CSN pin needs to be (and then remain) pulled high
            delete cfg.chipSelect;
            pin.output(true);
        }
        cfg.clockSpeed = (mode === 'fullspeed') ? 2*1000*1000 : 200*1000;
        spi = new port.SPI(cfg);
        //console.log("SPI is now", spi);
        spi.on('ready', cb);
    }
    
    var cmdBuffer = new Buffer(6 + 1 + 8);
    function sendCommand(cmd, arg, cb) {
        if (typeof arg === 'function') {
            cb = arg;
            arg = null;
        }
        
        var command = CMD[cmd];
        cmdBuffer[0] = 0x40 | command.index;
        if (arg) arg.copy(cmdBuffer, 1, 0, 4);
        else cmdBuffer.fill(0x00, 1, 5);
        //cmdBuffer[5] = Array.prototype.reduce.call(cmdBuffer.slice(0,5), crcAdd, 0);
        cmdBuffer[5] = reduceBuffer(cmdBuffer, 0, 5, crcAdd, 0);
        cmdBuffer.fill(0xFF, 6);
        
        console.log("* sending data:", cmdBuffer);
        spi.transfer(cmdBuffer, function (e,d) {
            console.log("TRANSFER RESULT", d);
            cb.call(null, arguments);
        });
    }
    
    configureSPI('pulse', function () {
        // need to pull MOSI _and_ CS high for minimum 74 clock cycles at 100–400kHz
        console.log("Initial SPI ready, triggering native command mode.");
        var initLen = Math.ceil(74/8),
            initBuf = new Buffer(initLen);
        initBuf.fill(0xFF);
        spi.transfer(initBuf, function () {             // WORKAROUND: would use .send but https://github.com/tessel/beta/issues/336
            configureSPI('init', function () {
                sendCommand('GO_IDLE_STATE', function () {
                    console.log("Init complete, switching SPI to full speed.");
                    configureSPI('fullspeed', function () {
                        // now card should be ready!
                        console.log("Card should be ready.");
                    
                    });
                });
            });
        });
    });
    
    return card;
};
