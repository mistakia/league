import knex from '#db'

/**
 * Which teams' rosters a block of work actually read.
 *
 * WORK NOT DONE IS INVISIBLE TO AN OUTCOME ASSERTION. Every capacity narrowing
 * in the settlement path produces the same answer as the sweep it replaces --
 * that is the point of it -- so nothing about the result can tell the two
 * apart. The queries can, and this is the only thing in the suite that sees
 * them.
 *
 * `getRoster` opens with `select * from "rosters" where "tid" = $1 ...`, so the
 * tid is the first binding. Matched on the FROM clause and the tid predicate
 * TOGETHER, for two reasons: a bare `rosters` substring also matches every
 * `rosters_players` query, whose first binding is not a tid at all, and an
 * earlier attempt anchored on `from "rosters"` with a trailing `\b`, which
 * cannot match after a closing quote and reported a confident zero for every
 * team.
 *
 * Every read is APPENDED rather than collected into a set, so a team read twice
 * stays visible as two entries. A double sweep is exactly the thing being
 * measured, and a set would report it as one.
 *
 * @param {() => Promise<any>} run
 * @returns {Promise<{result: any, reads: number[]}>} reads in issue order
 */
const ROSTER_READ = /from "rosters" where "tid" = /

/**
 * Start recording, and hand back the stopper.
 *
 * The form a spec wants when the reads span lifecycle hooks rather than one
 * awaited block — a `beforeEach` starts it, an `afterEach` stops it. Both forms
 * exist because both are needed and a second copy of the pattern is how the
 * regex above ends up with two versions, one of which is wrong.
 *
 * @param {(tid: number) => void} on_read
 * @returns {() => void} stop, safe to call more than once
 */
export const record_roster_reads = (on_read) => {
  const record = (query) => {
    if (ROSTER_READ.test(query.sql)) on_read(Number(query.bindings[0]))
  }
  knex.on('query', record)

  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    knex.removeListener('query', record)
  }
}

export const count_roster_reads = async (run) => {
  const reads = []
  // REMOVED IN A `finally`. A listener left attached outlives the spec and
  // keeps appending to an array nobody reads, which turns a later assertion
  // about read counts into an unexplained inflated number.
  const stop = record_roster_reads((tid) => reads.push(tid))
  try {
    const result = await run()
    return { result, reads }
  } finally {
    stop()
  }
}

export default count_roster_reads
