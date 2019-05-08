#! /usr/bin/env node
/* eslint-env node */

const fs = require('fs');
const path = require('path');
const find = require('find');
let ssjsCoreLoaded = false;
let error = false;
let cloudPageCounter = 0;
console.log('\nsearching for \u001b[36mcloudpage.json\u001b[0m...');
const filesArr = find.fileSync('cloudpage.json', process.cwd());
for (cloudPageCounter = 0; cloudPageCounter < filesArr.length; cloudPageCounter++) {
	const filePath = filesArr[cloudPageCounter];
	error = false;
	// cloudPageCounter++;
	const currentPath = path.dirname(filePath);
	const config = require(filePath);
	const currentPage = currentPath.split(process.cwd()).pop();

	console.log(`\n- ${currentPage}`);
	// create script wrapper
	let output = '';

	output += loadServer(config, currentPath);
	output += loadPublic(config, currentPath);

	if (error) {
		console.log(
			`\u001b[31mBundle not updated\u001b[0m: Please fix the above errors and re-run for \u001b[33m${currentPage}\u001b[0m`
		);
	} else {
		fs.writeFileSync(path.normalize(currentPath + '/' + config.dest), output);
		console.log('\u001b[32mbundle updated successfully\u001b[0m');
	}
}
if (cloudPageCounter) {
	console.log(`\nFound ${cloudPageCounter} cloudpages\n`);
} else {
	console.log('\u001b[31mNo cloudpages found\u001b[0m\n');
}

function returnSsjsWrap(content, config) {
	let output = '<script runat="server"';
	if (config.server.scriptAttributes) {
		for (const el in config.server.scriptAttributes) {
			if (config.server.scriptAttributes.hasOwnProperty(el)) {
				const value = config.server.scriptAttributes[el];
				output += ` ${el}="${value}"`;
			}
		}
	}
	output += '>\n';
	if (!ssjsCoreLoaded) {
		output += `Platform.Load("core", "${config.server.coreVersion}");\n`;
		ssjsCoreLoaded = true;
	}
	output += content;
	output += '\n</script>\n';

	// console.log('\n');
	// console.log('prefix: ', output);

	return output;
}
function _returnWrapped(type, content, config) {
	switch (type) {
		case 'css':
			return `\n<style>\n${content}\n</style>\n`;
		case 'js':
			return `\n<script type="text/javascript">\n${content}\n</script>\n`;
		case 'ssjs':
			return returnSsjsWrap(content, config);
		default:
			return `\n${content}\n`;
	}
}

function _filterComments(content) {
	return content
		.replace(/\/\*\*\s*\n([^\*]|(\*(?!\/)))*\*\//g, '') // remove jsdoc comments
		.replace(/\/\*.*\n?.*\*\//g, '') // remove multi-line comments
		.replace(/([ \t\n])\/\/.*/g, '') // remove single-line comments
		.replace(/^\/\/.*/g, '') // remove single-line comments at beginning of file
		.replace(/<!--.*\n?.*-->/g, '') // filter HTML comments
		.replace(/@charset .*;/g, '') // remove CSS file charset
		.replace(/\s\s+/g, ' '); // remove double-spaces
}
function loadServer(config, currentPath) {
	let output = '';
	const d = config.server.dependencies;
	const src = config.server.src;

	// load SSJS libs
	if (d.ssjs && d.ssjs.length) {
		const ssjsLibCode = d.ssjs
			.map(f => {
				const thisPath = path.normalize(currentPath + '/src/' + f);
				if (!fs.existsSync(thisPath)) {
					console.log(
						'\u001b[31mFile not found\u001b[0m (\u001b[33mserver.dependencies.ssjs\u001b[0m): ' + f
					);
					error = true;
					return '';
				}
				return (
					_prefixFile(f, 'ssjs') +
					_filterComments(
						fs
							.readFileSync(thisPath)
							.toString()
							.trim()
					)
				);
			})
			.join('\n/******************/\n');
		output += _returnWrapped('ssjs', ssjsLibCode, config);
	}

	// load other libs
	if (d.other && d.other.length) {
		output += d.other
			.map(f => {
				const thisPath = path.normalize(currentPath + '/src/' + f);
				if (!fs.existsSync(thisPath)) {
					console.log(
						'\u001b[31mFile not found\u001b[0m (\u001b[33mserver.dependencies.other\u001b[0m): ' + f
					);
					error = true;
					return '';
				}
				return (
					_prefixFile(f, 'html') +
					_filterComments(
						fs
							.readFileSync(path.normalize(currentPath + '/src/' + f))
							.toString()
							.trim()
					)
				);
			})
			.join('\n');
	}

	// load server
	if (src && src.length) {
		output += src
			.map(f => {
				const thisPath = path.normalize(currentPath + '/src/' + f);
				if (!fs.existsSync(thisPath)) {
					console.log('\u001b[31mFile not found\u001b[0m (\u001b[33mserver.src\u001b[0m): ' + f);
					error = true;
					return '';
				}
				const ext = f.split('.').pop();
				return (
					_prefixFile(f, ext) +
					_returnWrapped(
						ext,
						_filterComments(
							fs
								.readFileSync(path.normalize(currentPath + '/src/' + f))
								.toString()
								.trim()
						),
						config
					)
				);
			})
			.join('\n');
	}
	return output;
}

function loadPublic(config, currentPath) {
	let output = '';
	const pub = config.public;
	if (pub && pub.length) {
		output += pub
			.map(f => {
				const thisPath = path.normalize(currentPath + '/src/' + f);
				if (!fs.existsSync(thisPath)) {
					console.log('\u001b[31mFile not found\u001b[0m (\u001b[33mpublic[]\u001b[0m): ' + f);
					error = true;
					return '';
				}
				const ext = f.split('.').pop();
				return (
					_prefixFile(f, 'html') +
					_returnWrapped(
						ext,
						_filterComments(
							fs
								.readFileSync(path.normalize(currentPath + '/src/' + f))
								.toString()
								.trim()
						),
						config
					)
				);
			})
			.join('\n');
	}
	return output;
}

function _prefixFile(name, format) {
	let output = '';
	switch (format) {
		case 'html':
			output += `<!-- *** file: ${name} *** -->`;
			break;
		case 'css':
		case 'js':
		case 'ssjs':
			output += `/**** file: ${name} ****/`;
			break;
		case 'amp':
			output += `%%[ /**** file: ${name} ****/ ]%%`;
			break;
		default:
			output += '';
	}
	return '\n' + output + '\n';
}
