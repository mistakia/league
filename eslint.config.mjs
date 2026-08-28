import globals from 'globals'
import babelParser from '@babel/eslint-parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import noUnproxiedFetchWithRetry from './eslint-rules/no-unproxied-fetch-with-retry.mjs'
import noBareContainerJsdoc from './eslint-rules/no-bare-container-jsdoc.mjs'
import noBareDebugEnable from './eslint-rules/no-bare-debug-enable.mjs'
import noPrivateImportInCore from './eslint-rules/no-private-import-in-core.mjs'
import noWeekReconstruction from './eslint-rules/no-week-reconstruction.mjs'

// One `local` plugin holding every rule in eslint-rules/. Registering a second
// plugin object under the same name in a second config block would silently
// replace the first rather than merge with it.
const local_rules = {
  rules: {
    ...noUnproxiedFetchWithRetry.rules,
    ...noBareContainerJsdoc.rules,
    ...noBareDebugEnable.rules,
    ...noPrivateImportInCore.rules,
    ...noWeekReconstruction.rules
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
      'local/no-bare-debug-enable': 'error',
      'local/no-week-reconstruction': 'error',
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
    // db/adhoc is written once, run once and NEVER edited; db/archive is
    // tooling whose cluster closed, kept for reference and not run
    // (db/README.md). Both are frozen history, so a rule that would require
    // editing them is asking for churn against files whose whole value is that
    // they still read as what was run. The three call sites in here are
    // one-shot scripts nothing imports, so the namespace race cannot reach
    // them anyway.
    files: ['db/adhoc/**/*.mjs', 'db/archive/**/*.mjs'],

    rules: {
      'local/no-bare-debug-enable': 'off'
    }
  },
  {
    // The core/plugin layering: core never imports #private, scripts and jobs
    // may. Scoped HERE rather than inside the rule so the rule stays a plain
    // specifier check and the directory list is readable in one place.
    //
    // private/ is NOT in this list on purpose -- it is the plugin, and it
    // imports its own siblings through #private freely.
    files: [
      'libs-server/**/*.mjs',
      'libs-server/**/*.js',
      'libs-shared/**/*.mjs',
      'libs-shared/**/*.js',
      'api/**/*.mjs',
      'api/**/*.js',
      'app/**/*.mjs',
      'app/**/*.js',
      'app/**/*.jsx'
    ],

    rules: {
      'local/no-private-import-in-core': 'error'
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
      // The BASELINE-FREE rules, and only those. What decides eligibility
      // here is not importance, it is whether the rule can fail over a file it
      // cannot see: CI never checks this submodule out, so on the runner
      // private/ is an empty directory.
      //
      // A stateless rule is safe under that -- zero files means zero reports,
      // and the check is merely narrower on the runner than it is locally.
      // no-bare-container-jsdoc is not, because it ratchets against a committed
      // baseline: an entry for a private/ file reads as "allowance 2, actual 0"
      // on the runner and fails the gate for a file that was never fixed and is
      // merely absent. That turned master red on 32f05d60f.
      //
      // no-bare-debug-enable is deliberately baseline-free for this reason
      // among others -- see the header of eslint-rules/no-bare-debug-enable.mjs.
      'local/no-unproxied-fetch-with-retry': 'error',
      'local/no-bare-debug-enable': 'error',
      'local/no-week-reconstruction': 'error'
    }
  }
]
