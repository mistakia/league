// fetch_with_retry (libs-server/proxy-manager.mjs) defaults use_proxy to
// false, so a call that omits the key routes direct with no warning and no
// log line saying so. That omission has independently reproduced in five
// different vendor scrapers (import-keeptradecut.mjs, draftkings-dfs.mjs,
// fantasypros.mjs, fantasypoints.mjs, nfl-pro.mjs) -- the call site that
// proxies and the one that leaks are textually identical except for one
// absent key, and nothing at runtime distinguishes them. This rule makes the
// omission a lint error instead of a silent default: every fetch_with_retry
// call must state use_proxy explicitly, so choosing direct is a decision
// made in the code rather than an accident of a forgotten key.
//
// Deliberately conservative to avoid false positives: it only flags a call
// whose first argument is a plain object literal with no spread element (a
// spread could carry use_proxy from elsewhere and the rule cannot see that
// statically), and only when no property in that literal is named
// use_proxy. A call passing options via a variable, or via an object built
// with a spread, is left alone rather than guessed at.

const RULE_ID = 'no-unproxied-fetch-with-retry'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'require an explicit use_proxy key on every fetch_with_retry call'
    },
    schema: [],
    messages: {
      missingUseProxy:
        "fetch_with_retry call is missing an explicit 'use_proxy' key -- it defaults to false and will fetch direct. State use_proxy: true (proxied) or use_proxy: false (deliberately direct) explicitly."
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return
        if (node.callee.name !== 'fetch_with_retry') return

        const [first_arg] = node.arguments
        if (!first_arg || first_arg.type !== 'ObjectExpression') return

        const has_spread = first_arg.properties.some(
          (prop) => prop.type === 'SpreadElement'
        )
        if (has_spread) return

        const has_use_proxy = first_arg.properties.some(
          (prop) =>
            prop.type === 'Property' &&
            !prop.computed &&
            ((prop.key.type === 'Identifier' &&
              prop.key.name === 'use_proxy') ||
              (prop.key.type === 'Literal' && prop.key.value === 'use_proxy'))
        )

        if (!has_use_proxy) {
          context.report({ node: first_arg, messageId: 'missingUseProxy' })
        }
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
