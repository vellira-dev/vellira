import fs from 'node:fs';
import path from 'node:path';

/** Use the candidate's exact font bytes, but make screenshot font loading blocking.
 * font-display:optional may permanently retain fallback text on a cold navigation;
 * document.fonts.ready alone does not guarantee which font painted that page.
 */
export function canonicalScreenshotFonts(root) {
  const directory = path.join(root, 'packages/assets/styles');
  const fontRoot = fs.realpathSync(path.join(root, 'packages/assets/fonts'));
  const stylesheet = fs.readFileSync(path.join(directory, 'fonts.css'), 'utf8');
  let count = 0;
  const embedded = stylesheet.replace(
    /url\(['"]?([^)'"\s]+)['"]?\)/g,
    (_, url) => {
      const file = fs.realpathSync(path.resolve(directory, url));
      if (
        !file.startsWith(fontRoot + path.sep) ||
        path.extname(file) !== '.woff2'
      ) {
        throw new Error(
          'Canonical screenshot font must be a root-local WOFF2 asset.'
        );
      }
      count += 1;
      return `url('data:font/woff2;base64,${fs.readFileSync(file).toString('base64')}')`;
    }
  );
  if (!count || !/font-display:\s*optional/.test(embedded)) {
    throw new Error('Canonical screenshot font loading contract changed.');
  }
  return embedded.replace(/font-display:\s*optional/g, 'font-display: block');
}

export function canonicalVisualConfig(
  base,
  storybookRoot,
  fontStyle,
  baselineRoot
) {
  const screenshotExpectation = (expectation = {}) => ({
    ...expectation,
    toHaveScreenshot: {
      ...expectation.toHaveScreenshot,
      stylePath: [
        ...[expectation.toHaveScreenshot?.stylePath ?? []].flat(),
        fontStyle,
      ],
    },
  });
  const server = (value) => ({ ...value, cwd: value.cwd ?? storybookRoot });
  return {
    ...base,
    ...(baselineRoot
      ? {
          snapshotPathTemplate: path.join(
            baselineRoot,
            '{testFilePath}-snapshots/{arg}{ext}'
          ),
        }
      : {}),
    testDir: path.resolve(storybookRoot, base.testDir ?? '.'),
    outputDir: path.resolve(storybookRoot, base.outputDir ?? 'test-results'),
    reporter: Array.isArray(base.reporter)
      ? base.reporter.map(([name, options]) =>
          name === 'html'
            ? [
                name,
                {
                  ...options,
                  outputFolder: path.join(storybookRoot, 'playwright-report'),
                },
              ]
            : [name, options]
        )
      : base.reporter,
    expect: screenshotExpectation(base.expect),
    projects: base.projects?.map((project) => ({
      ...project,
      ...(project.testDir
        ? { testDir: path.resolve(storybookRoot, project.testDir) }
        : {}),
      ...(project.expect
        ? { expect: screenshotExpectation(project.expect) }
        : {}),
    })),
    ...(base.webServer
      ? {
          webServer: Array.isArray(base.webServer)
            ? base.webServer.map(server)
            : server(base.webServer),
        }
      : {}),
  };
}
