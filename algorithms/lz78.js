var _utils = require('../utils.js');

var HEADER_A = 72;
var HEADER_B = 72;
var HEADER_C = 3;

function LZ78() {

}

function findInDictionary(dict, f) {
	for (var i = 0; i < dict.length; i++) {
		if (_utils.arrEq(dict[i], f))
			return i;
	}
	return null;
}

function compress(d, ud, result) {
	var pb = new _utils.ProgressBar(ud.length / 1000, 20, "LZ78: compressing");
	var pairs = 0;
	var empty = false;
	pb.run(function(updater) {
		var f = [];
		var ls = 0;
		for (var i = 0; i < ud.length; i++) {
			var x = ud[i];
			f.push(x);
			var search = findInDictionary(d, f);
			if (search === null) {
				result.uwrite16(ls);
				result.uwrite(x);
				d.push(f);
				if (d.length > 65534) {
					d = [""];
				}
				f = [];
				ls = 0;
				++pairs;
			} else {
				ls = search;
				if (i === ud.length - 1) {
					empty = true;
					result.uwrite16(ls);
					++pairs;
				}
			}
			if (i % 1000 === 0) updater();
		}
	});
	return [pairs, empty];
}

LZ78.prototype.compress = function(udata) {
	var data = new _utils.DynamicBuffer();
	data.uwrite(HEADER_A);
	data.uwrite(HEADER_B);
	data.uwrite(HEADER_C);
	data.uwrite(0);
	data.uwrite(0);
	data.uwrite(0);
	data.uwrite(0);
	data.uwrite(0);
	dictionary = [
		[]
	];
	var res = compress(dictionary, udata, data);
	var cnt = res[0];
	var empty = res[1];
	console.log("Dictionary size: " + dictionary.length + ", pairs " + cnt);
	var resultBuffer = data.getBuffer();
	resultBuffer.writeUInt32LE(cnt, 3);
	if (empty) {
		resultBuffer.writeUInt8(1, 7);
	}
	console.log("Compression finished: compressed from " + udata.length + " bytes to " + resultBuffer.length + " bytes (" +
		(100.0 / udata.length) * resultBuffer.length + "%)");
	return resultBuffer;
};

LZ78.prototype.decompress = function(cdata) {
	var data = new _utils.DynamicBuffer();
	var pairs = cdata.readUInt32LE(3);
	var empty = cdata.readUInt8(7) === 1;
	var pb = new _utils.ProgressBar(pairs, 20, "LZ78: decompressing");
	var dict = [""];
	pb.run(function(updater) {
		var bufferOffset = 8;
		for (var l = 0; l < pairs; l++) {
			var idx = cdata.readUInt16LE(bufferOffset);
			bufferOffset += 2;

			var char;
			if (l !== (pairs - 1) || !empty) {
				char = cdata.readUInt8(bufferOffset++);
			}

			var ne = [];
			for (var i = 0; i < dict[idx].length; i++) {
				data.uwrite(dict[idx][i]);
				ne.push(dict[idx][i]);
			}

			if (l !== (pairs - 1) || !empty) {
				ne.push(char);
				data.uwrite(char);
			}

			dict.push(ne);
			if (dict.length > 65534) {
				dict = [""];
			}

			updater();
		}
	});
	var resultBuffer = data.getBuffer();
	console.log("Decompression finished: decompressed from " + cdata.length + " bytes to " + resultBuffer.length + " bytes");
	return resultBuffer;
};

function LZ78Factory() {

}

LZ78Factory.prototype.instance = function() {
	return new LZ78();
};

exports.register = function(am) {
	am.lz78 = {
		name: 'LZ78',
		algorithmFactory: new LZ78Factory(),
		header: [HEADER_A, HEADER_B, HEADER_C],
	};
};
