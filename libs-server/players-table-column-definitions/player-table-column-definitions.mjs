import db from '#db'

export default {
  player_name: {
    table_name: 'player',
    where_column: ({ case_insensitive = false }) => {
      if (case_insensitive) {
        return db.raw(`UPPER(player.fname || ' ' || player.lname)`)
      } else {
        return db.raw(`player.fname || ' ' || player.lname`)
      }
    },
    select: () => ['player.fname', 'player.lname'],
    group_by: () => ['player.fname', 'player.lname']
  },
  player_position: {
    table_name: 'player',
    column_name: 'pos'
  },

  player_height: {
    table_name: 'player',
    column_name: 'height'
  },
  player_weight: {
    table_name: 'player',
    column_name: 'weight'
  },
  player_age: {
    table_name: 'player',
    column_name: 'age',
    select: ({ column_index }) => [
      `ROUND(EXTRACT(YEAR FROM AGE(CURRENT_DATE, TO_DATE(player.dob, 'YYYY-MM-DD'))) +
       (EXTRACT(MONTH FROM AGE(CURRENT_DATE, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 12.0) +
       (EXTRACT(DAY FROM AGE(CURRENT_DATE, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 365.25), 2) as age_${column_index}`
    ],
    group_by: () => ['player.dob'],
    where_column: () =>
      `ROUND(EXTRACT(YEAR FROM AGE(CURRENT_DATE, TO_DATE(player.dob, 'YYYY-MM-DD'))) +
       (EXTRACT(MONTH FROM AGE(CURRENT_DATE, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 12.0) +
       (EXTRACT(DAY FROM AGE(CURRENT_DATE, TO_DATE(player.dob, 'YYYY-MM-DD'))) / 365.25), 2)`,
    use_having: true
  },
  player_date_of_birth: {
    table_name: 'player',
    column_name: 'dob'
  },
  player_forty_yard_dash: {
    table_name: 'player',
    column_name: 'forty'
  },
  player_bench_press: {
    table_name: 'player',
    column_name: 'bench'
  },
  player_vertical_jump: {
    table_name: 'player',
    column_name: 'vertical'
  },
  player_broad_jump: {
    table_name: 'player',
    column_name: 'broad'
  },
  player_shuttle_run: {
    table_name: 'player',
    column_name: 'shuttle'
  },
  player_three_cone_drill: {
    table_name: 'player',
    column_name: 'cone'
  },
  player_arm_length: {
    table_name: 'player',
    column_name: 'arm'
  },
  player_hand_size: {
    table_name: 'player',
    column_name: 'hand'
  },
  player_draft_position: {
    table_name: 'player',
    column_name: 'dpos'
  },
  player_draft_round: {
    table_name: 'player',
    column_name: 'round'
  },
  player_college: {
    table_name: 'player',
    column_name: 'col'
  },
  player_college_division: {
    table_name: 'player',
    column_name: 'dv'
  },
  player_starting_nfl_year: {
    table_name: 'player',
    column_name: 'start'
  },
  player_current_nfl_team: {
    table_name: 'player',
    column_name: 'current_nfl_team'
  },
  player_position_depth: {
    table_name: 'player',
    column_name: 'posd'
  },
  player_jersey_number: {
    table_name: 'player',
    column_name: 'jnum'
  },
  player_ngs_athleticism_score: {
    table_name: 'player',
    column_name: 'ngs_athleticism_score'
  },
  player_ngs_draft_grade: {
    table_name: 'player',
    column_name: 'ngs_draft_grade'
  },
  player_nfl_grade: {
    table_name: 'player',
    column_name: 'nfl_grade'
  },
  player_ngs_production_score: {
    table_name: 'player',
    column_name: 'ngs_production_score'
  },
  player_ngs_size_score: {
    table_name: 'player',
    column_name: 'ngs_size_score'
  }

  // TODO player.dcp ??
}
