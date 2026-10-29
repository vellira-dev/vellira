#!/usr/bin/env node
// #1906: prepare an isolated, unpublished proof project against an EXACT
// already published @vellira-ui/react-native version. Never edits the workspace.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const version = process.env.VELLIRA_NATIVE_VERSION;
const destinationArg = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('Set VELLIRA_NATIVE_VERSION to an exact published version, e.g. 2.188.1');
}
if (process.argv.length > 3 || (destinationArg && !path.isAbsolute(destinationArg))) {
  throw new Error('Usage: VELLIRA_NATIVE_VERSION=x.y.z node scripts/performance/native-published-pickerless-project.cjs [absolute-new-output-path]');
}
if (destinationArg && fs.existsSync(destinationArg)) {
  throw new Error('Proof output already exists; refusing to overwrite it');
}

const destination = destinationArg ||
  fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-published-pickerless-'));
if (destinationArg) fs.mkdirSync(destination, { recursive: true });

function write(relative, data) {
  const location = path.join(destination, relative);
  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(location, data);
}

const pkg = {
  name: 'vellira-published-pickerless-hermes-proof',
  version: '0.0.0',
  private: true,
  main: 'index.js',
  scripts: {
    ios: 'expo run:ios',
    android: 'expo run:android',
    typecheck: 'tsc --noEmit',
    'verify:pickerless': 'node verify-pickerless.cjs',
  },
  dependencies: {
    '@vellira-ui/react-native': version,
    expo: '57.0.31',
    '@expo/metro-runtime': '57.0.17',
    react: '19.2.3',
    'react-native': '0.86.3',
    'react-native-svg': '15.15.4',
    'react-native-safe-area-context': '5.9.1',
  },
  devDependencies: {
    typescript: '6.0.3',
    '@types/react': '19.2.4',
  },
};

write('package.json', JSON.stringify(pkg, null, 2) + '\n');
write('app.json', JSON.stringify({ expo: {
  name: 'Vellira Published Pickerless Proof',
  slug: 'vellira-published-pickerless-proof',
  version: '1.0.0',
  jsEngine: 'hermes',
  platforms: ['ios', 'android'],
  ios: { bundleIdentifier: 'dev.vellira.published.pickerlessproof' },
  android: { package: 'dev.vellira.published.pickerlessproof' },
}}, null, 2) + '\n');
write('tsconfig.json', JSON.stringify({
  extends: 'expo/tsconfig.base',
  compilerOptions: { strict: true, skipLibCheck: true },
  include: ['App.tsx'],
}, null, 2) + '\n');
write('index.js', [
  "import { registerRootComponent } from 'expo';",
  "import App from './App';",
  'registerRootComponent(App);',
  '',
].join('\n'));

write('App.tsx', [
  "import React from 'react';",
  "import { ScrollView, StyleSheet, Text, View } from 'react-native';",
  "import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';",
  "import { Button, Select, ThemeProvider } from '@vellira-ui/react-native';",
  '',
  'const choices = [',
  "  { label: 'France', value: 'fr' },",
  "  { label: 'Spain', value: 'es' },",
  '];',
  'const hermes = !!(globalThis as typeof globalThis & { HermesInternal?: unknown }).HermesInternal;',
  '',
  'function PublishedControls() {',
  "  const [country, setCountry] = React.useState<string | null>(null);",
  '  const [seen, setSeen] = React.useState<string[]>([]);',
  '  const [buttonPresses, setButtonPresses] = React.useState(0);',
  "  const selectPassed = seen.includes('fr') && seen.includes('es');",
  "  const selectedLabel = country === 'fr' ? 'France' : country === 'es' ? 'Spain' : 'none';",
  '  return (',
  '    <View style={styles.controls}>',
  '      <Select',
  "        testID='pickerless-select'",
  "        label='Country'",
  "        presentation='modal'",
  // Force an adequately sized list viewport in the isolated diagnostic.
  // The native Select's default auto-sized sheet may otherwise clip the
  // second item when a short FlatList first measures its content.
  '        contentStyle={{ height: 320 }}',
  '        options={choices}',
  '        value={country}',
  '        onOpenChange={(open) => {',
  "          console.log('[VELLIRA_PUBLISHED_PICKERLESS] select open: ' + open);",
  '        }}',
  '        onValueChange={(value) => {',
  '          setCountry(value);',
  '          if (value) {',
  '            setSeen(previous => previous.includes(value) ? previous : [...previous, value]);',
  "            console.log('[VELLIRA_PUBLISHED_PICKERLESS] Select value: ' + value);",
  '          }',
  '        }}',
  '      />',
  "      <Text testID='selection'>Selection: {selectedLabel}</Text>",
  "      <Text testID='seen-values'>Selections observed: {seen.join(', ') || 'none'}</Text>",
  "      <Text testID='select-result' style={selectPassed ? styles.pass : styles.pending}>",
  "        Native Select without picker: {selectPassed ? 'PASS' : 'PENDING'}",
  '      </Text>',
  '      <Button onPress={() => {',
  '        setButtonPresses(current => current + 1);',
  "        console.log('[VELLIRA_PUBLISHED_PICKERLESS] root Button: PRESS');",
  "      }}>Root Button</Button>",
  "      <Text testID='button-count'>Button presses: {buttonPresses}</Text>",
  '    </View>',
  '  );',
  '}',
  '',
  'export default function App() {',
  '  React.useEffect(() => {',
  "    console.log('[VELLIRA_PUBLISHED_PICKERLESS] engine: ' + (hermes ? 'Hermes' : 'NOT HERMES'));",
  '  }, []);',
  '  return (',
  '    <SafeAreaProvider>',
  '      <SafeAreaView style={styles.safeArea}>',
  '        <ScrollView contentContainerStyle={styles.container}>',
  '          <Text style={styles.title}>Published Vellira / pickerless proof</Text>',
  '          <Text testID="hermes" style={hermes ? styles.pass : styles.fail}>',
  "            Hermes engine: {hermes ? 'PASS' : 'FAIL'}",
  '          </Text>',
  // Keep the generated white proof canvas in sync with Vellira's light palette.
  // Dark theme produces near-white Select label/value text on this white canvas.
  '          <ThemeProvider theme="light">',
  '            <PublishedControls />',
  '          </ThemeProvider>',
  '          <Text>Tap Select, choose France, reopen and choose Spain.</Text>',
  '          <Text>PASS requires both selections in real Hermes without a Picker install.</Text>',
  '        </ScrollView>',
  '      </SafeAreaView>',
  '    </SafeAreaProvider>',
  '  );',
  '}',
  '',
  'const styles = StyleSheet.create({',
  "  safeArea: { flex: 1, backgroundColor: '#fff' },",
  "  container: { flexGrow: 1, padding: 24, gap: 20, backgroundColor: '#fff' },",
  '  controls: { gap: 16 },',
  "  title: { fontSize: 22, fontWeight: '700', color: '#111' },",
  "  pass: { fontSize: 16, fontWeight: '700', color: '#116b31' },",
  "  fail: { fontSize: 16, fontWeight: '700', color: '#ba1717' },",
  "  pending: { fontSize: 16, fontWeight: '700', color: '#52525b' },",
  '});',
  '',
].join('\n'));

write('verify-pickerless.cjs', [
  "const fs = require('node:fs');",
  "const path = require('node:path');",
  "const native = path.resolve(__dirname, 'node_modules/@vellira-ui/react-native');",
  "const manifest = JSON.parse(fs.readFileSync(path.join(native, 'package.json'), 'utf8'));",
  'const expected = ' + JSON.stringify(version) + ';',
  "if (manifest.name !== '@vellira-ui/react-native' || manifest.version !== expected) {",
  "  throw new Error('Installed wrong published Vellira package/version');",
  '}',
  "if (fs.existsSync(path.resolve(__dirname, 'node_modules/@react-native-picker/picker'))) {",
  "  throw new Error('Unexpected picker auto-install; no negative proof');",
  '}',
  'function walk(dir) {',
  '  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {',
  '    const file = path.join(dir, entry.name);',
  '    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];',
  '  });',
  '}',
  "const files = walk(path.join(native, 'dist')).filter(file => /\\.(?:js|mjs|cjs|d\\.ts|d\\.mts|d\\.cts)$/.test(file));",
  "if (!files.some(file => /\\.js$/.test(file)) || !files.some(file => /\\.d\\.ts$/.test(file))) {",
  "  throw new Error('Incomplete published dist');",
  '}',
  "const refs = files.filter(file => fs.readFileSync(file, 'utf8').includes('@react-native-picker/picker'));",
  "if (refs.length) throw new Error('Published runtime/declaration references picker: ' + refs.join(', '));",
  "console.log('[VELLIRA_PUBLISHED_PICKERLESS] install PASS version=' + expected + ' distFiles=' + files.length);",
  "console.log('[VELLIRA_PUBLISHED_PICKERLESS] picker absent, packed runtime/types references absent');",
  '',
].join('\n'));

write('README.md', [
  '# Published Vellira without Picker: real Hermes proof',
  '',
  'This is a **temporary, isolated** Expo 57 / RN 0.86.3 test project.',
  'It installs **published** @vellira-ui/react-native@' + version + ' (not a workspace tarball).',
  'The package manifest may still declare the mandatory picker peer.',
  'Install with --legacy-peer-deps to suppress npm peer auto-install **only for this negative-dependency test**.',
  'Do not infer that ordinary npm installation will behave identically.',
  '',
  '## Run on macOS iOS Simulator',
  '',
  '1. cd ' + JSON.stringify(destination),
  '2. npm install --legacy-peer-deps --no-audit --no-fund',
  '3. npm run verify:pickerless',
  '4. npm run typecheck',
  '5. npm run ios',
  '',
  'In the iOS Simulator, confirm Hermes engine: PASS.',
  'Tap Country, select France, reopen and select Spain.',
  'Native Select without picker: PASS should appear only after both onValueChange events.',
  'Tap Root Button; make sure the counter increases.',
  'Record screenshot and console messages with prefix [VELLIRA_PUBLISHED_PICKERLESS].',
  'If app launch or Select interaction fails, report the exact failure; do not claim PASS.',
  '',
  'Android is separate: npm run android on an equipped Android emulator/device.',
  'This project does not change any public Vellira dependency or export.',
  '',
].join('\n'));

console.log('[native-pickerless] output:', destination);
console.log('[native-pickerless] published version pinned:', version);
console.log('[native-pickerless] next: cd ' + JSON.stringify(destination) +
  ' && npm install --legacy-peer-deps --no-audit --no-fund && npm run verify:pickerless && npm run typecheck && npm run ios');
