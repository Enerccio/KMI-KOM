var _fs = require('fs');
var _path = require('path');

var _utils = require('./utils.js');
var _algs = require('./algorithms/loader.js');

var DIRECTORY_TYPE = 0;
var FILE_TYPE = 1;

function ArchiveInputStream(path) {
	this.path = path;
	this.stream = null;
	this.decompressed_data = null;
}
exports.ArchiveInputStream = ArchiveInputStream;

ArchiveInputStream.prototype.open = function(callback) {
	var that = this;
	fs.readFile(that.path, function(err, data) {
		if (err) {
			process.nextTick(callback, err);
			return;
		}
		that.stream = data;
		that._process();
		process.nextTick(callback);
	});
};

ArchiveInputStream.prototype.openSync = function() {
	this.stream = _fs.readFileSync(this.path);
	this._process();
};

ArchiveInputStream.prototype._process = function() {
	var algorithm = _algs.determineAlgorithm(this.stream, this.stream.length);
	this.uncompressed_data = algorithm.decompress(this.stream);
};

ArchiveInputStream.prototype.decompress = function(path) {
	var that = this;
	var pos = 0;
	var binary = new Buffer(4);
	for (var i = 0; i < 4; i++) {
		binary[i] = this.uncompressed_data[i + pos];
	}
	pos += 4;
	var flen = binary.readUInt32LE(0);

	var pb = new _utils.ProgressBar(flen, 20, "Decompressing files and directories");
	pb.run(function(updater) {
		while (pos < that.uncompressed_data.length) {
			var type = that.uncompressed_data[pos++];
			if (type == DIRECTORY_TYPE) {
				pos = that.decompressDirectory(path, pos);
			} else {
				pos = that.decompressFile(path, pos);
			}
			updater();
		}
	});
};

ArchiveInputStream.prototype.decompressDirectory = function(path, pos) {
	var data = this.decompressFileName(pos);
	var filename = data[0];
	pos = data[1];
	_fs.mkdirSync(_path.join(path, filename));
	return pos;
};

ArchiveInputStream.prototype.decompressFile = function(path, pos) {
	var data = this.decompressFileName(pos);
	var filename = data[0];
	pos = data[1];
	var binary = new Buffer(4);
	for (var i = 0; i < 4; i++) {
		binary[i] = this.uncompressed_data[i + pos];
	}
	pos += 4;
	var size = binary.readUInt32LE(0);
	var fd = _fs.openSync(_path.join(path, filename), "w");
	_fs.writeSync(fd, this.uncompressed_data, pos, size);
	_fs.closeSync(fd);
	return pos + size;
};

ArchiveInputStream.prototype.decompressFileName = function(pos) {
	var binary = new Buffer(4);
	for (var i = 0; i < 4; i++) {
		binary[i] = this.uncompressed_data[i + pos];
	}
	pos += 4;
	var count = binary.readUInt32LE(0);
	binary = new Buffer(count);
	for (i = 0; i < count; i++) {
		binary[i] = this.uncompressed_data[i + pos];
	}
	pos += count;
	return [binary.toString(), pos];
};

function ArchiveOutputStream(algorithm) {
	this.compressed = {};
	this.uncompressed_data = new _utils.DynamicBuffer();
	this.uncompressed_data.uwrite(0);
	this.uncompressed_data.uwrite(0);
	this.uncompressed_data.uwrite(0);
	this.uncompressed_data.uwrite(0);
	this.algorithm = algorithm;
	this.count = 0;
}
exports.ArchiveOutputStream = ArchiveOutputStream;

ArchiveOutputStream.prototype.addFile = function(file, base) {
	if (!_fs.existsSync(file)) {
		throw new Error("file " + file + " does not exists");
	}
	var stats = _fs.statSync(file);
	if (stats.isDirectory()) {
		this._addDirectoryToStream(file, base);
	} else {
		this._addFileToStream(file, base);
	}
};

ArchiveOutputStream.prototype._addDirectoryToStream = function(path, base) {
	this.uncompressed_data.uwrite(DIRECTORY_TYPE);
	this._addPathName(path, base);
};

ArchiveOutputStream.prototype._addFileToStream = function(path, base) {
	this.uncompressed_data.uwrite(FILE_TYPE);
	this._addPathName(path, base);
	var readBuffer = _fs.readFileSync(path);
	var count = readBuffer.length;
	var binary = new Buffer(4);
	binary.writeUInt32LE(count, 0);
	for (i = 0; i < 4; i++) {
		this.uncompressed_data.uwrite(binary[i]);
	}
	for (var i = 0; i < readBuffer.length; i++) {
		this.uncompressed_data.uwrite(readBuffer[i]);
	}
};

ArchiveOutputStream.prototype._addPathName = function(path, base) {
	path = path.substr(base.length + 1);
	var count = path.length;
	var binary = new Buffer(4);
	var i;
	binary.writeUInt32LE(count, 0);
	for (i = 0; i < 4; i++) {
		this.uncompressed_data.uwrite(binary[i]);
	}
	for (i = 0; i < count; i++) {
		this.uncompressed_data.uwrite(path.charCodeAt(i));
	}
	++this.count;
};

ArchiveOutputStream.prototype.compress = function(of) {
	var algorithm = _algs.getAlgorithm(this.algorithm, this.uncompressed_data.length);
	var packed = this.uncompressed_data.getBuffer();
	packed.writeUInt32LE(this.count, 0);
	var data = algorithm.compress(packed);
	var fd = _fs.openSync(of, 'w');
	_fs.writeSync(fd, data, 0, data.length, 0);
};
