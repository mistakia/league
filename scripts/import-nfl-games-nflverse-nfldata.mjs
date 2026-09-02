import fs from 'fs'
import os from 'os'
import { pipeline } from 'stream'
import { promisify } from 'util'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam } from '#libs-shared'
import {
  is_main,
  readCSV,
  update_nfl_game,
  report_job,
  fetch_with_retry,
  throw_if_shortfall
} from '#libs-server'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
import {
  is_nfl_postseason_round,
  nfl_postseason_week_by_round
} from '#libs-shared/nfl-postseason-week.mjs'
import { resolve_canonical_nfl_team } from '#libs-shared/nfl-team-franchise-eras.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-nfl-games-nflverse')
enable_debug_namespaces(
  'import-nfl-games-nflverse,update-nfl-game,get-player,fetch'
)

const format_number = (num) => {
  if (num === null || num === undefined || num === '') {
    return null
  }

  const n = Number(num)

  if (Number.isNaN(n)) {
    return null
  }

  if (Number.isInteger(n)) {
    return n
  }

  return Number(n.toFixed(12))
}

// The feed's `espn` column carries 14 wrong values, found by resolving all 7,548
// rows against ESPN's own scoreboard (site.api.espn.com, by game date and
// matchup) on 2026-09-02 and then confirming each replacement against the event
// endpoint. Thirteen are 2003-2010, where the ESPN legacy id — season_year minus
// 1980, then MMDD, then a 3-digit same-day index — was mis-indexed and the feed
// handed one game's id to another; `1999_18_BUF_TEN` carries 200109010, which is
// not an ESPN event at all (the digits of the 2000-01-08 date are transposed).
// Each entry below was verified twice: the feed's value resolves to a DIFFERENT
// matchup (or to nothing), and the replacement resolves to this matchup on this
// date. With these applied, all 7,548 feed values are distinct.
//
// Keyed on nflverse `game_id` rather than on the wrong value, because several
// wrong values are shared by two or three games and the value alone does not say
// which row to fix. Retire an entry when the feed itself is corrected — the
// no-op is logged on every run so a stale entry is visible rather than silent.
const espn_game_id_corrections = new Map([
  ['1999_18_BUF_TEN', '200108010'],
  ['2003_03_JAX_IND', '230921011'],
  ['2003_08_BUF_KC', '231026012'],
  ['2003_11_STL_CHI', '231116003'],
  ['2003_11_KC_CIN', '231116004'],
  ['2003_16_NE_NYJ', '231220020'],
  ['2003_17_PHI_WAS', '231227028'],
  ['2004_06_GB_DET', '241017008'],
  ['2004_06_DEN_OAK', '241017013'],
  ['2004_11_DET_MIN', '241121016'],
  ['2004_17_NYJ_STL', '250102014'],
  ['2005_11_KC_HOU', '251120034'],
  ['2006_11_OAK_KC', '261119012'],
  ['2010_10_HOU_JAX', '301114030']
])

// 2014_12_NYJ_BUF looks wrong by the same scoreboard test and is NOT: the feed
// carries 400607990, the game as actually played in Detroit on 2014-11-24 after
// the Buffalo snowstorm, while the originally-scheduled 400554331 still sits on
// the 2014-11-23 scoreboard. The feed is right; do not "fix" it.

// A correction is stale once nflverse publishes the right value itself, or once
// the game_id it keys on leaves the payload. Neither is an error, but both mean
// the entry can go, so the run says so rather than carrying dead weight quietly.
export const find_stale_espn_game_id_corrections = (data) => {
  const feed = new Map(
    data.map((item) => [item.game_id?.trim(), item.espn?.trim()])
  )

  return [...espn_game_id_corrections]
    .filter(
      ([game_id, corrected]) =>
        !feed.has(game_id) || feed.get(game_id) === corrected
    )
    .map(([game_id]) => game_id)
}

export const resolve_espn_game_id = (game) =>
  espn_game_id_corrections.get(game.game_id?.trim()) ||
  game.espn?.trim() ||
  null

// A guard against a FUTURE upstream collision, not against the 14 above: with
// the corrections applied the feed is currently collision-free, so this finds
// nothing today. If nflverse reintroduces a shared id, the value is ambiguous —
// nothing in the payload says which game owns it — and it gets written for NO
// game in its group rather than for the wrong one. Computed over the WHOLE
// payload before any --season-year / --season-type filter, so a single-season
// run suppresses the same set a full run does.
export const find_ambiguous_espn_game_ids = (data) => {
  const seen = new Set()
  const ambiguous = new Set()

  for (const item of data) {
    const espn_game_id = resolve_espn_game_id(item)
    if (!espn_game_id) {
      continue
    }

    if (seen.has(espn_game_id)) {
      ambiguous.add(espn_game_id)
    } else {
      seen.add(espn_game_id)
    }
  }

  return ambiguous
}

// espn_game_id is `integer` and the feed supplies a trimmed string, so it is
// validated rather than blindly cast: every value must be all-digits and fit a
// signed 32-bit integer, and anything else is dropped instead of silently
// becoming NaN or a truncated number. Measured against the live payload
// 2026-09-02, all 7,548 rows are 9-digit numerics with a maximum of 401,873,187
// — comfortably inside `integer`, so the column type is right and needs no
// retype.
const format_espn_game_id = ({ game, ambiguous_espn_game_ids }) => {
  const value = resolve_espn_game_id(game)

  if (!value || !/^\d+$/.test(value) || ambiguous_espn_game_ids.has(value)) {
    return null
  }

  const parsed = Number(value)

  return Number.isSafeInteger(parsed) && parsed <= 2147483647 ? parsed : null
}

// Filling these two columns from NULL records nothing in nfl_games_changelog:
// update_nfl_game writes a changelog row only when the previous value is
// truthy. That is deliberate and stays. The changelog exists to record
// value CONFLICTS — a source overwriting what another source already wrote —
// and an initial population from one named source is not one. A row per game
// would be 7,548 entries whose previous_value is uniformly null and whose
// source is uniformly 'nflverse', carrying no information the feed does not
// already carry. Overwrites of these columns, once populated, are recorded
// normally from the next run onward.
const format_game = (game, { ambiguous_espn_game_ids }) => ({
  nflverse_game_id: game.game_id?.trim() || null,
  // esbid: game.old_game_id,
  gsis_game_id: format_number(game.gsis),
  pff_game_id: game.pff?.trim() || null,
  pfr_game_id: game.pfr?.trim() || null,
  espn_game_id: format_espn_game_id({ game, ambiguous_espn_game_ids }),

  // ftn is supplied by this feed and has no nfl_games column, before or after
  // the 2026-07-29 pfrid/espnid conform. Do not add one here.

  // total: game.total,
  // season_year: game.season,
  // season_type: game.game_type,
  // week: game.week

  away_rest: format_number(game.away_rest),
  home_rest: format_number(game.home_rest),
  away_moneyline: format_number(game.away_moneyline),
  home_moneyline: format_number(game.home_moneyline),

  spread_line: format_number(game.spread_line),
  total_line: format_number(game.total_line),

  roof: game.roof?.trim() || null,
  playing_surface: game.surface?.trim() || null,
  temperature_fahrenheit: format_number(game.temp),
  wind_speed_mph: format_number(game.wind),

  stadium_name: game.stadium?.trim() || null,

  // nfl_games.{home,away}_play_caller are owned by scripts/import-nfl-coaches.mjs (samhoppen source) -- do not add them here.
  away_coach: game.away_coach?.trim() || null,
  home_coach: game.home_coach?.trim() || null,

  referee: game.referee?.trim() || null
})

export { format_game }

/*
  The feed and nfl_games encode the postseason differently, and the difference
  is not cosmetic: the feed carries game_type WC/DIV/CON/SB against weeks 18-22
  while nfl_games stores season_type POST against weeks 1-4. A match keyed on
  the feed's own season_type and week therefore cannot match a postseason row at
  ALL -- every one of them reached this table only through the esbid-only
  fallback below, which is why that fallback is load-bearing and stays.

  The round-to-week table is shared with the NGS importer rather than restated
  here; see libs-shared/nfl-postseason-week.mjs for why the feed's week is not
  usable as an input.
*/
export const translate_nflverse_game_params = (item) => {
  const is_postseason = is_nfl_postseason_round(item.game_type)

  if (!is_postseason && item.game_type !== 'REG' && item.game_type !== 'PRE') {
    log(
      `unrecognised game_type ${item.game_type} on ${item.game_id} — passing it through untranslated`
    )
  }

  return {
    season_year: Number(item.season),
    season_type: is_postseason ? 'POST' : item.game_type,
    week: is_postseason
      ? nfl_postseason_week_by_round[item.game_type]
      : Number(item.week)
  }
}

export const translate_nflverse_game_teams = (item) => {
  const season_year = Number(item.season)

  // fixTeam normalises the feed's spelling; resolve_canonical_nfl_team then
  // answers the season-aware question fixTeam cannot. For the feed's window
  // (1999 onward) the second step is the identity on every token, but running
  // it here means both sides of the team comparison below are canonical by
  // construction rather than by coincidence.
  return {
    away_nfl_team: resolve_canonical_nfl_team({
      era_nfl_team: fixTeam(item.away_team),
      season_year
    }),
    home_nfl_team: resolve_canonical_nfl_team({
      era_nfl_team: fixTeam(item.home_team),
      season_year
    })
  }
}

/*
  Compare the stored team pair against the feed's, in canonical terms on both
  sides. A raw token comparison is wrong for the 575 pre-relocation Rams and
  Chargers games: nfl_games stores SD and STL for those seasons while the feed
  normalises to LAC and LA, so the pair reads as a mismatch when it is the same
  two franchises. Each side is resolved against the season its own row belongs
  to, which is what makes the comparison total rather than token-shaped.
*/
const nfl_game_teams_match = ({ db_game, item }) => {
  const { away_nfl_team, home_nfl_team } = translate_nflverse_game_teams(item)

  return (
    resolve_canonical_nfl_team({
      era_nfl_team: db_game.away_nfl_team,
      season_year: db_game.season_year
    }) === away_nfl_team &&
    resolve_canonical_nfl_team({
      era_nfl_team: db_game.home_nfl_team,
      season_year: db_game.season_year
    }) === home_nfl_team
  )
}

/*
  Three tiers, in this order:

    1. nflverse_game_id, which is exact and covers every already-stamped row --
       including the 575 pre-relocation Rams and Chargers games that no
       team-column match can reach while nfl_games still stores era tokens;
    2. the translated (season_year, season_type, week, away, home) tuple, which
       is the unique index idx_24707_game and so returns at most one row;
    3. esbid alone, guarded by the team pair.

  Tier 1 is the one tier with no implicit team check, so it re-asserts the pair
  explicitly before returning -- an upstream id swap would otherwise write one
  game's lines onto another, which is the same hazard tier 3's guard was added
  for. On a mismatch it falls through rather than returning: the later tiers
  have their own guards and may legitimately find the right row.
*/
export const find_nfl_game_for_nflverse_item = async ({
  item,
  collector = null
}) => {
  const nflverse_game_id = item.game_id?.trim() || null

  if (nflverse_game_id) {
    const id_match = await db('nfl_games').where({ nflverse_game_id }).first()

    if (id_match) {
      if (nfl_game_teams_match({ db_game: id_match, item })) {
        return id_match
      }

      log(
        `nflverse_game_id tier team mismatch for ${nflverse_game_id}: nflverse=${item.away_team}@${item.home_team} db=${id_match.away_nfl_team}@${id_match.home_nfl_team} — falling through`
      )
      if (collector) {
        collector.add_warning(
          `Game team mismatch on nflverse_game_id: ${nflverse_game_id}`,
          {
            old_game_id: item.old_game_id,
            game_id: item.game_id,
            nflverse_teams: `${item.away_team}@${item.home_team}`,
            db_teams: `${id_match.away_nfl_team}@${id_match.home_nfl_team}`
          }
        )
      }
    }
  }

  const params_match = await db('nfl_games')
    .where({
      ...translate_nflverse_game_params(item),
      ...translate_nflverse_game_teams(item)
    })
    .first()

  if (params_match) {
    return params_match
  }

  if (item.old_game_id) {
    const esbid_match = await db('nfl_games')
      .where({ esbid: item.old_game_id })
      .first()

    if (esbid_match) {
      if (nfl_game_teams_match({ db_game: esbid_match, item })) {
        return esbid_match
      }

      log(
        `esbid-only fallback team mismatch for ${item.old_game_id}: nflverse=${item.away_team}@${item.home_team} db=${esbid_match.away_nfl_team}@${esbid_match.home_nfl_team} — skipping update`
      )
      if (collector) {
        collector.add_warning(
          `Game team mismatch on esbid fallback: ${item.old_game_id}`,
          {
            old_game_id: item.old_game_id,
            game_id: item.game_id,
            nflverse_teams: `${item.away_team}@${item.home_team}`,
            db_teams: `${esbid_match.away_nfl_team}@${esbid_match.home_nfl_team}`
          }
        )
      }
    }
  }

  return null
}

/*
  games_not_matched on its own cannot be a zero-tolerance oracle: the feed
  publishes rows for games nfl_games has not been seeded with yet, and an
  unbounded run legitimately reports those as unmatched.

  The exclusion is computed on the TRANSLATED tuple and per season_type,
  never on the feed's raw week. Regular-season weeks run 1-18 and postseason
  weeks 1-4, so a single "maximum seeded week" per season mixes two scales and
  would exempt every postseason row from 2021 onward -- exactly the rows the
  translation above exists to fix.

  A (season_year, season_type) with no row at all is EXCLUDED rather than
  compared against a null maximum. Season 2026 currently carries 272 REG rows
  and zero POST rows; absent is not zero.
*/
export const count_unmatched_within_seeded_weeks = async ({
  unmatched_game_params
}) => {
  const seeded = await db('nfl_games')
    .select('season_year', 'season_type')
    .max('week as max_week')
    .groupBy('season_year', 'season_type')

  const max_seeded_week = new Map(
    seeded.map((row) => [
      `${row.season_year}_${row.season_type}`,
      Number(row.max_week)
    ])
  )

  return unmatched_game_params.filter(({ season_year, season_type, week }) => {
    const ceiling = max_seeded_week.get(`${season_year}_${season_type}`)

    if (ceiling === undefined) {
      return false
    }

    return week <= ceiling
  }).length
}

const import_nfl_games_nflverse_nfldata = async ({
  season_year = null,
  season_type = null,
  overwrite_existing = false,
  force_download = false,
  collector = null
} = {}) => {
  console.time('import-nfl-games-nflverse-total')

  const result = {
    games_processed: 0,
    games_updated: 0,
    games_not_matched: 0,
    games_not_matched_within_seeded_weeks: 0
  }

  log('Preloading player cache for QB lookups...')
  console.time('player-cache-preload-time')
  await preload_active_players({ all_players: true })
  console.timeEnd('player-cache-preload-time')

  const current_date = new Date().toISOString().split('T')[0]
  const file_name = `nflverse_nfldata_games_${current_date}.csv`
  const path = `${os.tmpdir()}/${file_name}`
  const url = 'https://github.com/nflverse/nfldata/raw/master/data/games.csv'

  if (force_download || !fs.existsSync(path)) {
    log(`downloading ${url}`)
    const stream_pipeline = promisify(pipeline)
    // use_proxy: false -- public GitHub release asset, not a vendor scrape target.
    const response = await fetch_with_retry({ url, use_proxy: false })
    if (!response.ok)
      throw new Error(`unexpected response ${response.statusText}`)

    await stream_pipeline(response.body, fs.createWriteStream(`${path}`))
  } else {
    log(`file exists: ${path}`)
  }

  const game_not_matched = []
  let data = await readCSV(path, {
    mapValues: ({ header, index, value }) => (value === 'NA' ? null : value)
  })

  // Computed before the season filters below so a single-season run suppresses
  // the same espn values a full-payload run does.
  const ambiguous_espn_game_ids = find_ambiguous_espn_game_ids(data)
  if (ambiguous_espn_game_ids.size) {
    log(
      `${ambiguous_espn_game_ids.size} espn ids are shared by more than one game and will not be written: ${[...ambiguous_espn_game_ids].join(', ')}`
    )
  }

  const stale_espn_game_id_corrections =
    find_stale_espn_game_id_corrections(data)
  if (stale_espn_game_id_corrections.length) {
    log(
      `${stale_espn_game_id_corrections.length} espn_game_id_corrections entries are no longer needed and can be retired: ${stale_espn_game_id_corrections.join(', ')}`
    )
  }

  // Filter by season_year if specified
  if (season_year) {
    const original_count = data.length
    const season_year_num = Number(season_year)
    data = data.filter((item) => Number(item.season) === season_year_num)
    log(
      `Filtered to season_year ${season_year}: ${data.length} games (from ${original_count} total)`
    )
  }

  // Filter by season_type if specified
  if (season_type) {
    const before_filter = data.length
    data = data.filter((item) => item.game_type === season_type)
    log(
      `Filtered to season_type ${season_type}: ${data.length} games (from ${before_filter})`
    )
  }

  for (const item of data) {
    if (!item.season) {
      log(
        `skipping item (${item.old_game_id} / ${item.game_id}) — missing season`
      )
      continue
    }

    if (!item.week) {
      log(
        `skipping item (${item.old_game_id} / ${item.game_id}) — missing week`
      )
      continue
    }

    if (!item.game_type) {
      log(
        `skipping item (${item.old_game_id} / ${item.game_id}) — missing game_type`
      )
      continue
    }

    if (!item.away_team) {
      log(
        `skipping item (${item.old_game_id} / ${item.game_id}) — missing away_team`
      )
      continue
    }

    if (!item.home_team) {
      log(
        `skipping item (${item.old_game_id} / ${item.game_id}) — missing home_team`
      )
      continue
    }

    result.games_processed++

    const db_game = await find_nfl_game_for_nflverse_item({ item, collector })

    if (db_game) {
      const game = format_game(item, { ambiguous_espn_game_ids })

      if (item.away_qb_id) {
        const away_qb_player = find_player({
          gsis_player_id: item.away_qb_id,
          ignore_free_agent: false,
          ignore_retired: false
        })

        if (away_qb_player) {
          game.away_qb_pid = away_qb_player.pid
        } else {
          log(`away_qb_player not found: ${item.away_qb_id}`)
          if (collector) {
            collector.add_player_issue({
              type: 'qb_not_found',
              player_name: null,
              team: item.away_team,
              identifier: item.away_qb_id,
              source: 'nflverse',
              details: { game_id: item.game_id, role: 'away_qb' }
            })
          }
        }
      }

      if (item.home_qb_id) {
        const home_qb_player = find_player({
          gsis_player_id: item.home_qb_id,
          ignore_free_agent: false,
          ignore_retired: false
        })

        if (home_qb_player) {
          game.home_qb_pid = home_qb_player.pid
        } else {
          log(`home_qb_player not found: ${item.home_qb_id}`)
          if (collector) {
            collector.add_player_issue({
              type: 'qb_not_found',
              player_name: null,
              team: item.home_team,
              identifier: item.home_qb_id,
              source: 'nflverse',
              details: { game_id: item.game_id, role: 'home_qb' }
            })
          }
        }
      }

      await update_nfl_game({
        game_row: db_game,
        update: game,
        overwrite_existing,
        source: 'nflverse'
      })
      result.games_updated++
    } else {
      log(`game not matched: ${item.old_game_id} - ${item.game_id}`)
      game_not_matched.push(item)
      if (collector) {
        collector.add_warning(
          `Game not matched: ${item.old_game_id} - ${item.game_id}`,
          {
            old_game_id: item.old_game_id,
            game_id: item.game_id,
            season: item.season,
            week: item.week
          }
        )
      }
    }
  }

  result.games_not_matched = game_not_matched.length
  result.games_not_matched_within_seeded_weeks =
    await count_unmatched_within_seeded_weeks({
      unmatched_game_params: game_not_matched.map(
        translate_nflverse_game_params
      )
    })
  log(
    `${game_not_matched.length} games not matched, ${result.games_not_matched_within_seeded_weeks} of them within a seeded week`
  )

  if (collector) {
    collector.set_stats({
      games_processed: result.games_processed,
      games_updated: result.games_updated
    })
  }

  console.timeEnd('import-nfl-games-nflverse-total')

  return result
}

// Conservative floor for the full nflverse games CSV (thousands of rows
// spanning the modern NFL data window). 1000 catches CSV-not-downloaded /
// empty-CSV / parsing-failure scenarios that today exit cleanly with 0
// games processed. Single-year backfill is whitelisted via argv.year so
// the floor is only applied to the cron's unbounded run.
const NFLVERSE_GAMES_FLOOR_UNBOUNDED = 1000

// Zero by construction, not a tolerance. Every feed row whose translated
// (season_year, season_type) is seeded at all, and whose translated week is
// within that group's seeded maximum, describes a game nfl_games already holds
// -- so it must match by one of the three tiers. Rows past the ceiling are the
// feed publishing ahead of the schedule import and are excluded upstream by
// count_unmatched_within_seeded_weeks, which is where the reasoning lives.
const NFLVERSE_GAMES_NOT_MATCHED_CEILING_UNBOUNDED = 0

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const overwrite_existing = argv.overwrite_existing
    const force_download = argv.d
    const result = await import_nfl_games_nflverse_nfldata({
      season_year: argv.year,
      overwrite_existing,
      force_download
    })
    console.log(
      `=== SUMMARY === ${JSON.stringify({ script: 'import-nfl-games-nflverse-nfldata', season_year: argv.year || 'all', ...result })}`
    )
    const shortfalls = [
      !argv.year && result.games_processed < NFLVERSE_GAMES_FLOOR_UNBOUNDED
        ? `${result.games_processed} games processed (floor=${NFLVERSE_GAMES_FLOOR_UNBOUNDED} for unbounded run)`
        : null,
      !argv.year &&
      result.games_not_matched_within_seeded_weeks >
        NFLVERSE_GAMES_NOT_MATCHED_CEILING_UNBOUNDED
        ? `${result.games_not_matched_within_seeded_weeks} feed games within a seeded week did not match any stored game (ceiling=${NFLVERSE_GAMES_NOT_MATCHED_CEILING_UNBOUNDED} for unbounded run)`
        : null
    ].filter(Boolean)

    throw_if_shortfall(
      shortfalls.length
        ? `import-nfl-games-nflverse-nfldata shortfall: ${shortfalls.join('; ')}`
        : null
    )
  } catch (err) {
    error = err
    console.log(
      `ERROR: ${err.severity || 'UNKNOWN'} [${err.code || 'N/A'}] ${err.message}`
    )
  }

  await report_job({
    job_type: job_types.IMPORT_GAMES_NFLVERSE,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_nfl_games_nflverse_nfldata
