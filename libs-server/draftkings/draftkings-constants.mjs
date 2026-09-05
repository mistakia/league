/**
 * Constants for DraftKings odds import and processing
 */

export const CONFIG = {
  // Wait times (in milliseconds)
  WAIT_TIMES: {
    DEFAULT: 3000,
    EMPTY_RESULT: 500,
    EMPTY_RESULT_MAX: 3000,
    EMPTY_RESULT_DECREMENT: 500,
    CONSECUTIVE_EMPTY_THRESHOLD: 3,
    CONSECUTIVE_EMPTY_WAIT: 1000,
    EVENT_PROCESSING: 2000,
    ERROR_RETRY: 1000
  },

  // Team name validation
  TEAM_VALIDATION: {
    MAX_LENGTH: 50,
    DIVISION_PATTERNS: [/^\d+(ST|ND|RD|TH)\s+/i, /1ST/, /2ND/, /3RD/, /4TH/],
    NON_TEAM_PATTERNS: [
      /TO LOSE/i,
      /TO WIN/i,
      /WILD CARD/i,
      /DIVISIONAL/i,
      /CONFERENCE/i,
      /SUPER BOWL/i,
      /CHAMPION/i,
      /PLAYOFF/i,
      /ROUND/i,
      /^(OVER|UNDER)\s*\(/i, // Over/Under lines like "Under (9.5)"
      /\(\d+\.?\d*\)/, // Any parenthetical numbers
      /^[A-Z][a-z]+\s+[A-Z][a-z]+$/ // First Last name pattern (player names)
    ]
  },

  // Player name patterns
  PLAYER_PATTERNS: {
    TEAM_ABBREVIATION: /\s*\(([A-Z]{2,4})\)\s*$/,
    // Match numbers in betting contexts:
    // - "N+" format (e.g., "3+", "250+")
    // - Numbers preceded by Over/Under
    // - Numbers at word boundaries NOT embedded in team names like "49ers"
    // The pattern requires either a + suffix, Over/Under prefix, or decimal point
    METRIC_LINE: /(?:(?:over|under)\s*)?(\d+\.\d+|\d+\+)|\b(\d+)\+/i,
    UNICODE_MINUS: /\u2212/g
  },

  // Event validation
  EVENT_VALIDATION: {
    NUMERIC_ID_PATTERN: /^\d+$/,
    GAME_NAME_SEPARATOR: ' @ ',
    REQUIRED_PARTICIPANTS: 2,
    VENUE_ROLES: {
      HOME: 'Home',
      AWAY: 'Away'
    },
    PARTICIPANT_TYPES: {
      PLAYER: 'Player',
      TEAM: 'Team'
    }
  },

  // Logging
  LOGGING: {
    MAX_FAILURES_DISPLAY: 10,
    MAX_EVENTS_DISPLAY: 10
  },

  // File output
  FILE_OUTPUT: {
    PREFIX: 'draftking',
    EXTENSIONS: {
      RAW: 'markets',
      FORMATTED: 'markets-formatted',
      FAILED: 'failed-requests'
    }
  }
}

// `draftkings` does NOT match `draftkings-tracking` -- debug matches namespaces
// exactly unless a wildcard is given -- so the tracking module's log line never
// printed under any configuration this repo or the pm2 config has ever carried.
// That is the second half of why a total write failure stayed invisible for ten
// months: the catch swallowed the error and the only line reporting it went to a
// namespace nobody had enabled. Note this is NOT the debug.enable clobbering
// documented in CLAUDE.md; verified 2026-08-04 by instrumenting debug.enable
// across the real worker import graph, where no enable() call fires at all and
// the environment's namespace set survives intact.
export const DEBUG_MODULES = [
  'import-draft-kings',
  'get-player',
  'draftkings',
  'draftkings-tracking',
  'insert-prop-markets',
  'insert-prop-market-selections'
]

/**
 * Alternate line marketTypeIds for DraftKings
 *
 * DraftKings uses different marketTypeIds to distinguish between primary (single line)
 * and alternate (multiple lines with extreme odds) markets within the same subcategory.
 *
 * Primary markets: Balanced Over/Under odds around -110, single line near expected value
 * Alternate markets: Multiple lines with extreme odds (heavy favorites/longshots)
 *
 * This mapping identifies alternate marketTypeIds that should be classified as ALT types
 * even when the subcategoryId would normally indicate a primary market type.
 */
export const ALTERNATE_MARKET_TYPE_IDS = {
  // Receiving props - subcategoryId 14114 (primary: 13674)
  6818: 'GAME_ALT_RECEIVING_YARDS',

  // Receptions - subcategoryId 14115 (primary: 13676)
  6825: 'GAME_ALT_RECEPTIONS',

  // Passing yards - subcategoryId 9524 (primary: 13552)
  6835: 'GAME_ALT_PASSING_YARDS',

  // Rushing + Receiving yards - subcategoryId 9523 (primary: 13680)
  6829: 'GAME_ALT_RUSHING_RECEIVING_YARDS',

  // Rushing yards - subcategoryId 9514 (primary: 13675)
  6820: 'GAME_ALT_RUSHING_YARDS'
}

// DraftKings products this taxonomy DECLINES to model, at the two granularities
// the market-type mapper reports. Membership means "ruled out of scope", not
// "not yet reached" -- adding an id here is the explicit act of ruling a vendor
// product out, which until 2026-09-04 was folklore in a comment saying "most
// other categories carry exotic markets that are unmapped on purpose".
//
// The mapper's collector records EVERY id that falls through. Only the
// importer's signal is gated on these two sets, so removing an id from either
// makes it reportable again without touching the collector.
//
// Both sets exist because both arms are standing rather than novel. Measured
// 2026-09-04 by replaying the mapper over every distinct (categoryId,
// subcategoryId, betOfferTypeId, marketTypeId) tuple DraftKings published since
// 2025-08-01: 221 subcategories fall through under the 19 modelled categories,
// and 42 further categories reach no handler at all. Ungated, either arm would
// name the same ids on every import run and be a signal nobody reads. Novelty
// is what discriminates -- roughly four genuinely new subcategories a month.
//
// Seed reproduced by:
//   select distinct
//     (substring(source_market_name from 'categoryId: ([0-9]+)'))::int,
//     (substring(source_market_name from 'subcategoryId: ([0-9]+)'))::int,
//     (substring(source_market_name from 'betOfferTypeId: ([0-9]+)'))::int,
//     (substring(source_market_name from 'marketTypeId: ([0-9]+)'))::int
//   from prop_markets_index
//   where source_id = 'DRAFTKINGS' and observed_at >= timestamptz '2025-08-01'
//     and source_market_name ~ 'categoryId: [0-9]+'
// fed through get_market_type, collecting what the two arms recorded. Seed from
// the REPLAY, never from `market_type is null` in the table: market_type is
// last-write-wins on re-observation, so a row not re-observed since a mapping
// landed still reads null and over-seeds by roughly 20 ids.
export const known_unmapped_subcategory_ids = new Set([
  4660, 4661, 4671, 4673, 4674, 4738, 7293, 7629, 8480, 9318, 9320, 9323, 9324,
  9326, 9449, 9579, 9583, 9584, 9588, 9591, 9594, 9603, 9615, 10336, 10400,
  10404, 10405, 10445, 10448, 10508, 10509, 10523, 10541, 10554, 10569, 10587,
  10623, 10627, 11781, 11798, 11818, 11865, 11924, 11938, 11993, 12352, 12422,
  12423, 12424, 12425, 12451, 12625, 12647, 12657, 12664, 12686, 12699, 13103,
  13141, 13163, 13298, 13354, 13357, 13363, 13366, 13369, 13370, 13705, 14125,
  14225, 14457, 14485, 14489, 14492, 14758, 14759, 14760, 14806, 14818, 14819,
  14842, 14845, 14897, 14913, 14921, 14922, 14923, 14987, 14992, 15004, 15015,
  15022, 15023, 15024, 15025, 15026, 15028, 15039, 15046, 15047, 15437, 15662,
  15968, 16074, 16232, 16276, 16719, 16731, 16837, 16838, 16923, 16971, 16989,
  16990, 16991, 16993, 17001, 17063, 17064, 17078, 17081, 17101, 17125, 17130,
  17144, 17146, 17717, 17825, 17833, 18258, 18281, 18294, 18318, 18344, 18403,
  18497, 18501, 18514, 18515, 18535, 18543, 18544, 18567, 18587, 18744, 18745,
  18778, 18805, 18876, 18883, 18884, 18890, 18947, 18953, 18954, 18955, 18956,
  18958, 19080, 19085, 19107, 19108, 19109, 19110, 19112, 19114, 19115, 19116,
  19118, 19120, 19121, 19122, 19178, 19179, 19180, 19181, 19182, 19183, 19184,
  19185, 19186, 19187, 19188, 19189, 19191, 19192, 19193, 19194, 19196, 19197,
  19198, 19199, 19200, 19201, 19202, 19204, 19210, 19212, 19213, 19214, 19220,
  19221, 19231, 19232, 19233, 19234, 19235, 19284, 19356, 19367, 19368, 19387,
  19708, 19709, 20069, 20121, 20165, 20166, 20247, 20248, 20249
])

export const known_unmapped_offer_category_ids = new Set([
  638, 786, 862, 863, 982, 994, 998, 999, 1054, 1098, 1112, 1185, 1226, 1228,
  1237, 1287, 1303, 1304, 1529, 1547, 1552, 1559, 1627, 1643, 1644, 1645, 1653,
  1680, 1702, 1719, 1723, 1736, 1743, 1744, 1801, 1803, 1844, 1872, 1873, 1900,
  1908, 1920,
  // 1972 (Drive Props) and 1974 (No Brainer) ruled out 2026-09-05, signals
  // 128477/128469. The taxonomy has no drive granularity, so the five Drive
  // Props subcategories have no settlement-correct type short of coining one;
  // 1974's single "Either Team to Score 1+ Point" is a novelty with no fitting
  // type either. Deleting either id makes the family reportable again.
  1972, 1974
])
