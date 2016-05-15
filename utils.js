var _fs = require('fs');
var _path = require('path');

function ProgressBar(total, displayLen, prompt) { /**class*/
	this.prompt = prompt;
	this.total = total;
	this.displayLen = displayLen;
	this.perctf = 100.0 / total;
	this.displayf = 100.0 / displayLen;
	this.percprog = 0;
	this.displayprog = 0;

	this.laststr = "";
	this.dots = "";
	this.cpgrinc = 0;
	this.lastdisplayc = 0;
}

ProgressBar.prototype.update = function() {
	this.percprog += this.perctf;
	this.displayprog += this.perctf;
	if (this.displayprog > this.displayf) {
		this.dots += ".";
		this.displayprog = 0;
	}
	this.cpgrinc = (this.cpgrinc + 1) % 4;

	this.clear();
	this.laststr = this.prompt + " [" + this.dots;
	this.write(this.laststr + " " +
		this.percprog.toFixed() + "%] " + this.indicator());
};

ProgressBar.prototype.clear = function() {
	var str = "";
	for (var i = 0; i < this.lastdisplayc; i++) {
		str += "\b";
	}
	process.stdout.write(str);
};

ProgressBar.prototype.write = function(data) {
	process.stdout.write(data);
	this.lastdisplayc = data.length;
};

ProgressBar.prototype.indicator = function() {
	switch (this.cpgrinc) {
		case 0:
			return "-";
		case 1:
			return "\\";
		case 2:
			return "|";
		case 3:
			return "/";
	}
};

ProgressBar.prototype.run = function(callback) {
	var that = this;
	callback(function() {
		that.update();
	});
	this.clear();
	process.stdout.write(this.laststr + "] 100% Finished\n");
};

ProgressBar.prototype.runAsync = function(callback) {
	var that = this;
	callback(function() {
		that.update();
	}, function() {
		that.clear();
		process.stdout.write(that.laststr + "] 100% Finished\n");
	});
};
exports.ProgressBar = ProgressBar;

exports.walkSync = function(dir, filelist) {
	var files = _fs.readdirSync(dir);
	filelist = filelist || [];
	files.forEach(function(file) {
		var fp = _path.join(dir, file);
		filelist.push(fp);
		if (_fs.statSync(fp).isDirectory()) {
			filelist = exports.walkSync(fp, filelist);
		}
	});
	return filelist;
};

exports.packageData = function(array) {
	var buffer = new Buffer(array.length, "binary");
	for (i = 0; i < array.length; i++) {
		buffer[i] = array[i];
	}
	return buffer;
};

var DEFAULT_SIZE = 512,
	DEFAULT_FACTOR = 2.0;

/**
 * constructor, takes a starting size for the underlying buffer
 * and a factor, in which the buffer grows, if it gets to small.
 * Both have defaults (512 and 2.0).
 */
var DynamicBuffer = module.exports.DynamicBuffer = function(_size, _factor) {
	this.length = 0;
	this.buffer = new Buffer(_size || DEFAULT_SIZE);
	this.resizeFactor = _factor || DEFAULT_FACTOR;
	this.bits = [];
};

/**
 * append a string to the buffer and return it for chaining
 */
DynamicBuffer.prototype.append = function(_string) {
	ensureSize.call(this, _string.length);
	this.buffer.write(_string, this.length);
	this.length += Buffer.byteLength(_string);
	return this;
};

/**
 * append a byte to the buffer and return it for chaining
 */
DynamicBuffer.prototype.write = function(_byte) {
	ensureSize.call(this, 1);
	this.buffer.writeInt8(_byte, this.length);
	this.length += 1;
	return this;
};

DynamicBuffer.prototype.uwrite = function(_byte) {
	ensureSize.call(this, 1);
	this.buffer.writeUInt8(_byte, this.length);
	this.length += 1;
	return this;
};

DynamicBuffer.prototype.uwrite16 = function(_short) {
	ensureSize.call(this, 2);
	this.buffer.writeUInt16LE(_short, this.length);
	this.length += 2;
	return this;
};

/**
 * append a javascript (V8) buffer or DynamicBuffer to this one
 * and return it for chaining
 */
DynamicBuffer.prototype.concat = function(_buffer) {
	var buffer = "DynamicBuffer" === typeof(_buffer) ? _buffer.buffer : _buffer;

	ensureSize.call(this, buffer.length);
	buffer.copy(this.buffer, 0, this.length);
	this.length += buffer.length;
	return this;
};

function bit2byte(bits) {
	bits.reverse();
	var byte = 0;
	for (var i = 0; i < bits.length; i++) {
		var adjoff = 7 - i;
		byte = byte + (bits[i] << adjoff);
	}
	return byte;
}

DynamicBuffer.prototype.writeBit = function(bit) {
	this.bits.push(bit);
	if (this.bits.length === 8) {
		ensureSize.call(this, 1);
		this.uwrite(bit2byte(this.bits));
		this.bits = [];
	}
};

DynamicBuffer.prototype.flushBits = function() {
	ensureSize.call(this, 1);
	this.uwrite(bit2byte(this.bits));
	this.bits = [];
};

/**
 * get a copy of this DynamicBuffer. Changing one of the buffers does
 * not change the other one. Will accept an optional size for the copy.
 * If not given, the new one will be exactly the same as the original.
 */
DynamicBuffer.prototype.clone = function(_newBufferSize, _newResizeFactor) {
	var size = (_newBufferSize && _newBufferSize >= this.length) ? _newBufferSize : this.buffer.length,
		clone = new DynamicBuffer(size, _newResizeFactor || this.resizeFactor);

	clone.concat(this.buffer);
	return clone;
};

/**
 * shrinks this buffer either to the given size, or the length of the current buffer.
 * This method is mainly used to squeeze out the last bytes of memory, or increase the
 * size for large chunks of data to come
 */
DynamicBuffer.prototype.resizeUnderlyingBuffer = function(_size) {
	var oldBuffer = this.buffer;
	this.buffer = new Buffer(_size || this.length);
	oldBuffer.copy(this.buffer);
	return this;
};

/**
 * return a view of the underlying buffer that only contains the written space.
 * Changing that view will change this buffer, too.
 */
DynamicBuffer.prototype.getBuffer = function() {
	return this.buffer.slice(0, this.length);
};

// ----------------------------------------------------- PRIVATES

/**
 * make sure the underlying buffer is large enough to take the given amount of
 * bytes. If it is not, resize it (that will create a new buffer in the background)
 */
function ensureSize(_additionalDataSize) {
	var neededSize = this.length + _additionalDataSize;
	if (this.buffer.length < neededSize) {
		var oldBuffer = this.buffer;
		/* other possibility: take the current buffer length and multiply
		 * it with resizeFactor until it is large enough
		 */
		this.buffer = new Buffer(~~(neededSize * this.resizeFactor));
		oldBuffer.copy(this.buffer);
	}
}

function arrEq(arr1, arr2) {
	for (var i = 0; i < arr1.length; i++)
		if (arr1[i] != arr2[i])
			return false;
	return i == arr2.length;
}
exports.arrEq = arrEq;
