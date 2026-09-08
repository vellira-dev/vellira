import { createHighlighter } from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

export const highlighter = createHighlighter({
  themes: ['github-light', 'github-dark'],
  langs: ['tsx'],
  engine: createJavaScriptRegexEngine(),
});
