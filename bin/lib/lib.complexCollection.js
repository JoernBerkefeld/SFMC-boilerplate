#! /usr/bin/env node
/* eslint-env node */
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const find = require('find');
const jsdoc2md = require('jsdoc-to-markdown');
const color = require('cli-color');

/**
 * does heavy lifting for emails and cloudpages
 *
 * @param {string} configFileType - alias of the file that shall be searched for
 * @param {string} [nameFilter] - allows to only update one specific object
 * @returns {undefined}
 */
function complexCollection(configFileType, nameFilter) {
	let configFileName;
	switch (configFileType) {
		case 'cp':
			configFileName = 'cloudpage.json';
			break;
		case 'e':
			configFileName = 'email.json';
			break;
		default:
			return;
	}
	let ssjsCoreLoaded = false;
	let error = false;
	let cloudPageCounter = 0;
	const configFileNamePlural = configFileName.split('.')[0] + 's';
	console.log('\nsearching for \u001b[36m' + configFileName + '\u001b[0m...');
	const filesArr = find.fileSync(configFileName, process.cwd());
	for (cloudPageCounter = 0; cloudPageCounter < filesArr.length; cloudPageCounter++) {
		const filePath = filesArr[cloudPageCounter];
		error = false;
		// cloudPageCounter++;
		const currentPath = path.dirname(filePath);
		const config = require(filePath);
		if (nameFilter && config.name !== nameFilter) {
			console.error(
				`Skipped '${filePath}' due to not meeting filter criteria: '${config.name}' != '${nameFilter}'`
			);
			continue;
		}
		const currentPage = currentPath.split(process.cwd()).pop();

		console.log(`\n${cloudPageCounter + 1}) ${config.name} ${color.blackBright('- ' + currentPage)}`);
		// create script wrapper
		let output = '';

		output += loadServer(config, currentPath);
		output += loadPublic(config, currentPath);

		if (error) {
			console.log(
				`${color.redBright('Bundle not updated')}: Please fix the above errors and re-run ${color.cyan(
					`sfmc-build ${configFileType} "${config.name}"`
				)}`
			);
		} else {
			output = _prefixBundle(config, currentPage) + output;
			fs.writeFileSync(path.normalize(currentPath + '/' + config.dest), output);
			console.log(color.greenBright('bundle updated successfully'));

			createJsDocMarkdown(currentPath);
		}
	}
	if (cloudPageCounter) {
		console.log(`\nFound ${cloudPageCounter} ${configFileNamePlural}\n`);
	} else {
		console.log(color.redBright('No ' + configFileNamePlural + ' found\n'));
	}

	/**
	 *
	 *
	 * @param {string} content - code in file
	 * @param {Object} config - local configuration
	 * @returns {string} compiled code of file
	 */
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

	/**
	 *
	 *
	 * @param {string} type - identifies the file extension
	 * @param {string} content - code in file
	 * @param {Object} config - local config
	 * @returns {string} the wrapped code
	 */
	function _returnWrapped(type, content, config) {
		switch (type) {
			case 'css':
				return `<style>\n${content}\n</style>\n`;
			case 'js':
				return `<script type="text/javascript">\n${content}\n</script>\n`;
			case 'ssjs':
				return returnSsjsWrap(content, config);
			default:
				return `${content}\n`;
		}
	}

	/**
	 *
	 *
	 * @param {string} content - code in file
	 * @returns {string} code without comments & without charseet definition
	 */
	function _filterComments(content) {
		return content
			.replace(/\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\//g, '') // remove jsdoc comments
			.replace(/\/\*.*\n?.*\*\//g, '') // remove multi-line comments
			.replace(/([ \t\n])\/\/.*/g, '') // remove single-line comments
			.replace(/^\/\/.*/g, '') // remove single-line comments at beginning of file
			.replace(/<!--.*\n?.*-->/g, '') // filter HTML comments
			.replace(/@charset .*;/g, '') // remove CSS file charset
			.replace(/\s\s+/g, ' '); // remove double-spaces
	}

	/**
	 *
	 *
	 * @param {string} currentPath - current email/cloudpage folder
	 * @returns {undefined}
	 */
	function createJsDocMarkdown(currentPath) {
		// JavaScript
		_createJsDocMarkdown(currentPath, '/src/**/*.js', '/docs-js.md');

		// Server-Side JavaScript
		_createJsDocMarkdown(currentPath, '/src/**/*.ssjs', '/docs-ssjs.md');
	}

	/**
	 *
	 *
	 * @param {string} currentPath - current email/cloudpage folder
	 * @param {string} src - sub-path that needs to be searched
	 * @param {string} dest - relative path of output MD
	 * @returns {undefined}
	 */
	function _createJsDocMarkdown(currentPath, src, dest) {
		let output;
		// console.log('cwd', process.cwd());
		const relativeCurrentPath = currentPath.split(process.cwd()).pop();
		// if (relativeCurrentPath.charAt(0) === '/' || relativeCurrentPath.charAt(0) === '\\') {
		// 	relativeCurrentPath = relativeCurrentPath.substr(1);
		// }
		const files = path
			.normalize(relativeCurrentPath + src)
			.split('\\')
			.join('/')
			.substr(1);

		try {
			output = jsdoc2md.renderSync({
				files: files,
				configure: path.resolve(__dirname, '../jsdoc-conf.json')
			});
			console.log(`- Markdown created. ${color.blackBright(files)}`);
			fs.writeFileSync(path.normalize(relativeCurrentPath.substr(1) + dest), output);
		} catch (e) {
			console.log(`${color.red('- No Markdown created')}. ${color.blackBright(files)} not found`);
			output = '';
		}
	}

	/**
	 *
	 *
	 * @param {Object} config - local config
	 * @param {string} currentPath - current email/cloudpage folder
	 * @returns {string} minified file content
	 */
	function loadServer(config, currentPath) {
		let output = '\n' + _prefixFile('SERVER', 'html', true);
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
				.join('\n');
			output += _returnWrapped('ssjs', ssjsLibCode, config);
		}

		// load other libs
		if (d.other && d.other.length) {
			const otherCode = d.other
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
			output += _returnWrapped('other', otherCode, config);
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

	/**
	 *
	 *
	 * @param {Object} config - local config
	 * @param {string} currentPath - current email/cloudpage folder
	 * @returns {string} minified file content
	 */
	function loadPublic(config, currentPath) {
		let output = '\n' + _prefixFile('PUBLIC', 'html');
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

	/**
	 * used in
	 *
	 * @param {string} name - filename that was minified
	 * @param {string} format - normalized file extension
	 * @param {boolean} mainHeadline - switches off the "file: " prefix
	 * @returns {string} file content plus a prefix
	 */
	function _prefixFile(name, format, mainHeadline) {
		let output = '';
		const prefix = mainHeadline ? '' : 'file: ';
		switch (format) {
			case 'html':
				output += `<!-- *** ${prefix}${name} *** -->`;
				break;
			case 'css':
			case 'js':
			case 'ssjs':
				output += `/**** ${prefix}${name} ****/`;
				break;
			case 'amp':
				output += `%%[ /**** ${prefix}${name} ****/ ]%%`;
				break;
			default:
				output += '';
		}
		return '\n' + output + '\n';
	}
	/**
	 * adds standard comments to the top of the bundle
	 *
	 * @param {Object} config - local config
	 * @param {Object} currentPage - relative path
	 * @returns {string} file comments
	 */
	function _prefixBundle(config, currentPage) {
		let output = '%%[\n/*\n';
		output += ` *  bundle created based on ${configFileName} for '${config.name}'\n`;
		output += ` *  @author: ${config.author}\n`;
		output += ` *  @created: ${new Date()
			.toISOString()
			.replace(/T/, ' ')
			.replace(/\..+/, '')} GMT\n`;
		output += ` *  @path: ${currentPage}\n`;

		return output + ' */\n]%%';
	}
}

module.exports = complexCollection;
