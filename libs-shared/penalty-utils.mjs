// Canonical penalty type mappings - normalizes historical, variant, and
// source-specific names to a canonical format based on nflfastr/NFL standards

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
  'Player Out of Bounds on a Punt': 'Player Out of Bounds on Kick',

  // Sportradar-specific variants - strip prefix and normalize to base name
  // Dynamic suffix will be added by SIDE_SPECIFIC_PENALTIES logic based on pen_team/off_team
  // This ensures convergence with nflfastr and extraction pipelines
  'Offensive Facemask': 'Face Mask (15 Yards)',
  'Offensive Illegal Block Above the Waist': 'Illegal Block Above the Waist',
  'Defensive Illegal Blindside Block': 'Illegal Blindside Block',
  'Offensive Low Block': 'Low Block',
  'Defensive Chop Block': 'Chop Block'
}

// Penalties that are ALWAYS committed by the offense
export const OFFENSE_ONLY_PENALTIES = new Set([
  'False Start',
  'Delay of Game', // Note: "Defensive Delay of Game" is separate
  'Illegal Formation',
  'Illegal Shift',
  'Illegal Motion',
  'Ineligible Downfield Pass',
  'Ineligible Downfield Kick',
  'Intentional Grounding',
  'Illegal Forward Pass',
  'Illegal Touch Pass',
  'Illegal Touch Kick',
  'Illegal Double-Team Block',
  'Illegal Crackback',
  'Illegal Peelback',
  'Kickoff Out of Bounds',
  'Kickoff Short of Landing Zone',
  'Player Out of Bounds on Kick',
  'Delay of Kickoff',
  'Short Free Kick'
])

// Penalties that are ALWAYS committed by the defense
export const DEFENSE_ONLY_PENALTIES = new Set([
  'Neutral Zone Infraction',
  'Encroachment',
  'Roughing the Passer',
  'Roughing the Kicker',
  'Running Into the Kicker',
  'Illegal Contact',
  'Leverage',
  'Leaping',
  'Hip Drop Tackle',
  'Fair Catch Interference',
  'Kick Catch Interference',
  'Offside on Free Kick',
  'Invalid Fair Catch Signal',
  'Illegal Wedge'
])

// Penalties that can be committed by EITHER side - require dynamic suffix
export const SIDE_SPECIFIC_PENALTIES = new Set([
  'Unnecessary Roughness',
  'Unsportsmanlike Conduct',
  'Taunting',
  'Tripping',
  'Illegal Use of Hands',
  'Illegal Bat',
  'Personal Foul',
  'Disqualification',
  'Face Mask (15 Yards)',
  'Face Mask (5 Yards)',
  'Illegal Block Above the Waist',
  'Illegal Blindside Block',
  'Horse Collar Tackle',
  'Low Block',
  'Lowering the Head to Make Forcible Contact',
  'Illegal Substitution',
  'Illegal Kick/Kicking Loose Ball',
  'Chop Block',
  'Clipping'
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
 * Check if a penalty type already has a unit designation
 * (Offensive/Defensive prefix or / Offense, / Defense suffix)
 */
const has_unit_designation = (penalty_type) => {
  if (!penalty_type) return false
  return (
    penalty_type.startsWith('Offensive ') ||
    penalty_type.startsWith('Defensive ') ||
    penalty_type.endsWith(' / Offense') ||
    penalty_type.endsWith(' / Defense')
  )
}

/**
 * Normalize penalty type to canonical name with unit designation
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

  // Skip if already has unit designation (Offensive/Defensive prefix or suffix)
  if (has_unit_designation(normalized)) {
    return normalized
  }

  // Offense-only penalties always get / Offense suffix
  if (OFFENSE_ONLY_PENALTIES.has(normalized)) {
    return normalized + ' / Offense'
  }

  // Defense-only penalties always get / Defense suffix
  if (DEFENSE_ONLY_PENALTIES.has(normalized)) {
    return normalized + ' / Defense'
  }

  // Side-specific penalties need dynamic suffix based on pen_team vs off_team
  if (SIDE_SPECIFIC_PENALTIES.has(normalized)) {
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
