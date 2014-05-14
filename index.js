// Copyright © 2014 Nathan Vander Wilt. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the BSD 2-Clause License
// <LICENSE-FREEBSD or http://opensource.org/licenses/BSD-2-Clause>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.


var tessel = require('tessel');

// no global state! global variables/functions
// are fine as long as you can have more than one
// instance e.g. two accelerometers on two different ports

// private functions should take in a i2c or spi or uart etc.
// variable, basically any state they play with
function writeRegister (spi, next) {
    spi.transfer([somebytes], next);
}

function SDCard (port) {
    // create a private spi/i2c/uart instance
    this.spi = new port.SPI()
}

SDCard.prototype.somemethod = function () { }

// public function
function use(port) {
    return new SDCard(port);
}

// expose your classes and API all at the bottom
exports.SDCard = SDCard;
exports.use = use;