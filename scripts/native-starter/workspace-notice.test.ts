import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(
  new URL('../../examples/workspace-starter/native/App.tsx', import.meta.url),
  'utf8'
);
const component = readFileSync(
  new URL(
    '../../examples/workspace-starter/native/WorkspaceNotice.tsx',
    import.meta.url
  ),
  'utf8'
);

describe('Native Starter compact semantic notifications', () => {
  it('uses compact layout and accessible controls', () => {
    expect(app).toContain('<WorkspaceNotice');
    expect(component).toContain('minHeight: 52');
    expect(component).toContain("flexDirection: 'row'");
    expect(component).not.toContain("flexWrap: 'wrap'");
    expect(component).toContain("accessibilityLabel='Dismiss notification'");
    expect(component).toContain("accessibilityLabel='Undo project removal'");
    expect(component).toContain('minHeight: 44');
  });

  it('keeps short Undo notices compact and long notices readable', () => {
    expect(component).toContain(
      'const { width, fontScale } = useWindowDimensions()'
    );
    expect(component).toContain('const largeText = fontScale >= 1.5');
    expect(component).toContain(
      'const stacked = largeText && (width < 360 || notice.message.length > 24)'
    );
    expect(component).toContain("flexDirection: stacked ? 'column' : 'row'");
    expect(component).toContain("alignItems: stacked ? 'stretch' : 'center'");
    expect(component).toContain("alignSelf: stacked ? 'flex-end' : undefined");
    expect(component).toContain(
      'numberOfLines={largeText && !stacked ? 1 : undefined}'
    );
    expect(component).toContain('adjustsFontSizeToFit={largeText && !stacked}');
    expect(component).toContain('minimumFontScale={0.9}');
    expect(component).toContain('paddingVertical: 4');
    expect(component).toContain(
      'maxFontSizeMultiplier={largeText ? 1.4 : 1.5}'
    );
    expect(component).toContain('minWidth: 0');
    expect(component).toContain('accessibilityLiveRegion={');
    expect(component).toContain("accessibilityLabel='Undo project removal'");
    expect(component).toContain("accessibilityLabel='Dismiss notification'");
  });

  it('uses semantic status tokens for success, error and neutral', () => {
    expect(component).toContain('theme.semantic.status.success');
    expect(component).toContain('theme.semantic.status.error');
    expect(component).toContain('theme.semantic.surface.subtle');
    expect(component).toContain('theme.semantic.text.primary');
    expect(component).toContain("notice.tone === 'success'");
    expect(component).toContain("notice.tone === 'error'");
    expect(component).toContain('borderLeftColor: appearance.accent');
    expect(component).toContain(
      "notice.tone === 'error' ? 'assertive' : 'polite'"
    );
  });

  it('classifies project events and storage failures explicitly', () => {
    expect(app).toContain("tone: 'success'");
    expect(app).toContain("tone: 'neutral', message: 'Project removed.'");
    expect(app).toContain("tone: 'error'");
    expect(app).toContain("message: 'Project restored.'");
    expect(app).toContain("message: 'Could not save changes on this device.'");
    expect(app).toContain(
      "message: 'Could not load saved projects on this device.'"
    );
  });

  it('retains Undo and error messages while expiring success safely', () => {
    expect(app).toContain('onUndo={');
    expect(app).toContain('projects: [removedProject, ...current.projects]');
    expect(app).toContain("notice.tone !== 'success' || removedProject");
    expect(app).toContain('}, 4000)');
    expect(app).toContain('current === notice ? null : current');
    expect(app).toContain('setRemovedProject(null)');
  });
});
