#! /usr/bin/env node
/* eslint-env node */
/* eslint-disable no-console */

const complexCollection = require('./lib/lib.complexCollection');
const yargs = require('yargs');

// CLI framework
yargs
	.scriptName('sfmc-build')
	.usage('Usage: $0 <command> [options]')
	.command({
		command: 'all',
		aliases: ['a'],
		desc: 'processes all file types',
		handler: () => {
			complexCollection('cp');
			complexCollection('e');
		}
	})
	.command({
		command: 'library [name]',
		aliases: ['lib'],
		desc: 'compiles all or the given library',
		builder: yargs => {
			yargs.positional('name', {
				type: 'string',
				describe: 'the name of the library to parse'
			});
		},
		handler: argv => {
			complexCollection('lib', argv.name);
		}
	})
	.command({
		command: 'cloudPages [name]',
		aliases: ['cp'],
		desc: 'compiles all or the given cloudpage',
		builder: yargs => {
			yargs.positional('name', {
				type: 'string',
				describe: 'the name of the cloudpage to parse'
			});
		},
		handler: argv => {
			complexCollection('cp', argv.name);
		}
	})
	.command({
		command: 'emails [name]',
		aliases: ['e'],
		desc: 'compiles all or the given email',
		builder: yargs => {
			yargs.positional('name', {
				type: 'string',
				describe: 'the name of the email to parse'
			});
		},
		handler: argv => {
			complexCollection('e', argv.name);
		}
	})
	.demandCommand(1, 'Please enter a valid command')
	.strict()
	.recommendCommands()
	.wrap(yargs.terminalWidth())
	.help().argv;
