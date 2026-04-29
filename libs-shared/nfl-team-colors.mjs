// Official NFL team colors keyed by the ESPN-style abbreviation used in nfl_team_abbreviations.
// primary: dominant brand color, secondary: accent color, text: recommended text-on-primary color.
// Color values sourced from official team branding / teamcolorcodes.com.

export const nfl_team_colors = {
  ARI: { primary: '#97233f', secondary: '#000000', text: '#ffffff' },
  ATL: { primary: '#a71930', secondary: '#000000', text: '#ffffff' },
  BAL: { primary: '#241773', secondary: '#000000', text: '#ffffff' },
  BUF: { primary: '#00338d', secondary: '#c60c30', text: '#ffffff' },
  CAR: { primary: '#0085ca', secondary: '#101820', text: '#ffffff' },
  CHI: { primary: '#0b162a', secondary: '#c83803', text: '#ffffff' },
  CIN: { primary: '#fb4f14', secondary: '#000000', text: '#ffffff' },
  CLE: { primary: '#311d00', secondary: '#ff3c00', text: '#ffffff' },
  DAL: { primary: '#003594', secondary: '#869397', text: '#ffffff' },
  DEN: { primary: '#fb4f14', secondary: '#002244', text: '#ffffff' },
  DET: { primary: '#0076b6', secondary: '#b0b7bc', text: '#ffffff' },
  GB: { primary: '#203731', secondary: '#ffb612', text: '#ffffff' },
  HOU: { primary: '#03202f', secondary: '#a71930', text: '#ffffff' },
  IND: { primary: '#002c5f', secondary: '#a2aaad', text: '#ffffff' },
  JAX: { primary: '#101820', secondary: '#d7a22a', text: '#ffffff' },
  KC: { primary: '#e31837', secondary: '#ffb81c', text: '#ffffff' },
  LA: { primary: '#003594', secondary: '#ffd100', text: '#ffffff' },
  LAC: { primary: '#0080c6', secondary: '#ffc20e', text: '#ffffff' },
  LV: { primary: '#000000', secondary: '#a5acaf', text: '#ffffff' },
  MIA: { primary: '#008e97', secondary: '#fc4c02', text: '#ffffff' },
  MIN: { primary: '#4f2683', secondary: '#ffc62f', text: '#ffffff' },
  NE: { primary: '#002244', secondary: '#c60c30', text: '#ffffff' },
  NO: { primary: '#d3bc8d', secondary: '#101820', text: '#000000' },
  NYG: { primary: '#0b2265', secondary: '#a71930', text: '#ffffff' },
  NYJ: { primary: '#125740', secondary: '#000000', text: '#ffffff' },
  PHI: { primary: '#004c54', secondary: '#a5acaf', text: '#ffffff' },
  PIT: { primary: '#ffb612', secondary: '#101820', text: '#000000' },
  SEA: { primary: '#002244', secondary: '#69be28', text: '#ffffff' },
  SF: { primary: '#aa0000', secondary: '#b3995d', text: '#ffffff' },
  TB: { primary: '#d50a0a', secondary: '#34302b', text: '#ffffff' },
  TEN: { primary: '#0c2340', secondary: '#4b92db', text: '#ffffff' },
  WAS: { primary: '#5a1414', secondary: '#ffb612', text: '#ffffff' }
}

const DEFAULT_COLOR = '#666666'

/**
 * Returns a team color string for the given abbreviation and key.
 *
 * @param {object} params
 * @param {string} params.abbr - Uppercase NFL team abbreviation (e.g. 'KC')
 * @param {'primary'|'secondary'|'text'} [params.key='primary'] - Color key
 * @returns {string} hex color string
 */
export function get_team_color({ abbr, key = 'primary' } = {}) {
  const team = nfl_team_colors[abbr]
  if (!team) return DEFAULT_COLOR
  return team[key] ?? DEFAULT_COLOR
}
