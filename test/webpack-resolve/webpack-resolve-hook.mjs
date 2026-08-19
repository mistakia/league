// TEST-ONLY module resolution hook: gives Node the resolution webpack already
// performs, so a spec can `import` a Record, a field registry or an action
// creator out of `app/core` without any source change.
//
// Runs on the loader thread via `module.register()`. See `./register.mjs` for
// the main-thread entry point and the rationale for deriving rather than
// copying the alias map.
//
// SHAPE: this hook is strictly ADDITIVE. Every specifier goes to `nextResolve`
// first, and the webpack fallback runs only where Node has already failed. It
// therefore cannot change the meaning of an import Node can resolve on its own
// -- the subpath imports (`#libs-shared`, `#app/*`), every relative import that
// names its file, and every ordinary package. What it adds is the three things
// webpack does and Node does not:
//
//   1. `resolve.alias`     -- `@core/percentiles/actions`, `@components/...`,
//                             plus the package aliases (dayjs, react, ...).
//   2. `resolve.extensions` -- `.js` / `.mjs` / `.json` appended to a specifier
//                             that omits one. This must apply to BARE package
//                             subpaths as well as to app paths, because
//                             `dayjs/plugin/timezone` writes no extension and
//                             dayjs ships no `exports` map for Node to consult.
//   3. `resolve.mainFiles`  -- a directory resolving to its `index.<ext>`,
//                             where Node raises ERR_UNSUPPORTED_DIR_IMPORT.
//
// It deliberately does NOT implement `resolve.modules` (the `app/` root that
// lets webpack take a bare `core/x` specifier). Nothing under `app/core` uses
// that form, and honouring it would let a bare specifier silently shadow a real
// package.

import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

let alias_entries = []
let extensions = []
let main_files = []

export async function initialize(data) {
  // Longest key first, so `@mui/x-date-pickers` wins over a hypothetical `@mui`
  // and `react-dom` over `react`. webpack's own alias matching is
  // longest-prefix, and ordering by key length is how that is reproduced
  // against a plain object whose key order is insertion order.
  alias_entries = Object.entries(data.alias).sort(
    ([a], [b]) => b.length - a.length
  )
  extensions = data.extensions
  main_files = data.main_files
}

// webpack matches an alias key either exactly or as a whole path segment, so
// `@core` claims `@core/leagues/league.js` but `@corefoo` is untouched.
const apply_alias = (specifier) => {
  for (const [key, target] of alias_entries) {
    if (specifier === key) return target
    if (specifier.startsWith(`${key}/`)) {
      return path.join(target, specifier.slice(key.length + 1))
    }
  }
  return null
}

const is_file = (candidate) => {
  try {
    return fs.statSync(candidate).isFile()
  } catch {
    return false
  }
}

const is_directory = (candidate) => {
  try {
    return fs.statSync(candidate).isDirectory()
  } catch {
    return false
  }
}

// The file webpack would land on for an absolute path: the path itself, then
// the path plus each configured extension, then -- if it names a directory --
// each main file plus each extension inside it.
const resolve_to_file = (absolute_path) => {
  if (is_file(absolute_path)) return absolute_path

  for (const extension of extensions) {
    const candidate = `${absolute_path}${extension}`
    if (is_file(candidate)) return candidate
  }

  if (is_directory(absolute_path)) {
    for (const main_file of main_files) {
      for (const extension of extensions) {
        const candidate = path.join(absolute_path, `${main_file}${extension}`)
        if (is_file(candidate)) return candidate
      }
    }
  }

  return null
}

const is_relative = (specifier) =>
  specifier.startsWith('./') || specifier.startsWith('../')

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (node_resolution_error) {
    const aliased = apply_alias(specifier)

    // A relative specifier Node could not resolve is the extensionless /
    // directory-index case: `import reducer from './reducer'` inside app/core.
    // Resolve it against the importing module rather than the cwd.
    const absolute_path =
      aliased ??
      (is_relative(specifier) && context.parentURL?.startsWith('file:')
        ? path.resolve(
            path.dirname(new URL(context.parentURL).pathname),
            specifier
          )
        : null)

    if (absolute_path) {
      const found = resolve_to_file(absolute_path)
      if (found) {
        return {
          url: pathToFileURL(found).href,
          format: found.endsWith('.json') ? 'json' : undefined,
          importAttributes: found.endsWith('.json')
            ? { type: 'json' }
            : context.importAttributes,
          shortCircuit: true
        }
      }
    }

    // Node RESOLVED the specifier and then refused it because it names a
    // directory. That is capability 3 above, reached by the one route the
    // alias/relative branches cannot cover: a `#`-prefixed subpath import,
    // which the package's own `imports` map sends to a directory. The error
    // carries the directory it resolved to, so the main-file lookup can run
    // against that rather than against a path this hook re-derives.
    if (node_resolution_error.code === 'ERR_UNSUPPORTED_DIR_IMPORT') {
      const directory = node_resolution_error.url
      if (directory?.startsWith('file:')) {
        const found = resolve_to_file(new URL(directory).pathname)
        if (found) {
          return {
            url: pathToFileURL(found).href,
            format: undefined,
            importAttributes: context.importAttributes,
            shortCircuit: true
          }
        }
      }
    }

    // A BARE package subpath that omits its extension -- `dayjs/plugin/timezone`
    // -- reaches here only when the package publishes no `exports` map, since a
    // package that does have one has already answered. Retry the package's own
    // resolution with each extension appended and let Node do the lookup, which
    // keeps node_modules layout (workspaces, hoisting) out of this file.
    if (!aliased && !is_relative(specifier) && !path.extname(specifier)) {
      for (const extension of extensions) {
        try {
          return await nextResolve(`${specifier}${extension}`, context)
        } catch {
          // try the next extension
        }
      }
    }

    throw node_resolution_error
  }
}
