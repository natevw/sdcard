#SD Card
Driver for the sdcard Tessel SD Card module. The hardware documentation for this module can be found [here](https://github.com/tessel/hardware/blob/master/modules-overview.md#micro-sd-card).

If you run into any issues you can ask for support on the [SD Card Module Forums](http://forums.tessel.io/category/microsd).

###Installation
```sh
npm install sdcard
```

###Example
(Please make sure you have a backup of any important data on your card; the example below can be changed to zero out one of its blocks…)

```js
/*********************************************
This MicroSD card example writes a text file
to the sd card, then reads the file to the
console.
*********************************************/

var tessel = require('tessel');
var sdcardlib = require('sdcard');

var sdcard = sdcardlib.use(tessel.port['A']);

sdcard.on('ready', function() {
  sdcard.getFilesystems(function(err, fss) {
    var fs = fss[0];
    console.log('Writing...');
    fs.writeFile('someFile.txt', 'Hey Tessel SDCard!', function(err) {
      console.log('Write complete. Reading...');
      fs.readFile('someFile.txt', function(err, data) {
        console.log('Read:\n', data.toString());
      });
    });
  });
});
```

###Methods
&#x20;<a href="#api-var-sdcard-require-sdcard-use-port-opts-cb-Initialize-the-card-driver-with-the-given-Tessel-port-You-may-provide-an-optional-callback-taking-err-which-will-be-registered-for-the-ready-and-error-if-error-parameter-not-null-events-Valid-flags-for-the-opts-argument-which-is-not-required-either-are-documented-below" name="api-var-sdcard-require-sdcard-use-port-opts-cb-Initialize-the-card-driver-with-the-given-Tessel-port-You-may-provide-an-optional-callback-taking-err-which-will-be-registered-for-the-ready-and-error-if-error-parameter-not-null-events-Valid-flags-for-the-opts-argument-which-is-not-required-either-are-documented-below">#</a> <i>var</i>&nbsp; <b>sdcard</b> = require( 'sdcard').use(port, [opts], [cb])  
Initialize the card driver with the given Tessel port. You may provide an optional callback taking (err) which will be registered for the ready and error (if error parameter not null) events. Valid flags for the opts argument (which is not required either) are documented below.  

&#x20;<a href="#api-sdcard-isPresent-returns-true-if-there-is-something-physically-in-the-slot-false-if-not-Can-be-called-regardless-of-whether-the-card-is-ready-or-not-unlike-the-read-write-calls-below" name="api-sdcard-isPresent-returns-true-if-there-is-something-physically-in-the-slot-false-if-not-Can-be-called-regardless-of-whether-the-card-is-ready-or-not-unlike-the-read-write-calls-below">#</a> sdcard<b>.isPresent</b>()  
 Returns true if there is something physically in the slot, false if not. Can be called regardless of whether the card is ready or not, unlike the read/write calls below.  

&#x20;<a href="#api-sdcard-restart-The-card-driver-will-normally-only-fire-the-ready-or-error-event-once-after-the-first-time-a-card-is-inserted-and-successfully-or-unsuccessfully-initialized-If-you-wish-to-receive-once-of-those-events-again-call-restart-on-either-the-removed-or-inserted-events-and-the-driver-will-attempt-to-re-initialize-the-SD-Card" name="api-sdcard-restart-The-card-driver-will-normally-only-fire-the-ready-or-error-event-once-after-the-first-time-a-card-is-inserted-and-successfully-or-unsuccessfully-initialized-If-you-wish-to-receive-once-of-those-events-again-call-restart-on-either-the-removed-or-inserted-events-and-the-driver-will-attempt-to-re-initialize-the-SD-Card">#</a> sdcard<b>.restart</b>()  
The card driver will normally only fire the 'ready' (or 'error') event once, after the first time a card is inserted and successfully (or unsuccessfully) initialized. If you wish to receive once of those events again, call= restart() on either the 'removed' or 'inserted' events and the driver will attempt to re-initialize the SD Card.  

&#x20;<a href="#api-sdcard-getFilesystems-cb-Returns-e-array-with-the-usuable-filesystems-found-on-the-card-ready-to-use-These-filesystems-will-expose-an-API-similar-to-the-node-js-fs-module-http-nodejs-org-api-fs-html-Currently-this-only-supports-basic-FAT-partitions-hosted-within-https-github-com-natevw-parsetition-a-MBR-partition-table-and-the-fatfs-driver-https-github-com-natevw-fatfs-is-missing-some-functionality-and-lots-of-test-cases-Please-tread-with-caution-and-report-any-issues-https-github-com-natevw-fatfs-issues-you-may-encounter" name="api-sdcard-getFilesystems-cb-Returns-e-array-with-the-usuable-filesystems-found-on-the-card-ready-to-use-These-filesystems-will-expose-an-API-similar-to-the-node-js-fs-module-http-nodejs-org-api-fs-html-Currently-this-only-supports-basic-FAT-partitions-hosted-within-https-github-com-natevw-parsetition-a-MBR-partition-table-and-the-fatfs-driver-https-github-com-natevw-fatfs-is-missing-some-functionality-and-lots-of-test-cases-Please-tread-with-caution-and-report-any-issues-https-github-com-natevw-fatfs-issues-you-may-encounter">#</a> sdcard<b>.getFilesystems</b>(cb)  
Returns (e, array) with the usuable filesystems found on the card, ready to use. These filesystems will expose an API similar to the [node.js 'fs' module](http://nodejs.org/api/fs.html). Currently this only supports basic FAT partitions [hosted within](https://github.com/natevw/parsetition) a</i> MBR partition table, and the [fatfs driver](https://github.com/natevw/fatfs) is missing some functionality and lots of test cases. Please tread with caution and [report any issues](https://github.com/natevw/fatfs/issues) you may encounter!  

###Events
&#x20;<a href="#api-sdcard-on-ready-Fired-when-the-card-interface-has-been-initialized-and-is-ready-to-use-If-the-getFilesystems-option-was-set-this-event-will-wait-to-fire-until-with-a-filesystem-list-like-that-from-the-sdcard-getFilesystems-method-can-be-provided-as-its-argument" name="api-sdcard-on-ready-Fired-when-the-card-interface-has-been-initialized-and-is-ready-to-use-If-the-getFilesystems-option-was-set-this-event-will-wait-to-fire-until-with-a-filesystem-list-like-that-from-the-sdcard-getFilesystems-method-can-be-provided-as-its-argument">#</a> sdcard<b>.on</b>( 'ready')  
Fired when the card interface has been initialized and is ready to use. If the getFilesystems option was set, this event will wait to fire until with a filesystem list (like that from the sdcard.getFilesystems method) can be provided as its argument.  

&#x20;<a href="#api-sdcard-on-error-Fired-if-the-card-interface-or-any-filesystems-if-requested-could-not-become-ready" name="api-sdcard-on-error-Fired-if-the-card-interface-or-any-filesystems-if-requested-could-not-become-ready">#</a> sdcard<b>.on</b>( 'error')  
Fired if the card interface (or any filesystems, if requested) could not become ready.  

&#x20;<a href="#api-sdcard-on-inserted-If-the-watchCard-option-is-set-this-event-will-be-fired-when-the-card-has-been-physically-inserted-communications-probably-not-initialized-yet" name="api-sdcard-on-inserted-If-the-watchCard-option-is-set-this-event-will-be-fired-when-the-card-has-been-physically-inserted-communications-probably-not-initialized-yet">#</a> sdcard<b>.on</b>( 'inserted')  
If the watchCard option is set, this event will be fired when the card has been physically inserted (communications probably not initialized yet!)  

&#x20;<a href="#api-sdcard-on-removed-If-the-watchCard-option-is-set-this-event-will-be-fired-when-the-card-has-been-physically-removed" name="api-sdcard-on-removed-If-the-watchCard-option-is-set-this-event-will-be-fired-when-the-card-has-been-physically-removed">#</a> sdcard<b>.on</b>( 'removed' )  
 If the watchCard option is set, this event will be fired when the card has been physically removed.  

###Options for `sdcard.use`
These flags can be provided via an `opts` object to `sdcard.use`:

&#x20;<a href="#api-sdcard-use-getFilesystems-If-set-to-true-the-ready-event-will-be-delayed-until-filesystems-have-been-fetched-See-event-documentation-for-details-Defaults-to-false" name="api-sdcard-use-getFilesystems-If-set-to-true-the-ready-event-will-be-delayed-until-filesystems-have-been-fetched-See-event-documentation-for-details-Defaults-to-false">#</a> <b>getFilesystems</b>  
If set to true, the 'ready' event will be delayed until filesystems have been fetched. (See event documentation for details.) Defaults to false.  

&#x20;<a href="#api-sdcard-use-waitForCard-When-true-the-default-the-library-will-wait-for-a-card-to-be-physically-inserted-before-proceeding-with-initialization-If-set-to-false-then-an-error-will-be-emitted-if-a-card-is-not-immediately-detected-via-the-sense-pin" name="api-sdcard-use-waitForCard-When-true-the-default-the-library-will-wait-for-a-card-to-be-physically-inserted-before-proceeding-with-initialization-If-set-to-false-then-an-error-will-be-emitted-if-a-card-is-not-immediately-detected-via-the-sense-pin">#</a> <b>waitForCard</b>  
When true (the default), the library will wait for a card to be physically inserted before proceeding with initialization. If set to false, then an error will be emitted if a card is not immediately detected via the sense pin. 

&#x20;<a href="#api-sdcard-use-watchCard-If-set-to-true-your-script-will-never-finish-but-the-instance-will-emit-the-inserted-and-removed-events-as-documented-above-Defaults-to-false" name="api-sdcard-use-watchCard-If-set-to-true-your-script-will-never-finish-but-the-instance-will-emit-the-inserted-and-removed-events-as-documented-above-Defaults-to-false">#</a> <b>watchCard</b>  
If set to true, your script will never finish but the instance will emit the 'inserted' and 'removed' events as documented above. Defaults to false.  

###Further Examples
See the examples folder for code.

* [Offset Read/Write](https://github.com/tessel/sdcard/blob/master/examples/offset_rw.js) More advanced example of read/write functionality.

* [Multiple Block Read/Write](https://github.com/tessel/sdcard/blob/master/examples/test_multi.js). Demonstrates multiple block read/write. 

* [Timed MicroSD](https://github.com/tessel/sdcard/blob/master/examples/timed_microsd.js). This MicroSD card example writes a text file to the sd card, then reads the file to the console. 

###Advanced Information
####Low level (raw) API

&#x20;<a href="#api-sdcard-readBlock-i-cb-reads-the-i-th-block-of-data-Callback-receives-up-to-two-arguments-error-data-note-that-if-error-is-not-null-then-the-value-of-the-data-parameter-is-undetermined" name="api-sdcard-readBlock-i-cb-reads-the-i-th-block-of-data-Callback-receives-up-to-two-arguments-error-data-note-that-if-error-is-not-null-then-the-value-of-the-data-parameter-is-undetermined">#</a> sdcard<b>.readBlock</b>( i, cb)  
Reads the ith block of data. Callback receives up to two arguments (error, data), note that if error is not null then the value of the data parameter is undetermined.  

&#x20;<a href="#api-sdcard-readBlocks-i-buffer-cb-starting-at-the-i-th-block-reads-multiple-blocks-into-buffer-and-calls-cb-err-bytesRead-buffer-when-done-For-large-contiguous-reads-this-can-be-more-efficient-than-multiple-sdcard-readBlock-calls-The-destination-buffer-s-length-need-not-be-an-integer-multiple-of-sdcard-BLOCK_SIZE-any-extra-data-from-the-final-block-will-simply-be-discarded-Right-now-bytesRead-will-always-equal-buffer-length-and-you-are-responsible-for-not-reading-off-the-end-of-the-card-This-may-change-in-the-future-to-do-a-partial-read-instead" name="api-sdcard-readBlocks-i-buffer-cb-starting-at-the-i-th-block-reads-multiple-blocks-into-buffer-and-calls-cb-err-bytesRead-buffer-when-done-For-large-contiguous-reads-this-can-be-more-efficient-than-multiple-sdcard-readBlock-calls-The-destination-buffer-s-length-need-not-be-an-integer-multiple-of-sdcard-BLOCK_SIZE-any-extra-data-from-the-final-block-will-simply-be-discarded-Right-now-bytesRead-will-always-equal-buffer-length-and-you-are-responsible-for-not-reading-off-the-end-of-the-card-This-may-change-in-the-future-to-do-a-partial-read-instead">#</a> sdcard<b>.readBlocks</b>( i, buffer, cb)  
Starting at the ith block, reads multiple blocks into buffer and calls cb(err, bytesRead, buffer) when done. For large contiguous reads, this can be more efficient than multiple sdcard.readBlock calls.  The destination buffer's length need not be an integer multiple of sdcard.BLOCK_SIZE; any extra data from the final block will simply be discarded. [Right now, bytesRead will always equal buffer.length and you are responsible for not reading off the end of the card. This may change in the future to do a partial read instead.]  

&#x20;<a href="#api-sdcard-writeBlock-i-data-cb-overwrites-the-i-th-block-with-data-which-must-be-exactly-512-bytes-long-Callback-is-given-error-which-will-be-null-if-the-write-was-successful-Note-that-at-the-card-level-a-single-block-write-usually-requires-a-full-read-erase-rewrite-operation-against-an-entire-page-of-blocks-see-sdcard-writeBlocks-if-you-are-writing-several-contiguous-blocks-of-data" name="api-sdcard-writeBlock-i-data-cb-overwrites-the-i-th-block-with-data-which-must-be-exactly-512-bytes-long-Callback-is-given-error-which-will-be-null-if-the-write-was-successful-Note-that-at-the-card-level-a-single-block-write-usually-requires-a-full-read-erase-rewrite-operation-against-an-entire-page-of-blocks-see-sdcard-writeBlocks-if-you-are-writing-several-contiguous-blocks-of-data">#</a> sdcard<b>.writeBlock</b>( i, data, cb)  
Overwrites the ith block with data, which must be exactly 512 bytes long. Callback is given (error), which will be null if the write was successful. Note that at the card level, a single block write usually requires a full read/erase/rewrite operation against an entire page of blocks — see sdcard.writeBlocks if you are writing several contiguous blocks of data.  

&#x20;<a href="#api-sdcard-writeBlocks-i-data-cb-starting-at-the-i-th-block-first-erases-and-then-overwrites-multiple-blocks-with-the-contents-of-buffer-calling-cb-err-when-done-The-length-of-data-must-be-an-integer-multiple-of-sdcard-BLOCK_SIZE-This-call-is-significantly-more-efficient-than-sdcard-writeBlock-for-any-size-contiguous-writes" name="api-sdcard-writeBlocks-i-data-cb-starting-at-the-i-th-block-first-erases-and-then-overwrites-multiple-blocks-with-the-contents-of-buffer-calling-cb-err-when-done-The-length-of-data-must-be-an-integer-multiple-of-sdcard-BLOCK_SIZE-This-call-is-significantly-more-efficient-than-sdcard-writeBlock-for-any-size-contiguous-writes">#</a> sdcard<b>.writeBlocks</b>( i, data, cb)  
Starting at the ith block, first erases and then overwrites multiple blocks with the contents of buffer, calling cb(err) when done. The length of data **must** be an integer multiple of sdcard.BLOCK_SIZE. This call is *significantly* more efficient than sdcard.writeBlock for any size contiguous writes.   

**TBD**: expose atomic .modifyBlock helper?

**TBD**: expose how many blocks the card has available!

&#x20;<a href="#api-sdcard-BLOCK_SIZE-currently-this-will-always-be-512-However-for-more-self-documenting-code-or-for-compatibility-with-potential-not-necessarily-planned-a-future-backwards-incompatible-major-version-of-this-code-you-may-wish-to-use-this-property" name="api-sdcard-BLOCK_SIZE-currently-this-will-always-be-512-However-for-more-self-documenting-code-or-for-compatibility-with-potential-not-necessarily-planned-a-future-backwards-incompatible-major-version-of-this-code-you-may-wish-to-use-this-property">#</a> sdcard.<b>BLOCK_SIZE</b>  
Currently, this will always be 512. However, for more self-documenting code or for compatibility with (potential, not necessarily planned) a future backwards-incompatible major version of this code, you may wish to use this property.  

Note that all read/write requests are serialized internally. So it is okay to request a block read immediately after starting a write request to the same block; your read will see the data from your write. *However* note that this serialization is on a request-by-request basis and e.g. if you write updated block data in a read callback **you** are responsible for making sure no other conflicting writes have been queued for that particular block in the meantime!

(**TBD**: No caching is currently done, but individual block writes are very inefficient and so a cache be added in the future. The semantics of the above commands would not change, except that you could not count on the card having the data your callbacks think it has until an explicit request to flush had completed. Likely such a cache would be implemented as a separate wrapper around the core, or at least opt-in; I'll commit to changing the major version number if such a cache were to become the default behavior.)

**TBD**: helper methods that expose partition / FAT modules?

###License
© 2014 Nathan Vander Wilt.
Funding for this work was provided by Technical Machine, Inc.

BSD-2-Clause, MIT, or Apache-2.0 at your option.

