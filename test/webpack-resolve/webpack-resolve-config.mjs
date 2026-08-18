// The resolution facts the hook needs, READ OFF the webpack config rather than
// restated here.
//
// This is the whole answer to the one real cost of giving Node a second
// resolver: a copied alias map is a second oracle that drifts the moment
// someone adds a webpack alias and does not think about the test hook. Deriving
// it makes drift impossible by construction -- a new alias is mirrored the next
// time the suite runs, and a repointed one moves with it.
//
// `webpack/webpack.config.base.mjs` imports cleanly under plain Node (it pulls
// `webpack` itself and `./stylus-options.mjs`, both of which load), so this is a
// plain import and not a parse of the file's text.

import webpack_config_base from '../../webpack/webpack.config.base.mjs'

const { alias, extensions, modules } = webpack_config_base.resolve

// webpack's `resolve.mainFiles` default, which the config does not override.
// It is what makes `@components/player-row-status-column` (a directory) resolve
// at all -- Node has no equivalent and raises ERR_UNSUPPORTED_DIR_IMPORT.
export const main_files = ['index']

export const webpack_resolve_config = {
  alias,
  extensions,
  modules,
  main_files
}

// The globals webpack's DefinePlugin substitutes at build time. They are not
// imports, so no resolver can supply them: without `IS_DEV` every reducer that
// reaches `app/core/constants.js` throws ReferenceError on load, which reads as
// a module failure rather than as a missing build-time constant.
//
// Values mirror the PRODUCTION config (`webpack.config.prod.babel.mjs`), since a
// test asserting on a development-only branch would be asserting on something
// the deployed bundle never runs.
export const webpack_define_globals = {
  IS_DEV: false,
  APP_VERSION: '0.0.x-test',
  MACHINE_IP: '127.0.0.1'
}
