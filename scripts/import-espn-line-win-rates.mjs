import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as cheerio from 'cheerio'

import db from '#db'
import { fetch_with_retry } from '#libs-server/proxy-manager.mjs'
import {
  is_main,
  report_job,
  espn,
  grade_espn_line_win_rates_run,
  summarize_win_rate_feed,
  parse_season_year_from_url
} from '#libs-server'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { fixTeam } from '#libs-shared'
import { current_season } from '#constants'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('import-espn-line-win-rates')
enable_debug_namespaces('import-espn-line-win-rates,get-player')

// The residential-egress pool this importer fetches over. Spelled as a literal
// rather than imported from `#private/libs-server/nfl-pro/browser-task.mjs`,
// which is where NFL Pro names the same pool: `private/` is a submodule that is
// an EMPTY DIRECTORY in any clone and on the runner, and this feed has no other
// reason to depend on it. The coupling is that both read the same config row.
const ESPN_PROXY_POOL = 'nfl_pro'

const import_espn_line_win_rates = async ({
  collector = null,
  dry_run = false
} = {}) => {
  const result = {
    player_win_rates_inserted: 0,
    team_win_rates_inserted: 0,
    players_not_matched: 0,
    unmatched_players: []
  }

  // ESPN publishes these win rates only while a season is being played, and
  // `current_season.week` is a continuous counter from `regular_season_start`
  // that is CLAMPED AT ZERO before the opener. So the original guard --
  // `week > nfl_final_week` -- was dead through the entire offseason, which is
  // exactly the window it was written to cover: once the season constants roll
  // to the next season, its start is in the future, week reads 0, and 0 is not
  // greater than 18. Sixteen runs between 2025-12 and 2026-03 walked through it
  // and failed on an empty knex insert ("The query is empty"), and four more
  // succeeded into the wrong season. Both bounds are needed.
  if (
    current_season.week === 0 ||
    current_season.week > current_season.nfl_final_week
  ) {
    log(
      `Skipping — outside the regular season (week ${current_season.week}, final week ${current_season.nfl_final_week})`
    )
    return { ...result, skipped: true }
  }

  const observed_at = new Date()

  // Preload the cache with EVERY player, retired included. The roster-status
  // overrides at the lookup sites below are inert without this: a player absent
  // from the cache cannot be un-filtered, so `ignore_retired: false` against an
  // active-only cache is a no-op that reads like a fix.
  //
  // These leaderboards run to the end of the season and are re-read afterwards,
  // by which point some of the players on them have retired or been cut.
  log('Preloading player cache...')
  await preload_active_players({ all_players: true })
  log('Player cache initialized with all players (retired included)')

  const espn_config = await espn.get_espn_config()
  const { espn_line_win_rates_url } = espn_config

  // The season is a property of the SOURCE, never of the clock.
  // `espn_line_win_rates_url` is a per-season ESPN article
  // (.../id/46138675/2025-nfl-win-rates-...), so a run that reads the clock
  // stamps whatever season it happens to be executed in onto whatever season
  // the article covers. Those diverge every offseason, and did: four runs in
  // March 2026 wrote the finished 2025 article as season_year 2026. The oracle
  // below asserts the derived season against the season this run is supposed
  // to be importing, which is what catches a config row nobody repointed.
  const source_season_year = parse_season_year_from_url(espn_line_win_rates_url)

  // www.espn.com sits behind AWS WAF, which rejects DATACENTER egress across
  // the board -- not just this host. Measured 2026-08-26 against the same URL
  // with the client held constant: Contabo (this host) gets a CloudFront 403,
  // DigitalOcean and HostPapa get a 202 with an empty body, and only a
  // residential address is served the article. The two actions are different
  // and equally useless, since both parse to zero `table.inline-table`.
  //
  // So the fetch goes out over the `nfl_pro` pool -- three Geonode dedicated
  // ISP (static residential) addresses, `selection: sticky`. The RESIDENTIAL
  // tier is what matters, not proxying as such: the same call through the
  // `default` toolip pool still returns the 202 challenge, which is the
  // negative control this choice rests on.
  //
  // `requires_proxy` because proxy-manager is fail-open twice -- an unresolved
  // pool name falls back to `default`, and an empty pool falls back to a DIRECT
  // fetch out of the host WAN. Both of those silently land on exactly the
  // datacenter egress this exists to avoid, and would look like the feed simply
  // going empty.
  //
  // The pool is shared with the authenticated NFL Pro session that bought it.
  // Justified by volume -- one unauthenticated GET of a public article per week
  // -- but it is a shared blast radius: if ESPN ever flags these addresses the
  // cost lands on NFL Pro. See
  // [[user:guideline/software/vendor-egress-proxy-posture.md]].
  const response = await fetch_with_retry({
    url: espn_line_win_rates_url,
    use_proxy: true,
    requires_proxy: true,
    proxy_pool: ESPN_PROXY_POOL
  })

  // This guard is specifically about the WAF's CHALLENGE action, not its block.
  // A 403 never reaches here -- `fetch_with_retry` throws on a non-2xx status
  // itself. The 202 challenge does reach here, and it is the dangerous one: an
  // empty body dressed as success.
  //
  // So NOT `!response.ok`. 202 is inside the 2xx range, so `ok` is TRUE for the
  // exact response this exists to catch, and that check would hand cheerio the
  // empty body. Measured against the live URL on 2026-08-26: over the `default`
  // pool it answers `status=202 ok=true tables=0`. A served article is 200 and
  // nothing else.
  //
  // Failing here rather than downstream is what keeps the cause legible -- an
  // unguarded challenge parses to zero tables and fails the oracle as "every
  // feed is empty", which reads like ESPN restructuring the page, a materially
  // different diagnosis from "our egress was refused".
  if (response.status !== 200) {
    throw new Error(
      `ESPN returned ${response.status} for ${espn_line_win_rates_url} over the '${ESPN_PROXY_POOL}' proxy pool`
    )
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const tables = $('table.inline-table')
  const extracted_data = {
    pass_rush: [],
    pass_block: [],
    run_stop: [],
    run_block: [],
    team: []
  }

  // Players the page listed but whose identity we could not resolve, per
  // category. The ROWS are kept either way -- see below -- so this is the list
  // of names the oracle fails on, not a count of what was thrown away.
  const unmatched_by_category = {
    pass_rush: [],
    pass_block: [],
    run_stop: [],
    run_block: []
  }

  const process_player_table = async ({ table, data_key, win_rate_key }) => {
    const players = []
    for (const row of $(table).find('tbody tr').get()) {
      const cells = $(row).find('td')
      const player_link = $(cells[1]).find('a')
      const href = player_link.attr('href')
      const espn_id = href ? href.split('/id/')[1]?.split('/')[0] : null

      // `espn_player_id` is NOT NULL on both tables, so a row without one is
      // not writable at all. This used to be invisible: such a row failed the
      // id lookup, sometimes matched by name, and was dropped whenever it did
      // not. Now that unmatched rows are KEPT, it would reach the insert and
      // fail on the constraint instead. Raise here, where the cause is legible
      // -- a page that stopped linking its players is a restructure worth
      // failing on, not a row worth losing.
      if (!Number(espn_id)) {
        throw new Error(
          `${data_key} row "${player_link.text().trim() || $(cells[1]).text().trim()}" carries no ESPN player id -- the page no longer links players, which is a restructure`
        )
      }

      const player_data = {
        player_name: player_link.text(),
        espn_id: Number(espn_id),
        team: fixTeam($(cells[2]).text()),
        wins: Number($(cells[3]).text()),
        plays: Number($(cells[4]).text()),
        [win_rate_key]: parseFloat($(cells[5]).text()) / 100,
        double_team_percentage: parseFloat($(cells[6]).text()) / 100
      }

      // Try espn_id lookup first, then fallback to name+team lookup.
      //
      // Roster-status filters stay OFF on every route. `find_player` defaults
      // `ignore_retired` and `ignore_free_agent` to true, which asks a question
      // about the player's CURRENT employment in the middle of establishing who
      // this row is about. A leaderboard row is a historical fact; a player who
      // has since retired or been cut is still the same person. The archive
      // backfills have always overridden both, and the live importer not doing
      // so is why it loses players the backfill keeps.
      let player_row = find_player({
        espn_player_id: player_data.espn_id,
        ignore_retired: false,
        ignore_free_agent: false
      })

      // Fallback to name+team lookup if espn_id lookup failed
      if (!player_row) {
        player_row = find_player({
          name: player_data.player_name,
          teams: player_data.team ? [player_data.team] : [],
          ignore_retired: false,
          ignore_free_agent: false
        })
      }

      // Retry without team constraint if team-based lookup failed
      if (!player_row && player_data.team) {
        player_row = find_player({
          name: player_data.player_name,
          ignore_retired: false,
          ignore_free_agent: false
        })
        if (player_row) {
          log(
            `Matched ${player_data.player_name} without team (stale team: ${player_data.team}, DB team: ${player_row.current_nfl_team})`
          )
        }
      }

      // AN UNMATCHED PLAYER IS KEPT, WITH A NULL pid. Dropping the row lost two
      // things at once: the published leaderboard entry, and the denominator
      // that would have said how many were lost -- which is why no
      // fetched-vs-matched figure existed for this feed until a backfill
      // measured one. The column is nullable and the table already holds
      // null-pid rows. The oracle fails the run and names whoever is missing,
      // so the identity gap gets closed instead of silently repeating weekly.
      player_data.pid = player_row ? player_row.pid : null
      if (!player_row) {
        result.players_not_matched++
        const descriptor = `${player_data.player_name} (${player_data.team}, espn ${player_data.espn_id})`
        result.unmatched_players.push(descriptor)
        unmatched_by_category[data_key].push(descriptor)
      }

      players.push(player_data)
    }
    return players
  }

  const process_team_table = (table) => {
    return $(table)
      .find('tbody tr')
      .map((_, row) => {
        const cells = $(row).find('td')
        return {
          nfl_team: fixTeam($(cells[0]).find('a').text()),
          pass_rush_win_rate: parse_percentage($(cells[1]).text()),
          run_stop_win_rate: parse_percentage($(cells[2]).text()),
          pass_block_win_rate: parse_percentage($(cells[3]).text()),
          run_block_win_rate: parse_percentage($(cells[4]).text())
        }
      })
      .get()
  }

  // Parse a percentage cell. The fractional part is NOT optional decoration:
  // `/(\d+)%/` against "62.5%" matches the trailing "5%" and yields 0.05 -- a
  // well-formed number, off by more than a factor of ten, that no row-count or
  // fill-rate rule can see. ESPN currently renders these cells whole, so this
  // has never fired; it is one markup tweak away from silently corrupting the
  // whole table. The oracle's range rule is the second line of defense.
  const parse_percentage = (percentage_string) => {
    const match = percentage_string.match(/(\d+(?:\.\d+)?)%/)
    return match ? parseFloat(match[1]) / 100 : null
  }

  for (let index = 0; index < tables.length; index++) {
    const table = tables[index]
    if (index < 2) {
      const data = await process_player_table({
        table,
        data_key: 'pass_rush',
        win_rate_key: 'pass_rush_win_rate'
      })
      extracted_data.pass_rush.push(...data)
    } else if (index < 4) {
      const data = await process_player_table({
        table,
        data_key: 'pass_block',
        win_rate_key: 'pass_block_win_rate'
      })
      extracted_data.pass_block.push(...data)
    } else if (index < 6) {
      const data = await process_player_table({
        table,
        data_key: 'run_stop',
        win_rate_key: 'run_stop_win_rate'
      })
      extracted_data.run_stop.push(...data)
    } else if (index < 8) {
      const data = await process_player_table({
        table,
        data_key: 'run_block',
        win_rate_key: 'run_block_win_rate'
      })
      extracted_data.run_block.push(...data)
    } else {
      extracted_data.team.push(...process_team_table(table))
    }
  }

  // Insert player win rates data
  const player_win_rate_types = {
    pass_rush: 'PASS_RUSH',
    pass_block: 'PASS_BLOCK',
    run_stop: 'RUN_STOP',
    run_block: 'RUN_BLOCK'
  }

  const player_history_inserts = []
  const player_index_inserts = []

  for (const [data_key, win_rate_type] of Object.entries(
    player_win_rate_types
  )) {
    for (const win_rate_entry of extracted_data[data_key]) {
      const insert_data = {
        pid: win_rate_entry.pid,
        player_name: win_rate_entry.player_name,
        espn_player_id: win_rate_entry.espn_id,
        nfl_team: win_rate_entry.team,
        line_win_count: win_rate_entry.wins,
        total_plays: win_rate_entry.plays,
        win_rate: win_rate_entry[`${data_key}_win_rate`],
        double_team_percentage: win_rate_entry.double_team_percentage,
        espn_win_rate_type: win_rate_type,
        observed_at,
        season_year: source_season_year
      }

      player_history_inserts.push(insert_data)
      player_index_inserts.push(insert_data)
    }
  }

  const team_history_inserts = []
  const team_index_inserts = []

  for (const team of extracted_data.team) {
    const insert_data = {
      ...team,
      observed_at,
      season_year: source_season_year
    }

    team_history_inserts.push(insert_data)
    team_index_inserts.push(insert_data)
  }

  // Grade BEFORE writing. The rows this run is about to insert are the only
  // evidence it has, and a run that writes first and grades second has already
  // put the bad season on disk by the time it fails.
  //
  // Every table on this page is its own feed. ESPN restructures one at a time,
  // and the four player categories run 19-40 rows each, so any aggregate rule
  // across them is blind to a single category going dead.
  const grade = grade_espn_line_win_rates_run({
    source_season_year,
    expected_season_year: current_season.year,
    source_url: espn_line_win_rates_url,
    feeds: [
      ...Object.entries(player_win_rate_types).map(([data_key]) =>
        summarize_win_rate_feed({
          label: data_key,
          rows: extracted_data[data_key],
          rate_key: `${data_key}_win_rate`,
          unmatched: unmatched_by_category[data_key]
        })
      ),
      // The team table carries four independent rate columns read from four
      // fixed cell indexes, so one shifted column is a per-column failure that
      // a whole-table check cannot see.
      ...[
        'pass_rush_win_rate',
        'run_stop_win_rate',
        'pass_block_win_rate',
        'run_block_win_rate'
      ].map((rate_key) => ({
        ...summarize_win_rate_feed({
          label: `team ${rate_key}`,
          rows: extracted_data.team,
          rate_key
        }),
        is_team_feed: true
      }))
    ]
  })

  // console.log, not the debug logger: a scheduled job's verdict must not
  // depend on winning a DEBUG namespace negotiation against the import graph.
  console.log(grade.summary)

  // Only a DATA failure stops the write. A missing pid means the leaderboard is
  // right and one identity link is absent, and refusing to write on that would
  // throw away a correct season over a rookie -- the drop-the-row defect moved
  // up a level. Those rows land with a null pid and the run fails afterwards,
  // below, so the names still reach someone.
  if (grade.write_blocked) throw new Error(grade.summary)

  if (dry_run) {
    log(
      `Dry run: ${player_history_inserts.length} player rows, ${team_history_inserts.length} team rows for ${source_season_year}`
    )
    // A dry run reports the same verdict a real one would. A --dry that returns
    // green on a run the scheduler would fail is worse than no dry run at all,
    // because it is used to decide whether the real one is safe.
    if (!grade.passed) throw new Error(grade.summary)
    return { ...result, dry_run: true }
  }

  await db('espn_player_win_rates_history').insert(player_history_inserts)
  await db('espn_player_win_rates_index')
    .insert(player_index_inserts)
    .onConflict([
      'player_name',
      'espn_player_id',
      'espn_win_rate_type',
      'season_year'
    ])
    .merge()

  result.player_win_rates_inserted = player_history_inserts.length
  log(`inserted ${player_history_inserts.length} player win rate rows`)

  await db('espn_team_win_rates_history').insert(team_history_inserts)
  await db('espn_team_win_rates_index')
    .insert(team_index_inserts)
    .onConflict(['nfl_team', 'season_year'])
    .merge()

  result.team_win_rates_inserted = team_history_inserts.length
  log(`inserted ${team_history_inserts.length} team win rate rows`)

  if (result.unmatched_players.length > 0) {
    log(
      `${result.players_not_matched} unmatched players: ${result.unmatched_players.join(', ')}`
    )
  }

  if (collector) {
    collector.set_stats({
      player_win_rates_inserted: result.player_win_rates_inserted,
      team_win_rates_inserted: result.team_win_rates_inserted,
      players_not_matched: result.players_not_matched
    })
  }

  // The rows are down, and they are right. What is missing is one or more
  // identity links, which the run fails on so somebody attaches them. Thrown
  // AFTER the write on purpose: the data is worth keeping either way, and a
  // green run here would mean the same players go unmatched every week forever.
  if (!grade.passed) throw new Error(grade.summary)

  return result
}

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    // The oracle runs inside import_espn_line_win_rates, at the grain the page
    // breaks at and before anything is written. Nothing is graded out here:
    // the two aggregate floors that used to live at this level summed four
    // categories of 19-40 rows into one number of 50 and could not see any of
    // them die, and they ran on the inserted count, which is the wrong side of
    // the write.
    const result = await import_espn_line_win_rates({ dry_run: argv.dry })
    if (result) {
      console.log(
        `=== SUMMARY === ${JSON.stringify({ script: 'import-espn-line-win-rates', ...result, unmatched_players: undefined })}`
      )
    }
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_ESPN_LINE_WIN_RATES,
    error
  })

  // Carry the outcome in the exit code as well as the ledger. report_job
  // returning normally after catching an error is how a failed run reaches
  // process.exit(0) and reads green to anything watching the process.
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_espn_line_win_rates
