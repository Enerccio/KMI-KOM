var _bb = require('bit-buffer');

var _utils = require('../utils.js');
var FastPriorityQueue = require("fastpriorityqueue");

var HEADER_A = 72;
var HEADER_B = 72;
var HEADER_C = 1;

function Huffman() {

}

function generateFrequencies(data) {
	var rfreq = {};
	var total = 0;
	var pb = new _utils.ProgressBar(data.length / 1000, 20, "Huffman-Algorithm: Processing frequencies");
	pb.run(function(updater) {
		for (var i = 0; i < data.length; i++) {
			if (!(data[i] in rfreq))
				rfreq[data[i]] = 0;
			rfreq[data[i]] += 1;
			++total;
			if (i % 1000 === 0)
				updater();
		}
	});
	for (i = 0; i < 256; i++) {
		if (i + "" in rfreq)
			rfreq[i] = (1.0 / total) * rfreq[i];
	}
	return rfreq;
}

function generatePath(k, data, cmp) {
	if (data.byte === k) {
		return cmp;
	} else {
		var ret = null;
		if (data.right !== null) {
			ret = generatePath(k, data.right, cmp + "0");
		}
		if (ret !== null)
			return ret;
		if (data.left !== null)
			return generatePath(k, data.left, cmp + "1");
		return null;
	}
}

function generateNode(data, map) {
	for (var key in map) {
		var v = generatePath(key, data, "");
		v = v.split('').join('');
		map[key] = v;
	}
}

function generatePrefixMap(freqs) {
	var map = {};

	var pq = new FastPriorityQueue(function(a, b) {
		return a[0] < b[0];
	});

	for (var byte in freqs) {
		pq.add(
			[freqs[byte], {
				byte: byte,
				frequency: freqs[byte],
				left: null,
				right: null,
			}]
		);
		map[byte] = "";
	}

	var data = null;
	while (!pq.isEmpty()) {
		data = pq.poll()[1];
		if (pq.isEmpty()) {
			break;
		}
		var right = pq.poll()[1];
		pq.add(
			[data.frequency + right.frequency, {
				byte: null,
				frequency: data.frequency + right.frequency,
				left: data,
				right: right,
			}]
		);
	}
	generateNode(data, map);
	return map;
}

function savePrefixMap(prefixMap, data) {
	for (var i = 0; i < 256; i++) {
		if (prefixMap[i] === undefined) {
			data.uwrite(0);
		} else {
			var code = prefixMap[i];
			data.uwrite(code.length);
			for (var j = 0; j < code.length; j++)
				data.uwrite(code[j]);
		}
	}
}

function doCompress(prefixMap, udata, cdata) {
	var cnt = 0;
	var pb = new _utils.ProgressBar(udata.length / 1000, 20, "Huffman-Algorithm: Compressing");
	pb.run(function(updater) {
		for (var i = 0; i < udata.length; i++) {
			var code = prefixMap[udata[i]];
			cnt += code.length;
			for (var j = 0; j < code.length; j++) {
				cdata.writeBit(parseInt(code[j]));
			}
			if (i % 1000 === 0)
				updater();
		}
	});
	cdata.flushBits();
	return cnt;
}

Huffman.prototype.compress = function(udata) {
	var data = new _utils.DynamicBuffer();
	data.uwrite(HEADER_A);
	data.uwrite(HEADER_B);
	data.uwrite(HEADER_C);
	data.uwrite(0);
	data.uwrite(0);
	data.uwrite(0);
	data.uwrite(0);
	var freq = generateFrequencies(udata);
	console.log("Building tree ...");
	var prefixMap = generatePrefixMap(freq);
	savePrefixMap(prefixMap, data);
	var cnt = doCompress(prefixMap, udata, data);
	var resultBuffer = data.getBuffer();
	console.log("Compression finished: compressed from " + udata.length + " bytes to " + resultBuffer.length + " bytes (" +
		(100.0 / udata.length) * resultBuffer.length + "%)");
	resultBuffer.writeUInt32LE(cnt, 3);
	return resultBuffer;
};

function insertIntoTree(tree, word, data) {
	if (data.length === 0) {
		tree.byte = word;
	} else {
		var bit = data[0];
		data.shift();
		if (bit === 0) {
			if (tree.left === null) {
				tree.left = {
					byte: null,
					left: null,
					right: null,
				};
			}
			insertIntoTree(tree.left, word, data);
		} else {
			if (tree.right === null) {
				tree.right = {
					byte: null,
					left: null,
					right: null,
				};
			}
			insertIntoTree(tree.right, word, data);
		}
	}
}

function loadPrefixMap(c, pos) {
	var word = 0;
	var tree = {
		byte: null,
		left: null,
		right: null,
	};
	for (; word < 256; word++) {
		var len = c[pos++];
		if (len !== 0) {
			var data = [];
			for (var i = 0; i < len; i++) {
				data.push(c[pos++]);
			}
			insertIntoTree(tree, word, data);
		}
	}
	return [tree, pos];
}

function findInTreeRec(tree, data, pos) {
	if (tree === null) {
		throw new Error("Corrupted data " + data);
	}
	if (pos === data.length) {
		return tree.byte;
	}
	var bit = data[pos];
	if (bit === 0) {
		return findInTreeRec(tree.left, data, pos + 1);
	} else {
		return findInTreeRec(tree.right, data, pos + 1);
	}
}

function findInTree(tree, data) {
	return findInTreeRec(tree, data, 0);
}

Huffman.prototype.decompress = function(cdata) {
	var data = new _utils.DynamicBuffer();
	var readCount = cdata.readUInt32LE(3);
	var pos = 7;
	var load = loadPrefixMap(cdata, pos);
	pos = load[1];
	var tree = load[0];

	var bits = new _bb.BitStream(cdata, pos);
	bits._view._view = bits._view._view.slice(pos);

	var pb = new _utils.ProgressBar(readCount / 1000, 20, "Huffman-Algorithm: Decompressing");
	pb.run(function(updater) {
		var bit, byte;
		var cstream = [];
		for (var i = 0; i < readCount; i++) {
			bit = bits.readBits(1, false);
			cstream.push(bit);
			byte = findInTree(tree, cstream);
			if (byte !== null) {
				data.uwrite(byte);
				cstream = [];
			}
			if (i % 1000 === 0) {
				updater();
			}
		}
	});

	var resultBuffer = data.getBuffer();
	console.log("Decompression finished: decompressed from " + cdata.length + " bytes to " + resultBuffer.length + " bytes");
	return resultBuffer;
};

function HuffmanFactory() {

}

HuffmanFactory.prototype.instance = function() {
	return new Huffman();
};

exports.register = function(am) {
	am.huffman = {
		name: 'Huffman-Algorithm',
		algorithmFactory: new HuffmanFactory(),
		header: [HEADER_A, HEADER_B, HEADER_C],
	};
};
