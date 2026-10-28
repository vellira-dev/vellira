#!/usr/bin/env node
// Opt-in, non-publishing iOS/Android Hermes runtime proof for #1906.
// Prepares a disposable Expo project using the real shared-graph tarball.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../..');
const native = path.join(repo, 'packages/react-native');
const candidateSource = path.join(native, 'dist/shared-proof');
const required = ['index.js', 'button.js', 'theme.js'];
const requestedOut = process.argv[2];
if (process.argv.length > 3 || (requestedOut && !path.isAbsolute(requestedOut))) {
  throw new Error('Usage: node scripts/performance/native-hermes-subpath-project.cjs [absolute-empty-output-directory]');
}
for (const file of required) {
  if (!fs.statSync(path.join(candidateSource, file), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing ${file}; first run pnpm --filter @vellira-ui/react-native build and build:subpaths:shared-probe`);
  }
}
const destination = requestedOut || fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-hermes-subpaths-'));
if (requestedOut) {
  if (fs.existsSync(destination)) {
    throw new Error('Output directory already exists. Choose a new absolute path (no overwrites).');
  }
  fs.mkdirSync(destination, { recursive: true });
}
function write(name, value) {
  const file = path.join(destination, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}
const packageVersion = JSON.parse(fs.readFileSync(path.join(native, 'package.json'), 'utf8')).version;
const tarball = path.join(destination, 'vellira-hermes-shared-candidate.tgz');
const command = spawnSync(process.execPath, [path.join(repo, 'scripts/performance/native-shared-chunk-tarball-probe.cjs')], {
  cwd: repo,
  env: { ...process.env, VELLIRA_SHARED_TARBALL_OUTPUT: tarball },
  stdio: 'inherit',
});
if (command.error || command.status !== 0) {
  throw new Error(`Shared-graph candidate packaging failed: ${command.error?.message || command.status}`);
}
const pkg = {
  name: 'vellira-hermes-subpath-proof',
  version: '0.0.0',
  private: true,
  main: 'index.js',
  scripts: {
    ios: 'expo run:ios',
    android: 'expo run:android',
    typecheck: 'tsc --noEmit',
  },
  dependencies: {
    '@vellira-ui/react-native': 'file:./vellira-hermes-shared-candidate.tgz',
    expo: '57.0.31',
    '@expo/metro-runtime': '57.0.17',
    react: '19.2.3',
    'react-native': '0.86.3',
    'react-native-svg': '15.15.4',
  },
  devDependencies: { typescript: '6.0.3', '@types/react': '19.2.4' },
};
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
write('app.json', JSON.stringify({ expo: {
  name: 'Vellira Hermes Subpath Proof',
  slug: 'vellira-hermes-subpath-proof',
  version: '1.0.0',
  jsEngine: 'hermes',
  platforms: ['ios', 'android'],
  ios: { bundleIdentifier: 'dev.vellira.hermes.subpathproof' },
  android: { package: 'dev.vellira.hermes.subpathproof' },
}}, null, 2) + '\n');
write('tsconfig.json', JSON.stringify({extends:'expo/tsconfig.base',compilerOptions:{strict:true,skipLibCheck:true},include:['App.tsx']},null,2)+'\n');
write('index.js', "import { registerRootComponent } from 'expo';\nimport App from './App';\nregisterRootComponent(App);\n");
write('App.tsx', `import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button as RootButton, ThemeProvider as RootProvider, useTheme as rootUseTheme } from '@vellira-ui/react-native';
import { Button as SubpathButton } from '@vellira-ui/react-native/button';
import { ThemeProvider as SubpathProvider, useTheme as subpathUseTheme } from '@vellira-ui/react-native/theme';

const hermesEnabled = !!(globalThis as typeof globalThis & { HermesInternal?: unknown }).HermesInternal;

function ContextPair({ label }: { label: string }) {
  const root = rootUseTheme();
  const subpath = subpathUseTheme();
  const matches = root.themeName === 'dark' && subpath.themeName === 'dark';
  const result = matches ? 'PASS' : 'FAIL';
  React.useEffect(() => {
    console.log('[VELLIRA_HERMES_PROOF] ' + label + ': ' + result);
  }, [label, result]);
  return <Text testID={label} style={matches ? styles.pass : styles.fail}>
    {label}: {result} (root={root.themeName}, subpath={subpath.themeName})
  </Text>;
}

export default function App() {
  const [pressCount, setPressCount] = React.useState(0);
  React.useEffect(() => {
    console.log('[VELLIRA_HERMES_PROOF] engine: ' + (hermesEnabled ? 'Hermes' : 'NOT HERMES'));
  }, []);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Vellira / real React Native proof</Text>
      <Text testID="hermes-engine" style={hermesEnabled ? styles.pass : styles.fail}>
        Hermes engine: {hermesEnabled ? 'PASS' : 'FAIL'}
      </Text>
      <RootProvider theme="dark">
        <View style={styles.group}>
          <ContextPair label="root provider / both hooks" />
          <RootButton testID="root-button" onPress={() => setPressCount(n => n + 1)}>
            Root Button
          </RootButton>
          <SubpathButton testID="subpath-button" onPress={() => setPressCount(n => n + 1)}>
            Subpath Button
          </SubpathButton>
        </View>
      </RootProvider>
      <SubpathProvider theme="dark">
        <View style={styles.group}>
          <ContextPair label="subpath provider / both hooks" />
        </View>
      </SubpathProvider>
      <Text testID="press-count" style={styles.counter}>Button presses: {pressCount}</Text>
      <Text>PASS requires Hermes, both green provider checks, and working native buttons.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 20, backgroundColor: '#fff' },
  heading: { fontSize: 22, fontWeight: '700', color: '#111' },
  group: { gap: 16, padding: 12, borderWidth: 1, borderColor: '#ddd' },
  pass: { fontSize: 16, fontWeight: '700', color: '#116b31' },
  fail: { fontSize: 16, fontWeight: '700', color: '#ba1717' },
  counter: { fontSize: 16, color: '#111' },
});
`);
write('README.md', `# Vellira Hermes / React Native runtime proof — unpublished

Generated locally for #1906 from workspace package ${packageVersion}; NOT a public release.

The application installs exactly one disposable shared-graph npm tarball with root, button and theme from the same build. It does not request \`@react-native-picker/picker\` and installs with \`--legacy-peer-deps\` to avoid npm auto-installing mandatory peers.

## Test on iOS Simulator (requires Xcode, CocoaPods and a booted simulator)

\`\`\`bash
cd "${destination}"
npm install --legacy-peer-deps --no-audit --no-fund
npm run typecheck
node -e "if(require('node:fs').existsSync('node_modules/@react-native-picker/picker'))throw Error('Unexpected picker auto-install')"
npm run ios -- --device
\`\`\`

Launch the resulting app on the simulator. Confirm **Hermes engine: PASS**, both provider checks **PASS**, and both native Button controls respond. The terminal/Metro log should also include \`[VELLIRA_HERMES_PROOF]\` lines. A Metro export alone or Node mocks do not satisfy this proof. Record iOS simulator name/version, engine status, log text, and screenshot. If the build fails, record the exact error rather than reporting PASS.

For Android: \`npm run android\` with an emulator/device available.

No production exports, npm version, repository dependencies, or application files are modified. The entire proof is local and isolated in this generated directory.
`);
console.log('[native-hermes] project:', destination);
console.log('[native-hermes] source package:', packageVersion);
console.log('[native-hermes] candidate tarball:', tarball);
console.log('[native-hermes] next: cd ' + JSON.stringify(destination) + ' && npm install --legacy-peer-deps --no-audit --no-fund && npm run typecheck && npm run ios -- --device');
