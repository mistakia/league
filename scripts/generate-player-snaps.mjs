import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { groupBy } from '#libs-shared'
import { current_season } from '#constants'
import { is_main, batch_insert, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import handle_season_args_for_script from '#libs-server/handle-season-args-for-script.mjs'
import {
  snap_group_key,
  find_gamelog_for_snap_group
} from '#libs-server/snap-gamelog-pairing.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('generate-player-snaps')
enable_debug_namespaces('generate-player-snaps')

const create_quarter_snap_sets = () => ({
  q1_off: new Set(),
  q2_off: new Set(),
  q3_off: new Set(),
  q4_off: new Set(),
  q1_def: new Set(),
  q2_def: new Set(),
  q3_def: new Set(),
  q4_def: new Set()
})

const generate_player_snaps_for_week = async ({
  season_year = current_season.year,
  week = current_season.nfl_seas_week,
  season_type = current_season.nfl_seas_type,
  dry_run = false
}) => {
  log(
    `generating player snaps for week ${week} season_year ${season_year} season_type ${season_type} (dry_run: ${dry_run})`
  )
  const player_snap_inserts = []

  const nfl_game_rows = await db('nfl_games')
    .select('esbid')
    .where({ week, season_year, season_type })
  const esbids = nfl_game_rows.map((i) => i.esbid)

  const gamelogs = await db('player_gamelogs')
    .select(
      'player.gsis_it_player_id',
      // Selected so a snap group can be paired with the gamelog for its OWN
      // game. Without it the pairing below fell back to the player's first
      // gamelog anywhere in the week -- see libs-server/snap-gamelog-pairing.mjs.
      'player_gamelogs.esbid',
      'player_gamelogs.nfl_team',
      'player_gamelogs.opponent_nfl_team',
      'player_gamelogs.player_position'
    )
    .join('player', 'player.pid', 'player_gamelogs.pid')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.season_year', season_year)
    .where('nfl_games.week', week)
    .where('nfl_games.season_type', season_type)

  await db.raw('SET statement_timeout = 0')

  const nfl_snap_rows = await db('nfl_snaps')
    .select(
      'nfl_snaps.esbid',
      'nfl_snaps.play_id',
      'nfl_snaps.gsis_it_player_id',
      'nfl_plays.offense_nfl_team',
      'nfl_plays.defense_nfl_team',
      'nfl_plays.play_type',
      'nfl_plays.yard_line_100',
      'nfl_plays.score_difference',
      'nfl_plays.win_probability',
      'nfl_plays.is_no_huddle',
      'nfl_plays.seconds_remaining_half',
      'nfl_plays.yards_to_go',
      'nfl_plays.down_number',
      'nfl_plays.quarter'
    )
    .leftJoin('nfl_plays', function () {
      this.on('nfl_plays.esbid', '=', 'nfl_snaps.esbid').andOn(
        'nfl_plays.play_id',
        '=',
        'nfl_snaps.play_id'
      )
    })
    .whereIn('nfl_snaps.esbid', esbids)
    .whereNot('nfl_plays.play_type', 'NOPL')

  log(`found ${nfl_snap_rows.length} nfl snaps`)

  // Grouped per (player, GAME) rather than per player. A week can hold more
  // than one game for the same player, and grouping by player alone both merged
  // their snaps and took the esbid from whichever game sorted first.
  const nfl_snap_rows_by_player_game = groupBy(nfl_snap_rows, snap_group_key)
  log(
    `found ${Object.keys(nfl_snap_rows_by_player_game).length} player-games of snaps`
  )
  const gsis_it_ids = [
    ...new Set(nfl_snap_rows.map((row) => row.gsis_it_player_id))
  ]

  const player_rows = await db('player')
    .select('pid', 'gsis_it_player_id')
    .whereIn('gsis_it_player_id', gsis_it_ids)

  const team_totals = {}

  // Calculate team totals before looping through players
  for (const snap of nfl_snap_rows) {
    const {
      esbid,
      play_id: playId,
      offense_nfl_team: off,
      defense_nfl_team: def,
      play_type,
      yard_line_100,
      score_difference,
      win_probability,
      is_no_huddle,
      seconds_remaining_half,
      yards_to_go,
      down_number,
      quarter
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
            snaps_neutral_late_down: new Set(),
            ...create_quarter_snap_sets()
          },
          def: {
            snaps: new Set(),
            q1_def: new Set(),
            q2_def: new Set(),
            q3_def: new Set(),
            q4_def: new Set()
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

      if (yard_line_100 <= 5)
        team_totals[off].off.snaps_inside_five_yards.add(play_key)
      if (yard_line_100 <= 10)
        team_totals[off].off.snaps_inside_ten_yards.add(play_key)
      if (yard_line_100 <= 20)
        team_totals[off].off.snaps_inside_twenty_yards.add(play_key)
      if (score_difference > 0) team_totals[off].off.snaps_leading.add(play_key)
      if (score_difference < 0)
        team_totals[off].off.snaps_trailing.add(play_key)
      if (win_probability > 0.2 && win_probability < 0.8)
        team_totals[off].off.snaps_neutral.add(play_key)
      if (is_no_huddle) team_totals[off].off.snaps_no_huddle.add(play_key)
      if (seconds_remaining_half <= 120)
        team_totals[off].off.snaps_under_two_minutes.add(play_key)
      if (seconds_remaining_half <= 300)
        team_totals[off].off.snaps_under_five_minutes.add(play_key)
      if (win_probability < 0.2)
        team_totals[off].off.snaps_low_prob.add(play_key)
      if (win_probability > 0.2 && win_probability < 0.8 && yards_to_go <= 3)
        team_totals[off].off.snaps_neutral_short.add(play_key)
      if (win_probability > 0.2 && win_probability < 0.8 && yards_to_go >= 7)
        team_totals[off].off.snaps_neutral_long.add(play_key)
      if (win_probability > 0.2 && win_probability < 0.8 && down_number <= 2)
        team_totals[off].off.snaps_neutral_early_down.add(play_key)
      if (win_probability > 0.2 && win_probability < 0.8 && down_number > 2)
        team_totals[off].off.snaps_neutral_late_down.add(play_key)

      // Track quarter-specific snaps (exclude overtime - quarter 5)
      if (quarter >= 1 && quarter <= 4) {
        team_totals[off].off[`q${quarter}_off`].add(play_key)
        team_totals[def].def[`q${quarter}_def`].add(play_key)
      }
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

  for (const player_game_key in nfl_snap_rows_by_player_game) {
    const player_snap_rows = nfl_snap_rows_by_player_game[player_game_key]
    const { gsis_it_player_id, esbid } = player_snap_rows[0]

    const player_row = player_rows.find(
      (p) => p.gsis_it_player_id === gsis_it_player_id
    )
    if (!player_row) {
      log(`player not found for gsis_it_player_id: ${gsis_it_player_id}`)
      continue
    }

    // Paired on (player, GAME). A gamelog from another game of the same week is
    // not a fallback -- it is the wrong-game row this pairing exists to stop.
    const player_gamelog = find_gamelog_for_snap_group({
      gamelogs,
      gsis_it_player_id,
      esbid
    })
    if (!player_gamelog) {
      log(`player_gamelog not found for pid: ${player_row.pid} esbid: ${esbid}`)
      continue
    }

    const { opponent_nfl_team, player_position } = player_gamelog

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
      neutral_late_down: new Set(),
      q1_off: new Set(),
      q2_off: new Set(),
      q3_off: new Set(),
      q4_off: new Set(),
      q1_def: new Set(),
      q2_def: new Set(),
      q3_def: new Set(),
      q4_def: new Set()
    }

    for (const play of player_snap_rows) {
      const play_key = `${play.esbid}_${play.play_id}`

      if (play.play_type === 'PASS' || play.play_type === 'RUSH') {
        if (play.offense_nfl_team === player_gamelog.nfl_team) {
          player_snaps.off.add(play_key)

          if (play.play_type === 'PASS') player_snaps.pass.add(play_key)
          if (play.play_type === 'RUSH') player_snaps.rush.add(play_key)

          if (play.yard_line_100 <= 5)
            player_snaps.inside_five_yards.add(play_key)
          if (play.yard_line_100 <= 10)
            player_snaps.inside_ten_yards.add(play_key)
          if (play.yard_line_100 <= 20)
            player_snaps.inside_twenty_yards.add(play_key)
          if (play.score_difference > 0) player_snaps.leading.add(play_key)
          if (play.score_difference < 0) player_snaps.trailing.add(play_key)
          if (play.win_probability > 0.2 && play.win_probability < 0.8)
            player_snaps.neutral.add(play_key)
          if (play.is_no_huddle) player_snaps.no_huddle.add(play_key)

          if (play.seconds_remaining_half <= 120)
            player_snaps.under_two_minutes.add(play_key)
          if (play.seconds_remaining_half <= 300)
            player_snaps.under_five_minutes.add(play_key)

          if (play.win_probability < 0.2) player_snaps.low_prob.add(play_key)
          if (
            play.win_probability > 0.2 &&
            play.win_probability < 0.8 &&
            play.yards_to_go <= 3
          )
            player_snaps.neutral_short.add(play_key)
          if (
            play.win_probability > 0.2 &&
            play.win_probability < 0.8 &&
            play.yards_to_go >= 7
          )
            player_snaps.neutral_long.add(play_key)
          if (
            play.win_probability > 0.2 &&
            play.win_probability < 0.8 &&
            play.down_number <= 2
          )
            player_snaps.neutral_early_down.add(play_key)
          if (
            play.win_probability > 0.2 &&
            play.win_probability < 0.8 &&
            play.down_number > 2
          )
            player_snaps.neutral_late_down.add(play_key)

          // Track quarter-specific offensive snaps (exclude overtime)
          if (play.quarter >= 1 && play.quarter <= 4) {
            player_snaps[`q${play.quarter}_off`].add(play_key)
          }
        } else if (play.defense_nfl_team === player_gamelog.nfl_team) {
          player_snaps.def.add(play_key)

          // Track quarter-specific defensive snaps (exclude overtime)
          if (play.quarter >= 1 && play.quarter <= 4) {
            player_snaps[`q${play.quarter}_def`].add(play_key)
          }
        }
      }
      if (['PUNT', 'FGXP', 'KOFF', 'ONSD'].includes(play.play_type)) {
        player_snaps.st.add(play_key)
      }
    }

    const snaps_offense = player_snaps.off.size
    const snaps_defense = player_snaps.def.size
    const snaps_special_teams = player_snaps.st.size

    const team = player_gamelog.nfl_team
    const team_total = team_totals[team]

    if (!team_total) {
      log(`team_total not found for team: ${team}, pid: ${player_row.pid}`)
      continue
    }

    player_snap_inserts.push({
      esbid,
      pid: player_row.pid,
      is_active: true,
      season_year,
      // Named explicitly. Omitting it let a NEW row take the column DEFAULT of
      // '' on a NOT NULL column, which is how the only two source-less rows in
      // player_gamelogs came to hold an empty team. Now that the gamelog is
      // paired on (player, game), this is the team for THIS game.
      nfl_team: team,
      opponent_nfl_team,
      player_position,
      snaps_offense,
      snaps_defense,
      snaps_special_teams,
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
      snaps_low_probability: player_snaps.low_prob.size,
      snaps_neutral_short: player_snaps.neutral_short.size,
      snaps_neutral_long: player_snaps.neutral_long.size,
      snaps_neutral_early_down: player_snaps.neutral_early_down.size,
      snaps_neutral_late_down: player_snaps.neutral_late_down.size,
      snaps_under_five_minutes: player_snaps.under_five_minutes.size,
      snaps_offense_percentage: team_total.off.snaps
        ? snaps_offense / team_total.off.snaps || 0
        : null,
      snaps_defense_percentage: team_total.def.snaps
        ? snaps_defense / team_total.def.snaps || 0
        : null,
      snaps_special_teams_percentage: team_total.st.snaps
        ? snaps_special_teams / team_total.st.snaps || 0
        : null,
      snaps_pass_percentage: team_total.off.snaps_pass
        ? player_snaps.pass.size / team_total.off.snaps_pass || 0
        : null,
      snaps_rush_percentage: team_total.off.snaps_rush
        ? player_snaps.rush.size / team_total.off.snaps_rush || 0
        : null,
      snaps_inside_five_yards_percentage: team_total.off.snaps_inside_five_yards
        ? player_snaps.inside_five_yards.size /
            team_total.off.snaps_inside_five_yards || 0
        : null,
      snaps_inside_ten_yards_percentage: team_total.off.snaps_inside_ten_yards
        ? player_snaps.inside_ten_yards.size /
            team_total.off.snaps_inside_ten_yards || 0
        : null,
      snaps_inside_twenty_yards_percentage: team_total.off
        .snaps_inside_twenty_yards
        ? player_snaps.inside_twenty_yards.size /
            team_total.off.snaps_inside_twenty_yards || 0
        : null,
      snaps_leading_percentage: team_total.off.snaps_leading
        ? player_snaps.leading.size / team_total.off.snaps_leading || 0
        : null,
      snaps_trailing_percentage: team_total.off.snaps_trailing
        ? player_snaps.trailing.size / team_total.off.snaps_trailing || 0
        : null,
      snaps_neutral_percentage: team_total.off.snaps_neutral
        ? player_snaps.neutral.size / team_total.off.snaps_neutral || 0
        : null,
      snaps_no_huddle_percentage: team_total.off.snaps_no_huddle
        ? player_snaps.no_huddle.size / team_total.off.snaps_no_huddle || 0
        : null,
      snaps_under_two_minutes_percentage: team_total.off.snaps_under_two_minutes
        ? player_snaps.under_two_minutes.size /
            team_total.off.snaps_under_two_minutes || 0
        : null,
      snaps_under_five_minutes_percentage: team_total.off
        .snaps_under_five_minutes
        ? player_snaps.under_five_minutes.size /
            team_total.off.snaps_under_five_minutes || 0
        : null,
      snaps_low_probability_percentage: team_total.off.snaps_low_prob
        ? player_snaps.low_prob.size / team_total.off.snaps_low_prob || 0
        : null,
      snaps_neutral_short_percentage: team_total.off.snaps_neutral_short
        ? player_snaps.neutral_short.size /
            team_total.off.snaps_neutral_short || 0
        : null,
      snaps_neutral_long_percentage: team_total.off.snaps_neutral_long
        ? player_snaps.neutral_long.size / team_total.off.snaps_neutral_long ||
          0
        : null,
      snaps_neutral_early_down_percentage: team_total.off
        .snaps_neutral_early_down
        ? player_snaps.neutral_early_down.size /
            team_total.off.snaps_neutral_early_down || 0
        : null,
      snaps_neutral_late_down_percentage: team_total.off.snaps_neutral_late_down
        ? player_snaps.neutral_late_down.size /
            team_total.off.snaps_neutral_late_down || 0
        : null,

      // Quarter-specific offensive snaps
      quarter_1_snaps_offense: player_snaps.q1_off.size,
      quarter_1_snaps_offense_percentage: team_total.off.q1_off
        ? player_snaps.q1_off.size / team_total.off.q1_off || 0
        : null,
      quarter_2_snaps_offense: player_snaps.q2_off.size,
      quarter_2_snaps_offense_percentage: team_total.off.q2_off
        ? player_snaps.q2_off.size / team_total.off.q2_off || 0
        : null,
      quarter_3_snaps_offense: player_snaps.q3_off.size,
      quarter_3_snaps_offense_percentage: team_total.off.q3_off
        ? player_snaps.q3_off.size / team_total.off.q3_off || 0
        : null,
      quarter_4_snaps_offense: player_snaps.q4_off.size,
      quarter_4_snaps_offense_percentage: team_total.off.q4_off
        ? player_snaps.q4_off.size / team_total.off.q4_off || 0
        : null,

      // Quarter-specific defensive snaps
      quarter_1_snaps_defense: player_snaps.q1_def.size,
      quarter_1_snaps_defense_percentage: team_total.def.q1_def
        ? player_snaps.q1_def.size / team_total.def.q1_def || 0
        : null,
      quarter_2_snaps_defense: player_snaps.q2_def.size,
      quarter_2_snaps_defense_percentage: team_total.def.q2_def
        ? player_snaps.q2_def.size / team_total.def.q2_def || 0
        : null,
      quarter_3_snaps_defense: player_snaps.q3_def.size,
      quarter_3_snaps_defense_percentage: team_total.def.q3_def
        ? player_snaps.q3_def.size / team_total.def.q3_def || 0
        : null,
      quarter_4_snaps_defense: player_snaps.q4_def.size,
      quarter_4_snaps_defense_percentage: team_total.def.q4_def
        ? player_snaps.q4_def.size / team_total.def.q4_def || 0
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
          .onConflict(['esbid', 'pid', 'season_year'])
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
      year_query: ({ season_type = 'REG' }) => {
        const query = db('nfl_games')
          .select('season_year')
          .groupBy('season_year')
          .orderBy('season_year', 'asc')
        if (season_type !== 'ALL') {
          query.where({ season_type })
        }
        return query
      },
      week_query: ({ season_year, season_type = 'REG' }) => {
        const query = db('nfl_games')
          .select('week')
          .where({ season_year })
          .groupBy('week')
          .orderBy('week', 'asc')
        if (season_type !== 'ALL') {
          query.where({ season_type })
        }
        return query
      },
      script_args: { dry_run: argv.dry },
      season_type: argv.season_type || 'ALL'
    })
  } catch (err) {
    error = err
    log(error)
  }

  // Until 2026-08-26 this script reported NOTHING: no job type, no report_job,
  // and a bare process.exit() that returned 0 whether or not the run threw. The
  // snap columns it owns are the only evidence it ever ran, and they are NULL
  // both when it fails and when it was never invoked -- so a whole season_type
  // could sit unaggregated with no failed row, no signal and no non-zero exit
  // anywhere. 2024 PRE sat that way for two years and 2026 PRE was doing it
  // live. Reporting the job and exiting non-zero is what makes a broken run
  // distinguishable from a run that never happened; the coverage gap that
  // neither can see is owned by the gamelog-snaps-unaggregated data check.
  await report_job({
    job_type: job_types.GENERATE_PLAYER_SNAPS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_player_snaps_for_week
