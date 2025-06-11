import globals from 'globals'
import babelParser from '@babel/eslint-parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

export default [
  {
    ignores: ['dist/*', 'tmp/*', '.yarn/**/*']
  },
  ...compat
    .extends('standard', 'standard-jsx', 'standard-react', 'prettier')
    .map((config) => ({
      ...config,
      files: ['**/*.js', '**/*.mjs']
    })),
  {
    files: ['**/*.js', '**/*.mjs'],

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

    rules: {
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
  }
]
