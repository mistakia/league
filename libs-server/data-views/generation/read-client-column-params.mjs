import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

// The per-column param vocabulary lives in the CLIENT field registry
// (app/core/data-views-fields/), and for most columns it lives ONLY there: the
// server column definitions declare `column_params` on 56 of 597 columns, while
// the client declares them on 357. Everything the editor offers a user --
// `time_type`, `nfl_week_id`, `output`, `market_type`, `source_id` -- is
// declared client-side.
//
// This module reads that registry from the server so the generation catalog can
// carry the real vocabulary rather than the fraction the server happens to
// restate.
//
// What blocked this was NOT React, despite eight days of the comment in the
// catalog builder saying so. It was extensionless relative specifiers: `from
// './column-groups'` resolves under webpack's resolver and does not resolve
// under bare Node ESM, so every module in the directory failed on its first
// import line and the React imports further down were never reached. The
// specifiers now carry explicit extensions, which webpack resolves unchanged.
//
// Five of the 34 modules genuinely do import React or `@components` and are
// carved out here. The carve-out is DERIVED from the source text rather than
// listed by filename, so a module that later drops its React import starts
// contributing without anyone remembering to update a list.
//
// WHY THE SPECIFIERS WERE REWRITTEN RATHER THAN RESOLVED BY A HOOK.
// `test/webpack-resolve/register.mjs` already carries a Node resolve hook that
// derives alias, extensions and mainFiles from the real webpack config, and it
// records that rewriting all ~1,100 app specifiers was measured and rejected.
// This directory is 34 files, not 1,100, and the rewrite is mechanical: adding
// `.js` to a specifier that already resolved to that exact file changes nothing
// webpack does. The hook was not reused because
// `test/app.webpack-resolve-hook-conformance.spec.mjs` warns that every
// additional resolution authority is a thing that can disagree with webpack,
// and the API server would have been the third. Rewriting makes these modules
// importable by ANY consumer -- server, test, script -- with no authority at
// all, which is the smaller standing cost.

const client_fields_directory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../app/core/data-views-fields'
)

// `index.js` is the client aggregator: it pulls in React param editor
// components and applies row-grain prefixing that only makes sense in the UI.
// The per-module registries it composes are what carry the vocabulary.
const aggregator_module = 'index.js'

// Matches `from 'react'` and `from '@components/...'` without matching
// `from 'react-table/src/constants.mjs'`, which is a data-only constants module
// the catalog builder itself already imports server-side. An earlier count of
// "31 of 33 modules import React" was this false positive.
const react_import_pattern = /from\s+'(react'|@components\/)/

const is_client_only_module = (source) => react_import_pattern.test(source)

/**
 * Read every server-importable client field module and collect the
 * `column_params` each one declares.
 *
 * Throws rather than returning empty if the directory yields no modules. A
 * silently empty result is the failure mode that matters here: it would look
 * exactly like "these columns take no params" and would restore the gap this
 * module exists to close.
 *
 * @returns {Promise<{
 *   column_params_by_id: Record<string, object>,
 *   carve_out_modules: string[],
 *   failed_modules: Array<{ module: string, message: string }>,
 *   imported_module_count: number
 * }>}
 */
export const read_client_column_params = async () => {
  const entries = fs
    .readdirSync(client_fields_directory)
    .filter((entry) => /\.(js|mjs)$/.test(entry))
    .filter((entry) => entry !== aggregator_module)
    .sort()

  if (!entries.length) {
    throw new Error(
      `no client field modules found in ${client_fields_directory} -- the directory moved or the deploy is incomplete`
    )
  }

  const column_params_by_id = {}
  const carve_out_modules = []
  const failed_modules = []
  let imported_module_count = 0

  for (const entry of entries) {
    const module_path = path.join(client_fields_directory, entry)

    if (is_client_only_module(fs.readFileSync(module_path, 'utf8'))) {
      carve_out_modules.push(entry)
      continue
    }

    // The React text match is a heuristic, and this runs at API start behind a
    // top-level await. A module that grows a `.styl` import or touches `window`
    // WITHOUT importing React would slip the filter and, uncaught, take the
    // whole server down at boot -- trading a partial catalog for no API at all,
    // which is much the worse failure.
    //
    // So the failure is contained but never swallowed: it is recorded, surfaced
    // through the catalog's `coverage`, and policed by the param-coverage
    // ratchet in test, which fails when the vocabulary shrinks. The floor check
    // below still throws if the whole directory stops loading.
    let module
    try {
      module = await import(pathToFileURL(module_path).href)
    } catch (error) {
      failed_modules.push({ module: entry, message: error.message })
      continue
    }
    imported_module_count += 1

    const registry = module.default
    if (!registry || typeof registry !== 'object') {
      continue
    }

    for (const [column_id, definition] of Object.entries(registry)) {
      if (
        definition &&
        typeof definition === 'object' &&
        definition.column_params &&
        typeof definition.column_params === 'object'
      ) {
        column_params_by_id[column_id] = {
          ...column_params_by_id[column_id],
          ...definition.column_params
        }
      }
    }
  }

  // The floor. One module failing degrades the catalog and is reported; the
  // whole directory failing is indistinguishable from "these columns take no
  // params" and must not start.
  if (!imported_module_count) {
    throw new Error(
      `no client field module in ${client_fields_directory} could be read -- ${carve_out_modules.length} carved out, ${failed_modules.length} failed to import: ${failed_modules.map(({ module, message }) => `${module} (${message})`).join('; ')}`
    )
  }

  return {
    column_params_by_id,
    carve_out_modules,
    failed_modules,
    imported_module_count
  }
}

export default read_client_column_params
