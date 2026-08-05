import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { JSDOM } from 'jsdom'

import db from '#db'
import { is_main, report_job, updatePlayer } from '#libs-server'
import { fixTeam, format_player_name } from '#libs-shared'
import { current_season } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('import-nfl-player-ids')
debug.enable('import-nfl-player-ids,update-player')

// `player.nfl_player_id` is the NFL.com shield id — the numeric half of the old
// nfl.com player URL path (`tombrady/2504211`). Its original supplier was
// MyFantasyLeague via `import-mfl-players.mjs`, whose write path is commented
// out; MFL and dynastyprocess both stopped populating it for players entering
// from 2016, which is why coverage runs 84-97% for draft years 2012-2020 and
// then collapses to 4-11% for 2021-2025 and 0% for 2026.
//
// NFL.com never retired the scheme. This importer reads it back from the
// source, closing the cliff for the population NFL.com still serves.
//
// ## The id space is NOT bounded to 25xxxxx
//
// The 2490000-2600000 block is where the ids are dense and monotone in entry
// cohort, but NFL.com's own id space genuinely includes small legacy values,
// confirmed live against fantasy.nfl.com: 264 is Josh Johnson, 382 is Joe
// Flacco, 744 is Calais Campbell and 79860 is Matthew Stafford. Do not add a
// range CHECK to this column and do not treat an out-of-block value as corrupt.
//
// ## Resolution is id-first, then name scoped to current NFL participation
//
// An era-unscoped name attach is the defect class this whole cluster exists to
// close: it is what put one person's identifiers on another person's row, most
// often a father and a son sharing a name. Every player in this feed is on a
// current NFL roster, so a name match is only admissible against a row that
// could plausibly be that player TODAY. The scope is built from participation
// evidence rather than from `current_nfl_team`, which reads 'INA' for retired
// players and is what made the previous suspect writer unable to reach them.
//
// Matching is unique-or-abstain at every stage. Two rows tying on name after
// team and position narrowing are left alone and reported, because attaching
// to either one is exactly the coin flip that produced the existing damage.

const NFL_RESEARCH_URL = 'https://fantasy.nfl.com/research/players'
const PLAYERS_PER_PAGE = 100

// The listing runs out somewhere past offset 1000; this bounds a runaway loop
// without pinning the ceiling to a number the feed can change under us.
const MAX_PAGES = 40

// Pace against elapsed time rather than sleeping a fixed amount between
// requests: a fixed sleep ADDS to network latency instead of bounding a rate,
// so the achieved rate depends on which host runs the job and the fast host is
// always the one that ships.
const REQUEST_INTERVAL_MS = 1500

// A player who last participated more than this many seasons ago is not on a
// current roster. Two seasons rather than one so that a player who missed all
// of last season — injured reserve, a free-agent year — still resolves.
const PARTICIPATION_LOOKBACK_SEASONS = 2

let next_request_at = 0

const paced_fetch = async (url) => {
  const now = Date.now()
  if (now < next_request_at) {
    await new Promise((resolve) => setTimeout(resolve, next_request_at - now))
  }
  next_request_at = Math.max(Date.now(), next_request_at) + REQUEST_INTERVAL_MS

  const response = await fetch(url, {
    headers: {
      accept: 'text/html',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}`)
  }

  return response.text()
}

/**
 * Each listing row carries the shield id in the player-card anchor and the
 * position and team in an `<em>` beside the name, formatted `RB - SF`. A row
 * for a free agent carries the position alone.
 */
export const parse_listing_page = (html) => {
  const { document } = new JSDOM(html).window
  const players = []

  for (const anchor of document.querySelectorAll('a.playerCard.playerName')) {
    const href = anchor.getAttribute('href') || ''
    const id_match = /playerId=(\d+)/.exec(href)
    if (!id_match) continue

    const name = anchor.textContent.trim()
    if (!name) continue

    const detail = anchor.parentElement?.querySelector('em')?.textContent || ''
    const [raw_position, raw_team] = detail
      .split('-')
      .map((part) => part.trim())

    players.push({
      nfl_player_id: Number(id_match[1]),
      name,
      formatted_name: format_player_name(name),
      position: raw_position ? raw_position.toUpperCase() : null,
      team: raw_team ? fixTeam(raw_team) : null
    })
  }

  return players
}

export const fetch_all_listed_players = async () => {
  const by_id = new Map()

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PLAYERS_PER_PAGE
    const url = `${NFL_RESEARCH_URL}?offset=${offset}&count=${PLAYERS_PER_PAGE}&position=0`
    const players = parse_listing_page(await paced_fetch(url))

    log(`offset ${offset}: ${players.length} players`)
    if (!players.length) break

    let new_on_page = 0
    for (const player of players) {
      if (by_id.has(player.nfl_player_id)) continue
      by_id.set(player.nfl_player_id, player)
      new_on_page++
    }

    // The feed clamps rather than erroring past its last page, so a page that
    // repeats what we already hold is the real end-of-listing signal.
    if (!new_on_page) {
      log(`offset ${offset} returned no new players; end of listing`)
      break
    }
  }

  return [...by_id.values()]
}

/**
 * Player rows eligible for a NAME match against a current-roster feed.
 *
 * Membership requires positive evidence of recent NFL participation, or of
 * being too recent an entrant to have any yet. `roster_status` alone is not
 * enough — 5,459 rows carry none at all — and `current_nfl_team` alone is not
 * enough either, since it goes stale in both directions.
 *
 * @param {boolean} only_unfilled - the importer wants only rows it can fill, so
 *   it passes true. The attribution audit needs the same scope over rows that
 *   ALREADY hold a value, in order to find one contradicting the feed, so it
 *   passes false. The scope must be identical either way or the audit would
 *   measure a population the importer cannot act on.
 */
export const load_name_match_scope = async ({ only_unfilled = true } = {}) => {
  const earliest_participation_season =
    current_season.year - PARTICIPATION_LOOKBACK_SEASONS

  const rows = await db('player')
    .select(
      'player.pid',
      'player.formatted_name',
      'player.primary_position',
      'player.current_nfl_team',
      'player.nfl_player_id',
      'player.nfl_draft_year'
    )
    .modify((query) => {
      if (only_unfilled) query.whereNull('player.nfl_player_id')
    })
    .whereNot(function () {
      this.where('player.roster_status', 'RETIRED')
    })
    .where(function () {
      this.whereExists(function () {
        this.select(1)
          .from('player_gamelogs')
          .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
          .whereRaw('player_gamelogs.pid = player.pid')
          .where('nfl_games.season_year', '>=', earliest_participation_season)
      })
        .orWhere(
          'player.nfl_draft_year',
          '>=',
          current_season.year - PARTICIPATION_LOOKBACK_SEASONS
        )
        .orWhere(function () {
          this.whereNotNull('player.current_nfl_team').whereNotIn(
            'player.current_nfl_team',
            ['INA']
          )
        })
    })

  const by_formatted_name = new Map()
  for (const row of rows) {
    if (!row.formatted_name) continue
    if (!by_formatted_name.has(row.formatted_name)) {
      by_formatted_name.set(row.formatted_name, [])
    }
    by_formatted_name.get(row.formatted_name).push(row)
  }

  log(
    `name-match scope: ${rows.length} player rows across ${by_formatted_name.size} names`
  )

  return by_formatted_name
}

/**
 * Narrow a name group to a single row, or abstain. Team is tried before
 * position because it is the sharper discriminator on a current roster: two
 * players sharing a name AND a team is far rarer than two sharing a name and a
 * fantasy position.
 */
export const resolve_unique_candidate = ({ candidates, listed_player }) => {
  if (candidates.length === 1) {
    return { player_row: candidates[0], basis: 'name' }
  }

  if (listed_player.team) {
    const same_team = candidates.filter(
      (row) => row.current_nfl_team === listed_player.team
    )
    if (same_team.length === 1) {
      return { player_row: same_team[0], basis: 'name_and_team' }
    }
  }

  if (listed_player.position) {
    const same_position = candidates.filter(
      (row) => row.primary_position === listed_player.position
    )
    if (same_position.length === 1) {
      return { player_row: same_position[0], basis: 'name_and_position' }
    }
  }

  return { player_row: null, basis: 'ambiguous' }
}

const import_nfl_player_ids = async ({ dry = false } = {}) => {
  const listed_players = await fetch_all_listed_players()
  log(`${listed_players.length} players listed by nfl.com`)

  if (!listed_players.length) {
    throw new Error('nfl.com listing returned no players')
  }

  const existing_rows = await db('player')
    .select('pid', 'formatted_name', 'nfl_player_id')
    .whereNotNull('nfl_player_id')
  const pid_by_nfl_player_id = new Map(
    existing_rows.map((row) => [Number(row.nfl_player_id), row])
  )

  const name_match_scope = await load_name_match_scope({ only_unfilled: true })

  const counts = {
    listed: listed_players.length,
    already_present: 0,
    attached: 0,
    ambiguous: 0,
    no_candidate: 0,
    // Team agreement is the safety oracle on an attach, and it is deliberately
    // reported rather than enforced: `current_nfl_team` goes stale in the
    // offseason, so a disagreement is a reason to look rather than proof of a
    // wrong match. A run whose disagreements climb is a run to stop.
    attached_team_agreed: 0,
    attached_team_disagreed: 0,
    attached_team_unknown: 0
  }

  for (const listed_player of listed_players) {
    const existing = pid_by_nfl_player_id.get(listed_player.nfl_player_id)
    if (existing) {
      counts.already_present++
      if (existing.formatted_name !== listed_player.formatted_name) {
        log(
          `CONFLICT ${listed_player.nfl_player_id}: nfl.com says ${listed_player.formatted_name}, ${existing.pid} says ${existing.formatted_name}`
        )
      }
      continue
    }

    const candidates = name_match_scope.get(listed_player.formatted_name) || []
    if (!candidates.length) {
      counts.no_candidate++
      continue
    }

    const { player_row, basis } = resolve_unique_candidate({
      candidates,
      listed_player
    })

    if (!player_row) {
      counts.ambiguous++
      log(
        `ABSTAIN ${listed_player.name} (${listed_player.position} ${listed_player.team}): ${candidates.length} candidates — ${candidates.map((row) => row.pid).join(', ')}`
      )
      continue
    }

    counts.attached++

    if (!listed_player.team || !player_row.current_nfl_team) {
      counts.attached_team_unknown++
    } else if (listed_player.team === player_row.current_nfl_team) {
      counts.attached_team_agreed++
    } else {
      counts.attached_team_disagreed++
      log(
        `TEAM DISAGREE ${listed_player.name}: nfl.com ${listed_player.team}, ${player_row.pid} ${player_row.current_nfl_team}`
      )
    }

    log(
      `${dry ? 'DRY ' : ''}ATTACH ${listed_player.nfl_player_id} -> ${player_row.pid} (${listed_player.name}, by ${basis})`
    )

    if (!dry) {
      // allow_protected_props stays false on purpose: updatePlayer then refuses
      // a value another row already holds and refuses to overwrite a differing
      // existing one, which is the uniqueness guard this column has never had.
      await updatePlayer({
        player_row,
        update: { nfl_player_id: listed_player.nfl_player_id }
      })
    }
  }

  log(counts)
  return counts
}

export default import_nfl_player_ids

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv)).option('dry', {
      type: 'boolean',
      default: false,
      describe: 'resolve and report without writing'
    }).argv

    await import_nfl_player_ids({ dry: argv.dry })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.NFL_PLAYER_IDS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}
