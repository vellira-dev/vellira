// Regenerate the browser-hosted Native Starter directly from its maintained Expo sources.
// The result is a mechanical import bridge, not a separate dashboard implementation.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = existsSync(resolve('pnpm-workspace.yaml'))
  ? resolve('.')
  : resolve('../..');
const target = 'apps/website/src/sections/home/ProductInterfaceDemo/native-starter-source';
const files = ['App.tsx', 'WorkspaceSettings.tsx', 'WorkspaceNotice.tsx', 'projectUx.ts'];
const header = "/* Generated from examples/workspace-starter/native by sync-native-starter-preview.mjs. Do not edit. */\n";
const imports = [
  ["from 'expo-blur'", "from '../native-web-adapters/ExpoBlur'"],
  ["from 'react-native-safe-area-context'", "from '../native-web-adapters/SafeArea'"],
  [
    "from '@react-native-async-storage/async-storage'",
    "from '../native-web-adapters/AsyncStorage'",
  ],
];

function generatedContent(name) {
  let source = readFileSync(resolve(root, 'examples/workspace-starter/native', name), 'utf8');
  if (name === 'App.tsx') {
    for (const [original, replacement] of imports) {
      if (source.split(original).length !== 2) {
        throw new Error('Unexpected Native Starter import: ' + original);
      }
      source = source.replace(original, replacement);
    }
  }
  return header + source;
}

const check = process.argv.includes('--check');
for (const name of files) {
  const file = resolve(root, target, name);
  const source = generatedContent(name);
  if (check) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== source) {
      throw new Error('Native Starter website preview is stale: ' + name);
    }
  } else {
    mkdirSync(resolve(root, target), { recursive: true });
    writeFileSync(file, source);
    console.log('Synced Native Starter browser source: ' + name);
  }
}
if (check) console.log('Native Starter browser source sync: PASS');
