import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'
import { fetch as fetch_http2 } from 'fetch-h2'
import * as cheerio from 'cheerio'

import db from '#db'
import { is_main, report_job, espn, getPlayer } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { constants, fixTeam } from '#libs-shared'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-espn-line-win-rates')
debug.enable('import-espn-line-win-rates,get-player')

const import_espn_line_win_rates = async () => {
  const timestamp = Math.floor(Date.now() / 1000)
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
        wins: parseInt($(cells[3]).text(), 10),
        plays: parseInt($(cells[4]).text(), 10),
        [win_rate_key]: parseFloat($(cells[5]).text()) / 100,
        double_team_pct: parseFloat($(cells[6]).text()) / 100
      }

      let player_row
      if (player_data.espn_id) {
        try {
          player_row = await getPlayer({ espn_id: player_data.espn_id })
        } catch (err) {
          log(`Error getting player by espn_id: ${err}`)
        }
      }

      if (!player_row) {
        try {
          player_row = await getPlayer({
            name: player_data.player_name,
            team: player_data.team
          })
        } catch (err) {
          log(`Error getting player by name and team: ${err}`)
          log(player_data)
          continue
        }
      }

      if (player_row) {
        player_data.pid = player_row.pid
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

  console.log(extracted_data)

  // Insert player win rates data
  const player_win_rate_types = {
    pass_rush: 'PASS_RUSH',
    pass_block: 'PASS_BLOCK',
    run_stop: 'RUN_STOP',
    run_block: 'RUN_BLOCK'
  }

  for (const [data_key, win_rate_type] of Object.entries(
    player_win_rate_types
  )) {
    for (const player of extracted_data[data_key]) {
      const insert_data = {
        pid: player.pid,
        player_name: player.player_name,
        espn_id: player.espn_id,
        team: player.team,
        wins: player.wins,
        plays: player.plays,
        win_rate: player[`${data_key}_win_rate`],
        double_team_pct: player.double_team_pct,
        espn_win_rate_type: win_rate_type,
        timestamp,
        year: constants.season.year
      }

      await db('espn_player_win_rates_history').insert(insert_data)
      await db('espn_player_win_rates_index')
        .insert(insert_data)
        .onConflict(['player_name', 'espn_id', 'espn_win_rate_type', 'year'])
        .merge()
    }
  }

  for (const team of extracted_data.team) {
    const insert_data = {
      team: team.team,
      pass_rush_win_rate: team.pass_rush_win_rate,
      run_stop_win_rate: team.run_stop_win_rate,
      pass_block_win_rate: team.pass_block_win_rate,
      run_block_win_rate: team.run_block_win_rate,
      timestamp,
      year: constants.season.year
    }

    await db('espn_team_win_rates_history').insert(insert_data)
    await db('espn_team_win_rates_index')
      .insert(insert_data)
      .onConflict(['team', 'year'])
      .merge()
  }
}

const main = async () => {
  let error
  try {
    await import_espn_line_win_rates()
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
