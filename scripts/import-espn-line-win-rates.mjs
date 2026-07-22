import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'
import { fetch as fetch_http2 } from 'fetch-h2'
import * as cheerio from 'cheerio'

import db from '#db'
import { is_main, report_job, espn, throw_if_shortfall } from '#libs-server'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { fixTeam } from '#libs-shared'
import { current_season } from '#constants'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-espn-line-win-rates')
debug.enable('import-espn-line-win-rates,get-player')

const import_espn_line_win_rates = async ({ collector = null } = {}) => {
  const result = {
    player_win_rates_inserted: 0,
    team_win_rates_inserted: 0,
    players_not_matched: 0,
    unmatched_players: []
  }

  if (current_season.week > current_season.nflFinalWeek) {
    log('Skipping — outside regular season')
    return { ...result, skipped: true }
  }

  const observed_at = new Date()

  // Preload player cache for fast lookups
  log('Preloading player cache...')
  await preload_active_players()
  log('Player cache initialized')

  const espn_config = await espn.get_espn_config()
  const { espn_line_win_rates_url } = espn_config

  const response = await fetch_http2(espn_line_win_rates_url)
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

  const process_player_table = async ({ table, data_key, win_rate_key }) => {
    const players = []
    for (const row of $(table).find('tbody tr').get()) {
      const cells = $(row).find('td')
      const player_link = $(cells[1]).find('a')
      const href = player_link.attr('href')
      const espn_id = href ? href.split('/id/')[1]?.split('/')[0] : null

      const player_data = {
        player_name: player_link.text(),
        espn_id: Number(espn_id) || null,
        team: fixTeam($(cells[2]).text()),
        wins: Number($(cells[3]).text()),
        plays: Number($(cells[4]).text()),
        [win_rate_key]: parseFloat($(cells[5]).text()) / 100,
        double_team_pct: parseFloat($(cells[6]).text()) / 100
      }

      // Try espn_id lookup first, then fallback to name+team lookup
      let player_row = null
      if (player_data.espn_id) {
        player_row = find_player({
          espn_player_id: player_data.espn_id
        })
      }

      // Fallback to name+team lookup if espn_id lookup failed
      if (!player_row) {
        player_row = find_player({
          name: player_data.player_name,
          teams: player_data.team ? [player_data.team] : []
        })
      }

      // Retry without team constraint if team-based lookup failed
      if (!player_row && player_data.team) {
        player_row = find_player({
          name: player_data.player_name
        })
        if (player_row) {
          log(
            `Matched ${player_data.player_name} without team (stale team: ${player_data.team}, DB team: ${player_row.current_nfl_team})`
          )
        }
      }

      if (player_row) {
        player_data.pid = player_row.pid
      } else {
        result.players_not_matched++
        result.unmatched_players.push(
          `${player_data.player_name} (${player_data.team})`
        )
        continue
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
          team: fixTeam($(cells[0]).find('a').text()),
          pass_rush_win_rate: parse_percentage($(cells[1]).text()),
          run_stop_win_rate: parse_percentage($(cells[2]).text()),
          pass_block_win_rate: parse_percentage($(cells[3]).text()),
          run_block_win_rate: parse_percentage($(cells[4]).text())
        }
      })
      .get()
  }

  // Helper function to parse percentage strings
  const parse_percentage = (percentage_string) => {
    const match = percentage_string.match(/(\d+)%/)
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
        espn_id: win_rate_entry.espn_id,
        team: win_rate_entry.team,
        wins: win_rate_entry.wins,
        plays: win_rate_entry.plays,
        win_rate: win_rate_entry[`${data_key}_win_rate`],
        double_team_pct: win_rate_entry.double_team_pct,
        espn_win_rate_type: win_rate_type,
        observed_at,
        season_year: current_season.year
      }

      player_history_inserts.push(insert_data)
      player_index_inserts.push(insert_data)
    }
  }

  await db('espn_player_win_rates_history').insert(player_history_inserts)
  await db('espn_player_win_rates_index')
    .insert(player_index_inserts)
    .onConflict(['player_name', 'espn_id', 'espn_win_rate_type', 'season_year'])
    .merge()

  result.player_win_rates_inserted = player_history_inserts.length
  log(`inserted ${player_history_inserts.length} player win rate rows`)

  const team_history_inserts = []
  const team_index_inserts = []

  for (const team of extracted_data.team) {
    const insert_data = {
      ...team,
      observed_at,
      season_year: current_season.year
    }

    team_history_inserts.push(insert_data)
    team_index_inserts.push(insert_data)
  }

  await db('espn_team_win_rates_history').insert(team_history_inserts)
  await db('espn_team_win_rates_index')
    .insert(team_index_inserts)
    .onConflict(['team', 'season_year'])
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

  return result
}

// In-season per-run floors. ESPN publishes win rates for ~30-50 players
// per category (pass_rush/pass_block/run_stop/run_block = 4 tables) and
// all 32 teams. 50 player rows and 16 team rows catch wholesale parser
// failure / upstream HTML restructure without false-alarming on partial
// data.
const ESPN_PLAYER_WIN_RATES_FLOOR = 50
const ESPN_TEAM_WIN_RATES_FLOOR = 16

const main = async () => {
  let error
  try {
    const result = await import_espn_line_win_rates()
    if (result) {
      console.log(
        `=== SUMMARY === ${JSON.stringify({ script: 'import-espn-line-win-rates', ...result, unmatched_players: undefined })}`
      )
    }

    if (result && !result.skipped) {
      const shortfalls = []
      if (result.player_win_rates_inserted < ESPN_PLAYER_WIN_RATES_FLOOR) {
        shortfalls.push(
          `player_win_rates_inserted=${result.player_win_rates_inserted} (floor=${ESPN_PLAYER_WIN_RATES_FLOOR})`
        )
      }
      if (result.team_win_rates_inserted < ESPN_TEAM_WIN_RATES_FLOOR) {
        shortfalls.push(
          `team_win_rates_inserted=${result.team_win_rates_inserted} (floor=${ESPN_TEAM_WIN_RATES_FLOOR})`
        )
      }
      throw_if_shortfall(
        shortfalls.length
          ? `import-espn-line-win-rates shortfall: ${shortfalls.join('; ')}`
          : null
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

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_espn_line_win_rates
