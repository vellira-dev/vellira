import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  /**
   * =====================================================
   * IGNORES
   * =====================================================
   */
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/storybook-static/**',
      '**/src/generated/**',
      'apps/website/src/sections/home/ProductInterfaceDemo/native-starter-source/**',
      '**/.storybook/**',
      '**/.rnstorybook/**',
      '**/android/**',
      '**/ios/**',
      '**/*.jar',
      '**/*.aar',
      '**/.next/**',
      '**/.vitepress/cache/**',
    ],
  },

  /**
   * =====================================================
   * BASE JS + TS
   * =====================================================
   */
  js.configs.recommended,
  ...tseslint.configs.recommended,

  /**
   * =====================================================
   * WEB / REACT / PACKAGES
   * =====================================================
   */
  {
    files: [
      'packages/**/*.{ts,tsx,js,jsx}',
      'apps/react-playground/**/*.{ts,tsx,js,jsx}',
      'apps/react-storybook/**/*.{ts,tsx,js,jsx}',
    ],

    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.browser,
        __DEV__: 'readonly',
      },
    },

    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'simple-import-sort': simpleImportSort,
      import: importPlugin,
      prettier: prettierPlugin,
    },

    settings: {
      react: {
        version: 'detect',
        runtime: 'automatic',
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
        node: true,
      },
    },

    rules: {
      ...reactPlugin.configs.flat.recommended.rules,

      /**
       * GENERAL RULES
       */
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',

      /**
       * TYPESCRIPT RULES
       */
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-require-imports': 'off',

      /**
       * REACT RULES
       */
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      /**
       * HOOKS RULES
       */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      /**
       * IMPORTS RULES
       */
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^react$', '^react-dom'],
            ['^node:'],
            ['^@?\\w'],
            ['^@web', '^@native', '^@shared', '^@assets', '^@/'],
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            ['\\.(css|scss|sass)$', '\\.(png|jpg|jpeg|gif|svg)$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',

      'import/no-duplicates': 'error',
      'import/no-cycle': 'warn',
      'import/no-unresolved': 'off',

      /**
       * PRETTIER RULES
       */
      'prettier/prettier': 'error',
    },
  },

  /**
   * =====================================================
   * TESTS / STORIES
   * =====================================================
   */
  {
    files: [
      '**/*.test.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
      '**/*.spec.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
      '**/*.stories.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
    ],

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'import/no-cycle': 'off',
    },
  },

  /**
   * =====================================================
   * NODE / CONFIG / SCRIPTS
   * =====================================================
   */
  {
    files: ['**/*.config.{js,ts,mjs,mts}', '**/scripts/**/*.{js,ts,mjs,mts}'],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },

    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },

  /**
   * =====================================================
   * COMMONJS CONFIGS
   * =====================================================
   */
  {
    files: ['**/*.cjs', '**/*.cts'],

    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
    },

    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },

  /**
   * =====================================================
   * NATIVE (React Native / Expo)
   * =====================================================
   */
  {
    files: [
      'apps/native-playground/**/*.{js,ts,tsx}',
      'apps/native-storybook/**/*.{js,ts,tsx}',
    ],

    languageOptions: {
      globals: {
        ...globals.browser,
        __DEV__: 'readonly',
      },
    },

    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  /**
   * =====================================================
   * PRETTIER OVERRIDE (MUST BE LAST)
   * =====================================================
   */
  prettierConfig,
];
