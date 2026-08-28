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
// Five of the 33 modules genuinely do import React or `@components` and are
// carved out here. The carve-out is DERIVED from the source text rather than
// listed by filename, so a module that later drops its React import starts
// contributing without anyone remembering to update a list.

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
  let imported_module_count = 0

  for (const entry of entries) {
    const module_path = path.join(client_fields_directory, entry)

    if (is_client_only_module(fs.readFileSync(module_path, 'utf8'))) {
      carve_out_modules.push(entry)
      continue
    }

    // Not wrapped in try/catch on purpose. Every module here has been shown to
    // resolve, so an error is a real break -- a moved dependency or a syntax
    // error -- and swallowing it would silently shrink the vocabulary back
    // toward the gap.
    const module = await import(pathToFileURL(module_path).href)
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

  if (!imported_module_count) {
    throw new Error(
      `every client field module in ${client_fields_directory} was carved out -- the React detection is over-matching`
    )
  }

  return { column_params_by_id, carve_out_modules, imported_module_count }
}

export default read_client_column_params
