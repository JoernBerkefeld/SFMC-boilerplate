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
        command: 'all [template]',
        aliases: ['a'],
        desc: 'processes all file types',
        builder: yargs => {
            yargs.positional('template', {
                type: 'string',
                describe: 'the name of the template to convert environment specific values'
            });
        },
        handler: argv => {
            complexCollection('cp', null, argv.template);
            complexCollection('e', null, argv.template);
        }
    })
    .command({
        command: 'library [name] [template]',
        aliases: ['lib'],
        desc: 'compiles all or the given library',
        builder: yargs => {
            yargs.positional('name', {
                type: 'string',
                describe: 'the name of the library to parse'
            })
            .positional('template', {
                type: 'string',
                describe: 'the name of the template to convert environment specific values'
            });
        },
        handler: argv => {
            complexCollection('lib', argv.name, argv.template);
        }
    })
    .command({
        command: 'cloudPages [name] [template]',
        aliases: ['cp'],
        desc: 'compiles all or the given cloudpage',
        builder: yargs => {
            yargs.positional('name', {
                type: 'string',
                describe: 'the name of the cloudpage to parse'
            })
            .positional('template', {
                type: 'string',
                describe: 'the name of the template to convert environment specific values'
            });
        },
        handler: argv => {
            complexCollection('cp', argv.name, argv.template);
        }
    })
    .command({
        command: 'emails [name] [template]',
        aliases: ['e'],
        desc: 'compiles all or the given email',
        builder: yargs => {
            yargs.positional('name', {
                type: 'string',
                describe: 'the name of the email to parse'
            })
            .positional('template', {
                type: 'string',
                describe: 'the name of the template to convert environment specific values'
            });
        },
        handler: argv => {
            complexCollection('e', argv.name, argv.template);
        }
    })
    .demandCommand(1, 'Please enter a valid command')
    .strict()
    .recommendCommands()
    .wrap(yargs.terminalWidth())
    .help().argv;
