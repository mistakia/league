import {
  RATE_TYPE_TO_OUTPUT,
  is_play_level_period
} from './data-views-output-tokens.mjs'

// Compat shim retained for one release cycle; scheduled for removal in
// retire-rate-type-compat-shims. The canonical predicate is is_play_level_period
// against the period-keyed NON_PLAY_LEVEL_PERIODS set in data-views-output-tokens.
export default function is_play_level_rate_type(rate_type) {
  if (!rate_type) return false
  const entry = RATE_TYPE_TO_OUTPUT[rate_type]
  if (!entry) return false
  return is_play_level_period(entry.period)
}
