#SD Card

Driver for the sdcard Tessel SD Card module.

##Installation

```sh
npm install sdcard
```

##Example

(Please make sure you have a backup of any important data on your card; the example below can be changed to zero out one of its blocks…)

```js
/*********************************************
Basic reading/writing to an SD card.
*********************************************/

var tessel = require('tessel');
var sdcard = require('../').use(tessel.port['A'], function (e) {
    if (e) throw e;
    
    sdcard.readBlock(0, function (e,d) {
        if (e) throw e;
        else console.log("First sector contents:", d);
    });
    
    var zeroes = new Buffer(sdcard.BLOCK_SIZE);
    zeroes.fill(0);
    // TODO: change the logic below if you know it's safe to do
    if (0) sdcard.writeBlock(1, zeroes, function (e,d) {
        if (e) console.error("Write failed!", e);
        else console.log("Zeroed out the second sector…");
    });
});
```

## API Reference

* `var sdcard = require('sdcard').use(port, [opts], [cb])` — Initialize the card driver with the given Tessel port. You may provide an optional callback taking `(err)` which will be registered for the `ready` and `error` (if error parameter not `null`) events. Valid flags for the `opts` argument (which is not required either) are documented below.
* `sdcard.isPresent()` — returns `true` if there is something physically in the slot, `false` if not. Can be called regardless of whether the card is ready or not, unlike the read/write calls below.

* `'ready'` event — fired when the card interface has been initialized and is ready to use. If the `getFilesystems` *option* was set, this event will wait to fire until with a filesystem list (like that from the `sdcard.getFilesystems` *method*) can be provided as its argument.
* `'error'` event — fired if the card interface (or any filesystems, if requested) could not become ready.
* `'inserted'` event — if the `watchCard` option is set, this event will be fired when the card has been physically inserted (communications probably not initialized yet!)
* `'removed'` event — if the `watchCard` option is set, this event will be fired when the card has been physically removed

* `sdcard.restart()` — The card driver will normally only fire the `'ready'` (or `'error'`) event once, after the first time a card is inserted and successfully (or unsuccessfully) initialized. If you wish to receive once of those events again, call `.restart()` on either the `'removed'` or `'inserted'` events and the driver will attempt to re-initialize the SD Card.

* `sdcard.getFilesystems(cb)` — Returns `(e, array)` with the usuable filesystems found on the card, ready to use. These filesystems will expose an API similar to the [node.js 'fs' module](http://nodejs.org/api/fs.html). Currently this only supports basic FAT partitions [hosted within](https://github.com/natevw/parsetition) a MBR partition table, and the [fatfs driver]((https://github.com/natevw/fatfs) is missing some functionality and **lots** of test cases. Please tread with caution and [report any issues]((https://github.com/natevw/fatfs/issues) you may encounter!

## Options to `sdcard.use`

These flags can be provided via an `opts` object to `sdcard.use`:

* `getFilesystems` — If set to `true`, the `'ready'` event will be delayed until filesystems have been fetched. (See event documentation for details.) Defaults to `false`.
* `waitForCard` — When `true` (the default), the library will wait for a card to be physically inserted before proceeding with initialization. If set to `false`, then an error will be emitted if a card is not immediately detected via the sense pin.
* `watchCard` — If set to `true`, your script will never finish but the instance will emit the `'inserted'` and `'removed'` events as documented above. Defaults to `false`.


## Low level (raw) API

* `sdcard.readBlock(i, cb)` — reads the `i`th block of data. Callback receives up to two arguments `(error, data)`, note that if `error` is not `null` then the value of the `data` parameter is undetermined.

* `sdcard.readBlocks(i, buffer, cb)` — starting at the `i`th block, reads multiple blocks into `buffer` and calls `cb(err, bytesRead, buffer)` when done. For large contiguous reads, this can be more efficient than multiple `sdcard.readBlock` calls.  The destination buffer's length need not be an integer multiple of `sdcard.BLOCK_SIZE`; any extra data from the final block will simply be discarded. [Right now, `bytesRead` will always equal `buffer.length` and you are responsible for not reading off the end of the card. This may change in the future to do a partial read instead.]

* `sdcard.writeBlock(i, data, cb)` — overwrites the `i`th block with `data`, which must be exactly 512 bytes long. Callback is given `(error)`, which will be `null` if the write was successful. Note that at the card level, a single block write usually requires a full read/erase/rewrite operation against an entire page of blocks — see `sdcard.writeBlocks` if you are writing several contiguous blocks of data.

* `sdcard.writeBlocks(i, data, cb)` — starting at the `i`th block, first erases and then overwrites multiple blocks with the contents of `buffer`, calling `cb(err)` when done. The length of `data` **must** be an integer multiple of `sdcard.BLOCK_SIZE`. This call is *significantly* more efficient than `sdcard.writeBlock` for any size contiguous writes. 

**TBD**: expose atomic `.modifyBlock` helper?

**TBD**: expose how many blocks the card has available!

* `sdcard.BLOCK_SIZE` — currently, this will always be `512`. However, for more self-documenting code or for compatibility with (potential, not necessarily planned) a future backwards-incompatible major version of this code, you may wish to use this property.

Note that all read/write requests are serialized internally. So it is okay to request a block read immediately after starting a write request to the same block; your read will see the data from your write. *However* note that this serialization is on a request-by-request basis and e.g. if you write updated block data in a read callback **you** are responsible for making sure no other conflicting writes have been queued for that particular block in the meantime!

(**TBD**: No caching is currently done, but individual block writes are very inefficient and so a cache be added in the future. The semantics of the above commands would not change, except that you could not count on the card having the data your callbacks think it has until an explicit request to flush had completed. Likely such a cache would be implemented as a separate wrapper around the core, or at least opt-in; I'll commit to changing the major version number if such a cache were to become the default behavior.)

**TBD**: helper methods that expose partition / FAT modules?


## Further Examples

See the examples folder for code.

* offset_rw.js: shows how to overwrite just a few bytes of data

* todo1: Logging data to the raw disk with a very simple "homemade" filesytem

* todo2: **TBD** once FAT integration is in place we need an example

## License

© 2014 Nathan Vander Wilt.
Funding for this work was provided by Technical Machine, Inc.

BSD-2-Clause or Apache-2.0 at your option.
