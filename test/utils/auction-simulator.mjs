import { current_season, transaction_types } from '#constants'
import {
  submit_auction_election,
  withdraw_auction_election
} from '#libs-server/auction-elections.mjs'

// A SEEDED AUCTION, DRIVEN THROUGH THE REAL WRITE PATHS, ASSERTING AFTER EVERY
// STEP.
//
// The four spec layers each cover one mechanism in isolation. This is the only
// thing that exercises their INTERACTION, and interaction is where this
// subsystem's defects have actually lived: a settlement racing a bid clock, a
// stall inheriting the final block, a socket cache that a REST write moved. Each
// of those looks correct in the module that owns it.
//
// It is deterministic on purpose. A simulator that cannot reproduce its own
// failure is a flake generator, so the PRNG is seeded, every choice runs through
// it, and the step log is the comparable artifact -- `run_auction_simulation`
// twice on one seed must produce identical logs.

// mulberry32. Small, exactly reproducible, and it does not pull a dependency in
// for eight lines of arithmetic.
export const seeded_random = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The manager profiles the plan names. Each answers one question -- what does
// this team do about a player -- and the point of the set is that a real auction
// contains all of them at once.
export const MANAGER_PROFILES = {
  // States a ceiling the moment a player is nominated and is never present.
  // The design's central bet: this manager should never be penalised for it.
  ABSENT_CEILING: 'absent_ceiling',
  // Declines everything. Satisfies completeness and never competes.
  DECLINER: 'decliner',
  // Holds out while everyone else elects, then relents. The board CANNOT move
  // past a team that never acts -- the auction is strictly sequential and the
  // next nomination is refused while a player is open -- so a permanently silent
  // team produces a one-nomination simulation, which is the design working
  // rather than something to assert against. The stall is what gets exercised
  // here; the final block is what bounds it, and that is auction.stall.spec.mjs.
  SILENT: 'silent',
  // Elects, then withdraws before settlement -- back into the outstanding set.
  WITHDRAWER: 'withdrawer'
}

const snapshot = async ({ knex, lid, season_year }) => {
  const teams = await knex('teams')
    .where({ lid, season_year })
    .select('team_id', 'salary_cap')
  const roster_rows = await knex('rosters_players')
    .where({ lid, season_year, week: 0 })
    .select('tid', 'pid')
  const processed = await knex('transactions')
    .where({ lid, season_year, type: transaction_types.AUCTION_PROCESSED })
    .select('tid', 'pid', 'player_salary')

  const roster_count = new Map()
  for (const row of roster_rows) {
    roster_count.set(row.tid, (roster_count.get(row.tid) || 0) + 1)
  }

  return {
    cap: new Map(teams.map((team) => [team.team_id, team.salary_cap])),
    roster_count,
    roster_pids: roster_rows.map((row) => row.pid),
    processed
  }
}

// THE INVARIANTS, checked against the PREVIOUS snapshot rather than against a
// remembered constant, so a violation names the step that caused it.
//
// Every one of these is a property the settlement model rests on rather than a
// nice-to-have: eligibility is monotone only because rosters and budgets move in
// one direction, and completeness stays reached only because eligibility is
// monotone.
export const check_invariants = ({ before, after, step }) => {
  const failures = []
  const at = (message) =>
    failures.push(`step ${step.index} (${step.kind}): ${message}`)

  for (const [tid, cap] of after.cap) {
    const previous = before.cap.get(tid)
    if (previous !== undefined && cap > previous) {
      at(`team ${tid} remaining cap ROSE, ${previous} -> ${cap}`)
    }
  }

  for (const [tid, count] of before.roster_count) {
    const now = after.roster_count.get(tid) || 0
    if (now < count) {
      at(`team ${tid} roster SHRANK, ${count} -> ${now}`)
    }
  }

  const seen = new Set()
  for (const pid of after.roster_pids) {
    if (seen.has(pid)) at(`${pid} is on more than one roster`)
    seen.add(pid)
  }

  const sold = new Map()
  for (const row of after.processed) {
    if (sold.has(row.pid)) {
      at(`${row.pid} sold more than once`)
    }
    sold.set(row.pid, row)
    if (row.player_salary < 0) {
      at(`${row.pid} sold at a negative price ${row.player_salary}`)
    }
  }

  // A sale must put the player on the buyer's roster. The two are written in one
  // transaction, so a divergence means a settlement half-committed.
  for (const [pid, row] of sold) {
    if (!after.roster_pids.includes(pid)) {
      at(`${pid} sold to team ${row.tid} but is on no roster`)
    }
  }

  return failures
}

/**
 * Drive a seeded auction against a real league, asserting invariants per step.
 *
 * @returns {Promise<{log: Array, failures: Array<string>, sold: number}>}
 */
export const run_auction_simulation = async ({
  knex,
  auction,
  lid,
  season_year = current_season.year,
  seed = 1,
  max_players = 6,
  user_id = 1
}) => {
  const random = seeded_random(seed)
  const log = []
  const failures = []

  const teams = await knex('teams')
    .where({ lid, season_year })
    .orderBy('draft_order')
  const tids = teams.map((team) => team.team_id)

  // Profiles assigned OFF THE SEED, so a seed reproduces the cast as well as the
  // choices. Every profile is present at least once whenever there are enough
  // teams, because the interaction is the point.
  const profile_values = Object.values(MANAGER_PROFILES)
  const profiles = new Map(
    tids.map((tid, index) => [
      tid,
      index < profile_values.length
        ? profile_values[index]
        : profile_values[Math.floor(random() * profile_values.length)]
    ])
  )

  const record = async (kind, detail, before) => {
    const after = await snapshot({ knex, lid, season_year })
    const step = { index: log.length, kind, ...detail }
    failures.push(...check_invariants({ before, after, step }))
    log.push(step)
    return after
  }

  let state = await snapshot({ knex, lid, season_year })
  let sold = 0

  for (let placed = 0; placed < max_players; placed++) {
    // RELOAD BEFORE READING THE TURN. Every settlement here lands over REST, and
    // `nominating_team_id` reads the socket's transaction cache, which no REST
    // write tells about -- so without this the simulator nominates for the team
    // that held the turn a player ago. That is the subsystem's oldest defect
    // shape, and the simulator has to drive correctly rather than reproduce it.
    await auction._load_transactions()
    const nominating_team_id = auction.nominating_team_id
    if (!nominating_team_id) break

    // The board, in the order the auction itself offers it, minus anything
    // already rostered anywhere.
    const rostered = new Set(state.roster_pids)
    const candidates = await knex('player')
      .whereNotIn('pid', [...rostered])
      .whereIn('primary_position', ['QB', 'RB', 'WR', 'TE'])
      .orderBy('pid')
      .limit(200)
    const candidate = candidates[Math.floor(random() * candidates.length)]
    if (!candidate) break

    const opening = Math.floor(random() * 3)
    await auction.nominate(
      { pid: candidate.pid, value: opening, user_id },
      { user_id, tid: nominating_team_id }
    )
    state = await record(
      'nominate',
      { pid: candidate.pid, tid: nominating_team_id, value: opening },
      state
    )

    // A REFUSED NOMINATION IS NOT A QUIET NO-OP TO STEP PAST. Everything below
    // elects on this player, and against a player nobody opened those writes
    // mean something different -- so stop and say so rather than carrying on
    // producing steps that look like an auction.
    const opened = await knex('transactions')
      .where({
        lid,
        season_year,
        pid: candidate.pid,
        type: transaction_types.AUCTION_BID
      })
      .limit(1)
    if (!opened.length) {
      failures.push(
        `step ${log.length}: nomination of ${candidate.pid} by team ${nominating_team_id} was refused`
      )
      break
    }

    const holdouts = []
    for (const tid of tids) {
      if (tid === nominating_team_id) continue
      const profile = profiles.get(tid)

      if (profile === MANAGER_PROFILES.SILENT) {
        holdouts.push(tid)
        continue
      }

      if (profile === MANAGER_PROFILES.DECLINER) {
        await submit_auction_election({
          lid,
          tid,
          pid: candidate.pid,
          user_id,
          maximum_bid: null
        })
        state = await record('decline', { tid, pid: candidate.pid }, state)
        continue
      }

      if (profile === MANAGER_PROFILES.WITHDRAWER) {
        const amount = Math.floor(random() * 12)
        await submit_auction_election({
          lid,
          tid,
          pid: candidate.pid,
          user_id,
          maximum_bid: amount
        })
        state = await record(
          'elect',
          { tid, pid: candidate.pid, maximum_bid: amount },
          state
        )
        await withdraw_auction_election({
          lid,
          tid,
          pid: candidate.pid,
          user_id
        })
        state = await record('withdraw', { tid, pid: candidate.pid }, state)
        // Back in the outstanding set, so it has to elect again or the board
        // stalls -- which is the behavior under test, not a cleanup.
        await submit_auction_election({
          lid,
          tid,
          pid: candidate.pid,
          user_id,
          maximum_bid: null
        })
        state = await record('re-decline', { tid, pid: candidate.pid }, state)
        continue
      }

      const amount = Math.floor(random() * 20)
      await submit_auction_election({
        lid,
        tid,
        pid: candidate.pid,
        user_id,
        maximum_bid: amount
      })
      state = await record(
        'elect',
        { tid, pid: candidate.pid, maximum_bid: amount },
        state
      )
    }

    // THE STALL, AND THEN THE RELENT. Everyone else has elected and the player
    // is still open, held by the teams the outstanding set is waiting on. That
    // state is asserted rather than assumed -- if the player had already settled
    // with a holdout outstanding, completeness would not mean what the whole
    // model says it means.
    if (holdouts.length) {
      const settled_early = state.processed.some(
        (row) => row.pid === candidate.pid
      )
      if (settled_early) {
        failures.push(
          `step ${log.length}: ${candidate.pid} settled while ${holdouts.length} team(s) were still outstanding`
        )
      }
      log.push({ index: log.length, kind: 'stalled', pid: candidate.pid })

      for (const tid of holdouts) {
        await submit_auction_election({
          lid,
          tid,
          pid: candidate.pid,
          user_id,
          maximum_bid: null
        })
        state = await record('relent', { tid, pid: candidate.pid }, state)
      }
    }

    const settled = state.processed.some((row) => row.pid === candidate.pid)
    if (settled) sold++
    log.push({
      index: log.length,
      kind: 'nomination-closed',
      pid: candidate.pid,
      settled
    })
  }

  return { log, failures, sold, profiles }
}

export default { run_auction_simulation, seeded_random, MANAGER_PROFILES }
