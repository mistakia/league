import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  find_player_row,
  is_main,
  report_job,
  batch_insert,
  updatePlayer,
  find_or_create_adp_format,
  grade_adp_import_run,
  summarize_adp_feed
} from '#libs-server'
import { current_season } from '#constants'
import fetch_cheerio from '#libs-server/fetch-cheerio.mjs'
import throw_if_shortfall from '#libs-server/throw-if-shortfall.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { adp_format } from '#libs-shared'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-cbs-adp')
enable_debug_namespaces('import-cbs-adp,update-player,get-player')

const observed_at = new Date()
const BATCH_SIZE = 500

const fetch_cbs_data = async (url) => {
  log(`fetching ${url}`)

  // Was a bare fetch-h2 call that read .text() straight into cheerio without
  // looking at the status, so a rate-limit or a WAF challenge parsed to zero
  // rows and this importer wrote nothing and exited 0. fetch_cheerio carries
  // the `status !== 200` check; the shared helper returns the identical 216
  // rows over plain fetch, so the second transport bought nothing.
  const $ = await fetch_cheerio(url, {
    method: 'GET',
    headers: {
      Accept: 'text/html'
    }
  })

  const players = $('#TableBase > div > div > table')
    .find('tr')
    .map((_, row) => {
      const cells = $(row).find('td')
      if (cells.length === 0) return null

      const player_link = $(cells[1]).find('.CellPlayerName--long a')
      const href = player_link.attr('href')
      const cbs_id = href
        ? Number(href.split('/')[href.split('/').length - 4])
        : null

      const player_name = player_link.text().trim()
      const pos = $(cells[1])
        .find('.CellPlayerName--long .CellPlayerName-position')
        .text()
        .trim()
      const team = $(cells[1])
        .find('.CellPlayerName--long .CellPlayerName-team')
        .text()
        .trim()
      const adp = parseFloat($(cells[3]).text().trim())
      const high_adp = Number($(cells[4]).text().split('/')[0].trim())
      const low_adp = Number($(cells[4]).text().split('/')[1].trim())
      const percent_drafted = parseFloat($(cells[5]).text().trim())

      return {
        cbs_id,
        player_name,
        pos,
        team,
        adp,
        high_adp,
        low_adp,
        percent_drafted
      }
    })
    .get()

  // This importer had no shortfall guard at all, so a page that parsed to
  // nothing wrote nothing and exited 0 — the silent zero-row failure the
  // projections importers were given guards against. CBS answers a slice that
  // does not exist with 200 and a real page carrying no table (measured against
  // an invalid ADP slice: 200, 472KB, zero rows), so the status check alone
  // cannot see this and there is no vendor sentinel to excuse it either.
  throw_if_shortfall(
    players.length === 0 ? `cbs adp: parsed 0 rows (${url})` : null
  )

  return players
}

const import_cbs_adp = async ({
  year = current_season.year,
  dry_run = false
} = {}) => {
  const adp_types = [
    {
      url: 'https://www.cbssports.com/fantasy/football/draft/averages/ppr/both/h2h/all/',
      ranking_type: 'PPR_REDRAFT'
    },
    {
      url: 'https://www.cbssports.com/fantasy/football/draft/averages/both/h2h/all/',
      ranking_type: 'STANDARD_REDRAFT'
    }
  ]

  const feeds = []

  for (const { url, ranking_type } of adp_types) {
    const players = await fetch_cbs_data(url)

    const average_draft_position_format_id = await find_or_create_adp_format(
      db,
      adp_format.decode_adp_type(ranking_type)
    )

    log(`Processing ${ranking_type} data`)

    const adp_inserts = []
    const matched_cbs_ids = new Set()
    const unmatched_players = []

    // First iteration: match by cbs_id
    for (const source_player of players) {
      let player_row
      try {
        player_row = await find_player_row({
          cbs_player_id: source_player.cbs_id
        })
      } catch (err) {
        log(`Error getting player by cbs_id: ${err}`)
        unmatched_players.push(source_player)
        continue
      }

      if (player_row) {
        matched_cbs_ids.add(Number(source_player.cbs_id))
        adp_inserts.push({
          pid: player_row.pid,
          player_position: player_row.primary_position,
          season_year: year,
          average_draft_position: source_player.adp,
          min_pick: source_player.low_adp,
          max_pick: source_player.high_adp,
          standard_deviation: null,
          sample_size: null,
          percent_drafted: source_player.percent_drafted,
          source_id: 'CBS',
          average_draft_position_format_id
        })
      } else {
        unmatched_players.push(source_player)
      }
    }

    // Second iteration: match remaining players by name, team, pos
    for (const source_player of unmatched_players) {
      const player_params = {
        name: source_player.player_name,
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
          player_row.cbs_player_id &&
          matched_cbs_ids.has(Number(player_row.cbs_player_id))
        ) {
          log(`Player ${player_row.cbs_player_id} already matched`)
          log(source_player)
          continue
        }

        if (!player_row.cbs_player_id) {
          await updatePlayer({
            player_row,
            update: {
              cbs_player_id: source_player.cbs_id
            },
            source: 'cbs'
          })
        }

        matched_cbs_ids.add(Number(source_player.cbs_id))
        adp_inserts.push({
          pid: player_row.pid,
          player_position: player_row.primary_position,
          season_year: year,
          average_draft_position: source_player.adp,
          min_pick: source_player.low_adp,
          max_pick: source_player.high_adp,
          standard_deviation: null,
          sample_size: null,
          percent_drafted: source_player.percent_drafted,
          source_id: 'CBS',
          average_draft_position_format_id
        })
      }
    }

    feeds.push(
      summarize_adp_feed({
        label: ranking_type,
        fetched: players.length,
        rows: adp_inserts
      })
    )

    if (dry_run) {
      log(`Dry run: ${adp_inserts.length} ${ranking_type} ADP rankings`)
      log(adp_inserts[0])
      continue
    }

    if (adp_inserts.length) {
      log(
        `Inserting ${adp_inserts.length} ${ranking_type} ADP rankings into database`
      )
      await batch_insert({
        items: adp_inserts,
        batch_size: BATCH_SIZE,
        save: async (batch) => {
          await db('player_adp_index')
            .insert(batch)
            .onConflict([
              'season_year',
              'source_id',
              'average_draft_position_format_id',
              'pid'
            ])
            .merge()
        }
      })
      await batch_insert({
        items: adp_inserts.map((i) => ({ ...i, observed_at })),
        batch_size: BATCH_SIZE,
        save: async (batch) => {
          await db('player_adp_history').insert(batch)
        }
      })
    }
  }

  const grade = grade_adp_import_run({ source_id: 'CBS', year, feeds })
  // console.log, not the debug logger: a scheduled run's verdict must not
  // depend on winning a DEBUG namespace negotiation.
  console.log(grade.summary)
  if (!grade.passed) throw new Error(grade.summary)
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await import_cbs_adp({ dry_run: argv.dry })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_CBS_ADP,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_cbs_adp
