// `private/` is a git submodule (mistakia/league-private) that NO workflow checks
// out -- there is no `submodules:` key anywhere under .github/workflows -- so on
// the runner, and in any clone of this public repo, it is a present but EMPTY
// directory. Core code that imports through `#private/*` therefore cannot load
// there at all.
//
// The failure mode is the worst available one. A missing module aborts mocha
// during file LOAD, before a single test runs, so the suite reports zero tests
// rather than one failure: a blackout dressed as a normal red. It took thirteen
// hours and three sessions to attribute the last one, because the commit that
// went red had nothing to do with the file that caused it -- a spec had merely
// imported one PURE function from a core module that happened to carry a
// top-level `#private` import, and that import took everything down with it.
//
// The layering this enforces is the one the codebase already follows almost
// everywhere: dependencies run private -> core, not core -> private. private/ is
// a downstream PLUGIN built on the public platform (it imports libs-shared,
// libs-server, db and constants hundreds of times over), and the platform must
// not reach back into it.
//
//   core (libs-shared, libs-server, api, app)  never imports #private
//   composition roots (scripts, jobs)          may import #private
//   plugin (private/)                          imports core freely
//
// scripts/ and jobs/ are exempt because they are ENTRY POINTS: they are invoked
// deliberately, the test suite never loads them, and "this importer is
// unavailable without the submodule" is an honest thing for one to say. Core is
// different -- it is the open-source product, and it has to stand up alone.
//
// Dynamic `import()` is deliberately NOT reported, and the line is drawn exactly
// where the failure is. A static import runs at module LOAD, so it takes the
// importing module and every spec that touches it down with it -- that is the
// blackout. A lazy `await import('#private/...')` inside a function leaves the
// module perfectly loadable; CI never notices, because CI never calls it.
//
// That lazy form is an established convention here, not an oversight:
// get-data-view-results.mjs wraps it in try/catch and falls back to an empty
// mapping, and underdog.mjs memoizes it behind a loader precisely so the
// #libs-server barrel stays importable without the submodule. Banning it would
// break a pattern the codebase adopted on purpose.
//
// Deferral is not automatically the right answer either. When the module holding
// the private dependency is otherwise PURE -- as player-identity-sources.mjs was,
// a set of row mappers a spec wanted -- the fix is to move the fetching code to
// its consumer in scripts/, not to hide the import behind a lazy call. Deferring
// there would have left pure functions permanently entangled with a vendor. Ask
// which half of the module actually needs private, and relocate that half.
//
// NO baseline allowance, deliberately. The move that made core private-free went
// to zero, so zero is the honest enforcement, and a baseline file would be a
// second thing to maintain. Scope is by path in eslint.config.mjs, so this rule
// never has to know which directory it is looking at.

const RULE_ID = 'no-private-import-in-core'

const PRIVATE_SPECIFIER = /^#private(\/|$)/

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'ban #private imports from core, which cannot resolve without the submodule'
    },
    schema: [],
    messages: {
      privateImport:
        'Core (libs-shared, libs-server, api, app) must not STATICALLY import {{source}}. private/ is a submodule CI never checks out, so this makes the module -- and every spec that imports it -- fail to LOAD, taking the whole suite to zero tests. Either move the code that needs private into scripts/ or jobs/, or, if this module is a vendor wrapper, reach it through a lazy await import() inside the function that needs it.'
    }
  },
  create(context) {
    const report = (node, source) =>
      context.report({ node, messageId: 'privateImport', data: { source } })

    return {
      // import ... from '#private/...'
      ImportDeclaration(node) {
        if (PRIVATE_SPECIFIER.test(node.source.value)) {
          report(node, node.source.value)
        }
      },

      // export ... from '#private/...' -- re-exporting resolves the module just
      // as a plain import does, so it fails identically.
      ExportNamedDeclaration(node) {
        if (node.source && PRIVATE_SPECIFIER.test(node.source.value)) {
          report(node, node.source.value)
        }
      },

      ExportAllDeclaration(node) {
        if (node.source && PRIVATE_SPECIFIER.test(node.source.value)) {
          report(node, node.source.value)
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
