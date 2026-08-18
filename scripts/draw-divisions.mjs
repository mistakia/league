import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'

import db from '#db'
import { current_season } from '#constants'
import { chunk_mutating } from '#libs-shared/chunk.mjs'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

// Draw a league's Divisions under Article V Section 13.
//
// The Division structure is DERIVED from the league's size, not chosen by the
// caller: ten teams means no Divisions, twelve means four of three, and any other
// count is unconstituted and throws. That is why this takes no division count --
// a caller who could pass one could produce a structure the league never voted
// for, which is the thing Amendment XL was written to prevent.
//
// The draw itself happens OUTSIDE this script, against a predetermined future
// Ethereum block, so that no one -- the Commissioner included -- can grind it.
// The two halves:
//
//   1. `--pots` computes the three power-index pots and prints them. Nothing
//      random has happened yet: the pots are a deterministic function of the two
//      preceding Qualifying Seasons. That output is what gets announced.
//
//   2. `--pot_order` applies a resolved draw. Each pot is given in its drawn
//      order, and Division i takes the i-th team of every pot -- which is exactly
//      "at random, one Team shall be selected from each pot to form a Division"
//      with the randomness made auditable.
//
// The tooling for the commitment lives in user-base at cli/league/announce-draw.mjs
// and cli/league/resolve-draw.mjs; the records live in data/league/draws/.

const log = debug('draw-divisions')
if (!process.env.DEBUG) {
  debug.enable('draw-divisions')
}

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

// Article V Section 13, subsections (a) through (c).
export const division_count_for_league_size = (number_teams) => {
  if (number_teams === 10) return 0
  if (number_teams === 12) return 4

  throw new Error(
    `Article V Section 13(c) bars a LEAGUE of ${number_teams} Teams: the constitution prescribes ` +
      'a Division structure at ten (none) and at twelve (four of three) only. An amendment is ' +
      'needed before this league size can be drawn.'
  )
}

const min_max_normalize = (values) => {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min

  // Every team identical on this input: normalizing would divide by zero, and
  // the honest answer is that the input separates nobody.
  if (span === 0) return values.map(() => 0)

  return values.map((value) => (value - min) / span)
}

/**
 * Power index per Article V Section 13(d): head-to-head win percentage plus
 * points for per game, each min-max normalized across the league, over the two
 * preceding Qualifying Seasons (or fewer for a team that has competed in fewer).
 */
export const compute_power_indexes = ({ teams, seasonlogs }) => {
  const per_team = teams.map((team) => {
    const logs = seasonlogs.filter((log_row) => log_row.tid === team.team_id)

    let wins = 0
    let losses = 0
    let ties = 0
    let points_for = 0

    for (const row of logs) {
      wins += row.regular_season_wins || 0
      losses += row.regular_season_losses || 0
      ties += row.regular_season_ties || 0
      points_for += Number(row.points_for) || 0
    }

    const games = wins + losses + ties
    // A tie counts as one half of a win, matching the Article II definition the
    // amendment added for All Play.
    const win_pct = games ? (wins + ties / 2) / games : 0
    const points_for_per_game = games ? points_for / games : 0

    return {
      tid: team.team_id,
      name: team.name,
      seasons: logs.length,
      games,
      win_pct,
      points_for_per_game
    }
  })

  const normalized_win_pct = min_max_normalize(per_team.map((t) => t.win_pct))
  const normalized_points = min_max_normalize(
    per_team.map((t) => t.points_for_per_game)
  )

  return per_team
    .map((team, index) => ({
      ...team,
      power_index: normalized_win_pct[index] + normalized_points[index]
    }))
    .sort((a, b) => b.power_index - a.power_index)
}

export const build_pots = ({ power_indexes, num_divisions }) => {
  const pot_count = 3
  const pot_size = power_indexes.length / pot_count

  if (!Number.isInteger(pot_size)) {
    throw new Error(
      `${power_indexes.length} teams do not divide into ${pot_count} pots of equal size`
    )
  }

  if (pot_size !== num_divisions) {
    throw new Error(
      `pot size ${pot_size} does not match the ${num_divisions} Divisions to be formed`
    )
  }

  return chunk_mutating({ items: [...power_indexes], chunk_size: pot_size })
}

const print_pots = (pots) => {
  pots.forEach((pot, index) => {
    console.log(`Pot ${index + 1}`)
    const table = new Table()
    for (const team of pot) {
      table.addRow({
        tid: team.tid,
        team: team.name,
        PowerIndex: team.power_index.toFixed(4),
        WinPct: team.win_pct.toFixed(4),
        PFPerGame: team.points_for_per_game.toFixed(2),
        Seasons: team.seasons
      })
    }
    table.printTable()
  })
}

/**
 * Zip drawn pots into Divisions: Division i takes the i-th team of every pot.
 */
export const assign_divisions = ({ drawn_pots, num_divisions }) => {
  for (const [index, pot] of drawn_pots.entries()) {
    if (pot.length !== num_divisions) {
      throw new Error(
        `drawn pot ${index + 1} holds ${pot.length} team(s); ${num_divisions} expected`
      )
    }
  }

  const assignments = new Map()
  for (let i = 0; i < num_divisions; i++) {
    for (const pot of drawn_pots) {
      assignments.set(pot[i], i + 1)
    }
  }

  return assignments
}

const run = async ({ lid, pots: print_pots_only, pot_order, dry_run }) => {
  const teams = await db('teams').where({
    lid,
    season_year: current_season.year
  })

  if (!teams.length) {
    throw new Error(`no teams for league ${lid} in ${current_season.year}`)
  }

  const num_divisions = division_count_for_league_size(teams.length)
  log(`${teams.length} teams -> ${num_divisions || 'no'} division(s)`)

  if (num_divisions === 0) {
    // No Divisions exist, so no team has one. NULL is the value that says that;
    // a placeholder 1 would read as "Division 1 of 1", which is a structure the
    // constitution does not describe and which every consumer would then have to
    // special-case by counting.
    if (print_pots_only || pot_order) {
      throw new Error(
        `a ${teams.length}-team LEAGUE has no Divisions under Article V Section 13(a); ` +
          'there is nothing to draw'
      )
    }

    if (dry_run) {
      log(`[dry run] would clear division on ${teams.length} team(s)`)
      return { num_divisions, cleared: teams.length }
    }

    await db('teams')
      .update({ division: null })
      .where({ lid, season_year: current_season.year })

    log(`cleared division on ${teams.length} team(s)`)
    return { num_divisions, cleared: teams.length }
  }

  // Section 13(d) computes the power index over the two PRECEDING Qualifying
  // Seasons -- the current year is excluded, since it has not been played.
  const first_year = current_season.year - 2
  const last_year = current_season.year - 1
  const seasonlogs = await db('league_team_seasonlogs')
    .where('lid', lid)
    .whereBetween('season_year', [first_year, last_year])
    .whereIn(
      'tid',
      teams.map((team) => team.team_id)
    )

  const power_indexes = compute_power_indexes({ teams, seasonlogs })
  const pots = build_pots({ power_indexes, num_divisions })

  if (print_pots_only) {
    print_pots(pots)
    console.log('')
    console.log(
      'Announce this input to the draw as three groups, in pot order:'
    )
    console.log(
      JSON.stringify(
        pots.map((pot) =>
          pot.map((team) => ({ uid: team.tid, name: team.name }))
        ),
        null,
        2
      )
    )
    return { num_divisions, pots }
  }

  if (!pot_order) {
    throw new Error(
      'pass --pots to compute the pots for announcement, or --pot_order to apply a resolved draw'
    )
  }

  const drawn_pots = String(pot_order)
    .split(';')
    .map((pot) => pot.split(',').map((value) => Number(value.trim())))

  if (drawn_pots.length !== pots.length) {
    throw new Error(
      `--pot_order gives ${drawn_pots.length} pot(s); ${pots.length} expected`
    )
  }

  // The drawn order may only permute WITHIN a pot -- the pots themselves are
  // deterministic, so a team appearing in the wrong one means the draw was run
  // against a different input than this league's current standings.
  for (const [index, pot] of pots.entries()) {
    const expected = new Set(pot.map((team) => team.tid))
    const drawn = new Set(drawn_pots[index])
    if (
      drawn.size !== expected.size ||
      [...expected].some((tid) => !drawn.has(tid))
    ) {
      throw new Error(
        `--pot_order pot ${index + 1} holds ${[...drawn].join(',')}, but the computed pot is ` +
          `${[...expected].join(',')}. The draw was announced against different pots.`
      )
    }
  }

  const assignments = assign_divisions({ drawn_pots, num_divisions })

  for (let division = 1; division <= num_divisions; division++) {
    const members = [...assignments.entries()]
      .filter(([, div]) => div === division)
      .map(([tid]) => tid)
    console.log(
      `Division ${division}: ${members
        .map((tid) => teams.find((team) => team.team_id === tid).name)
        .join(', ')}`
    )
  }

  if (dry_run) {
    log('[dry run] no writes')
    return { num_divisions, assignments }
  }

  for (const [tid, division] of assignments.entries()) {
    await db('teams')
      .update({ division })
      .where({ team_id: tid, lid, season_year: current_season.year })
  }

  return { num_divisions, assignments }
}

export default run

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    if (!argv.lid) {
      throw new Error('missing --lid')
    }

    await run({
      lid: argv.lid,
      pots: Boolean(argv.pots),
      pot_order: argv.pot_order,
      dry_run: Boolean(argv.dry)
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.DRAW_DIVISIONS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}
