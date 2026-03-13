import core_play_columns from './core-play-columns.mjs'
import play_outcome_columns from './play-outcome-columns.mjs'
import play_passing_columns from './play-passing-columns.mjs'
import play_rushing_columns from './play-rushing-columns.mjs'
import play_receiving_columns from './play-receiving-columns.mjs'
import play_context_columns from './play-context-columns.mjs'
import play_personnel_columns from './play-personnel-columns.mjs'
import play_situational_columns from './play-situational-columns.mjs'

export default {
  ...core_play_columns,
  ...play_outcome_columns,
  ...play_passing_columns,
  ...play_rushing_columns,
  ...play_receiving_columns,
  ...play_context_columns,
  ...play_personnel_columns,
  ...play_situational_columns
}
