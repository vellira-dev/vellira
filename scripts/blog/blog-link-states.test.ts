import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { describe, it } from 'vitest';

const stylesheet = postcss.parse(
  readFileSync(
    path.resolve(
      process.cwd(),
      'apps/website/src/blog/ui/BlogExperience.module.css'
    ),
    'utf8'
  )
);

function declarations(selector: string): Record<string, string> {
  const values: Record<string, string> = {};
  stylesheet.walkRules((rule) => {
    if (rule.parent?.type === 'root' && rule.selectors.includes(selector)) {
      rule.walkDecls((declaration) => {
        assert.equal(Boolean(declaration.important), false);
        values[declaration.prop] = declaration.value;
      });
    }
  });
  return values;
}

describe('Blog prose link interaction states', () => {
  it('uses canonical semantic colors instead of a fixed palette color', () => {
    assert.equal(declarations('.articleBody a').color, 'var(--text-brand)');
    assert.equal(
      declarations('.articleBody a:hover').color,
      'var(--text-interactive-hover)'
    );
    assert.equal(
      declarations('.articleBody a:active').color,
      'var(--text-interactive-pressed)'
    );
  });

  it('underlines only on hover or keyboard focus', () => {
    const normal = declarations('.articleBody a');
    const hover = declarations('.articleBody a:hover');
    const focus = declarations('.articleBody a:focus-visible');
    assert.equal(normal['text-decoration-line'], 'none');
    assert.equal(hover['text-decoration-line'], 'underline');
    assert.equal(focus['text-decoration-line'], 'underline');
    assert.equal(normal['text-decoration-thickness'], '1px');
    assert.equal(hover['text-decoration-thickness'], '2px');
    assert.equal(focus['text-decoration-thickness'], '2px');
    assert.equal(focus.color, hover.color);
    assert.equal(
      focus.outline,
      'var(--focus-ring-width) solid var(--focus-ring-color)'
    );
  });

  it('removes transition motion without removing interactive feedback', () => {
    let transition: string | undefined;
    stylesheet.walkAtRules('media', (media) => {
      if (media.params !== '(prefers-reduced-motion: reduce)') {
        return;
      }
      media.walkRules((rule) => {
        if (rule.selectors.includes('.articleBody a')) {
          rule.walkDecls('transition', (declaration) => {
            transition = declaration.value;
          });
        }
      });
    });
    assert.equal(transition, 'none');
    assert.notEqual(
      declarations('.articleBody a:hover').color,
      declarations('.articleBody a').color
    );
  });
});
