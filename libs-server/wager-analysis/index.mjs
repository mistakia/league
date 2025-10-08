// Wager Analysis Module
// Comprehensive betting data analysis and reporting utilities

// Wager Data Loading
export { load_wagers_from_files } from './wager-data-loading.mjs'

// Wager Data Processing
export {
  build_selection_index,
  enrich_selections_from_db,
  build_unique_selections
} from './wager-data-processing.mjs'

// Wager Output Handlers
export {
  print_player_exposure_if_requested,
  print_summary_tables,
  print_round_robin_analysis_if_requested,
  print_lost_by_legs_if_requested,
  print_unique_props_table,
  print_exposures_by_game,
  print_prop_combination_tables,
  print_individual_wagers_if_not_hidden,
  print_fanatics_sets_if_requested
} from './wager-console-output-handlers.mjs'

export { handle_markdown_outputs } from './wager-markdown-output-handlers.mjs'

// Wager Standardization
export { standardize_wager_by_source } from './wager-standardization.mjs'

// Wager Calculations
export {
  calculate_wager_summary,
  calculate_props_summary
} from './wager-calculations.mjs'

// Prop Combinations Analysis
export { analyze_prop_near_miss_combinations } from './prop-near-miss-analysis.mjs'

// Key Selections Analysis
export { calculate_key_selections } from './key-selections-analysis.mjs'

// Round Robin Analysis
export {
  format_round_robin_display,
  analyze_fanduel_round_robin_selections,
  analyze_fanatics_wager_sets
} from './round-robin-analysis.mjs'

// Wager Filters
export {
  filter_wagers_by_week,
  filter_wagers_by_lost_legs,
  filter_wagers_by_min_legs,
  filter_wagers_excluding_selections,
  filter_wagers_including_selections,
  filter_wagers_by_source,
  sort_wagers,
  apply_wager_filters
} from './wager-filters.mjs'

// Table Formatters
export {
  create_player_exposure_table,
  create_wager_summary_table,
  create_lost_by_legs_table,
  create_unique_props_table,
  create_event_exposure_table,
  create_prop_combination_table,
  create_wager_table
} from './wager-table-formatters.mjs'

// Data Formatters
export { print_wagers_analysis_tables } from './wager-data-formatters.mjs'

// Markdown Formatters
export {
  format_exposures_markdown,
  format_review_template,
  format_key_selections_markdown
} from './wager-exposure-markdown-formatters.mjs'

export {
  format_wager_search_markdown,
  format_near_misses_markdown
} from './wager-search-markdown-formatters.mjs'
