// Canonical penalty type mappings - normalizes historical and variant names
// to Sportradar-style canonical names with offense/defense suffixes

export const PENALTY_TYPE_CANONICAL_MAP = {
  // Face Mask - preserve yard distinction
  'Face Mask': 'Face Mask (15 Yards)',
  'Face Mask (5 Yards)': 'Face Mask (5 Yards)',
  'Face Mask (15 Yards)': 'Face Mask (15 Yards)',

  // Historical renames (pre-2018 to current naming)
  'Defensive 12 On-field': 'Defensive Too Many Men on Field',
  'Offensive 12 On-field': 'Offensive Too Many Men on Field',
  'Player Out of Bounds on Punt': 'Player Out of Bounds on Kick',
  'Interference with Opportunity to Catch': 'Kick Catch Interference',
  'Lowering the Head to Initiate Contact':
    'Lowering the Head to Make Forcible Contact',
  'Crown of Helmet': 'Lowering the Head to Make Forcible Contact',

  // Variant normalizations
  'Horse Collar': 'Horse Collar Tackle',
  'Illegal Kick': 'Illegal Kick/Kicking Loose Ball',
  'Illegally Kicking Ball': 'Illegal Kick/Kicking Loose Ball',

  // Offensive facemask variant
  'Offensive Facemask': 'Offensive Facemask'
}

// Penalties that require offense/defense suffix based on penalized team
export const SIDE_SPECIFIC_PENALTIES = new Set([
  'Unnecessary Roughness',
  'Unsportsmanlike Conduct',
  'Taunting',
  'Tripping',
  'Illegal Use of Hands',
  'Illegal Bat',
  'Personal Foul',
  'Disqualification'
])

// Regex patterns for extracting penalty type from play description
// Standard format: PENALTY on TEAM-PLAYER, Type, X yards
const PENALTY_REGEX_WITH_PLAYER = /PENALTY on [A-Z]{2,4}-[^,]+, ([^,]+),/
const PENALTY_REGEX_TEAM_ONLY = /PENALTY on [A-Z]{2,4}, ([^,]+),/
// nflfastR format with jersey number: PENALTY on TEAM-##-PLAYER, Type, placed at
const PENALTY_REGEX_NFLFASTR = /PENALTY on [A-Z]{2,4}-\d+-[^,]+, ([^,]+),/
// Kickoff penalties: Type, placed at (no yard value)
const PENALTY_REGEX_PLACED_AT =
  /PENALTY on [A-Z]{2,4}(?:-[^,]+)?, ([^,]+), placed at/

// Invalid penalty names (parsing errors - yard values extracted instead of type)
const INVALID_PENALTY_NAMES = new Set([
  '0 yards',
  '2 yards',
  '3 yards',
  '4 yards',
  '5 yards',
  '6 yards',
  '7 yards',
  '8 yards',
  '9 yards',
  '10 yards',
  '14 yards',
  '15 yards'
])

/**
 * Extract penalty type from play description
 * @param {Object} params
 * @param {string} [params.desc] - Play description text (NGS/NFL v1 source)
 * @param {string} [params.desc_nflfastr] - nflfastr play description (preferred, more complete)
 * @returns {string|null} Extracted penalty type or null if not found
 */
export const extract_penalty_from_desc = ({ desc, desc_nflfastr }) => {
  const description = desc_nflfastr || desc
  if (!description) {
    return null
  }

  // Try patterns in order of specificity
  const patterns = [
    PENALTY_REGEX_NFLFASTR, // nflfastR format with jersey number (most specific)
    PENALTY_REGEX_WITH_PLAYER, // Standard format with player name
    PENALTY_REGEX_PLACED_AT, // Kickoff penalties with "placed at"
    PENALTY_REGEX_TEAM_ONLY // Team-only format (Delay of Game, etc.)
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match && match[1]) {
      const penalty_name = match[1].trim()
      if (!INVALID_PENALTY_NAMES.has(penalty_name)) {
        return penalty_name
      }
    }
  }

  return null
}

/**
 * Normalize penalty type to canonical name
 * @param {Object} params
 * @param {string} params.raw_penalty_type - Raw penalty type name
 * @param {string} [params.pen_team] - Team that committed the penalty
 * @param {string} [params.off_team] - Team on offense during the play
 * @returns {string|null} Canonical penalty type or null if input is null
 */
export const normalize_penalty_type = ({
  raw_penalty_type,
  pen_team,
  off_team
}) => {
  if (!raw_penalty_type) {
    return null
  }

  // Check if it's an invalid name (parsing error)
  if (INVALID_PENALTY_NAMES.has(raw_penalty_type)) {
    return null
  }

  // Apply direct mapping if exists
  let normalized = PENALTY_TYPE_CANONICAL_MAP[raw_penalty_type]

  // If no mapping, use the raw type
  if (!normalized) {
    normalized = raw_penalty_type
  }

  // Check if this penalty needs side suffix
  if (SIDE_SPECIFIC_PENALTIES.has(raw_penalty_type)) {
    // Only add suffix if we can determine the side
    if (pen_team && off_team) {
      const is_offense_penalty =
        pen_team.toUpperCase() === off_team.toUpperCase()
      const suffix = is_offense_penalty ? ' / Offense' : ' / Defense'
      return normalized + suffix
    }
    // If we can't determine side, return without suffix
    return normalized
  }

  return normalized
}

/**
 * Extract and normalize penalty type in one step
 * @param {Object} params
 * @param {string} [params.desc] - Play description text (NGS/NFL v1 source)
 * @param {string} [params.desc_nflfastr] - nflfastr play description (preferred, more complete)
 * @param {string} [params.pen_team] - Team that committed the penalty
 * @param {string} [params.off_team] - Team on offense during the play
 * @returns {string|null} Canonical penalty type or null if not extractable
 */
export const get_canonical_penalty_type = ({
  desc,
  desc_nflfastr,
  pen_team,
  off_team
}) => {
  const raw_penalty_type = extract_penalty_from_desc({ desc, desc_nflfastr })
  if (!raw_penalty_type) {
    return null
  }

  return normalize_penalty_type({
    raw_penalty_type,
    pen_team,
    off_team
  })
}
