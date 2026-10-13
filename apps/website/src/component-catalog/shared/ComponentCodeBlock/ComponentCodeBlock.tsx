'use client';

import { useEffect, useState } from 'react';

import { Button } from '@vellira-ui/react';

import { highlighter } from './highlighter';

import styles from './ComponentCodeBlock.module.css';

type ComponentCodeBlockProps = {
  code: string;
  language?: 'tsx';
  copyEnabled?: boolean;
};

export function ComponentCodeBlock({
  code,
  language = 'tsx',
  copyEnabled = true,
}: ComponentCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [html, setHtml] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      const instance = await highlighter;

      const highlighted = instance.codeToHtml(code, {
        lang: language,
        themes: {
          light: 'github-light',
          dark: 'github-dark',
        },
        defaultColor: 'light',
      });

      if (!cancelled) {
        setHtml(highlighted);
      }
    }

    void highlight();

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const copyCode = async () => {
    if (!copyEnabled) return;
    await navigator.clipboard.writeText(code);

    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1600);
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <span className={styles.language}>{language}</span>

        <Button
          appearance='bare'
          type='button'
          className={styles.copy}
          onClick={copyCode}
          disabled={!copyEnabled}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {html ? (
        <div
          className={styles.code}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className={styles.code}>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
