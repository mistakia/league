// Format data generation configuration
// Contains all configuration constants and script definitions

/**
 * Main script configuration constants
 */
export const SCRIPT_CONFIG = {
  log_name: 'generate-format-data',
  script_delay: 500,
  format_delay: 1000,
  min_year_check: 2020
}

/**
 * Configuration for available generation scripts
 * Each script defines:
 * - script: filename to execute
 * - description: human-readable description
 * - args: template arguments with placeholders
 * - dependencies: other steps that must run first
 * - tables: database tables affected
 * - per_format: format type ('scoring' or 'league')
 */
export const generation_scripts = {
  // Core format definitions
  core_formats: {
    script: 'generate-league-formats.mjs',
    description: 'Generate core league and scoring format definitions',
    args: [],
    dependencies: [],
    tables: ['league_formats', 'league_scoring_formats']
  },

  // Scoring format player data
  scoring_format_gamelogs: {
    script: 'generate-scoring-format-player-gamelogs.mjs',
    description: 'Generate scoring format player gamelogs',
    args: ['--scoring_format_hash', '{scoring_format_hash}', '--all'],
    dependencies: [],
    tables: ['scoring_format_player_gamelogs'],
    per_format: 'scoring'
  },

  scoring_format_seasonlogs: {
    script: 'generate-scoring-format-player-seasonlogs.mjs',
    description: 'Generate scoring format player seasonlogs',
    args: ['--scoring_format_hash', '{scoring_format_hash}', '--all'],
    dependencies: ['scoring_format_gamelogs'],
    tables: ['scoring_format_player_seasonlogs'],
    per_format: 'scoring'
  },

  scoring_format_careerlogs: {
    script: 'generate-scoring-format-player-careerlogs.mjs',
    description: 'Generate scoring format player careerlogs',
    args: ['--scoring_format_hash', '{scoring_format_hash}'],
    dependencies: ['scoring_format_seasonlogs'],
    tables: ['scoring_format_player_careerlogs'],
    per_format: 'scoring'
  },

  scoring_format_projections: {
    script: 'process-projections-for-scoring-format.mjs',
    description: 'Process projections for scoring format',
    args: ['--scoring_format_hash', '{scoring_format_hash}', '--all'],
    dependencies: [],
    tables: ['scoring_format_player_projection_points'],
    per_format: 'scoring'
  },

  // League format player data
  league_format_gamelogs: {
    script: 'generate-league-format-player-gamelogs.mjs',
    description: 'Generate league format player gamelogs',
    args: ['--league_format_hash', '{league_format_hash}', '--all'],
    dependencies: [
      'scoring_format_gamelogs',
      'scoring_format_seasonlogs',
      'scoring_format_careerlogs'
    ],
    tables: ['league_format_player_gamelogs'],
    per_format: 'league'
  },

  league_format_seasonlogs: {
    script: 'generate-league-format-player-seasonlogs.mjs',
    description: 'Generate league format player seasonlogs',
    args: ['--league_format_hash', '{league_format_hash}', '--all'],
    dependencies: ['league_format_gamelogs'],
    tables: ['league_format_player_seasonlogs'],
    per_format: 'league'
  },

  league_format_careerlogs: {
    script: 'generate-league-format-player-careerlogs.mjs',
    description: 'Generate league format player careerlogs',
    args: ['--league_format_hash', '{league_format_hash}'],
    dependencies: ['league_format_seasonlogs'],
    tables: ['league_format_player_careerlogs'],
    per_format: 'league'
  },

  league_format_projections: {
    script: 'process-projections-for-league-format.mjs',
    description: 'Process projections for league format',
    args: ['--league_format_hash', '{league_format_hash}', '--all'],
    dependencies: ['scoring_format_projections'],
    tables: ['league_format_player_projection_values'],
    per_format: 'league'
  },

  league_format_draft_values: {
    script: 'calculate-draft-pick-value.mjs',
    description: 'Calculate draft pick values for league format',
    args: ['--league_format_hash', '{league_format_hash}'],
    dependencies: ['league_format_careerlogs'],
    tables: ['league_format_draft_pick_value'],
    per_format: 'league'
  }
}

/**
 * Step execution order configuration for different format types
 */
export const STEP_CONFIGURATION = {
  scoring_steps: [
    'scoring_format_gamelogs',
    'scoring_format_seasonlogs',
    'scoring_format_careerlogs',
    'scoring_format_projections'
  ],
  league_steps: [
    'league_format_gamelogs',
    'league_format_seasonlogs',
    'league_format_careerlogs',
    'league_format_projections',
    'league_format_draft_values'
  ]
}
