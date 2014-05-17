// Copyright © 2014 Nathan Vander Wilt. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the BSD 2-Clause License
// <LICENSE-FREEBSD or http://opensource.org/licenses/BSD-2-Clause>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var events = require('events'),
    _ = require('struct-fu');

var cmdStruct = _.struct([
    _.bool('start'),
    _.bool('tx'),
    _.ubit('command', 6),
    _.uint32('argument'),
    _.ubit('crc', 7),
    _.bool('end')
]);


var CMD = {
    GO_IDLE_STATE: 0,
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


exports.use = function (port) {
    var card = new events.EventEmitter(),
        spi = new port.SPI({
            // NOTE: these values are for init
            clockSpeed: 200*1000,
            chipSelect: port.gpio(1),
            chipSelectActive: 'high'
        });
    
    
    var cmdBuffer = new Buffer(6);
    function sendCommand(cmd, arg, cb) {
        if (typeof cmd === 'string') cmd = CMD[cmd];
        
        // TODO: might be simpler to just manually pack the buffer…
        cmdStruct.valueToBytes({
            start: 0,
            tx: true,
            command: cmd,
            argument: arg,
            crc: 0,
            end: true
        }, cmdBuffer);
        // TODO: calculate CRC7
        // TODO: send, handle various response situations, etc. etc.
        process.nextTick(cb.bind(null, Error("Not Implemented")), 0);
    }
    
    // need to pull MOSI and CS high for minimum 74 clock cycles at 100–400kHz
    spi.on('ready', function () {
        console.log("Initial SPI ready, triggering native command mode.");
        var initLen = Math.ceil(74/8),
            initBuf = new Buffer(initLen);
        initBuf.fill(0xFF);
        spi.send(initBuf, function () {
            sendCommand('GO_IDLE_STATE', function () {
                console.log("Init complete!");
                
                
                // now card should be ready!
            });
        });
    });
    
    return card;
};
