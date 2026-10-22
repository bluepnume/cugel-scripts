#!/usr/bin/env node
import { cli } from './cli';

cli({
    argv: process.argv.slice(2),
    cwd:  process.cwd(),
    // eslint-disable-next-line no-console -- the CLI's output channel
    log:  line => console.log(line)
}).then(({ code }) => {
    process.exitCode = code;
}).catch((err : unknown) => {
    // eslint-disable-next-line no-console -- the CLI's output channel
    console.error(err);
    process.exitCode = 1;
});
