#!/usr/bin/env node
// #1906 historical shared graph; #2082 accepts an exact, unmodified packed
// candidate for iOS/Android Hermes root/leaf runtime acceptance.
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { getNativeExpoFixture } = require('./native-expo-fixture.cjs');

const repo = path.resolve(__dirname, '../..');
const expoFixture = getNativeExpoFixture(process.env.VELLIRA_NATIVE_EXPO_PROFILE, repo);
const native = path.join(repo, 'packages/react-native');
const candidateSource = path.join(native, 'dist/shared-proof');
const required = ['index.js', 'button.js', 'theme.js'];
const exactTarball = process.env.VELLIRA_NATIVE_CANDIDATE_TGZ;
if (exactTarball) {
  if (!path.isAbsolute(exactTarball) || !exactTarball.endsWith('.tgz') ||
      !fs.lstatSync(exactTarball, { throwIfNoEntry: false })?.isFile()) {
    throw new Error('Exact native candidate must be an existing absolute regular .tgz file');
  }
}
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(native, 'package.json'), 'utf8')
).version;
let candidateHash;
if (exactTarball) {
  const requiredHash = process.env.VELLIRA_NATIVE_CANDIDATE_SHA256;
  if (!/^[a-f0-9]{64}$/.test(requiredHash ?? '')) {
    throw new Error('Exact Native candidate requires its SHA256 pinned.');
  }
  candidateHash = createHash('sha256').update(fs.readFileSync(exactTarball)).digest('hex');
  if (candidateHash !== requiredHash) {
    throw new Error('Exact candidate SHA256 mismatch: ' + candidateHash);
  }
  const inspected = spawnSync('tar', ['-xzOf', exactTarball, 'package/package.json'], {
    encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  if (inspected.error || inspected.status !== 0) {
    throw new Error('Exact Native candidate is not a valid npm tarball.');
  }
  let packedManifest;
  try {
    packedManifest = JSON.parse(inspected.stdout);
  } catch {
    throw new Error('Exact Native candidate has an invalid packed manifest.');
  }
  if (packedManifest.name !== '@vellira-ui/react-native' ||
      packedManifest.version !== packageVersion ||
      !['.', './button', './theme', './select'].every(
        (entry) => typeof packedManifest.exports?.[entry]?.['react-native'] === 'string'
      )) {
    throw new Error('Exact Native candidate name/version/subpath authority mismatch.');
  }
}
// Optional true native layout check. The default context/Button proof is unchanged.
const sheetProof = process.env.VELLIRA_HERMES_SHEET_PROOF === '1';
const requestedOut = process.argv[2];
if (process.argv.length > 3 || (requestedOut && !path.isAbsolute(requestedOut))) {
  throw new Error('Usage: node scripts/performance/native-hermes-subpath-project.cjs [absolute-empty-output-directory]');
}
if (!exactTarball) {
  for (const file of required) {
    if (!fs.statSync(path.join(candidateSource, file), { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`Missing ${file}; first run pnpm --filter @vellira-ui/react-native build and build:subpaths:shared-probe`);
    }
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
const tarball = path.join(destination, 'vellira-hermes-shared-candidate.tgz');
if (exactTarball) {
  // Real candidate mode: never modify any installed package or rebuild an
  // isolated entry. The same actual tarball must be used for iOS and Android.
  fs.copyFileSync(exactTarball, tarball, fs.constants.COPYFILE_EXCL);
  console.log('[native-hermes] immutable candidate SHA256:', candidateHash);
} else {
  const command = spawnSync(process.execPath, [path.join(repo, 'scripts/performance/native-shared-chunk-tarball-probe.cjs')], {
    cwd: repo,
    env: { ...process.env, VELLIRA_SHARED_TARBALL_OUTPUT: tarball },
    stdio: 'inherit',
  });
  if (command.error || command.status !== 0) {
    throw new Error(`Shared-graph candidate packaging failed: ${command.error?.message || command.status}`);
  }
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
    ...expoFixture.dependencies,
  },
  devDependencies: expoFixture.devDependencies,
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
const sheetState = sheetProof
  ? [
      "  const [sheetCountry, setSheetCountry] = React.useState<string | null>(null);",
      "  const [sheetSeen, setSheetSeen] = React.useState<string[]>([]);",
    ].join('\n')
  : '';
const sheetUI = sheetProof
  ? [
      '          <RootProvider theme="light">',
      '            <View style={styles.group}>',
      '              <Text style={styles.heading}>Native Select / compact bottom sheet</Text>',
      '              <Select',
      '                label="Country"',
      '                presentation="sheet"',
      '                options={[{ label: "France", value: "fr" }, { label: "Spain", value: "es" }]}',
      '                value={sheetCountry}',
      '                onValueChange={(value) => {',
      '                  setSheetCountry(value);',
      '                  if (value) {',
      '                    setSheetSeen(previous => previous.includes(value) ? previous : [...previous, value]);',
      "                    console.log('[VELLIRA_HERMES_SHEET] selected: ' + value);",
      '                  }',
      '                }}',
      '              />',
      '              <Text testID="sheet-selection">Selected: {sheetCountry ?? "none"}</Text>',
      '              <Text testID="sheet-seen">Observed: {sheetSeen.join(", ") || "none"}</Text>',
      '              <Text testID="sheet-result">Select choices: {sheetSeen.includes("fr") && sheetSeen.includes("es") ? "PASS" : "PENDING"}</Text>',
      '              <Text>Open Country; both options should be visible in a compact sheet anchored at the bottom.</Text>',
      '            </View>',
      '          </RootProvider>',
    ].join('\n')
  : '';

write('App.tsx', `import React from 'react';
import { ${sheetProof ? 'LogBox, ' : ''}ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Button as RootButton, ThemeProvider as RootProvider, useTheme as rootUseTheme } from '@vellira-ui/react-native';
import { Button as SubpathButton } from '@vellira-ui/react-native/button';
import { ThemeProvider as SubpathProvider, useTheme as subpathUseTheme } from '@vellira-ui/react-native/theme';
${sheetProof ? "import { Select } from '@vellira-ui/react-native/select';" : ''}

const hermesEnabled = !!(globalThis as typeof globalThis & { HermesInternal?: unknown }).HermesInternal;
${sheetProof ? '(globalThis as typeof globalThis & { __VELLIRA_SELECT_LAYOUT_PROOF__?: boolean }).__VELLIRA_SELECT_LAYOUT_PROOF__ = true;\nLogBox.ignoreLogs(["[VELLIRA_SELECT_LAYOUT]"]);' : ''}

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
  const [rootPressCount, setRootPressCount] = React.useState(0);
${sheetState}
  const [subpathPressCount, setSubpathPressCount] = React.useState(0);
  const onRootPress = () => {
    setRootPressCount(n => n + 1);
    console.log('[VELLIRA_HERMES_PROOF] root button: PRESS');
  };
  const onSubpathPress = () => {
    setSubpathPressCount(n => n + 1);
    console.log('[VELLIRA_HERMES_PROOF] subpath button: PRESS');
  };
  const independentPass = rootPressCount > 0 && subpathPressCount > 0;
  React.useEffect(() => {
    console.log('[VELLIRA_HERMES_PROOF] independent buttons: ' + (independentPass ? 'PASS' : 'PENDING'));
  }, [independentPass]);
  React.useEffect(() => {
    console.log('[VELLIRA_HERMES_PROOF] engine: ' + (hermesEnabled ? 'Hermes' : 'NOT HERMES'));
  }, []);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.heading}>Vellira / real React Native proof</Text>
          <Text testID="hermes-engine" style={hermesEnabled ? styles.pass : styles.fail}>
            Hermes engine: {hermesEnabled ? 'PASS' : 'FAIL'}
          </Text>
          <RootProvider theme="dark">
            <View style={styles.group}>
              <ContextPair label="root provider / both hooks" />
              <RootButton testID="root-button" onPress={onRootPress}>
                Root Button
              </RootButton>
              <SubpathButton testID="subpath-button" onPress={onSubpathPress}>
                Subpath Button
              </SubpathButton>
            </View>
          </RootProvider>
          <SubpathProvider theme="dark">
            <View style={styles.group}>
              <ContextPair label="subpath provider / both hooks" />
            </View>
          </SubpathProvider>
${sheetUI}
          <Text testID="root-press-count" style={styles.counter}>Root Button presses: {rootPressCount}</Text>
          <Text testID="subpath-press-count" style={styles.counter}>Subpath Button presses: {subpathPressCount}</Text>
          <Text testID="independent-button-result" style={independentPass ? styles.pass : styles.pending}>
            Independent buttons: {independentPass ? 'PASS' : 'PENDING'}
          </Text>
          <Text>PASS requires Hermes, both green provider checks, and independent button presses.</Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 24, gap: 20, backgroundColor: '#fff' },
  heading: { fontSize: 22, fontWeight: '700', color: '#111' },
  group: { gap: 16, padding: 12, borderWidth: 1, borderColor: '#ddd' },
  pass: { fontSize: 16, fontWeight: '700', color: '#116b31' },
  fail: { fontSize: 16, fontWeight: '700', color: '#ba1717' },
  pending: { fontSize: 16, fontWeight: '700', color: '#52525b' },
  counter: { fontSize: 16, color: '#111' },
});
`);
write('README.md', `# Vellira Hermes / React Native runtime proof — unpublished

Generated locally for #2082 from candidate version ${packageVersion}; NOT a public release.
${exactTarball ? 'Installed as the EXACT verified candidate tarball, without synthetic entry rewrites.' : 'Using historical unpublished shared-graph probe mode.'}

The application installs one coherent shared-graph npm tarball with root, button, theme and optional Select subpaths. It does not request \`@react-native-picker/picker\`. ${exactTarball ? 'Use a normal npm install (legacy-peer-deps=false).' : 'The historical pre-removal probe uses --legacy-peer-deps.'}

## Test on iOS Simulator (requires Xcode, CocoaPods and a booted simulator)

\`\`\`bash
cd "${destination}"
${exactTarball ? 'npm install --no-audit --no-fund' : 'npm install --legacy-peer-deps --no-audit --no-fund'}
npm run typecheck
node -e "if(require('node:fs').existsSync('node_modules/@react-native-picker/picker'))throw Error('Unexpected picker auto-install')"
npm run ios -- --device
\`\`\`

${sheetProof ? 'Optional sheet layout proof: open Country, verify France/Spain are both visible, select both, and inspect the spacing below the last row. Record a screenshot and the [VELLIRA_SELECT_LAYOUT] sheet/list/contentHeight Metro logs to prove the native geometry. The panel should stay bottom-anchored without clipping.\\n\\n' : ''}
Launch the resulting app on the simulator. Confirm **Hermes engine: PASS** and both provider checks **PASS**. Tap **Root Button** and **Subpath Button** at least once each; verify their **separate** counters increase and \`Independent buttons: PASS\` appears. The terminal/Metro log should also include \`[VELLIRA_HERMES_PROOF]\` lines. A Metro export alone or Node mocks do not satisfy this proof. Record iOS simulator name/version, engine status, log text, and screenshot. If the build fails, record the exact error rather than reporting PASS.

For Android: \`npm run android\` with an emulator/device available.

No production exports, npm version, repository dependencies, or application files are modified. The entire proof is local and isolated in this generated directory.
`);
console.log('[native-hermes] project:', destination);
console.log('[native-hermes] source package:', packageVersion);
console.log('[native-hermes] toolchain:', expoFixture.profile, expoFixture.lockSha256 ?? 'legacy-pinned');
console.log('[native-hermes] candidate tarball:', tarball);
console.log('[native-hermes] next: cd ' + JSON.stringify(destination) + ' && ' + (exactTarball ? 'npm install --no-audit --no-fund' : 'npm install --legacy-peer-deps --no-audit --no-fund') + ' && npm run typecheck && npm run ios -- --device');
