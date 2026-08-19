/* global describe it */

import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

import webpack_config_base from '../webpack/webpack.config.base.mjs'
import {
  webpack_resolve_config,
  webpack_define_globals
} from './webpack-resolve/webpack-resolve-config.mjs'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repository_root = path.resolve(__dirname, '..')

// The one real cost of `test/webpack-resolve/`: it is a SECOND resolution
// oracle, and a second oracle can disagree with the bundle.
//
// The primary defence is structural -- `webpack-resolve-config.mjs` IMPORTS
// the webpack config rather than restating it, so a new or repointed alias is
// mirrored by construction and cannot drift. This spec asserts that the
// derivation is real and still wired, so replacing the import with a copied
// literal fails here rather than silently making the suite disagree with the
// bundle.
//
// It also asserts the two things derivation alone cannot give: that every
// alias target exists on disk (a repointed alias with a typo resolves to
// nothing under both webpack and the hook, but only fails loudly here), and
// that the alias-shaped specifiers the SPA actually writes resolve.

describe('webpack resolution hook conformance', function () {
  const webpack_resolve = webpack_config_base.resolve

  it('derives its alias map from webpack rather than restating it', function () {
    // Identity, not deep equality: a copied literal would pass a deep compare
    // on the day it was copied and drift silently afterwards.
    expect(webpack_resolve_config.alias).to.equal(webpack_resolve.alias)
    expect(webpack_resolve_config.extensions).to.equal(
      webpack_resolve.extensions
    )
    expect(webpack_resolve_config.modules).to.equal(webpack_resolve.modules)
  })

  it('carries every alias webpack declares', function () {
    const webpack_alias_keys = Object.keys(webpack_resolve.alias).sort()

    // A floor rather than an exact list, so adding an alias does not fail the
    // suite for bookkeeping -- but an alias map that collapsed to a handful of
    // entries is caught. The named set is what the prototype measured as
    // load-bearing: the four view aliases were as necessary as `@core`, and
    // the package aliases are what make `dayjs/plugin/timezone` resolve.
    expect(webpack_alias_keys.length).to.be.at.least(13)
    for (const required of [
      '@core',
      '@components',
      '@views',
      '@pages',
      '@styles',
      '@layouts',
      'dayjs',
      'react',
      'react-dom'
    ]) {
      expect(webpack_alias_keys, `webpack alias ${required}`).to.include(
        required
      )
    }
  })

  it('points every alias at a path that exists', function () {
    const missing = Object.entries(webpack_resolve.alias)
      .filter(([, target]) => !fs.existsSync(target))
      .map(([key, target]) => `${key} -> ${target}`)

    expect(missing).to.deep.equal([])
  })

  // The three things Node does not do and webpack does. Each specifier here is
  // a shape the SPA writes in bulk: 665 of the 1,112 alias specifiers omit the
  // extension and 435 name a directory.
  it('resolves the alias shapes the SPA writes', async function () {
    const specifiers = [
      '@core/leagues/league.js', // alias, extension written
      '@core/percentiles/actions', // alias, extension omitted
      '@core/utils', // alias, directory index
      'dayjs/plugin/timezone' // bare package subpath, no extension
    ]

    for (const specifier of specifiers) {
      const resolved = await import(specifier)
      // A module namespace object, not a plain one -- assert it has exports
      // rather than its type, so this cannot pass over an empty module.
      expect(
        Object.keys(resolved).length,
        `${specifier} must resolve to a module with exports`
      ).to.be.at.least(1)
    }
  })

  // The header claims `resolve.mainFiles`, and the alias and relative branches
  // deliver it for the two specifier shapes they cover. A `#`-prefixed subpath
  // import is neither: the package's own `imports` map resolves it to a
  // DIRECTORY, so Node fails with ERR_UNSUPPORTED_DIR_IMPORT after resolution
  // rather than before it, and the fallback used to have nothing to retry.
  // `@core/data-view-request/reducer` is the module that surfaced it -- it
  // imports `#app/core/data-views`.
  it('resolves a directory reached through a # subpath import', async function () {
    const resolved = await import('#app/core/utils')
    expect(
      Object.keys(resolved).length,
      '#app/core/utils must resolve to its index and evaluate'
    ).to.be.at.least(1)

    // The module that surfaced the gap. It cannot be asserted on its exports:
    // it reaches `window` through app/core/data-views/index.js and dies on the
    // documented DOM wall, which is a separate limit and not this one. What
    // must hold is that it gets PAST resolution, so assert on the error CLASS
    // rather than on success -- that is the only thing distinguishing the two
    // failures, and asserting success here would pin the DOM wall by accident.
    let caught = null
    try {
      await import('#app/core/data-view-request/reducer')
    } catch (error) {
      caught = error
    }

    if (caught) {
      expect(
        caught.code,
        'a # subpath naming a directory must resolve, not raise a directory-import error'
      ).to.not.equal('ERR_UNSUPPORTED_DIR_IMPORT')
    }
  })

  // Not a resolution property, but the same failure mode: a DefinePlugin global
  // is not an import, so nothing can supply it and every module reaching
  // `app/core/constants.js` throws ReferenceError on load without it.
  it('supplies the build-time globals DefinePlugin substitutes', function () {
    const production_config_source = fs.readFileSync(
      path.join(repository_root, 'webpack/webpack.config.prod.babel.mjs'),
      'utf8'
    )

    for (const name of Object.keys(webpack_define_globals)) {
      expect(
        globalThis,
        `${name} must be defined for app/core`
      ).to.have.property(name)
    }

    // A global the production build defines and this list does not is the next
    // instance of the same defect, so read the production config's own
    // DefinePlugin block rather than trusting the list to be complete.
    const define_plugin_block = production_config_source.match(
      /new webpack\.DefinePlugin\(\{([\s\S]*?)\}\)/
    )
    expect(define_plugin_block, 'production DefinePlugin block').to.not.equal(
      null
    )

    const defined_in_production = [
      ...define_plugin_block[1].matchAll(/^\s*(\w+):/gm)
    ].map((match) => match[1])

    expect(defined_in_production.length).to.be.at.least(2)
    for (const name of defined_in_production) {
      expect(
        Object.keys(webpack_define_globals),
        `DefinePlugin defines ${name}; the test globals must supply it`
      ).to.include(name)
    }
  })

  // The negative control. Derivation makes drift impossible only while the hook
  // is actually CONSUMING the derived map, so mutate the map the hook was given
  // and confirm resolution follows it -- a hook resolving `@core` from a
  // hardcoded path would stay green here.
  it('resolves through the derived map, not a hardcoded path', async function () {
    const core_target = webpack_resolve.alias['@core']
    expect(core_target).to.equal(path.join(repository_root, 'app/core'))

    const resolved = await import('@core/leagues/league.js')
    const expected = pathToFileURL(
      path.join(core_target, 'leagues/league.js')
    ).href

    const direct = await import(expected)
    expect(
      resolved.League,
      '@core must resolve to the module the webpack alias target names'
    ).to.equal(direct.League)
  })
})
