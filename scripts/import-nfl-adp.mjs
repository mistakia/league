import { fetch as fetch_http2 } from 'fetch-h2'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { JSDOM } from 'jsdom'

import db from '#db'
import {
  find_player_row,
  is_main,
  report_job,
  batch_insert,
  updatePlayer,
  find_or_create_adp_format
} from '#libs-server'
import { current_season } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { adp_format } from '#libs-shared'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-nfl-adp')
debug.enable('import-nfl-adp,update-player,get-player')

const timestamp = Math.floor(Date.now() / 1000)
const batch_size = 500

const fetch_nfl_data = async (url) => {
  log(`fetching ${url}`)

  const response = await fetch_http2(url, {
    method: 'GET',
    headers: {
      Accept: 'text/html'
    }
  })

  const html = await response.text()
  return html
}

const parse_nfl_data = (html) => {
  const dom = new JSDOM(html)
  const document = dom.window.document

  const players = []
  const rows = document.querySelectorAll('tbody tr')

  rows.forEach((row) => {
    const tds = row.querySelectorAll('td')
    if (!tds.length) return
    const player_info = row.querySelector('td:first-child').textContent
    const adp = row.querySelector('td:nth-child(2)').textContent
    const nfl_id_element = row.querySelector('td:first-child a')

    let match = player_info.match(/(.+?)\s+([A-Z]{2,3}).*?([A-Z]{2,3})/)

    if (!match) {
      // Handle special cases for DEF, K, and players with injury designations
      match = player_info.match(/(.+?)\s+(DEF|K)\s+([A-Z]{2,3})/)
      if (!match) {
        match = player_info.match(/(.+?)\s+(K)\s+-\s+([A-Z]{2,3})/)
      }
    }

    if (match) {
      // eslint-disable-next-line no-unused-vars
      const [_, name, pos, team] = match

      if (nfl_id_element && nfl_id_element.href) {
        const nfl_id_match = nfl_id_element.href.match(/playerId=(\d+)/)
        if (nfl_id_match) {
          const nfl_id = nfl_id_match[1]
          players.push({
            name,
            pos,
            team,
            adp: Number(adp),
            nfl_id: Number(nfl_id)
          })
        } else {
          log(`could_not_extract_nfl_id_for_player`, { name })
        }
      } else {
        log(`no_nfl_id_link_found_for_player`, { name })
      }
    } else {
      // Handle team defense cases
      const def_match = player_info.match(/(.+?)\s+(DEF)\s*/)
      if (def_match) {
        // eslint-disable-next-line no-unused-vars
        const [_, name, pos] = def_match
        players.push({ name, pos, team: name, adp: Number(adp), nfl_id: null })
      } else {
        log(`could_not_parse_player_info`, { player_info })
      }
    }
  })

  return players
}

const import_nfl_adp = async ({
  year = current_season.year,
  dry_run = false
} = {}) => {
  const url = `https://fantasy.nfl.com/draftcenter/breakdown?leagueId=&offset=1&count=400&position=all&season=${year}&sort=draftAveragePosition`
  const html = await fetch_nfl_data(url)
  const players = parse_nfl_data(html)

  const adp_format_id = await find_or_create_adp_format(
    db,
    adp_format.decode_adp_type('PPR_REDRAFT')
  )

  log(`Processing NFL ADP data`)

  const adp_inserts = []
  const unmatched_players = []
  const matched_nfl_ids = new Set()

  // First iteration: match by nfl_id
  for (const source_player of players) {
    if (!source_player.nfl_id) {
      log(source_player)
      continue
    }

    let player_row
    try {
      player_row = await find_player_row({
        nfl_player_id: source_player.nfl_id
      })
    } catch (err) {
      log(`Error getting player by nfl_id: ${err}`)
      unmatched_players.push(source_player)
      continue
    }

    if (player_row) {
      matched_nfl_ids.add(Number(source_player.nfl_id))
      adp_inserts.push({
        pid: player_row.pid,
        pos: player_row.primary_position,
        year,
        adp: source_player.adp,
        min_pick: null,
        max_pick: null,
        std_dev: null,
        sample_size: null,
        percent_drafted: null,
        source_id: 'NFL',
        adp_format_id
      })
    } else {
      unmatched_players.push(source_player)
    }
  }

  // Second iteration: match remaining players by name, team, pos
  for (const source_player of unmatched_players) {
    const player_params = {
      name: source_player.name,
      pos: source_player.pos,
      team: source_player.team
    }

    let player_row
    try {
      player_row = await find_player_row(player_params)
    } catch (err) {
      log(`Error getting player by name, team, pos: ${err}`)
      log(player_params)
      continue
    }

    if (player_row) {
      if (
        player_row.nfl_player_id &&
        matched_nfl_ids.has(Number(player_row.nfl_player_id))
      ) {
        log(`Player ${player_row.nfl_player_id} already matched`)
        log(source_player)
        continue
      }

      if (!player_row.nfl_player_id) {
        await updatePlayer({
          player_row,
          update: {
            nfl_player_id: source_player.nfl_id
          }
        })
      }

      matched_nfl_ids.add(Number(source_player.nfl_id))
      adp_inserts.push({
        pid: player_row.pid,
        pos: player_row.primary_position,
        year,
        adp: source_player.adp,
        min_pick: null,
        max_pick: null,
        std_dev: null,
        sample_size: null,
        percent_drafted: null,
        source_id: 'NFL',
        adp_format_id
      })
    } else {
      log(
        `Unmatched player: ${source_player.name} (${source_player.pos}, ${source_player.team})`
      )
    }
  }

  if (dry_run) {
    log(`Dry run: ${adp_inserts.length} NFL ADP rankings`)
    log(adp_inserts[0])
    return
  }

  if (adp_inserts.length) {
    log(`Inserting ${adp_inserts.length} NFL ADP rankings into database`)
    await batch_insert({
      items: adp_inserts,
      batch_size,
      save: async (batch) => {
        await db('player_adp_index')
          .insert(batch)
          .onConflict(['year', 'source_id', 'adp_format_id', 'pid'])
          .merge()
      }
    })
    await batch_insert({
      items: adp_inserts.map((i) => ({ ...i, timestamp })),
      batch_size,
      save: async (batch) => {
        await db('player_adp_history').insert(batch)
      }
    })
  }

  log(`Unmatched players: ${unmatched_players.length}`)
  unmatched_players.forEach((source_player) => log(source_player))
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await import_nfl_adp({ year: argv.year, dry_run: argv.dry })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_NFL_ADP,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_nfl_adp
