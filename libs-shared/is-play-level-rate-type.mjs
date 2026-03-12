const NON_PLAY_LEVEL_RATE_TYPES = new Set([
  'per_game',
  'per_team_half',
  'per_team_quarter'
])

export default function is_play_level_rate_type(rate_type) {
  if (!rate_type) {
    return false
  }
  return !NON_PLAY_LEVEL_RATE_TYPES.has(rate_type)
}
