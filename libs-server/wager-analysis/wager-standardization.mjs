import { standardize_fanduel_wager } from './fanduel-standardization.mjs'
import { standardize_draftkings_wager } from './draftkings-standardization.mjs'
import { standardize_fanatics_wager } from './fanatics-standardization.mjs'

// Standardize wager format across different sportsbooks
export const standardize_wager_by_source = ({ wager, source }) => {
  if (source === 'fanduel') {
    return standardize_fanduel_wager(wager)
  } else if (source === 'draftkings') {
    return standardize_draftkings_wager(wager)
  } else if (source === 'fanatics') {
    return standardize_fanatics_wager(wager)
  }

  throw new Error(`Unknown wager source: ${source}`)
}
