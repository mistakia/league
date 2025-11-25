import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, groupBy } from '#libs-shared'
import { is_main, batch_insert } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('generate-player-snaps')
debug.enable('generate-player-snaps')

const generate_player_snaps_for_week = async ({
  year = constants.season.year,
  week = constants.season.nfl_seas_week,
  seas_type = constants.season.nfl_seas_type,
  dry_run = false
}) => {
  log(
    `generating player snaps for week ${week} year ${year} seas_type ${seas_type} (dry_run: ${dry_run})`
  )
  const player_snap_inserts = []

  const nfl_game_rows = await db('nfl_games')
    .select('esbid')
    .where({ week, year, seas_type })
  const esbids = nfl_game_rows.map((i) => i.esbid)

  const gamelogs = await db('player_gamelogs')
    .select(
      'player.gsis_it_id',
      'player_gamelogs.tm',
      'player_gamelogs.opp',
      'player_gamelogs.pos'
    )
    .join('player', 'player.pid', 'player_gamelogs.pid')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.week', week)
    .where('nfl_games.seas_type', seas_type)

  await db.raw('SET statement_timeout = 0')

  const nfl_snap_rows = await db('nfl_snaps')
    .select(
      'nfl_snaps.esbid',
      'nfl_snaps.playId',
      'nfl_snaps.gsis_it_id',
      'nfl_plays.off',
      'nfl_plays.def',
      'nfl_plays.play_type',
      'nfl_plays.ydl_100',
      'nfl_plays.score_diff',
      'nfl_plays.wp',
      'nfl_plays.no_huddle',
      'nfl_plays.sec_rem_half',
      'nfl_plays.yards_to_go',
      'nfl_plays.dwn'
    )
    .leftJoin('nfl_plays', function () {
      this.on('nfl_plays.esbid', '=', 'nfl_snaps.esbid').andOn(
        'nfl_plays.playId',
        '=',
        'nfl_snaps.playId'
      )
    })
    .whereIn('nfl_snaps.esbid', esbids)
    .whereNot('nfl_plays.play_type', 'NOPL')

  log(`found ${nfl_snap_rows.length} nfl snaps`)

  const nfl_snap_rows_by_gsis_it_id = groupBy(nfl_snap_rows, 'gsis_it_id')
  log(`found ${Object.keys(nfl_snap_rows_by_gsis_it_id).length} players`)
  const gsis_it_ids = Object.keys(nfl_snap_rows_by_gsis_it_id)

  const player_rows = await db('player')
    .select('pid', 'gsis_it_id')
    .whereIn('gsis_it_id', gsis_it_ids)

  const team_totals = {}

  // Calculate team totals before looping through players
  for (const snap of nfl_snap_rows) {
    const {
      esbid,
      playId,
      off,
      def,
      play_type,
      ydl_100,
      score_diff,
      wp,
      no_huddle,
      sec_rem_half,
      yards_to_go,
      dwn
    } = snap

    // Initialize team totals for both offense and defense if not already present
    for (const team of [off, def]) {
      if (!team_totals[team]) {
        team_totals[team] = {
          off: {
            snaps: new Set(),
            snaps_pass: new Set(),
            snaps_rush: new Set(),
            snaps_inside_five_yards: new Set(),
            snaps_inside_ten_yards: new Set(),
            snaps_inside_twenty_yards: new Set(),
            snaps_leading: new Set(),
            snaps_trailing: new Set(),
            snaps_neutral: new Set(),
            snaps_no_huddle: new Set(),
            snaps_under_two_minutes: new Set(),
            snaps_under_five_minutes: new Set(),
            snaps_low_prob: new Set(),
            snaps_neutral_short: new Set(),
            snaps_neutral_long: new Set(),
            snaps_neutral_early_down: new Set(),
            snaps_neutral_late_down: new Set()
          },
          def: {
            snaps: new Set()
          },
          st: {
            snaps: new Set()
          }
        }
      }
    }

    const play_key = `${esbid}_${playId}`

    // Update offensive stats
    if (play_type === 'PASS' || play_type === 'RUSH') {
      team_totals[off].off.snaps.add(play_key)
      team_totals[def].def.snaps.add(play_key)

      if (play_type === 'PASS') team_totals[off].off.snaps_pass.add(play_key)
      if (play_type === 'RUSH') team_totals[off].off.snaps_rush.add(play_key)

      if (ydl_100 <= 5)
        team_totals[off].off.snaps_inside_five_yards.add(play_key)
      if (ydl_100 <= 10)
        team_totals[off].off.snaps_inside_ten_yards.add(play_key)
      if (ydl_100 <= 20)
        team_totals[off].off.snaps_inside_twenty_yards.add(play_key)
      if (score_diff > 0) team_totals[off].off.snaps_leading.add(play_key)
      if (score_diff < 0) team_totals[off].off.snaps_trailing.add(play_key)
      if (wp > 0.2 && wp < 0.8) team_totals[off].off.snaps_neutral.add(play_key)
      if (no_huddle) team_totals[off].off.snaps_no_huddle.add(play_key)
      if (sec_rem_half <= 120)
        team_totals[off].off.snaps_under_two_minutes.add(play_key)
      if (sec_rem_half <= 300)
        team_totals[off].off.snaps_under_five_minutes.add(play_key)
      if (wp < 0.2) team_totals[off].off.snaps_low_prob.add(play_key)
      if (wp > 0.2 && wp < 0.8 && yards_to_go <= 3)
        team_totals[off].off.snaps_neutral_short.add(play_key)
      if (wp > 0.2 && wp < 0.8 && yards_to_go >= 7)
        team_totals[off].off.snaps_neutral_long.add(play_key)
      if (wp > 0.2 && wp < 0.8 && dwn <= 2)
        team_totals[off].off.snaps_neutral_early_down.add(play_key)
      if (wp > 0.2 && wp < 0.8 && dwn > 2)
        team_totals[off].off.snaps_neutral_late_down.add(play_key)
    }

    // Update special teams stats
    if (['PUNT', 'FGXP', 'KOFF', 'ONSD'].includes(play_type)) {
      team_totals[off].st.snaps.add(play_key)
      team_totals[def].st.snaps.add(play_key)
    }
  }

  // Convert Sets to counts
  for (const team in team_totals) {
    for (const unit in team_totals[team]) {
      for (const key in team_totals[team][unit]) {
        team_totals[team][unit][key] = team_totals[team][unit][key].size
      }
    }
  }

  for (const gsis_it_id_key in nfl_snap_rows_by_gsis_it_id) {
    const gsis_it_id = Number(gsis_it_id_key)
    const player_row = player_rows.find((p) => p.gsis_it_id === gsis_it_id)
    if (!player_row) {
      log(`player not found for gsis_it_id: ${gsis_it_id}`)
      continue
    }

    const player_gamelog = gamelogs.find((p) => p.gsis_it_id === gsis_it_id)
    if (!player_gamelog) {
      log(`player_gamelog not found for pid: ${player_row.pid}`)
      continue
    }

    const { opp, pos } = player_gamelog
    const player_snap_rows = nfl_snap_rows_by_gsis_it_id[gsis_it_id]
    const { esbid } = player_snap_rows[0]

    const player_snaps = {
      off: new Set(),
      def: new Set(),
      st: new Set(),
      pass: new Set(),
      rush: new Set(),
      inside_five_yards: new Set(),
      inside_ten_yards: new Set(),
      inside_twenty_yards: new Set(),
      leading: new Set(),
      trailing: new Set(),
      neutral: new Set(),
      no_huddle: new Set(),
      under_two_minutes: new Set(),
      under_five_minutes: new Set(),
      low_prob: new Set(),
      neutral_short: new Set(),
      neutral_long: new Set(),
      neutral_early_down: new Set(),
      neutral_late_down: new Set()
    }

    for (const play of player_snap_rows) {
      const play_key = `${play.esbid}_${play.playId}`

      if (play.play_type === 'PASS' || play.play_type === 'RUSH') {
        if (play.off === player_gamelog.tm) {
          player_snaps.off.add(play_key)

          if (play.play_type === 'PASS') player_snaps.pass.add(play_key)
          if (play.play_type === 'RUSH') player_snaps.rush.add(play_key)

          if (play.ydl_100 <= 5) player_snaps.inside_five_yards.add(play_key)
          if (play.ydl_100 <= 10) player_snaps.inside_ten_yards.add(play_key)
          if (play.ydl_100 <= 20) player_snaps.inside_twenty_yards.add(play_key)
          if (play.score_diff > 0) player_snaps.leading.add(play_key)
          if (play.score_diff < 0) player_snaps.trailing.add(play_key)
          if (play.wp > 0.2 && play.wp < 0.8) player_snaps.neutral.add(play_key)
          if (play.no_huddle) player_snaps.no_huddle.add(play_key)

          if (play.sec_rem_half <= 120)
            player_snaps.under_two_minutes.add(play_key)
          if (play.sec_rem_half <= 300)
            player_snaps.under_five_minutes.add(play_key)

          if (play.wp < 0.2) player_snaps.low_prob.add(play_key)
          if (play.wp > 0.2 && play.wp < 0.8 && play.yards_to_go <= 3)
            player_snaps.neutral_short.add(play_key)
          if (play.wp > 0.2 && play.wp < 0.8 && play.yards_to_go >= 7)
            player_snaps.neutral_long.add(play_key)
          if (play.wp > 0.2 && play.wp < 0.8 && play.dwn <= 2)
            player_snaps.neutral_early_down.add(play_key)
          if (play.wp > 0.2 && play.wp < 0.8 && play.dwn > 2)
            player_snaps.neutral_late_down.add(play_key)
        } else if (play.def === player_gamelog.tm) {
          player_snaps.def.add(play_key)
        }
      }
      if (['PUNT', 'FGXP', 'KOFF', 'ONSD'].includes(play.play_type)) {
        player_snaps.st.add(play_key)
      }
    }

    const snaps_off = player_snaps.off.size
    const snaps_def = player_snaps.def.size
    const snaps_st = player_snaps.st.size

    const team = player_gamelog.tm
    const team_total = team_totals[team]

    if (!team_total) {
      log(`team_total not found for team: ${team}, pid: ${player_row.pid}`)
      continue
    }

    player_snap_inserts.push({
      esbid,
      pid: player_row.pid,
      active: true,
      year,
      opp,
      pos,
      snaps_off,
      snaps_def,
      snaps_st,
      snaps_pass: player_snaps.pass.size,
      snaps_rush: player_snaps.rush.size,
      snaps_inside_five_yards: player_snaps.inside_five_yards.size,
      snaps_inside_ten_yards: player_snaps.inside_ten_yards.size,
      snaps_inside_twenty_yards: player_snaps.inside_twenty_yards.size,
      snaps_leading: player_snaps.leading.size,
      snaps_trailing: player_snaps.trailing.size,
      snaps_neutral: player_snaps.neutral.size,
      snaps_no_huddle: player_snaps.no_huddle.size,
      snaps_under_two_minutes: player_snaps.under_two_minutes.size,
      snaps_low_prob: player_snaps.low_prob.size,
      snaps_neutral_short: player_snaps.neutral_short.size,
      snaps_neutral_long: player_snaps.neutral_long.size,
      snaps_neutral_early_down: player_snaps.neutral_early_down.size,
      snaps_neutral_late_down: player_snaps.neutral_late_down.size,
      snaps_under_five_minutes: player_snaps.under_five_minutes.size,
      snaps_off_pct: team_total.off.snaps
        ? snaps_off / team_total.off.snaps || 0
        : null,
      snaps_def_pct: team_total.def.snaps
        ? snaps_def / team_total.def.snaps || 0
        : null,
      snaps_st_pct: team_total.st.snaps
        ? snaps_st / team_total.st.snaps || 0
        : null,
      snaps_pass_pct: team_total.off.snaps_pass
        ? player_snaps.pass.size / team_total.off.snaps_pass || 0
        : null,
      snaps_rush_pct: team_total.off.snaps_rush
        ? player_snaps.rush.size / team_total.off.snaps_rush || 0
        : null,
      snaps_inside_five_yards_pct: team_total.off.snaps_inside_five_yards
        ? player_snaps.inside_five_yards.size /
            team_total.off.snaps_inside_five_yards || 0
        : null,
      snaps_inside_ten_yards_pct: team_total.off.snaps_inside_ten_yards
        ? player_snaps.inside_ten_yards.size /
            team_total.off.snaps_inside_ten_yards || 0
        : null,
      snaps_inside_twenty_yards_pct: team_total.off.snaps_inside_twenty_yards
        ? player_snaps.inside_twenty_yards.size /
            team_total.off.snaps_inside_twenty_yards || 0
        : null,
      snaps_leading_pct: team_total.off.snaps_leading
        ? player_snaps.leading.size / team_total.off.snaps_leading || 0
        : null,
      snaps_trailing_pct: team_total.off.snaps_trailing
        ? player_snaps.trailing.size / team_total.off.snaps_trailing || 0
        : null,
      snaps_neutral_pct: team_total.off.snaps_neutral
        ? player_snaps.neutral.size / team_total.off.snaps_neutral || 0
        : null,
      snaps_no_huddle_pct: team_total.off.snaps_no_huddle
        ? player_snaps.no_huddle.size / team_total.off.snaps_no_huddle || 0
        : null,
      snaps_under_two_minutes_pct: team_total.off.snaps_under_two_minutes
        ? player_snaps.under_two_minutes.size /
            team_total.off.snaps_under_two_minutes || 0
        : null,
      snaps_under_five_minutes_pct: team_total.off.snaps_under_five_minutes
        ? player_snaps.under_five_minutes.size /
            team_total.off.snaps_under_five_minutes || 0
        : null,
      snaps_low_prob_pct: team_total.off.snaps_low_prob
        ? player_snaps.low_prob.size / team_total.off.snaps_low_prob || 0
        : null,
      snaps_neutral_short_pct: team_total.off.snaps_neutral_short
        ? player_snaps.neutral_short.size /
            team_total.off.snaps_neutral_short || 0
        : null,
      snaps_neutral_long_pct: team_total.off.snaps_neutral_long
        ? player_snaps.neutral_long.size / team_total.off.snaps_neutral_long ||
          0
        : null,
      snaps_neutral_early_down_pct: team_total.off.snaps_neutral_early_down
        ? player_snaps.neutral_early_down.size /
            team_total.off.snaps_neutral_early_down || 0
        : null,
      snaps_neutral_late_down_pct: team_total.off.snaps_neutral_late_down
        ? player_snaps.neutral_late_down.size /
            team_total.off.snaps_neutral_late_down || 0
        : null
    })
  }

  if (dry_run) {
    log(player_snap_inserts[0])
    return
  }

  if (player_snap_inserts.length) {
    log(`inserting ${player_snap_inserts.length} player snaps`)
    await batch_insert({
      items: player_snap_inserts,
      save: async (batch) => {
        await db('player_gamelogs')
          .insert(batch)
          .onConflict(['esbid', 'pid', 'year'])
          .merge()
      },
      batch_size: 500
    })
  }
}

const main = async () => {
  const argv = initialize_cli()
  let error
  try {
    await handle_season_args_for_script({
      argv,
      script_name: 'generate-player-snaps',
      script_function: generate_player_snaps_for_week,
      year_query: ({ seas_type = 'REG' }) => {
        const query = db('nfl_games')
          .select('year')
          .groupBy('year')
          .orderBy('year', 'asc')
        if (seas_type !== 'ALL') {
          query.where({ seas_type })
        }
        return query
      },
      week_query: ({ year, seas_type = 'REG' }) => {
        const query = db('nfl_games')
          .select('week')
          .where({ year })
          .groupBy('week')
          .orderBy('week', 'asc')
        if (seas_type !== 'ALL') {
          query.where({ seas_type })
        }
        return query
      },
      script_args: { dry_run: argv.dry },
      seas_type: argv.seas_type || 'ALL'
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_player_snaps_for_week
