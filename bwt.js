var readline = require('readline');
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: false
});

function bwt(data) {
	data = data + "|";
	var len = data.length;
	var table = [];
	for (var i = 0; i < len; i++) {
		table.push(data);
		data = data[len - 1] + data.substring(0, len - 1);
	}
	table.sort();
	var res = "";
	for (i = 0; i < len; i++) {
		res += table[i][len - 1];
	}
	return res;
}

function inverseBwt(data) {
	var table = [];
	var len = data.length;
	for (var i = 0; i < len; i++) {
		table.push("");
	}
	for (i = 0; i < len; i++) {
		for (var j = 0; j < len; j++) {
			table[j] = data[j] + table[j];
		}
		table.sort();
	}
	for (i = 0; i < len; i++) {
		if (table[i][len - 1] == '|')
			return table[i];
	}
}

rl.on('line', function(line) {
	console.log("BWT:  <" + bwt(line) + ">");
	console.log("BWT Reversed:  <" + inverseBwt(bwt(line)) + ">");
});
