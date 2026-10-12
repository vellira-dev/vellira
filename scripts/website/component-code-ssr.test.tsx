import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ComponentCodeBlock } from '../../apps/website/src/component-catalog/shared/ComponentCodeBlock';

describe('component examples in initial HTML', () => {
  it('exposes a usable TypeScript example before client-side highlighting', () => {
    const example = [
      "import { Checkbox } from '@vellira-ui/react';",
      "<Checkbox checked={selected} onCheckedChange={setSelected} />",
    ].join('\n');

    const html = renderToStaticMarkup(<ComponentCodeBlock code={example} />);

    expect(html).toContain('<pre><code>');
    expect(html).toContain('Checkbox');
    expect(html).toContain('onCheckedChange');
    expect(html).toContain('setSelected');
    expect(html).toContain('Copy');
    // Rendering must be readable without JavaScript; Shiki can enhance it later.
    expect(html).not.toContain('shiki');
  });

  it('renders snippets as safe text instead of executable markup', () => {
    const code = '</code><script>alert("xss")</script><code>';

    const html = renderToStaticMarkup(<ComponentCodeBlock code={code} />);

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('</code><script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('alert(&quot;xss&quot;)');
  });

  it('preserves the copy control disabled state for invalid snippets', () => {
    const html = renderToStaticMarkup(
      <ComponentCodeBlock code='<Checkbox />' copyEnabled={false} />
    );

    expect(html).toContain('Copy');
    expect(html).toContain('disabled=""');
    expect(html).toContain('&lt;Checkbox');
  });
});
