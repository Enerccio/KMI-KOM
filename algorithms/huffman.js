var _utils = require('../utils.js');
var FastPriorityQueue = require("fastpriorityqueue");

var HEADER_A = 72;
var HEADER_B = 72;
var HEADER_C = 1;

function Huffman() {

}

function generateFrequencies(data) {
	var rfreq = [];
	for (var i = 0; i < 256; i++) {
		rfreq[i] = 0;
	}
	var total = 0;
	var pb = new _utils.ProgressBar(data.length / 1000, 20, "Huffman-Algorithm: Processing frequencies");
	pb.run(function(updater) {
		for (var i = 0; i < data.length; i++) {
			rfreq[data[i]] += 1;
			++total;
			if (i % 1000 === 0)
				updater();
		}
	});
	for (i = 0; i < 256; i++) {
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
		v = v.split('').reverse().join('');
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
	for (var i=0; i<255; i++) {
		if (prefixMap[i] === undefined) {
			data.uwrite(0);
		} else {
			var code = prefixMap[i];
			data.uwrite(code.length);
			for (var j=0; j<code.length; j++)
				data.uwrite(code[j]);
		}
	}
}

function doCompress(prefixMap, udata, cdata) {
	var pb = new _utils.ProgressBar(udata.length / 1000, 20, "Huffman-Algorithm: Compressing");
	pb.run(function(updater) {
		for (var i = 0; i < udata.length; i++) {
			var code = prefixMap[udata[i]];
			for (var j = 0; j < code.length; j++) {
				cdata.writeBit(parseInt(code[j]));
			}
			if (i % 1000 === 0)
				updater();
		}
	});
	cdata.flushBits();
}

Huffman.prototype.compress = function(udata) {
	var data = new _utils.DynamicBuffer();
	data.uwrite(HEADER_A);
	data.uwrite(HEADER_B);
	data.uwrite(HEADER_C);
	var freq = generateFrequencies(udata);
	console.log("Building tree ...");
	var prefixMap = generatePrefixMap(freq);
	savePrefixMap(prefixMap, data);
	doCompress(prefixMap, udata, data);
	var resultBuffer = data.getBuffer();
	console.log("Compression finished: compressed from " + udata.length + " bytes to " + resultBuffer.length + " bytes (" +
		(100.0 / udata.length) * resultBuffer.length + "%)");
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
