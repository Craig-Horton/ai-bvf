#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const documentUrl = new URL('../docs/worked-example.md', import.meta.url);
const document = readFileSync(documentUrl, 'utf8').replace(/\r\n/g, '\n');
const heading = '## Run the example against the built source\n';
const sections = document.split(heading);

assert.equal(sections.length, 2, 'The worked example must have exactly one executable-example section.');
const section = sections[1].split('\n## ')[0];
const blocks = [...section.matchAll(/^```js[ \t]*\n([\s\S]*?)^```[ \t]*$/gm)];
assert.equal(blocks.length, 1, 'The executable-example section must contain exactly one js fence.');
assert.ok(blocks[0][1].trim(), 'The executable example must contain JavaScript.');

console.log('Running the published worked example against the built local engine.');
const result = spawnSync(process.execPath, ['--input-type=module', '-'], {
  cwd: repositoryRoot,
  input: blocks[0][1],
  stdio: ['pipe', 'inherit', 'inherit'],
});

if (result.error) throw result.error;
assert.equal(
  result.status,
  0,
  result.signal
    ? 'The worked-example process ended on signal ' + result.signal + '.'
    : 'The published worked-example assertions failed.',
);
