var _utils = require('../utils.js');

var HEADER_A = 72;
var HEADER_B = 72;
var HEADER_C = 4;

function LZW() {

}

function findInDictionary(dict, f) {
	for (var i = 0; i < dict.length; i++) {
		if (_utils.arrEq(dict[i], f))
			return i;
	}
	return null;
}

function emptyDict() {
	var d = [];
	for (var i = 0; i < 256; i++) {
		d.push([i]);
	}
	return d;
}

function compress(d, ud, result) {
	var pairs = 0;
	var f = [];
	var ls = 0;
	for (var i = 0; i < ud.length; i++) {
		var x = ud[i];
		f.push(x);
		var search = findInDictionary(d, f);
		if (search === null) {
			result.uwrite16(ls);
			d.push(f);
			if (d.length > 65534) {
				d = emptyDict();
			}
			f = [];
			ls = 0;
			++pairs;
			--i;
		} else {
			ls = search;
			if (i === ud.length - 1) {
				result.uwrite16(ls);
				++pairs;
			}
		}
	}
	return pairs;
}

LZW.prototype.compress = function(udata) {
	var data = new _utils.DynamicBuffer();
	data.uwrite(HEADER_A);
	data.uwrite(HEADER_B);
	data.uwrite(HEADER_C);
	data.uwrite(0);
	data.uwrite(0);
	data.uwrite(0);
	data.uwrite(0);
	dictionary = emptyDict();
	var cnt = compress(dictionary, udata, data);
	console.log("Dictionary size: " + dictionary.length + ", pairs " + cnt);
	var resultBuffer = data.getBuffer();
	resultBuffer.writeUInt32LE(cnt, 3);
	console.log("Compression finished: compressed from " + udata.length + " bytes to " + resultBuffer.length + " bytes (" +
		(100.0 / udata.length) * resultBuffer.length + "%)");
	return resultBuffer;
};

LZW.prototype.decompress = function(cdata) {
	var data = new _utils.DynamicBuffer();
	var pairs = cdata.readUInt32LE(3);
	var pb = new _utils.ProgressBar(pairs, 20, "LZW: decompressing");
	var dict = emptyDict();
	pb.run(function(updater) {
		var bufferOffset = 7;
		for (var l = 0; l < pairs; l++) {
			var idx = cdata.readUInt16LE(bufferOffset);
			bufferOffset += 2;

			var next = null;
			if (l !== (pairs - 1)) {
				next = cdata.readUInt16LE(bufferOffset);
			}

			//console.log(require('util').inspect([idx, next, dict], { depth: null }));

			var ne = [];
			for (var i = 0; i < dict[idx].length; i++) {
				data.uwrite(dict[idx][i]);
				ne.push(dict[idx][i]);
			}

			if (next !== null) {
				if (dict[next] === undefined) {
						ne.push(ne[0]);
				} else {
					ne.push(dict[next][0]);
				}
			}

			dict.push(ne);
			if (dict.length > 65534) {
				dict = emptyDict();
			}

			updater();
		}
	});
	var resultBuffer = data.getBuffer();
	console.log("Decompression finished: decompressed from " + cdata.length + " bytes to " + resultBuffer.length + " bytes");
	return resultBuffer;
};

function LZWFactory() {

}

LZWFactory.prototype.instance = function() {
	return new LZW();
};

exports.register = function(am) {
	am.lzw = {
		name: 'LZW',
		algorithmFactory: new LZWFactory(),
		header: [HEADER_A, HEADER_B, HEADER_C],
	};
};
