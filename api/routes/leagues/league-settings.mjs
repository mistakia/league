/**
 * @swagger
 * components:
 *   schemas:
 *     LeagueFieldDefinitions:
 *       type: object
 *       description: Comprehensive league settings field definitions and validation rules
 *       properties:
 *         league_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Basic league identification and external platform fields
 *           example: ["name", "espn_league_id", "sleeper_league_id", "mfl_league_id", "fleaflicker_league_id"]
 *         league_format_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Roster configuration and league format fields
 *           example: ["num_teams", "starter_slots_qb", "starter_slots_rb", "starter_slots_wr", "starter_slots_te", "bench_slot_count", "cap"]
 *         league_scoring_format_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Fantasy scoring system configuration fields
 *           example: ["passing_attempts", "passing_completions", "passing_yards", "passing_touchdowns", "rushing_attempts", "rushing_yards", "rushing_touchdowns", "receptions", "receiving_yards"]
 *         season_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Season-specific configuration fields
 *           example: ["max_roster_qb", "max_roster_rb", "max_roster_wr", "max_roster_te", "max_roster_dst", "max_roster_k", "starting_faab_budget"]
 *         integer_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Fields that must be integer values
 *           example: ["num_teams", "starter_slots_qb", "starter_slots_rb", "bench_slot_count", "cap", "starting_faab_budget"]
 *         positive_integer_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Fields that must be positive integer values
 *           example: ["starter_slots_qb", "starter_slots_rb", "starter_slots_wr", "bench_slot_count", "cap", "starting_faab_budget"]
 *         float_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Fields that accept decimal/float values
 *           example: ["passing_yards", "rushing_yards", "receptions", "receiving_yards", "passing_attempts", "passing_completions"]
 *
 *     LeagueFieldMetadata:
 *       type: object
 *       description: Detailed metadata about league setting fields
 *       properties:
 *         field_name:
 *           type: string
 *           description: The setting field name
 *           example: "passing_yards"
 *         data_type:
 *           type: string
 *           enum: ["integer", "float", "string", "positive_integer"]
 *           description: Expected data type for the field
 *           example: "float"
 *         category:
 *           type: string
 *           enum: ["league", "format", "scoring", "season"]
 *           description: Setting category classification
 *           example: "scoring"
 *         description:
 *           type: string
 *           description: Human-readable description of the setting
 *           example: "Points per passing yard"
 *         validation_rules:
 *           type: object
 *           description: Validation constraints for the field
 *           properties:
 *             minimum:
 *               type: number
 *               description: Minimum allowed value
 *             maximum:
 *               type: number
 *               description: Maximum allowed value
 *             required:
 *               type: boolean
 *               description: Whether field is required
 */

/**
 * @swagger
 * /leagues/{leagueId}/league-settings:
 *   get:
 *     summary: Get league settings field definitions and validation rules
 *     description: |
 *       Retrieves the complete schema of available league settings fields,
 *       their data types, validation rules, and categorization. This endpoint
 *       provides metadata about what settings can be configured.
 *
 *       **Key Features:**
 *       - Complete field definitions for league configuration
 *       - Data type specifications and validation rules
 *       - Field categorization by functional area
 *       - Validation constraints and boundaries
 *       - Integration with external platforms
 *
 *       **Fantasy Football Context:**
 *       - League settings define the entire competitive framework
 *       - Different categories serve different purposes
 *       - Validation ensures league integrity and balance
 *       - Field definitions guide UI and API interactions
 *
 *       **Field Categories:**
 *       - **League Fields**: Basic identification and external IDs
 *       - **Format Fields**: Roster slots, team count, salary cap
 *       - **Scoring Fields**: Fantasy points for statistical categories
 *       - **Season Fields**: Season-specific limits and budgets
 *
 *       **Data Types:**
 *       - **Integer**: Whole numbers (roster slots, team count)
 *       - **Positive Integer**: Non-negative whole numbers (caps, budgets)
 *       - **Float**: Decimal numbers (scoring multipliers)
 *       - **String**: Text fields (league name)
 *
 *       **Validation Rules:**
 *       - Type constraints ensure data integrity
 *       - Range limits prevent unreasonable values
 *       - Required fields enforce minimum configuration
 *       - Category groupings organize related settings
 *
 *       **Usage Examples:**
 *       - Building league configuration forms
 *       - Validating setting updates before submission
 *       - Understanding available customization options
 *       - Implementing league setup wizards
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     responses:
 *       200:
 *         description: League settings field definitions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeagueFieldDefinitions'
 *             examples:
 *               field_definitions:
 *                 summary: Complete field definitions and validation rules
 *                 value:
 *                   league_fields: ["name", "espn_league_id", "sleeper_league_id", "mfl_league_id", "fleaflicker_league_id"]
 *                   league_format_fields: ["num_teams", "starter_slots_qb", "starter_slots_rb", "starter_slots_wr", "starter_slots_te", "bench_slot_count", "practice_squad_slot_count", "reserve_short_term_limit", "cap", "min_bid"]
 *                   league_scoring_format_fields: ["passing_attempts", "passing_completions", "passing_yards", "passing_touchdowns", "rushing_attempts", "rushing_yards", "rushing_touchdowns", "receptions", "receiving_yards", "receiving_touchdowns"]
 *                   season_fields: ["max_roster_qb", "max_roster_rb", "max_roster_wr", "max_roster_te", "max_roster_dst", "max_roster_k", "starting_faab_budget"]
 *                   integer_fields: ["num_teams", "starter_slots_qb", "starter_slots_rb", "starter_slots_wr", "starter_slots_te", "bench_slot_count", "practice_squad_slot_count", "reserve_short_term_limit", "cap", "passing_attempts", "passing_completions", "passing_yards", "passing_touchdowns", "espn_league_id", "sleeper_league_id"]
 *                   positive_integer_fields: ["starter_slots_qb", "starter_slots_rb", "starter_slots_wr", "starter_slots_te", "bench_slot_count", "practice_squad_slot_count", "reserve_short_term_limit", "cap", "min_bid", "espn_league_id", "sleeper_league_id", "mfl_league_id"]
 *                   float_fields: ["passing_attempts", "passing_completions", "passing_yards", "rushing_attempts", "rushing_yards", "receptions", "receiving_yards"]
 *       400:
 *         description: Invalid league ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_league:
 *                 summary: League not found
 *                 value:
 *                   error: "invalid leagueId"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

// Shared league settings definitions
// This file contains the authoritative list of league settings fields
// that can be updated via the API

import {
  scoring_columns,
  scoring_column_names
} from '#libs-shared/scoring-columns.mjs'

// The scoring contribution to the three lists below is DERIVED from
// libs-shared/scoring-columns.mjs rather than repeated here. Listed by hand,
// this file was a fifth enumeration of the same knowledge, and the failure mode
// is silent in the direction that matters: a scoring column absent from
// league_scoring_format_fields is rejected as 'invalid field', so a
// commissioner's edit fails with the column fully wired everywhere else.
//
// Note `integer_fields` gates numeric validation for BOTH integer and float
// fields -- `float_fields` is only consulted inside that branch, so a field in
// float_fields alone reaches Postgres unvalidated. `targets`,
// `rushing_first_downs` and `receiving_first_downs` were in exactly that state;
// deriving both lists from `input_type` closes it.
const scoring_numeric_fields = scoring_columns
  .filter((entry) => entry.input_type === 'int' || entry.input_type === 'float')
  .map((entry) => entry.column)

const scoring_float_fields = scoring_columns
  .filter((entry) => entry.input_type === 'float')
  .map((entry) => entry.column)

export const league_fields = [
  'name',
  'espn_league_id',
  'sleeper_league_id',
  'mfl_league_id',
  'fleaflicker_league_id'
]

export const league_format_fields = [
  'num_teams',
  'starter_slots_qb',
  'starter_slots_rb',
  'starter_slots_wr',
  'starter_slots_te',
  'starter_slots_rb_wr_flex',
  'srbwrte',
  'sqbrbwrte',
  'starter_slots_wr_te_flex',
  'starter_slots_dst',
  'starter_slots_k',
  'bench_slot_count',
  'practice_squad_slot_count',
  'reserve_short_term_limit',
  'cap',
  'min_bid'
]

export const league_scoring_format_fields = scoring_column_names

export const season_fields = [
  'max_roster_qb',
  'max_roster_rb',
  'max_roster_wr',
  'max_roster_te',
  'max_roster_dst',
  'max_roster_k',
  'starting_faab_budget',
  'playoff_team_count',
  'bye_count',
  'bye_candidate_pool',
  'bye_selection_method',
  'at_large_selection_method',
  'has_division_winner_berths',
  'head_to_head_berth_count'
]

// All updatable league settings fields
export const league_settings_fields = [
  ...league_fields,
  ...season_fields,
  ...league_format_fields,
  ...league_scoring_format_fields
]

// Field type classifications for validation
export const integer_fields = [
  'starter_slots_qb',
  'starter_slots_rb',
  'starter_slots_wr',
  'starter_slots_te',
  'starter_slots_k',
  'starter_slots_dst',
  'starter_slots_rb_wr_flex',
  'srbwrte',
  'sqbrbwrte',
  'starter_slots_wr_te_flex',
  'bench_slot_count',
  'practice_squad_slot_count',
  'reserve_short_term_limit',
  'max_roster_qb',
  'max_roster_rb',
  'max_roster_wr',
  'max_roster_te',
  'max_roster_dst',
  'max_roster_k',
  'starting_faab_budget',
  'playoff_team_count',
  'bye_count',
  'head_to_head_berth_count',
  'cap',
  'num_teams',
  'min_bid',
  'espn_league_id',
  'sleeper_league_id',
  'mfl_league_id',
  'fleaflicker_league_id',
  ...scoring_numeric_fields
]

export const positive_integer_fields = [
  'starter_slots_qb',
  'starter_slots_rb',
  'starter_slots_wr',
  'starter_slots_te',
  'starter_slots_k',
  'starter_slots_dst',
  'starter_slots_rb_wr_flex',
  'srbwrte',
  'sqbrbwrte',
  'starter_slots_wr_te_flex',
  'bench_slot_count',
  'practice_squad_slot_count',
  'reserve_short_term_limit',
  'max_roster_qb',
  'max_roster_rb',
  'max_roster_wr',
  'max_roster_te',
  'max_roster_dst',
  'max_roster_k',
  'starting_faab_budget',
  'playoff_team_count',
  'cap',
  'min_bid',
  'punt_return_touchdowns',
  'kickoff_return_touchdowns',
  'fumble_return_touchdowns',
  'espn_league_id',
  'sleeper_league_id',
  'mfl_league_id',
  'fleaflicker_league_id'
]

export const float_fields = scoring_float_fields
