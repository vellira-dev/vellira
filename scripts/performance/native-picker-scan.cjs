const fs = require('node:fs');
const path = require('node:path');

const PICKER_MODULE = '@react-native-picker/picker';
const SCANNABLE_FILE = /\.(?:js|mjs|cjs|d\.ts|d\.mts|d\.cts)$/;
const DECLARATION_FILE = /\.d\.(?:ts|mts|cts)$/;

function inspectPublishedPickerReferences(nativeRoot, packedFiles) {
  const references = [];
  const scannedFiles = { runtime: 0, declarations: 0 };
  for (const file of packedFiles) {
    if (!SCANNABLE_FILE.test(file)) continue;
    const category = DECLARATION_FILE.test(file) ? 'declarations' : 'runtime';
    scannedFiles[category] += 1;
    if (fs.readFileSync(file, 'utf8').includes(PICKER_MODULE)) {
      references.push(path.relative(nativeRoot, file).replaceAll(path.sep, '/'));
    }
  }
  if (scannedFiles.runtime === 0 || scannedFiles.declarations === 0) {
    throw new Error('incomplete published picker scan: ' + JSON.stringify(scannedFiles));
  }
  if (references.length) {
    throw new Error('published native dist references picker: ' + references.join(', '));
  }
  return { scannedFiles, references };
}

module.exports = { inspectPublishedPickerReferences };
