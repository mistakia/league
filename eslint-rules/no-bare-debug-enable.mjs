// `debug.enable` REPLACES the process-wide enabled namespace set rather than
// adding to it, and ESM evaluates every import before the importing module's
// body -- so a bare module-scope call means the LAST module imported owns the
// process and every other namespace silently goes dark. Nothing fails, nothing
// warns, and the symptom is an absent log line rather than an error, which is
// why the prop write path stayed unlogged in production across five deploys and
// three wrong diagnoses on 2026-08-03.
//
// The remedy is enable_debug_namespaces (libs-shared/enable-debug-namespaces.mjs),
// which reads the current set back out and re-enables it alongside the new one.
// That makes the operation a UNION, so import order stops mattering and no entry
// point has to enumerate the namespaces of its transitive dependencies.
//
// This rule exists so the sweep that moved every call site onto that helper
// cannot be undone one file at a time. It carries NO baseline allowance,
// deliberately: the sweep went to zero, so the honest enforcement is zero, and a
// baseline file would be a second thing to maintain and to keep ratcheting down.
// The one legitimate call site is the helper itself, which is exempted by path.

import path from 'node:path'

const RULE_ID = 'no-bare-debug-enable'

// The single file allowed to call debug.enable. Matched on a path suffix so it
// holds under any repo root and inside the private/ submodule's own checkout.
const HELPER_SUFFIX = path.join('libs-shared', 'enable-debug-namespaces.mjs')

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'ban direct debug.enable calls in favour of enable_debug_namespaces'
    },
    schema: [],
    messages: {
      bareEnable:
        'debug.enable REPLACES the whole namespace set, so this silences every other namespace depending on import order. Use enable_debug_namespaces() from #libs-shared/enable-debug-namespaces.mjs, which unions instead.'
    }
  },
  create(context) {
    const filename = context.filename ?? context.getFilename()
    if (filename && filename.endsWith(HELPER_SUFFIX)) {
      return {}
    }

    return {
      MemberExpression(node) {
        if (node.computed) return
        if (node.property.type !== 'Identifier') return
        if (node.property.name !== 'enable') return
        if (node.object.type !== 'Identifier') return
        if (node.object.name !== 'debug') return

        context.report({ node, messageId: 'bareEnable' })
      }
    }
  }
}

export default {
  rules: {
    [RULE_ID]: rule
  }
}

export { RULE_ID }
