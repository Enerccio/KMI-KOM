var _utils = require('../utils.js');

var HEADER_A = 72;
var HEADER_B = 72;
var HEADER_C = 0;

function NoCompress() {

}

NoCompress.prototype.compress = function(udata) {
	var data = new _utils.DynamicBuffer();
	data.uwrite(HEADER_A);
	data.uwrite(HEADER_B);
	data.uwrite(HEADER_C);
	for (var i = 0; i < udata.length; i++) {
		data.uwrite(udata[i]);
	}
	var resultBuffer = data.getBuffer();
	console.log("Compression finished: compressed from " + udata.length + " bytes to " + resultBuffer.length + " bytes (" +
		(100.0 / udata.length) * resultBuffer.length + "%)");
	return resultBuffer;
};

NoCompress.prototype.decompress = function(cdata) {
	var data = new _utils.DynamicBuffer();
	for (var i = 3; i < cdata.length; i++) {
		data.uwrite(cdata[i]);
	}
	var resultBuffer = data.getBuffer();
	console.log("Decompression finished: decompressed from " + cdata.length + " bytes to " + resultBuffer.length + " bytes");
	return resultBuffer;
};

function NoCompressFactory() {

}

NoCompressFactory.prototype.instance = function() {
	return new NoCompress();
};

exports.register = function(am) {
	am.nocompress = {
		name: '<no compression algorithm>',
		algorithmFactory: new NoCompressFactory(),
		header: [HEADER_A, HEADER_B, HEADER_C],
	};
};
