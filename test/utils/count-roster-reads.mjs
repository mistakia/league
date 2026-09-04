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
export const count_roster_reads = async (run) => {
  const reads = []
  const record = (query) => {
    if (/from "rosters" where "tid" = /.test(query.sql)) {
      reads.push(Number(query.bindings[0]))
    }
  }

  knex.on('query', record)
  try {
    const result = await run()
    return { result, reads }
  } finally {
    // REMOVED IN A `finally`. A listener left attached outlives the spec and
    // keeps appending to an array nobody reads, which turns a later assertion
    // about read counts into an unexplained inflated number.
    knex.removeListener('query', record)
  }
}

export default count_roster_reads
