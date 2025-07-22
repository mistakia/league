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
 *           example: ["name", "espn_id", "sleeper_id", "mfl_id", "fleaflicker_id"]
 *         league_format_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Roster configuration and league format fields
 *           example: ["num_teams", "sqb", "srb", "swr", "ste", "bench", "cap"]
 *         league_scoring_format_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Fantasy scoring system configuration fields
 *           example: ["pa", "pc", "py", "tdp", "ra", "ry", "tdr", "rec", "recy"]
 *         season_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Season-specific configuration fields
 *           example: ["mqb", "mrb", "mwr", "mte", "mdst", "mk", "faab"]
 *         integer_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Fields that must be integer values
 *           example: ["num_teams", "sqb", "srb", "bench", "cap", "faab"]
 *         positive_integer_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Fields that must be positive integer values
 *           example: ["sqb", "srb", "swr", "bench", "cap", "faab"]
 *         float_fields:
 *           type: array
 *           items:
 *             type: string
 *           description: Fields that accept decimal/float values
 *           example: ["py", "ry", "rec", "recy", "pa", "pc"]
 *
 *     LeagueFieldMetadata:
 *       type: object
 *       description: Detailed metadata about league setting fields
 *       properties:
 *         field_name:
 *           type: string
 *           description: The setting field name
 *           example: "py"
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
 *       - Leagues
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
 *                   league_fields: ["name", "espn_id", "sleeper_id", "mfl_id", "fleaflicker_id"]
 *                   league_format_fields: ["num_teams", "sqb", "srb", "swr", "ste", "bench", "ps", "ir", "cap", "min_bid"]
 *                   league_scoring_format_fields: ["pa", "pc", "py", "tdp", "ra", "ry", "tdr", "rec", "recy", "tdrec"]
 *                   season_fields: ["mqb", "mrb", "mwr", "mte", "mdst", "mk", "faab"]
 *                   integer_fields: ["num_teams", "sqb", "srb", "swr", "ste", "bench", "ps", "ir", "cap", "pa", "pc", "py", "tdp", "espn_id", "sleeper_id"]
 *                   positive_integer_fields: ["sqb", "srb", "swr", "ste", "bench", "ps", "ir", "cap", "min_bid", "espn_id", "sleeper_id", "mfl_id"]
 *                   float_fields: ["pa", "pc", "py", "ra", "ry", "rec", "recy"]
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

export const league_fields = [
  'name',
  'espn_id',
  'sleeper_id',
  'mfl_id',
  'fleaflicker_id'
]

export const league_format_fields = [
  'num_teams',
  'sqb',
  'srb',
  'swr',
  'ste',
  'srbwr',
  'srbwrte',
  'sqbrbwrte',
  'swrte',
  'sdst',
  'sk',
  'bench',
  'ps',
  'ir',
  'cap',
  'min_bid'
]

export const league_scoring_format_fields = [
  'pa',
  'pc',
  'py',
  'ints',
  'tdp',
  'ra',
  'ry',
  'tdr',
  'rec',
  'rbrec',
  'wrrec',
  'terec',
  'recy',
  'twoptc',
  'tdrec',
  'fuml',
  'prtd',
  'krtd'
]

export const season_fields = ['mqb', 'mrb', 'mwr', 'mte', 'mdst', 'mk', 'faab']

// All updatable league settings fields
export const league_settings_fields = [
  ...league_fields,
  ...season_fields,
  ...league_format_fields,
  ...league_scoring_format_fields
]

// Field type classifications for validation
export const integer_fields = [
  'sqb',
  'srb',
  'swr',
  'ste',
  'sk',
  'sdst',
  'srbwr',
  'srbwrte',
  'sqbrbwrte',
  'swrte',
  'bench',
  'ps',
  'ir',
  'mqb',
  'mrb',
  'mwr',
  'mte',
  'mdst',
  'mk',
  'faab',
  'cap',
  'pa',
  'pc',
  'py',
  'ints',
  'tdp',
  'ra',
  'ry',
  'tdr',
  'rbrec',
  'wrrec',
  'terec',
  'rec',
  'recy',
  'twoptc',
  'tdrec',
  'fuml',
  'num_teams',
  'min_bid',
  'prtd',
  'krtd',
  'espn_id',
  'sleeper_id',
  'mfl_id',
  'fleaflicker_id'
]

export const positive_integer_fields = [
  'sqb',
  'srb',
  'swr',
  'ste',
  'sk',
  'sdst',
  'srbwr',
  'srbwrte',
  'sqbrbwrte',
  'swrte',
  'bench',
  'ps',
  'ir',
  'mqb',
  'mrb',
  'mwr',
  'mte',
  'mdst',
  'mk',
  'faab',
  'cap',
  'min_bid',
  'prtd',
  'krtd',
  'espn_id',
  'sleeper_id',
  'mfl_id',
  'fleaflicker_id'
]

export const float_fields = [
  'pa',
  'pc',
  'py',
  'ra',
  'ry',
  'rbrec',
  'wrrec',
  'terec',
  'rec',
  'recy'
]
