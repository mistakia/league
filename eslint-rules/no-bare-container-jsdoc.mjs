// Bans JSDoc type tags written as a bare container name. See
// ./bare-container-jsdoc.mjs for what counts and why it is worse than no tag.
//
// A RATCHET, NOT A FLOOR. The rule went in against 1,139 existing occurrences
// across 181 files, so plain `error` would have failed `yarn lint` on the
// commit that added it and the only way to green would have been to turn it
// off. Instead each file carries an ALLOWANCE in
// ./bare-container-jsdoc-baseline.json, and the rule reports only the
// occurrences beyond it. A file absent from the baseline is allowed zero.
//
// So: the tree is green today, a new bare tag anywhere is an error today, and
// the allowances only move down. Fixing a file means deleting or lowering its
// entry, which `generate-bare-container-jsdoc-baseline.mjs --check` requires --
// that gate fails when a baseline entry is HIGHER than the file's real count,
// which is what stops the ratchet from silently accumulating slack and turning
// back into a floor.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  find_bare_containers,
  CONTAINER_ADVICE
} from './bare-container-jsdoc.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..')
const baseline_path = path.join(__dirname, 'bare-container-jsdoc-baseline.json')

const baseline = JSON.parse(fs.readFileSync(baseline_path, 'utf8'))
const allowances = baseline.allowances || {}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'ban JSDoc type tags written as a bare container name (`{Object}`, `{Array}`, `{Map}`, `{Set}`, `{Function}`, `{Promise}`)'
    },
    schema: [],
    messages: {
      bareContainer:
        'JSDoc `{{{container}}}` on @{{tag}} covers nothing -- {{advice}}.'
    }
  },
  create(context) {
    const source_code = context.sourceCode ?? context.getSourceCode()
    const filename = context.filename ?? context.getFilename()
    const relative_path = path.relative(repo_root, filename)
    const allowance = allowances[relative_path] || 0

    return {
      'Program:exit'(node) {
        const found = find_bare_containers({ source: source_code.getText() })
        if (found.length <= allowance) return

        // Report the occurrences past the allowance, newest-last, so a file
        // that adds one gets one error rather than its whole history.
        for (const occurrence of found.slice(allowance)) {
          context.report({
            node,
            loc: source_code.getLocFromIndex(occurrence.index),
            messageId: 'bareContainer',
            data: {
              container: occurrence.container,
              tag: occurrence.tag,
              advice: CONTAINER_ADVICE[occurrence.container]
            }
          })
        }
      }
    }
  }
}

export default { rules: { 'no-bare-container-jsdoc': rule } }
