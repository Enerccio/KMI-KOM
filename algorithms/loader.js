var _utils = require('../utils.js');

var algs = {};
require('./nocompress.js').register(algs);
require('./huffman.js').register(algs);
require('./lz77.js').register(algs);
require('./lz78.js').register(algs);
require('./lzw.js').register(algs);

exports.determineAlgorithm = function(stream, dataSetLength) {
	var header = [stream[0], stream[1], stream[2]];
	for (var algKey in algs) {
		if (_utils.arrEq(algs[algKey].header, header)) {
			console.log("Using " + algs[algKey].name + " algorithm to decompress " + dataSetLength + " bytes");
			return algs[algKey].algorithmFactory.instance();
		}
	}
	throw new Error("unknown header");
};

exports.getAlgorithm = function(aname, dataSetLength) {
	if (!(aname in algs)) {
		throw new Error("Algorithm " + aname + " undefined");
	}
	console.log("Using " + algs[aname].name + " algorithm to compress " + dataSetLength + " bytes");
	return algs[aname].algorithmFactory.instance();
};
