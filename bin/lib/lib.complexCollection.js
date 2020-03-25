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
 * @param {string} [templateName] - allows to only update one specific object
 * @returns {undefined}
 */
function complexCollection(configFileType, nameFilter, templateName) {
    let configFileName;
    switch (configFileType) {
        case 'lib':
            configFileName = 'sfmc-lib.json';
            break;
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
    let cloudPageCounter = 0;
    const configFileNamePlural = configFileName.split('.')[0] + 's';
    console.log('\nsearching for \u001b[36m' + configFileName + '\u001b[0m...');
    const filesArr = find.fileSync(configFileName, process.cwd());
    if (filesArr.length) {
        console.log(`Found ${filesArr.length} ${configFileNamePlural}:`);
    } else {
        console.log(color.redBright('No ' + configFileNamePlural + ' found\n'));
    }
    for (cloudPageCounter = 0; cloudPageCounter < filesArr.length; cloudPageCounter++) {
        _processConfigFile(filesArr, cloudPageCounter, templateName);
    }

    // *********************************************/
    // *********************************************/
    // *********************************************/

    /**
     * iterates over array and outputs all strings in that array via console.log()
     *
     * @param {Array<string>} logArr - log messages
     */
    function _outputLogs(logArr) {
        if ('object' !== typeof logArr) {
            return;
        }
        for (let index = 0; index < logArr.length; index++) {
            console.log(logArr[index]);
        }
    }
    /**
     * make sure the config has the right attributes
     *
     * @param {object} config - config loaded from file
     * @param {Array<string>} logs - list of logs for current item
     * @returns {boolean} - did the log pass the check or not
     */
    function _sanityCheckConfig(config, logs) {
        let testPassed = true;
        if (!config.name) {
            logs.push(color.redBright('Error') + ': config.name missing');
            testPassed = false;
        }
        if (!config.author) {
            logs.push(color.redBright('Error') + ': config.author missing');
            testPassed = false;
        }
        if (
            !config.server ||
            'object' !== typeof config.server ||
            'undefined' !== typeof config.server.length
        ) {
            logs.push(color.redBright('Error') + ': config.server missing or not an object');
            testPassed = false;
        }
        if (
            (!config.public || !config.public.length) &&
            (!config.server.src || !config.server.src.length) &&
            (!config.lib ||
                ((!config.lib.ssjs || !config.lib.ssjs.length) &&
                    (!config.lib.amp || !config.lib.amp.length)))
        ) {
            logs.push(
                color.redBright('Error') +
                    ': config.server.src and config.public missing. Make sure at least one has a link to a file.'
            );
            testPassed = false;
        }
        if (config.server.dependencies.ssjs && !config.server.coreVersion) {
            logs.push(
                color.redBright('Error') +
                    ': config.server.coreVersion missing. Set to "1.1.1" or similar.'
            );
            testPassed = false;
        }

        if (!config.dest) {
            logs.push(
                color.redBright('Error') +
                    ': config.dest missing. Set to "dist/bundle.html" or similar.'
            );
            testPassed = false;
        }
        return testPassed;
    }
    /**
     *
     *
     * @param {Array} filesArr - list of all files
     * @param {number} cloudPageCounter - iterator over all files
     * @param {string} [templateName] - allows to only update one specific object
     * @returns {undefined}
     */
    function _processConfigFile(filesArr, cloudPageCounter, templateName) {
        const logs = [];
        const filePath = filesArr[cloudPageCounter];
        // let error = false;
        const finder = {
            error: false,
            jsFound: false, // eslint-disable-line prefer-const
            ssjsFound: false, // eslint-disable-line prefer-const
            libMode: 'amp',
        };
        // cloudPageCounter++;
        const currentPath = path.dirname(filePath);
        const config = require(filePath);
        if (nameFilter && config.name !== nameFilter) {
            // console.error(
            // 	`Skipped '${filePath}' due to not meeting filter criteria: '${config.name}' != '${nameFilter}'`
            // );
            return;
        }
        if (!_sanityCheckConfig(config, logs)) {
            logs.push(
                `\n\u001b[36m${config.name}\u001b[0m ${
                    templateName ? ' (' + templateName + ')' : ''
                } ${color.blackBright('- ' + filePath)}`
            );
            _outputLogs(logs);
            return;
        }
        const currentPage = currentPath.split(process.cwd()).pop();

        const templateList = [];
        if (templateName) {
            if (templateName === '*') {
                if (config.template) {
                    for (const key in config.template) {
                        templateList.push(key);
                    }
                }
            } else {
                templateList.push(templateName);
            }
        }
        if (!templateList.length) {
            // fallback
            templateList.push(null);
        }

        logs.push(`\n\u001b[36m${config.name}\u001b[0m ${color.blackBright('- ' + filePath)}`);
        _outputLogs(logs);
        let templateCounter = 0;
        for (let myTemplateName of templateList) {
            ssjsCoreLoaded = false;
            const logs = [];
            let output = '';

            if (templateCounter) {
                logs.push('');
            }
            templateCounter++;

            // create script wrapper
            if (!config.template || !config.template[myTemplateName]) {
                myTemplateName = null;
            }
            logs.push(`Template: ${myTemplateName ? myTemplateName : 'n/a'}`);

            const outputLib = loadlib(config, currentPath, finder);
            if (outputLib) {
                output += outputLib;
            } else {
                output += loadServer(config, currentPath, finder);
                output += loadPublic(config, currentPath, finder);
            }

            let serverConfigCode = null;
            if (config.server.config && config.destConfig) {
                serverConfigCode = loadServerConfig(config, currentPath);
            } else if (
                (config.server.config && !config.destConfig) ||
                (!config.server.config && config.destConfig)
            ) {
                logs.push(
                    `${color.redBright('Problem with server config')}: Please define ${color.cyan(
                        'config.server.config'
                    )} and ${color.cyan('config.destConfig')} together.`
                );
                finder.error = true;
            }

            if (finder.error) {
                logs.push(
                    `${color.redBright(
                        'Bundle not updated'
                    )}: Please fix the above errors and re-run ${color.cyan(
                        `sfmc-build ${configFileType} "${config.name}"`
                    )}`
                );
                _outputLogs(logs);
            } else {
                output =
                    _prefixBundle(config, currentPage, finder.libMode, myTemplateName) + output;
                let fileDest = path.normalize(currentPath + '/' + config.dest);
                const directory = path.dirname(fileDest);
                fs.mkdir(directory, { recursive: true }, err => {
                    if (!err) {
                        if (myTemplateName) {
                            output = _templatingCode(config, myTemplateName, output);
                            fileDest = _templatingName(config, myTemplateName, fileDest);
                        }

                        if (fs.existsSync(fileDest)) {
                            fs.unlinkSync(fileDest);
                        }
                        fs.writeFile(fileDest, output, err => {
                            if (!err) {
                                if (serverConfigCode) {
                                    let destinationPath = config.destConfig;
                                    if (myTemplateName) {
                                        serverConfigCode = _templatingCode(
                                            config,
                                            myTemplateName,
                                            serverConfigCode
                                        );
                                        destinationPath = _templatingName(
                                            config,
                                            myTemplateName,
                                            destinationPath
                                        );
                                    }
                                    const configDest = path.normalize(
                                        currentPath + '/' + destinationPath
                                    );
                                    if (fs.existsSync(configDest)) {
                                        fs.unlinkSync(configDest);
                                    }
                                    fs.writeFileSync(configDest, serverConfigCode);
                                }

                                logs.push(
                                    color.greenBright('bundle updated successfully') +
                                        ' ' +
                                        color.blackBright(
                                            new Date().toLocaleTimeString() + ': ' + fileDest
                                        )
                                );

                                createJsDocMarkdown(currentPath, finder, logs);

                                _outputLogs(logs);
                            }
                        });
                    }
                });
            }
        }
    }
    /**
     * apply templating to output
     *
     * @param {Object} config - config of our package
     * @param {string} templateName - name of template
     * @param {string} code - code in file that we want to write
     */
    function _templatingCode(config, templateName, code) {
        const logs = [];
        if (!config.template || !config.template[templateName]) {
            logs.push(
                `${color.redBright(
                    'Template not found'
                )}: The template ${templateName} is not defined`
            );
        } else {
            // logs.push(`${color.greenBright('Applied template')}: '${templateName}'`);

            for (const search in config.template[templateName]) {
                const replacement = config.template[templateName][search];
                code = code.split(search).join(replacement);
            }
        }
        _outputLogs(logs);

        return code;
    }

    /**
     * rename bundle to hold the template-name
     *
     * @param {Object} config - config of our package
     * @param {string} templateName - name of template
     * @param {string} destinationPath - path of the file we want to write to
     */
    function _templatingName(config, templateName, destinationPath) {
        if (!config.template || !config.template[templateName]) {
            return destinationPath;
        } else {
            const destinationParts = destinationPath.split('.');
            const destinationExt = destinationParts.pop();
            return destinationParts.join('.') + `-${templateName}.${destinationExt}`;
        }
    }

    /**
     *
     *
     * @param {string} content - code in file
     * @param {object} config - local configuration
     * @returns {string} compiled code of file
     */
    function _returnSsjsWrap(content, config) {
        let output = '<script runat="server"';
        if (config.server.scriptAttributes) {
            for (const el in config.server.scriptAttributes) {
                if (Object.prototype.hasOwnProperty.call(config.server.scriptAttributes, el)) {
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
     * @param {object} config - local config
     * @returns {string} the wrapped code
     */
    function _returnWrapped(type, content, config) {
        switch (type) {
            case 'css':
                return `<style>\n${content}\n</style>\n`;
            case 'js':
                return `<script type="text/javascript">\n${content}\n</script>\n`;
            case 'ssjs':
                return _returnSsjsWrap(content, config);
            case 'amp':
                return `<div style="display:none">\n%%[\n${content}\n]%%\n</div>\n`;
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
        return (
            content
                .replace(/\/\*\*\s*\n([^*]|(\*(?!\/)))*\*\//g, '') // remove jsdoc comments
                .replace(/\/\*.*\n?.*\*\//g, '') // remove multi-line comments
                .replace(/([ \t\n])\/\/.*/g, '') // remove single-line comments
                .replace(/^\/\/.*/g, '') // remove single-line comments at beginning of file
                // .replace(/<!--.*\n?.*-->/g, '') // filter HTML comments
                .replace(/@charset .*;/g, '') // remove CSS file charset
                .replace(/\s\s+/g, ' ')
        ); // remove double-spaces
    }

    /**
     *
     *
     * @param {string} currentPath - current email/cloudpage folder
     * @param {object} finder - status variable
     * @param {Array<string>} logs - multiple log messages for the same item
     * @returns {undefined}
     */
    function createJsDocMarkdown(currentPath, finder, logs) {
        const jsDocDest = '/docs-js.md';
        const ssjsDocDest = '/docs-ssjs.md';
        const relativeCurrentPath = currentPath.split(process.cwd()).pop();

        if (finder.jsFound) {
            // JavaScript
            _createJsDocMarkdown(currentPath, '/src/**/*.js', jsDocDest, logs);
            // cleanup
        } else if (fs.existsSync(relativeCurrentPath.substr(1) + jsDocDest)) {
            fs.unlinkSync(path.normalize(relativeCurrentPath.substr(1) + jsDocDest));
        }

        if (finder.ssjsFound) {
            // Server-Side JavaScript
            _createJsDocMarkdown(currentPath, '/src/**/*.ssjs', ssjsDocDest, logs);
        } else if (fs.existsSync(relativeCurrentPath.substr(1) + ssjsDocDest)) {
            // cleanup
            fs.unlinkSync(path.normalize(relativeCurrentPath.substr(1) + ssjsDocDest));
        }
    }

    /**
     *
     *
     * @param {string} currentPath - current email/cloudpage folder
     * @param {string} src - sub-path that needs to be searched
     * @param {string} dest - relative path of output MD
     * @param {Array<string>} logs - multiple log messages for the same item
     * @returns {undefined}
     */
    function _createJsDocMarkdown(currentPath, src, dest, logs) {
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
                configure: path.resolve(__dirname, '../jsdoc-conf.json'),
            });

            logs.push(`- Markdown created for ${src.split('/').pop()} `);
            // logs.push(`- Markdown created. ${color.blackBright(files)}`);
            fs.writeFileSync(path.normalize(relativeCurrentPath.substr(1) + dest), output);
        } catch (e) {
            logs.push(
                `${color.red('- No Markdown created')}. ${color.blackBright(files)} not found`
            );
            output = '';
        }
    }

    /**
     *
     *
     * @param {object} config - local config
     * @param {string} currentPath - current email/cloudpage folder
     * @param {object} finder - status variable
     * @returns {string} minified file content
     */
    function loadServer(config, currentPath, finder) {
        const d = config.server.dependencies;
        const src = config.server.src;
        let output = '';

        if ((d.ssjs && d.ssjs.length) || (d.other && d.other.length) || (src && src.length)) {
            output = '\n' + _prefixFile('SERVER', 'html', true);
        }

        // load SSJS libs
        if (d.ssjs && d.ssjs.length) {
            finder.ssjsFound = true;
            const ssjsLibCode = d.ssjs
                .map(f => {
                    const thisPath = path.normalize(currentPath + '/src/' + f);
                    if (!fs.existsSync(thisPath)) {
                        console.log(
                            '\u001b[31mFile not found\u001b[0m (\u001b[33mserver.dependencies.ssjs\u001b[0m): ' +
                                f
                        );
                        finder.error = true;
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
                            '\u001b[31mFile not found\u001b[0m (\u001b[33mserver.dependencies.other\u001b[0m): ' +
                                f
                        );
                        finder.error = true;
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
            output += _returnWrapped('other', otherCode, config);
        }

        // load server
        if (src && src.length) {
            output += src
                .map(f => {
                    const thisPath = path.normalize(currentPath + '/src/' + f);
                    if (!fs.existsSync(thisPath)) {
                        console.log(
                            '\u001b[31mFile not found\u001b[0m (\u001b[33mserver.src\u001b[0m): ' +
                                f
                        );
                        finder.error = true;
                        return '';
                    }
                    const ext = f.split('.').pop();
                    if (ext === 'ssjs') {
                        finder.ssjsFound = true;
                    }
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
     * if the system is used solely for minification of a library, this method can be used
     *
     * @param {object} config - local config
     * @param {string} currentPath - current email/cloudpage folder
     * @param {object} finder - status variable
     * @returns {string} minified file content
     */
    function loadlib(config, currentPath, finder) {
        let output = '';
        if (!config.lib) {
            return output;
        }
        const myLib = config.lib;

        // load SSJS libs
        if (myLib.ssjs && myLib.ssjs.length) {
            finder.ssjsFound = true;
            const ssjsLibCode = myLib.ssjs
                .map(f => {
                    const thisPath = path.normalize(currentPath + '/src/' + f);
                    if (!fs.existsSync(thisPath)) {
                        console.log(
                            '\u001b[31mFile not found\u001b[0m (\u001b[33mserver.dependencies.ssjs\u001b[0m): ' +
                                f
                        );
                        finder.error = true;
                        return '';
                    }
                    return _filterComments(
                        fs
                            .readFileSync(thisPath)
                            .toString()
                            .trim()
                    );
                })
                .join('\n');
            output += ssjsLibCode;
            finder.libMode = 'ssjs';
        }

        // load other libs
        else if (myLib.amp && myLib.amp.length) {
            const ampCode = myLib.amp
                .map(f => {
                    const thisPath = path.normalize(currentPath + '/src/' + f);
                    if (!fs.existsSync(thisPath)) {
                        console.log(
                            '\u001b[31mFile not found\u001b[0m (\u001b[33mserver.dependencies.other\u001b[0m): ' +
                                f
                        );
                        finder.error = true;
                        return '';
                    }
                    return _filterComments(
                        fs
                            .readFileSync(path.normalize(currentPath + '/src/' + f))
                            .toString()
                            .trim()
                    );
                })
                .join('\n');
            output += ampCode;
            finder.libMode = 'amp';
        }

        return output;
    }
    /**
     *
     *
     * @param {object} config - local config
     * @param {string} currentPath - current email/cloudpage folder
     * @param {object} finder - status variable
     * @returns {string} minified file content
     */
    function loadServerConfig(config, currentPath, finder) {
        let output = '';
        const serverConfig = config.server.config;

        // load SSJS/ampscript config
        if (serverConfig && serverConfig.length && typeof serverConfig === 'string') {
            const ext = serverConfig.split('.').pop();

            const thisPath = path.normalize(currentPath + '/src/' + serverConfig);
            if (!fs.existsSync(thisPath)) {
                console.log(
                    '\u001b[31mFile not found\u001b[0m (\u001b[33mserver.config\u001b[0m): ' +
                        serverConfig
                );
                finder.error = true;
            }
            const serverConfigCode = fs
                .readFileSync(thisPath)
                .toString()
                .trim();
            output = _returnWrapped(ext, serverConfigCode, config);
        }

        return output;
    }
    /**
     *
     *
     * @param {object} config - local config
     * @param {string} currentPath - current email/cloudpage folder
     * @param {object} finder - status variable
     * @returns {string} minified file content
     */
    function loadPublic(config, currentPath, finder) {
        let output = '';
        const pub = config.public;
        if (pub && pub.length) {
            output = '\n' + _prefixFile('PUBLIC', 'html', true);
            output += pub
                .map(f => {
                    const thisPath = path.normalize(currentPath + '/src/' + f);
                    if (!fs.existsSync(thisPath)) {
                        console.log(
                            '\u001b[31mFile not found\u001b[0m (\u001b[33mpublic[]\u001b[0m): ' + f
                        );
                        finder.error = true;
                        return '';
                    }
                    const ext = f.split('.').pop();
                    if (ext === 'js') {
                        finder.jsFound = true;
                    } else if (ext === 'ssjs') {
                        finder.ssjsFound = true;
                    }
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
        const prefix = mainHeadline ? '' : 'file: src/';
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
     * @param {object} config - local config
     * @param {object} currentPage - relative path
     * @param {string} [libMode] - switches surrounding ampscript signs off if code shall be used in lib
     * @param {string} [templateName] - name of template
     * @returns {string} file comments
     */
    function _prefixBundle(config, currentPage, libMode, templateName) {
        const packageJson = require(path.normalize(process.cwd() + '/package.json'));
        if (!libMode) {
            libMode = 'amp';
        }
        let output = '';
        if (libMode === 'amp') {
            output = '%%[\n';
        }
        output += '/*\n';
        output += ` *  bundle created based on ${configFileName} for '${config.name}'\n`;
        output += ` *  template: ${templateName ? templateName : 'n/a'}\n`;
        output += ` *  @author: ${config.author}\n`;
        output += ` *  @created: ${new Date()
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '')} GMT\n`;
        if (packageJson && packageJson.repository) {
            if ('string' === typeof packageJson.repository) {
                output += ` *  @repository: ${packageJson.repository}\n`;
            } else if (packageJson.repository.url) {
                output += ` *  @repository: ${packageJson.repository.url}\n`;
            }
        }
        output += ` *  @path: ${currentPage.split('\\').join('/')}\n */\n`;
        if (libMode === 'amp') {
            output += ']%%\n';
        }
        return output;
    }
}

module.exports = complexCollection;
