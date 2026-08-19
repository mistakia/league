import globals from 'globals'
import babelParser from '@babel/eslint-parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import noUnproxiedFetchWithRetry from './eslint-rules/no-unproxied-fetch-with-retry.mjs'
import noBareContainerJsdoc from './eslint-rules/no-bare-container-jsdoc.mjs'

// One `local` plugin holding every rule in eslint-rules/. Registering a second
// plugin object under the same name in a second config block would silently
// replace the first rather than merge with it.
const local_rules = {
  rules: {
    ...noUnproxiedFetchWithRetry.rules,
    ...noBareContainerJsdoc.rules
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

export default [
  {
    ignores: ['dist/*', 'tmp/*', '.yarn/**/*', '.cache/**']
  },
  ...compat
    .extends('standard', 'standard-jsx', 'standard-react', 'prettier')
    .map((config) => ({
      ...config,
      files: ['**/*.js', '**/*.mjs'],
      ignores: ['private/**']
    })),
  {
    files: ['**/*.js', '**/*.mjs'],
    ignores: ['private/**'],

    languageOptions: {
      globals: {
        ...globals.browser
      },

      parser: babelParser,
      ecmaVersion: 12,
      sourceType: 'script',

      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },

        sourceType: 'module'
      }
    },

    plugins: {
      local: local_rules
    },

    rules: {
      'local/no-unproxied-fetch-with-retry': 'error',
      'local/no-bare-container-jsdoc': 'error',
      camelcase: ['off'],
      curly: ['off'],
      indent: ['off'],
      'multiline-ternary': ['off', 'always'],

      'generator-star-spacing': [
        'error',
        {
          before: false,
          after: true
        }
      ],

      'react/jsx-handler-names': ['off'],

      'space-before-function-paren': [
        'error',
        {
          anonymous: 'always',
          named: 'never',
          asyncArrow: 'always'
        }
      ]
    }
  },
  {
    files: ['libs-server/*.mjs'],

    rules: {
      'react/prop-types': 'off'
    }
  },
  {
    files: ['test/**/*.mjs', 'test/**/*.js'],

    rules: {
      'no-unused-expressions': 'off'
    }
  },
  {
    // private/ is a separate git repo with its own style conventions, so it
    // does not get the standard/style ruleset above -- only the proxy-safety
    // rule, which is the one CI cannot see for this submodule (eslint.config
    // used to ignore private/** entirely, and CI never checks it out).
    files: ['private/**/*.js', 'private/**/*.mjs'],

    languageOptions: {
      parser: babelParser,
      ecmaVersion: 12,
      sourceType: 'script',

      parserOptions: {
        sourceType: 'module'
      }
    },

    plugins: {
      local: local_rules
    },

    rules: {
      'local/no-unproxied-fetch-with-retry': 'error',
      'local/no-bare-container-jsdoc': 'error'
    }
  }
]
