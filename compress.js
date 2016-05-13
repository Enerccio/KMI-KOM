var _fs = require('fs');
process.stdout.write = function(data) {
	try {
		_fs.writeSync(1, data);
	} catch (e) {
		process.stdout.write(data);
	}
};

var _util = require('util');

var _utils = require('./utils.js');
var _af = require('./archive_file.js');

var argv = require('yargs')
	.usage('Usage: $0 --alg [algorithm] --dir [direction] input/output\nUsage: $0 --alg [algorithm] --dir c/compress output-file input-path\nUsage: $0 --alg [algorithm] --dir d/decompress/x/extract input-file output-path')
	.demand(['alg', 'dir'])
	.demand(2)
	.argv;

if (argv.dir == 'c' || argv.dir == 'compress') {
	var cf = new _af.ArchiveOutputStream(argv.alg);
	var output = argv._[0];
	var input = argv._[1];
	var dirSource = _utils.walkSync(input, []);
	var pb = new _utils.ProgressBar(dirSource.length, 20, "Loading files");
	pb.run(function(updater) {
		for (var i = 0; i < dirSource.length; i++) {
			cf.addFile(dirSource[i], input);
			updater();
		}
	});
	cf.compress(output);
} else if (argv.dir == 'd' || argv.dir == 'x' || argv.dir == 'extract' || argv.dir == 'decompress') {
	var output = argv._[1];
	var input = argv._[0];
	var df = new _af.ArchiveInputStream(input);
	df.openSync();
	df.decompress(output);
} else {
	throw new Error("--dir argument must be c, compress or d, x, extract or decompress");
}
