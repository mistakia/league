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
    METRIC_LINE: /(\d+\.?\d*)+/,
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

export const DEBUG_MODULES = [
  'import-draft-kings',
  'get-player',
  'draftkings',
  'insert-prop-markets',
  'insert-prop-market-selections'
]
