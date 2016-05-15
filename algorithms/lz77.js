var _utils = require('../utils.js');

var HEADER_A = 72;
var HEADER_B = 72;
var HEADER_C = 2;

function LZ77() {

}

function pushIntoBuffer(b, v) {
	if (b.length > 8096) {
		b.shift();
	}
	b.push(v);
}

function findInBuffer(b, w) {
	for (var i = 0; i < b.length; i++) {
		var fpos = i;
		for (var j = 0; j < w.length; j++) {
			if (i + j >= b.length) {
				fpos = -1;
				break;
			}
			if (w[j] !== b[i + j]) {
				fpos = -1;
				break;
			}
		}
		if (fpos !== -1)
			return fpos;
	}
	return null;
}

function compress(result, buffer, searchBuffer) {
	var pb = new _utils.ProgressBar(searchBuffer.length / 1000, 20, "LZ77: compressing");
	var triplets = 0;
	pb.run(function(updater) {
		var rb = 0;
		while (rb < searchBuffer.length) {
			var orb = Math.floor(rb / 1000);

			for (var i = Math.min(32, (searchBuffer.length - 1) - rb); i >= 0; i--) {
				if (i === 0) {
					result.uwrite16(0);
					result.uwrite(0);
					result.uwrite(searchBuffer[rb++]);
					pushIntoBuffer(buffer, searchBuffer[rb - 1]);
				} else {
					var window = [];
					for (var j = 0; j < i; j++) {
						window.push(searchBuffer[rb + j]);
					}
					var position = findInBuffer(buffer, window);
					if (position === null)
						continue;
					for (j = 0; j < i; j++) {
						pushIntoBuffer(buffer, searchBuffer[rb++]);
					}

					result.uwrite16(position);
					result.uwrite(window.length);
					result.uwrite(searchBuffer[rb++]);
					pushIntoBuffer(buffer, searchBuffer[rb - 1]);

					break;
				}
			}
			var orb2 = Math.floor(rb / 1000);
			if (orb2 > orb) updater();
			++triplets;
		}
	});
	console.log("Written out " + triplets + " triplets");
	return triplets;
}

LZ77.prototype.compress = function(udata) {
	var data = new _utils.DynamicBuffer();
	data.uwrite(HEADER_A);
	data.uwrite(HEADER_B);
	data.uwrite(HEADER_C);
	data.uwrite(0);
	data.uwrite(0);
	data.uwrite(0);
	data.uwrite(0);
	var cnt = compress(data, [], udata);
	var resultBuffer = data.getBuffer();
	resultBuffer.writeUInt32LE(cnt, 3);
	console.log("Compression finished: compressed from " + udata.length + " bytes to " + resultBuffer.length + " bytes (" +
		(100.0 / udata.length) * resultBuffer.length + "%)");
	return resultBuffer;
};

LZ77.prototype.decompress = function(cdata) {
	var data = new _utils.DynamicBuffer();
	var triplets = cdata.readUInt32LE(3);
	var pb = new _utils.ProgressBar(triplets, 20, "LZ77: decompressing");
	var buffer = [];
	pb.run(function(updater) {
		var bufferOffset = 7;
		for (var _ = 0; _ < triplets; _++) {
			var start = cdata.readUInt16LE(bufferOffset);
			var len = cdata.readUInt8(bufferOffset + 2);
			var char = cdata.readUInt8(bufferOffset + 3);
			var pushd = [];
			bufferOffset += 4;
			for (var i = start; i < len + start; i++) {
				pushd.push(buffer[i]);
			}
			pushd.push(char);

			for (var j = 0; j < pushd.length; j++) {
				data.uwrite(pushd[j]);
				pushIntoBuffer(buffer, pushd[j]);
			}
			updater();
		}
	});
	var resultBuffer = data.getBuffer();
	console.log("Decompression finished: decompressed from " + cdata.length + " bytes to " + resultBuffer.length + " bytes");
	return resultBuffer;
};

function LZ77Factory() {

}

LZ77Factory.prototype.instance = function() {
	return new LZ77();
};

exports.register = function(am) {
	am.lz77 = {
		name: 'LZ77',
		algorithmFactory: new LZ77Factory(),
		header: [HEADER_A, HEADER_B, HEADER_C],
	};
};
