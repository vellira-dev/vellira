import { isValidElement } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

import { createHighlighter } from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

import styles from './BlogCodeBlock.module.css';

interface CodeElementProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

interface BlogCodeBlockProps extends HTMLAttributes<HTMLPreElement> {
  children?: ReactNode;
}

const LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
  ts: 'typescript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  text: 'plaintext',
};

const highlighter = createHighlighter({
  themes: ['github-light', 'github-dark', 'github-dark-high-contrast'],
  langs: [
    'typescript',
    'tsx',
    'javascript',
    'jsx',
    'json',
    'bash',
    'css',
    'html',
    'yaml',
    'markdown',
    'go',
    'python',
    'plaintext',
  ],
  engine: createJavaScriptRegexEngine(),
});

function readCodeBlock(children: ReactNode) {
  if (!isValidElement<CodeElementProps>(children)) {
    return null;
  }

  const code = children.props.children;

  if (typeof code !== 'string') {
    return null;
  }

  const languageMatch = /language-([\w-]+)/.exec(
    children.props.className ?? ''
  );

  return {
    code: code.replace(/\n$/, ''),
    language: languageMatch?.[1] ?? 'text',
  };
}

function normalizeLanguage(language: string): string {
  return LANGUAGE_ALIASES[language] ?? language;
}

export async function BlogCodeBlock({
  children,
  ...props
}: BlogCodeBlockProps) {
  const codeBlock = readCodeBlock(children);

  if (!codeBlock) {
    return <pre {...props}>{children}</pre>;
  }

  try {
    const instance = await highlighter;
    const highlightedHtml = instance.codeToHtml(codeBlock.code, {
      lang: normalizeLanguage(codeBlock.language),
      themes: {
        light: 'github-light',
        dark: 'github-dark',
        highContrast: 'github-dark-high-contrast',
      },
      defaultColor: 'light',
    });

    return (
      <div className={styles.codeBlock} data-language={codeBlock.language}>
        <div className={styles.codeBlockToolbar} aria-hidden='true'>
          <span>{codeBlock.language}</span>
        </div>
        <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </div>
    );
  } catch {
    return <pre {...props}>{children}</pre>;
  }
}
