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
  underdog
} from '#libs-server'
import { current_season } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('import-underdog-bestball-adp')
debug.enable('import-underdog-bestball-adp,underdog,underdog-session-manager')

const timestamp = Math.floor(Date.now() / 1000)
const BATCH_SIZE = 500

// Best-ball slate titles that are payout variants, not roster-format variants.
// They reuse a format already ingested from the base / superflex Season slates,
// so ingesting them would double-count. Logged when skipped (no silent cap).
const SKIP_SLATE_KEYWORDS = ['Eliminator', 'Weekly Winners']

const jittered_delay = () =>
  new Promise((resolve) =>
    setTimeout(resolve, 500 + Math.floor(Math.random() * 500))
  )

// num_qb is carried by the slate, not the scoring type: the same half-PPR
// scoring_type_id returns 2QB-premium ADP for a Superflex slate (validated:
// top QB ADP 1.2 superflex vs 33.5 standard). Unknown titles default to 1QB.
const num_qb_for_slate = (title) => (/superflex/i.test(title) ? 2 : 1)

const import_underdog_bestball_adp = async ({
  year = current_season.year,
  dry_run = false
} = {}) => {
  const slates = await underdog.get_underdog_nfl_slates()
  const best_ball_slates = slates.filter((slate) => slate.best_ball)
  log(`found ${best_ball_slates.length} best-ball slates`)

  const teams = await underdog.get_underdog_teams()
  const abbr_by_team_id = new Map(teams.map((team) => [team.id, team.abbr]))

  const summary = []

  // Phase 1 (browser-bound): fetch every slate payload up front while the
  // CloakBrowser session is warm, then tear the session down. Player matching
  // against the league DB (Phase 2) issues one query per appearance and can run
  // for minutes when the DB is reached over a remote tunnel (e.g. the storage
  // server's autossh tunnel to league prod) -- long enough for the idle headless
  // context to be reaped, which would make every slate after the first fail its
  // fetch with "Target page... has been closed". Fetching all payloads back to
  // back keeps the browser session short-lived and independent of slow DB work.
  const slate_payloads = []
  for (const slate of best_ball_slates) {
    const title = slate.description || slate.title || ''
    if (SKIP_SLATE_KEYWORDS.some((kw) => title.includes(kw))) {
      log(`SKIP slate "${title}" (${slate.id}) -- payout variant, not a format`)
      summary.push({ title, skipped: true })
      continue
    }

    const num_qb = num_qb_for_slate(title)
    log(`fetching slate "${title}" (${slate.id}) as num_qb=${num_qb}`)

    await jittered_delay()
    const appearances = await underdog.get_underdog_appearances({
      slate_id: slate.id
    })
    await jittered_delay()
    const players = await underdog.get_underdog_slate_players({
      slate_id: slate.id
    })

    slate_payloads.push({ slate, title, num_qb, appearances, players })
  }

  // Release the headless browser before the multi-minute DB matching phase.
  await underdog.cleanup_underdog_session()

  // Phase 2 (DB-bound): resolve adp_format, match players, insert.
  for (const { slate, title, num_qb, appearances, players } of slate_payloads) {
    log(`ingesting slate "${title}" (${slate.id}) as num_qb=${num_qb}`)

    const adp_format_id = await find_or_create_adp_format(db, {
      scoring_class: 'HALF_PPR',
      scoring_format_id: null,
      num_qb,
      num_teams: null,
      duration: 'REDRAFT',
      draft_pool: 'ALL',
      contest_style: 'BEST_BALL'
    })

    const player_by_id = new Map(players.map((player) => [player.id, player]))

    const adp_inserts = []
    let matched = 0
    let unmatched = 0
    let no_adp = 0

    for (const appearance of appearances) {
      // Underdog returns the string "-" for undrafted players (no ADP), and
      // Number('-') is NaN -- which slipped past a bare null check and poisoned
      // the numeric adp column. Guard on a finite number so "-" (and any null or
      // future placeholder) is counted as no-adp and skipped. This also makes
      // with_adp/match_rate measure real-ADP players, not the full deep slate.
      const adp = Number(appearance?.projection?.adp)
      if (!Number.isFinite(adp)) {
        no_adp += 1
        continue
      }

      const player = player_by_id.get(appearance.player_id)
      if (!player) {
        unmatched += 1
        continue
      }

      const team_abbr = abbr_by_team_id.get(appearance.team_id) || null
      const name = `${player.first_name} ${player.last_name}`.trim()

      let player_row
      try {
        player_row = await find_player_row({
          underdog_player_id: appearance.player_id
        })
        if (!player_row) {
          player_row = await find_player_row({
            name,
            pos: player.position_name,
            team: team_abbr
          })
          // backfill underdog_id on a name match so the next run matches by id
          // (skip in dry run -- this writes to player)
          if (!dry_run && player_row && !player_row.underdog_player_id) {
            await updatePlayer({
              player_row,
              update: { underdog_player_id: appearance.player_id }
            })
          }
        }
      } catch (err) {
        log(`match error for ${name} (${appearance.player_id}): ${err.message}`)
      }

      if (!player_row) {
        unmatched += 1
        continue
      }

      matched += 1
      adp_inserts.push({
        pid: player_row.pid,
        pos: player_row.pos,
        year,
        adp,
        min_pick: null,
        max_pick: null,
        std_dev: null,
        sample_size: null,
        percent_drafted: null,
        source_id: 'UNDERDOG',
        adp_format_id
      })
    }

    const with_adp = appearances.length - no_adp
    const match_rate = with_adp
      ? ((matched / with_adp) * 100).toFixed(1)
      : '0.0'
    log(
      `slate "${title}": ${appearances.length} appearances, ${no_adp} without adp, matched ${matched}/${with_adp} (${match_rate}%), unmatched ${unmatched}`
    )
    summary.push({
      title,
      num_qb,
      appearances: appearances.length,
      matched,
      unmatched,
      match_rate
    })

    if (dry_run) {
      log(`dry run -- skipping insert of ${adp_inserts.length} rows`)
      log(adp_inserts[0])
      continue
    }

    if (adp_inserts.length) {
      await batch_insert({
        items: adp_inserts,
        batch_size: BATCH_SIZE,
        save: async (batch) => {
          await db('player_adp_index')
            .insert(batch)
            .onConflict(['year', 'source_id', 'adp_format_id', 'pid'])
            .merge()
        }
      })
      await batch_insert({
        items: adp_inserts.map((i) => ({ ...i, timestamp })),
        batch_size: BATCH_SIZE,
        save: async (batch) => {
          await db('player_adp_history').insert(batch)
        }
      })
    }
  }

  log('=== SUMMARY ===')
  for (const entry of summary) log(JSON.stringify(entry))
  return summary
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv)).argv
    await import_underdog_bestball_adp({ year: argv.year, dry_run: argv.dry })
  } catch (err) {
    error = err
    log(error)
  } finally {
    try {
      await underdog.cleanup_underdog_session()
    } catch (cleanup_err) {
      log(`cleanup error: ${cleanup_err.message}`)
    }
  }

  await report_job({
    job_type: job_types.IMPORT_UNDERDOG_BESTBALL_ADP,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_underdog_bestball_adp
