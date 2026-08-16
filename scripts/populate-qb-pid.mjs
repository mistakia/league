import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main } from '#libs-server'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('populate-qb-pid')
debug.enable('populate-qb-pid')

// nfl_snaps data available from 2016 onward
const SNAP_DATA_START_YEAR = 2016

const populate_qb_pid = async ({
  year = current_season.year,
  esbids = null,
  dry_run = false
} = {}) => {
  const has_snap_data = year >= SNAP_DATA_START_YEAR
  const scope = esbids ? `${esbids.length} games` : `year ${year}`
  log(
    `Populating qb_pid for ${scope} (dry_run: ${dry_run}, snap_data: ${has_snap_data})`
  )

  // For years with snap data (2016+), use nfl_snaps + player table to identify
  // the QB on the field for non-pass, non-scramble plays. For multi-QB snaps,
  // prefer the QB who is passer_pid on a pass play in the same drive.
  //
  // For years without snap data (pre-2016), only set qb_pid on pass plays
  // (passer_pid) and scramble/kneel plays (ball_carrier_pid). Leave other plays NULL.

  const esbid_list = esbids
    ? esbids.map((id) => parseInt(id, 10)).join(',')
    : null
  const esbid_filter = esbid_list ? `AND np.esbid IN (${esbid_list})` : ''
  const outer_esbid_filter = esbid_list ? `AND p.esbid IN (${esbid_list})` : ''

  const update_query = has_snap_data
    ? `
    UPDATE nfl_plays p
    SET qb_pid = derived.qb_pid
    FROM (
      SELECT
        np.esbid,
        np.play_id,
        np.season_year,
        CASE
          WHEN np.is_passing_play = true AND np.passer_pid IS NOT NULL THEN np.passer_pid
          WHEN (np.is_qb_scramble = true OR np.is_qb_kneel = true) AND np.ball_carrier_pid IS NOT NULL THEN np.ball_carrier_pid
          ELSE snap_qb.pid
        END AS qb_pid
      FROM nfl_plays np
      LEFT JOIN LATERAL (
        SELECT p2.pid
        FROM nfl_snaps ns
        JOIN player p2 ON p2.gsis_it_player_id = ns.gsis_it_player_id AND p2.primary_position = 'QB'
        JOIN player_gamelogs pg ON pg.pid = p2.pid AND pg.esbid = np.esbid AND pg.nfl_team = np.possession_nfl_team
        WHERE ns.esbid = np.esbid
          AND ns.play_id = np.play_id
          AND ns.season_year = :year
        ORDER BY
          CASE WHEN p2.pid = (
            SELECT gp.passer_pid FROM nfl_plays gp
            WHERE gp.esbid = np.esbid AND gp.drive_sequence = np.drive_sequence
              AND gp.passer_pid IS NOT NULL AND gp.season_year = :year
            LIMIT 1
          ) THEN 0 ELSE 1 END
        LIMIT 1
      ) snap_qb ON np.is_passing_play IS NOT TRUE
        AND NOT ((np.is_qb_scramble = true OR np.is_qb_kneel = true) AND np.ball_carrier_pid IS NOT NULL)
      WHERE np.season_year = :year ${esbid_filter}
    ) derived
    WHERE p.esbid = derived.esbid
      AND p.play_id = derived.play_id
      AND p.season_year = :year
      AND derived.qb_pid IS NOT NULL
      ${outer_esbid_filter}
  `
    : `
    UPDATE nfl_plays p
    SET qb_pid = derived.qb_pid
    FROM (
      SELECT
        np.esbid,
        np.play_id,
        np.season_year,
        CASE
          WHEN np.is_passing_play = true AND np.passer_pid IS NOT NULL THEN np.passer_pid
          WHEN (np.is_qb_scramble = true OR np.is_qb_kneel = true) AND np.ball_carrier_pid IS NOT NULL THEN np.ball_carrier_pid
          ELSE NULL
        END AS qb_pid
      FROM nfl_plays np
      WHERE np.season_year = :year ${esbid_filter}
    ) derived
    WHERE p.esbid = derived.esbid
      AND p.play_id = derived.play_id
      AND p.season_year = :year
      AND derived.qb_pid IS NOT NULL
      ${outer_esbid_filter}
  `

  if (dry_run) {
    const plays_esbid_filter = esbid_list ? `AND esbid IN (${esbid_list})` : ''
    const snaps_esbid_filter = esbid_list
      ? `AND ns.esbid IN (${esbid_list})`
      : ''
    const snap_subquery = has_snap_data
      ? `,
        (SELECT COUNT(DISTINCT ns.esbid || '-' || ns.play_id)
         FROM nfl_snaps ns
         JOIN player p ON p.gsis_it_player_id = ns.gsis_it_player_id AND p.primary_position = 'QB'
         WHERE ns.season_year = ? ${snaps_esbid_filter}) as plays_with_qb_snap`
      : ''
    const snap_count_query = `
      SELECT
        COUNT(*) as total_plays,
        COUNT(CASE WHEN is_passing_play = true AND passer_pid IS NOT NULL THEN 1 END) as pass_plays,
        COUNT(CASE WHEN (is_qb_scramble = true OR is_qb_kneel = true) AND ball_carrier_pid IS NOT NULL THEN 1 END) as scramble_kneel_plays,
        COUNT(CASE WHEN NOT (is_passing_play = true AND passer_pid IS NOT NULL)
          AND NOT ((is_qb_scramble = true OR is_qb_kneel = true) AND ball_carrier_pid IS NOT NULL) THEN 1 END) as other_plays
        ${snap_subquery}
      FROM nfl_plays WHERE season_year = ? ${plays_esbid_filter}
    `

    const params = has_snap_data ? [year, year] : [year]
    const result = await db.raw(snap_count_query, params)
    const counts = result.rows[0]
    log(`Dry run for ${scope}:`)
    log(`  Total plays: ${counts.total_plays}`)
    log(`  Pass plays (passer_pid): ${counts.pass_plays}`)
    log(
      `  Scramble/kneel plays (ball_carrier_pid): ${counts.scramble_kneel_plays}`
    )
    log(`  Other plays: ${counts.other_plays}`)
    if (has_snap_data) {
      log(`  Plays with QB in nfl_snaps: ${counts.plays_with_qb_snap}`)
    } else {
      log(`  No snap data available - other plays will be NULL`)
    }
    return counts
  }

  const result = await db.raw(update_query, { year })
  log(`Updated ${result.rowCount} rows for ${scope}`)
  return { year, rows_updated: result.rowCount }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const year = argv.year
    const dry_run = argv.dryRun || argv['dry-run'] || false

    if (argv.all) {
      log('Processing all years from 2000 to current season')
      for (let y = 2000; y <= current_season.year; y++) {
        await populate_qb_pid({ year: y, dry_run })
      }
    } else {
      await populate_qb_pid({ year, dry_run })
    }
  } catch (err) {
    error = err
    log('Error:', error)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default populate_qb_pid
