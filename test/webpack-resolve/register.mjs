// Main-thread entry point for the test-only webpack resolution hook.
//
// Import this ONCE, before anything under `app/` is imported. `test/global.mjs`
// does that for the suite, so an ordinary spec just imports from `@core/...` or
// `#app/core/...` and it works.
//
// Why this exists at all: 1,112 specifiers under `app/` are written against
// webpack's `resolve.alias`, and 665 of those omit the file extension while 435
// name a directory. Node resolves none of it, so no spec could load a Record, a
// reducer or a field registry -- which is how three SPA-side production defects
// shipped in one month against a green 4,185-test suite. Rewriting ~1,100
// specifiers was measured and rejected: it moves resolution and nothing else,
// while 99 of the 104 files that still fail under this hook fail on `window` or
// on JSX, which no specifier rewrite touches.

import module from 'module'
import {
  webpack_resolve_config,
  webpack_define_globals
} from './webpack-resolve-config.mjs'

// DefinePlugin substitutes these at build time, so they are free identifiers in
// the source and no resolver can supply them. `app/core/constants.js` reads
// `IS_DEV`, and it sits under almost every reducer -- without this, those
// modules fail to load with a ReferenceError that reads like a broken module.
for (const [name, value] of Object.entries(webpack_define_globals)) {
  if (!(name in globalThis)) globalThis[name] = value
}

module.register('./webpack-resolve-hook.mjs', {
  parentURL: import.meta.url,
  data: webpack_resolve_config
})
