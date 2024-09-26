import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import xlsx from 'node-xlsx'

import { is_main, report_job } from '#libs-server'
import db from '#db'
import { job_types } from '#libs-shared/job-constants.mjs'
import { fixTeam } from '#libs-shared'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-dvoa-sheets')
debug.enable('import-dvoa-sheets')

const process_team_def_vs_rec = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing teamDefvsRec worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[3] === 'D' && row[2] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        nfl_team: fixTeam(row[2]),
        team_unit: 'DEFENSE',
        pass_dvoa_rank: row[4],
        pass_wr1_dvoa: row[5],
        pass_wr1_dvoa_rank: row[6],
        pass_points_allowed_per_game_wr1: row[7],
        pass_yards_allowed_per_game_wr1: row[8],
        pass_wr2_dvoa: row[9],
        pass_wr2_dvoa_rank: row[10],
        pass_points_allowed_per_game_wr2: row[11],
        pass_yards_allowed_per_game_wr2: row[12],
        pass_wr3_dvoa: row[13],
        pass_wr3_dvoa_rank: row[14],
        pass_points_allowed_per_game_wr3: row[15],
        pass_yards_allowed_per_game_wr3: row[16],
        pass_te_dvoa: row[17],
        pass_te_dvoa_rank: row[18],
        pass_points_allowed_per_game_te: row[19],
        pass_yards_allowed_per_game_te: row[20],
        pass_rb_dvoa: row[21],
        pass_rb_dvoa_rank: row[22],
        pass_points_allowed_per_game_rb: row[23],
        pass_yards_allowed_per_game_rb: row[24],
        pass_left_dvoa: row[25],
        pass_left_dvoa_rank: row[26],
        pass_middle_dvoa: row[27],
        pass_middle_dvoa_rank: row[28],
        pass_right_dvoa: row[29],
        pass_right_dvoa_rank: row[30],
        pass_deep_dvoa: row[31],
        pass_deep_dvoa_rank: row[32],
        pass_short_dvoa: row[33],
        pass_short_dvoa_rank: row[34],
        pass_deep_left_dvoa: row[35],
        pass_deep_middle_dvoa: row[36],
        pass_deep_right_dvoa: row[37],
        pass_short_left_dvoa: row[38],
        pass_short_middle_dvoa: row[39],
        pass_short_right_dvoa: row[40],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_unit_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_team_directional_rushing = async (
  worksheet,
  { dry_run, timestamp }
) => {
  log(`Processing teamDirectionalRushing worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[2] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        nfl_team: fixTeam(row[2]),
        team_unit: row[3] === 'O' ? 'OFFENSE' : 'DEFENSE',
        team_adjusted_line_yards: row[4],
        team_adjusted_line_yards_rank: row[5],
        team_rush_left_end_dvoa: row[6],
        team_rush_left_end_dvoa_rank: row[7],
        team_rush_left_tackle_dvoa: row[8],
        team_rush_left_tackle_dvoa_rank: row[9],
        team_rush_mid_guard_dvoa: row[10],
        team_rush_mid_guard_dvoa_rank: row[11],
        team_rush_right_tackle_dvoa: row[12],
        team_rush_right_tackle_dvoa_rank: row[13],
        team_rush_right_end_dvoa: row[14],
        team_rush_right_end_dvoa_rank: row[15],
        team_running_back_carries: row[16],
        team_running_back_carries_rank: row[17],
        team_rush_left_end_pct: row[18],
        team_rush_left_tackle_pct: row[19],
        team_rush_mid_guard_pct: row[20],
        team_rush_right_tackle_pct: row[21],
        team_rush_right_end_pct: row[22],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_unit_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_team_line_yards = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing teamLineYards worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[2] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        nfl_team: fixTeam(row[2]),
        team_unit: row[3] === 'O' ? 'OFFENSE' : 'DEFENSE',
        team_adjusted_line_yards: row[4],
        team_adjusted_line_yards_rank: row[5],
        team_rb_yards: row[6],
        team_rb_yards_rank: row[7],
        team_power_success: row[8],
        team_power_success_rank: row[9],
        team_stuffed_rate: row[10],
        team_stuffed_rate_rank: row[11],
        team_second_level_yards: row[12],
        team_second_level_yards_rank: row[13],
        team_open_field_yards: row[14],
        team_open_field_yards_rank: row[15],
        team_sacks: row[16],
        team_sacks_rank: row[17],
        team_adjusted_sack_rate: row[18],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_unit_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_team_run_pass_week = async (
  worksheet,
  { dry_run, timestamp, year }
) => {
  log(`Processing teamRunPassWeek worksheet`)

  const data = worksheet.data
  const formatted_data = []

  const categories = [
    'PASSING OFFENSE',
    'PASSING DEFENSE',
    'RUSHING OFFENSE',
    'RUSHING DEFENSE'
  ]
  let current_category = ''
  let week_count = 0

  for (const row of data) {
    if (categories.includes(row[0])) {
      current_category = row[0]
      week_count = row.filter((cell) => cell !== '' && !isNaN(cell)).length
      continue
    }

    if (row[0] && row[0] !== 'NFL') {
      const nfl_team = fixTeam(row[0])
      for (let week = 1; week <= week_count; week++) {
        const dvoa_value = row[week]
        if (dvoa_value !== '') {
          const entry = {
            nfl_team,
            week,
            timestamp,
            year
          }

          if (current_category === 'PASSING OFFENSE') {
            entry.pass_offense_dvoa = dvoa_value
          } else if (current_category === 'PASSING DEFENSE') {
            entry.pass_defense_dvoa = dvoa_value
          } else if (current_category === 'RUSHING OFFENSE') {
            entry.rush_offense_dvoa = dvoa_value
          } else if (current_category === 'RUSHING DEFENSE') {
            entry.rush_defense_dvoa = dvoa_value
          }

          const existing_entry = formatted_data.find(
            (item) => item.nfl_team === nfl_team && item.week === week
          )

          if (existing_entry) {
            Object.assign(existing_entry, entry)
          } else {
            formatted_data.push(entry)
          }
        }
      }
    }
  }

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_gamelogs')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'week'])
      .merge()
  }
}

const process_team_home_road = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing teamHomeRoad worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[2] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        nfl_team: fixTeam(row[2]),
        team_unit: row[3] === 'O' ? 'OFFENSE' : 'DEFENSE',
        home_dvoa: row[4],
        home_dvoa_rank: row[5],
        road_dvoa: row[6],
        road_dvoa_rank: row[7],
        total_dvoa: row[8],
        total_dvoa_rank: row[9],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_unit_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_team_down_dist = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing teamDownDist worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[2] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        nfl_team: fixTeam(row[2]),
        team_unit: row[3] === 'O' ? 'OFFENSE' : 'DEFENSE',
        all_first_down_dvoa: row[4],
        all_first_down_dvoa_rank: row[5],
        second_and_short_dvoa: row[6],
        second_and_short_dvoa_rank: row[7],
        second_and_mid_dvoa: row[8],
        second_and_mid_dvoa_rank: row[9],
        second_and_long_dvoa: row[10],
        second_and_long_dvoa_rank: row[11],
        all_second_down_dvoa: row[12],
        all_second_down_dvoa_rank: row[13],
        third_and_short_dvoa: row[14],
        third_and_short_dvoa_rank: row[15],
        third_and_mid_dvoa: row[16],
        third_and_mid_dvoa_rank: row[17],
        third_and_long_dvoa: row[18],
        third_and_long_dvoa_rank: row[19],
        all_third_down_dvoa: row[20],
        all_third_down_dvoa_rank: row[21],
        all_plays_dvoa: row[22],
        all_plays_dvoa_rank: row[23],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_unit_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_team_by_zone = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing teamByZone worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[2] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        nfl_team: fixTeam(row[2]),
        team_unit: row[3] === 'O' ? 'OFFENSE' : 'DEFENSE',
        back_zone_dvoa: row[4],
        back_zone_dvoa_rank: row[5],
        deep_zone_dvoa: row[6],
        deep_zone_dvoa_rank: row[7],
        front_zone_dvoa: row[8],
        front_zone_dvoa_rank: row[9],
        mid_zone_dvoa: row[10],
        mid_zone_dvoa_rank: row[11],
        red_zone_dvoa: row[12],
        red_zone_dvoa_rank: row[13],
        red_zone_pass_dvoa: row[14],
        red_zone_pass_dvoa_rank: row[15],
        red_zone_rush_dvoa: row[16],
        red_zone_rush_dvoa_rank: row[17],
        goal_to_go_dvoa: row[18],
        goal_to_go_dvoa_rank: row[19],
        total_dvoa: row[20],
        total_dvoa_rank: row[21],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_unit_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_team_score_gap = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing teamScoreGap worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[2] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        nfl_team: fixTeam(row[2]),
        team_unit: row[3] === 'O' ? 'OFFENSE' : 'DEFENSE',
        losing_9_plus_dvoa: row[4],
        losing_9_plus_dvoa_rank: row[5],
        tie_or_losing_1_to_8_dvoa: row[6],
        tie_or_losing_1_to_8_dvoa_rank: row[7],
        winning_1_to_8_dvoa: row[8],
        winning_1_to_8_dvoa_rank: row[9],
        winning_9_plus_dvoa: row[10],
        winning_9_plus_dvoa_rank: row[11],
        late_and_close_dvoa: row[12],
        late_and_close_dvoa_rank: row[13],
        total_dvoa: row[14],
        total_dvoa_rank: row[15],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_unit_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_team_qtr = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing teamQtr worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[2] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        nfl_team: fixTeam(row[2]),
        team_unit: row[3] === 'O' ? 'OFFENSE' : 'DEFENSE',
        first_quarter_dvoa: row[4],
        first_quarter_dvoa_rank: row[5],
        second_quarter_dvoa: row[6],
        second_quarter_dvoa_rank: row[7],
        third_quarter_dvoa: row[8],
        third_quarter_dvoa_rank: row[9],
        fourth_quarter_ot_dvoa: row[10],
        fourth_quarter_ot_dvoa_rank: row[11],
        first_half_dvoa: row[12],
        first_half_dvoa_rank: row[13],
        second_half_dvoa: row[14],
        second_half_dvoa_rank: row[15],
        late_and_close_dvoa: row[16],
        late_and_close_dvoa_rank: row[17],
        total_dvoa: row[18],
        total_dvoa_rank: row[19],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_unit_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_qb_pass_by_dir = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing QBPassbyDir worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data.map((row) => {
    return {
      year: row[0],
      // week: row[1],
      player: row[2],
      gsis_id: row[3],
      full_name: row[4],
      nfl_team: row[5],
      pass_left_dyar: row[6],
      pass_left_dvoa: row[7],
      pass_left_attempts: row[8],
      pass_left_pct: row[9],
      pass_mid_dyar: row[10],
      pass_mid_dvoa: row[11],
      pass_mid_attempts: row[12],
      pass_mid_pct: row[13],
      pass_right_dyar: row[14],
      pass_right_dvoa: row[15],
      pass_right_attempts: row[16],
      pass_right_pct: row[17],
      pass_deep_dyar: row[18],
      pass_deep_dvoa: row[19],
      pass_deep_attempts: row[20],
      pass_deep_pct: row[21],
      pass_short_dyar: row[22],
      pass_short_dvoa: row[23],
      pass_short_attempts: row[24],
      pass_short_pct: row[25],
      timestamp
    }
  })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    // match to player and add to player_gamelogs
  }
}

const process_shotgun = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing Shotgun worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[2] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        nfl_team: fixTeam(row[2]),
        team_unit: row[3] === 'O' ? 'OFFENSE' : 'DEFENSE',
        shotgun_dvoa: row[4],
        shotgun_dvoa_rank: row[5],
        shotgun_yards: row[6],
        shotgun_yards_rank: row[7],
        not_shotgun_dvoa: row[8],
        not_shotgun_dvoa_rank: row[9],
        not_shotgun_yards: row[10],
        not_shotgun_yards_rank: row[11],
        shotgun_difference_dvoa: row[12],
        shotgun_difference_dvoa_rank: row[13],
        shotgun_yards_difference: row[14],
        shotgun_yards_difference_rank: row[15],
        shotgun_percentage: row[16],
        shotgun_percentage_rank: row[17],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_unit_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_team_down_play = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing teamDownPlay worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[2] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        nfl_team: fixTeam(row[2]),
        team_unit: row[3] === 'O' ? 'OFFENSE' : 'DEFENSE',
        first_down_pass_dvoa: row[4],
        first_down_pass_dvoa_rank: row[5],
        first_down_rush_dvoa: row[6],
        first_down_rush_dvoa_rank: row[7],
        first_down_all_dvoa: row[8],
        first_down_all_dvoa_rank: row[9],
        second_down_pass_dvoa: row[10],
        second_down_pass_dvoa_rank: row[11],
        second_down_rush_dvoa: row[12],
        second_down_rush_dvoa_rank: row[13],
        second_down_all_dvoa: row[14],
        second_down_all_dvoa_rank: row[15],
        third_fourth_down_pass_dvoa: row[16],
        third_fourth_down_pass_dvoa_rank: row[17],
        third_fourth_down_rush_dvoa: row[18],
        third_fourth_down_rush_dvoa_rank: row[19],
        third_fourth_down_all_dvoa: row[20],
        third_fourth_down_all_dvoa_rank: row[21],
        all_downs_pass_dvoa: row[22],
        all_downs_pass_dvoa_rank: row[23],
        all_downs_rush_dvoa: row[24],
        all_downs_rush_dvoa_rank: row[25],
        all_downs_dvoa: row[26],
        all_downs_dvoa_rank: row[27],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_unit_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_week_by_week = async (
  worksheet,
  { dry_run, timestamp, year }
) => {
  log(`Processing Week by Week worksheet`)

  const data = worksheet.data
  const formatted_data = []

  const categories = ['TOTAL', 'OFFENSE', 'DEFENSE', 'SPECIAL TEAMS']
  let current_category = ''
  let week_count = 0

  for (const row of data) {
    if (categories.includes(row[0])) {
      current_category = row[0]
      week_count = row.length - 1 // Exclude the category name
      continue
    }

    if (row[0] === 'TEAM') {
      break // Stop processing when we reach the team schedule matrix
    }

    if (row[0] && row[0] !== 'NFL') {
      const nfl_team = fixTeam(row[0])
      for (let week = 1; week <= week_count; week++) {
        const dvoa_value = row[week]
        if (dvoa_value !== '') {
          const entry = {
            nfl_team,
            week,
            year,
            timestamp
          }

          if (current_category === 'TOTAL') {
            entry.total_dvoa = dvoa_value
          } else if (current_category === 'OFFENSE') {
            entry.offense_dvoa = dvoa_value
          } else if (current_category === 'DEFENSE') {
            entry.defense_dvoa = dvoa_value
          } else if (current_category === 'SPECIAL TEAMS') {
            entry.special_teams_dvoa = dvoa_value
          }

          const existing_entry = formatted_data.find(
            (item) => item.nfl_team === nfl_team && item.week === week
          )

          if (existing_entry) {
            Object.assign(existing_entry, entry)
          } else {
            formatted_data.push(entry)
          }
        }
      }
    }
  }

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_gamelogs')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'week'])
      .merge()
  }
}

const process_pgwe = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing PGWE worksheet`)
  // skip for now
}

const process_special_dvoa = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing specialDvoa worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[3] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        special_teams_dvoa_rank: row[2],
        nfl_team: fixTeam(row[3]),
        special_teams_dvoa: row[4],
        last_week_special_teams_dvoa: row[5],
        special_teams_weighted_dvoa: row[6],
        special_teams_weighted_dvoa_rank: row[7],
        fg_xp_dvoa: row[8],
        kick_dvoa: row[9],
        kick_return_dvoa: row[10],
        punt_dvoa: row[11],
        punt_return_dvoa: row[12],
        no_weather_dvoa: row[13],
        variance: row[14],
        variance_rank: row[15],
        hidden_points: row[16],
        hidden_points_rank: row[17],
        weather_points: row[18],
        weather_points_rank: row[19],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team'])
      .merge()

    await db('dvoa_team_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'week'])
      .merge()
  }
}

const process_defense_dvoa = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing defenseDvoa worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[3] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        defense_dvoa_rank: row[2],
        nfl_team: fixTeam(row[3]),
        defense_dvoa: row[4],
        last_week_defense_dvoa: row[5],
        defense_weighted_dvoa: row[6],
        defense_weighted_dvoa_rank: row[7],
        pass_defense_dvoa: row[8],
        pass_defense_dvoa_rank: row[9],
        rush_defense_dvoa: row[10],
        rush_defense_dvoa_rank: row[11],
        non_adjusted_total_defense: row[12],
        non_adjusted_pass_defense: row[13],
        non_adjusted_rush_defense: row[14],
        defense_variance: row[15],
        defense_variance_rank: row[16],
        defense_schedule: row[17],
        defense_schedule_rank: row[18],
        timestamp
      }
    })

  const unit_formatted_data = formatted_data.map((row) => ({
    year: row.year,
    week: row.week,
    nfl_team: row.nfl_team,
    team_unit: 'DEFENSE',
    pass_dvoa: row.pass_defense_dvoa,
    pass_dvoa_rank: row.pass_defense_dvoa_rank,
    rush_dvoa: row.rush_defense_dvoa,
    rush_dvoa_rank: row.rush_defense_dvoa_rank,
    timestamp: row.timestamp
  }))

  if (dry_run) {
    log(formatted_data[0])
    log(unit_formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team'])
      .merge()

    await db('dvoa_team_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'week'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_index')
      .insert(unit_formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(unit_formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_offense_dvoa = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing offenseDvoa worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[3] !== 'NFL')
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        offense_dvoa_rank: row[2],
        nfl_team: fixTeam(row[3]),
        offense_dvoa: row[4],
        last_week_offense_dvoa: row[5],
        offense_weighted_dvoa: row[6],
        offense_weighted_dvoa_rank: row[7],
        pass_offense_dvoa: row[8],
        pass_offense_dvoa_rank: row[9],
        rush_offense_dvoa: row[10],
        rush_offense_dvoa_rank: row[11],
        non_adjusted_total_offense: row[12],
        non_adjusted_pass_offense: row[13],
        non_adjusted_rush_offense: row[14],
        offense_variance: row[15],
        offense_variance_rank: row[16],
        offense_schedule: row[17],
        offense_schedule_rank: row[18],
        timestamp
      }
    })

  const unit_formatted_data = formatted_data.map((row) => ({
    year: row.year,
    week: row.week,
    nfl_team: row.nfl_team,
    team_unit: 'OFFENSE',
    pass_dvoa: row.pass_offense_dvoa,
    pass_dvoa_rank: row.pass_offense_dvoa_rank,
    rush_dvoa: row.rush_offense_dvoa,
    rush_dvoa_rank: row.rush_offense_dvoa_rank,
    timestamp: row.timestamp
  }))

  if (dry_run) {
    log(formatted_data[0])
    log(unit_formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team'])
      .merge()

    await db('dvoa_team_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'week'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_index')
      .insert(unit_formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit'])
      .merge()

    await db('dvoa_team_unit_seasonlogs_history')
      .insert(unit_formatted_data)
      .onConflict(['year', 'nfl_team', 'team_unit', 'week'])
      .merge()
  }
}

const process_total_dvoa = async (worksheet, { dry_run, timestamp }) => {
  log(`Processing totalDvoa worksheet`)

  const data = worksheet.data.slice(1)

  const formatted_data = data
    .filter((row) => row[3] !== 'NFL' && row[3])
    .map((row) => {
      return {
        year: row[0],
        week: row[1],
        total_dvoa_rank: row[2],
        nfl_team: fixTeam(row[3]),
        total_dvoa: row[4],
        last_week_dvoa: row[5],
        non_adjusted_total_voa: row[6],
        // win_loss: row[7],
        offense_dvoa: row[8],
        offense_dvoa_rank: row[9],
        defense_dvoa: row[10],
        defense_dvoa_rank: row[11],
        special_teams_dvoa: row[12],
        special_teams_dvoa_rank: row[13],
        offense_voa_unadjusted: row[14],
        defense_voa_unadjusted: row[15],
        special_voa_unadjusted: row[16],
        estimated_wins: row[17],
        estimated_wins_rank: row[18],
        total_weighted_dvoa: row[19],
        total_weighted_dvoa_rank: row[20],
        past_schedule: row[21],
        past_schedule_rank: row[22],
        future_schedule: row[23],
        future_schedule_rank: row[24],
        total_variance: row[25],
        total_variance_rank: row[26],
        timestamp
      }
    })

  if (dry_run) {
    log(formatted_data[0])
  }

  if (!dry_run && formatted_data.length) {
    await db('dvoa_team_seasonlogs_index')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team'])
      .merge()

    await db('dvoa_team_seasonlogs_history')
      .insert(formatted_data)
      .onConflict(['year', 'nfl_team', 'week'])
      .merge()
  }
}

const import_dvoa_sheets = async ({ dry_run = false, filepath } = {}) => {
  if (!filepath) {
    throw new Error('filepath is required')
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const worksheets = xlsx.parse(filepath)
  log(`loaded ${worksheets.length} worksheets`)

  const year = worksheets.find((ws) => ws.name === 'teamDefvsRec')?.data[1][0]

  log(`year: ${year}`)

  if (!year) {
    throw new Error('year not found')
  }

  for (const worksheet of worksheets) {
    switch (worksheet.name) {
      case 'teamDefvsRec':
        await process_team_def_vs_rec(worksheet, { dry_run, timestamp })
        break
      case 'teamDirectionalRushing':
        await process_team_directional_rushing(worksheet, {
          dry_run,
          timestamp
        })
        break
      case 'teamLineYards':
        await process_team_line_yards(worksheet, { dry_run, timestamp })
        break
      case 'AdjLineYds Weekly Sheet':
        // skip
        break
      case 'schedule':
        // skip
        break
      case 'teamRunPassWeek':
        await process_team_run_pass_week(worksheet, {
          dry_run,
          timestamp,
          year
        })
        break
      case 'teamHomeRoad':
        await process_team_home_road(worksheet, { dry_run, timestamp })
        break
      case 'teamDownDist':
        await process_team_down_dist(worksheet, { dry_run, timestamp })
        break
      case 'teamByZone':
        await process_team_by_zone(worksheet, { dry_run, timestamp })
        break
      case 'teamScoreGap':
        await process_team_score_gap(worksheet, { dry_run, timestamp })
        break
      case 'teamQtr':
        await process_team_qtr(worksheet, { dry_run, timestamp })
        break
      case 'QBPassbyDir':
        await process_qb_pass_by_dir(worksheet, { dry_run, timestamp })
        break
      case 'Shotgun':
        await process_shotgun(worksheet, { dry_run, timestamp })
        break
      case 'teamDownPlay':
        await process_team_down_play(worksheet, { dry_run, timestamp })
        break
      case 'Week by Week':
        await process_week_by_week(worksheet, { dry_run, timestamp, year })
        break
      case 'PGWE':
        await process_pgwe(worksheet, { dry_run, timestamp })
        break
      case 'specialDvoa':
        await process_special_dvoa(worksheet, { dry_run, timestamp })
        break
      case 'defenseDvoa':
        await process_defense_dvoa(worksheet, { dry_run, timestamp })
        break
      case 'offenseDvoa':
        await process_offense_dvoa(worksheet, { dry_run, timestamp })
        break
      case 'totalDvoa':
        await process_total_dvoa(worksheet, { dry_run, timestamp })
        break
      default:
        log(`Unhandled worksheet: ${worksheet.name}`)
    }
  }
}

const main = async () => {
  let error
  try {
    await import_dvoa_sheets({ filepath: argv.filepath, dry_run: argv.dry })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_DVOA_SHEETS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_dvoa_sheets
