// A gate that cannot SEE a file cannot go red on it, so a gate whose declared
// corpus is partly absent is reporting a narrower result than its verdict line
// claims. Every scanner here filtered its roots through fs.existsSync or
// swallowed ENOENT inside the walk, which drops a missing root silently and
// leaves an unqualified `GATE OK` standing over a directory that was never
// read. That is not coverage, it is a confident zero.
//
// The live instance is `private/`, a submodule NO workflow checks out (there is
// no `submodules:` key in any file under .github/workflows). So on the runner
// it is an empty directory, and check-league-fixture-reset-coverage -- which
// names it in WRITER_ROOTS and does run in CI -- had been passing green there
// over a root it never opened. The cost is not hypothetical: private/test was
// still updating `seasons.year` long after the conform renamed the column to
// season_year, because every consumer sweep that would have caught it ran over
// a corpus private/ was not in.
//
// Declaring the corpus does not make CI check the submodule out, and is not
// meant to. It makes the narrowing VISIBLE, so a green in CI and a green
// locally stop being the same claim.

import fs from 'fs'
import path from 'path'

// The marker the cluster runner keys its OK (PARTIAL) verdict on. Anything
// printing this must mean it, and anything meaning it must print it.
export const CORPUS_INCOMPLETE_MARKER = 'CORPUS INCOMPLETE'

/**
 * Split declared roots into the ones this gate actually read and the ones it
 * did not.
 *
 * @param {object} params
 * @param {string[]} params.roots repo-relative directory names
 * @param {string} params.repo_root absolute path to the repository root
 * @param {Map<string, number>|object} [params.counts] files the caller actually
 *   read per root. When given it is authoritative and the filesystem is not
 *   consulted, because a root that yielded no files cannot produce a finding.
 * @returns {{ roots: string[], present: string[], missing: string[],
 *   reasons: object }} `reasons` maps each missing root to why it was unread:
 *   `absent`, `empty (uninitialized submodule?)`, `no files read` or
 *   `not walked`.
 */
export const resolve_corpus = ({ roots, repo_root, counts }) => {
  const present = []
  const missing = []
  const reasons = {}

  for (const root of roots) {
    // When the caller knows how many files it actually read, that is the
    // authoritative answer and nothing here can second-guess it: a root that
    // yielded no files cannot produce a finding, whatever the filesystem says.
    if (counts) {
      const read = counts instanceof Map ? counts.get(root) : counts[root]
      if (read > 0) {
        present.push(root)
      } else {
        missing.push(root)
        reasons[root] = read === undefined ? 'not walked' : 'no files read'
      }
      continue
    }

    let entries = null
    try {
      entries = fs.readdirSync(path.join(repo_root, root))
    } catch {
      // ENOENT and EACCES are indistinguishable here and are treated the same:
      // either way this gate did not read the root, which is the only fact the
      // verdict depends on.
      entries = null
    }

    if (entries === null) {
      missing.push(root)
      reasons[root] = 'absent'
      continue
    }

    // An EMPTY directory is the case that matters and the one a bare
    // existsSync/statSync check gets wrong. An uninitialized git submodule is
    // a present, empty MOUNTPOINT -- `git worktree add` and a CI checkout
    // without `submodules:` both produce exactly that -- so an existence check
    // reports `private` as scanned and the gate then prints an unqualified
    // GATE OK over nothing. Measured against a worktree at HEAD, which is what
    // the runner sees.
    if (entries.length === 0) {
      missing.push(root)
      reasons[root] = 'empty (uninitialized submodule?)'
      continue
    }

    present.push(root)
  }

  return { roots, present, missing, reasons }
}

/**
 * The corpus block, printed BEFORE any findings. Ordering matters: a reader who
 * stops at the first finding should already know what was and was not scanned.
 *
 * @param {object} params
 * @param {{ roots: string[], missing: string[], reasons: object }} params.corpus
 *   as returned by resolve_corpus
 * @param {Map<string, number>|object} [params.counts] files scanned per root
 * @returns {string}
 */
export const format_corpus = ({ corpus, counts }) => {
  const read = (root) => {
    if (!counts) return ''
    const value = counts instanceof Map ? counts.get(root) : counts[root]
    return value === undefined ? '' : `  ${String(value).padStart(5)} files`
  }

  const lines = ['CORPUS']
  for (const root of corpus.roots) {
    const is_missing = corpus.missing.includes(root)
    const state = is_missing ? 'MISSING' : 'scanned'
    const reason = is_missing
      ? `  -- ${corpus.reasons?.[root] ?? 'absent'}`
      : ''
    lines.push(`  ${state.padEnd(8)} ${root}${read(root)}${reason}`)
  }

  if (corpus.missing.length) {
    lines.push(
      '',
      `  ${CORPUS_INCOMPLETE_MARKER} -- not scanned: ${corpus.missing.join(', ')}`,
      '  This gate cannot report a finding in a root it did not read, so its',
      '  verdict below is scoped to the roots marked scanned above.'
    )
  }

  return lines.join('\n')
}

/**
 * The suffix a gate appends to its own success line, so `GATE OK` never appears
 * unqualified over a corpus that was only partly read.
 *
 * @param {{ missing: string[] }} corpus
 * @returns {string}
 */
export const verdict_suffix = (corpus) =>
  corpus.missing.length
    ? ` (${CORPUS_INCOMPLETE_MARKER}: ${corpus.missing.join(', ')})`
    : ''
