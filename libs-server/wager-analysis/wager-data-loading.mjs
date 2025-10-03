import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

import { standardize_wager_by_source } from './wager-standardization.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../../tmp')

/**
 * Load wagers from optional FanDuel, DraftKings and Fanatics source files
 * and return both combined standardized wagers and the raw FanDuel list for
 * round-robin analysis.
 *
 * @param {object} params
 * @param {string|undefined} params.fanduel_filename
 * @param {string|undefined} params.draftkings_filename
 * @param {string|undefined} params.fanatics_filename
 * @param {boolean} params.show_only_open_round_robins
 * @returns {Promise<{ wagers: Array, fanduel_round_robin_wagers: Array }>}
 */
export const load_wagers_from_files = async ({
  fanduel_filename,
  draftkings_filename,
  fanatics_filename,
  show_only_open_round_robins
}) => {
  let wagers = []
  let fanduel_round_robin_wagers = []

  if (fanduel_filename) {
    try {
      const fanduel_wagers = await fs.readJson(
        `${data_path}/${fanduel_filename}`
      )
      wagers = wagers.concat(
        fanduel_wagers.flatMap((wager) =>
          standardize_wager_by_source({ wager, source: 'fanduel' })
        )
      )
      fanduel_round_robin_wagers = fanduel_wagers.filter((wager) => {
        const is_round_robin = wager.numLines > 1
        if (show_only_open_round_robins) {
          return is_round_robin && wager.potentialWin > 0
        }
        return is_round_robin
      })
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(
          `Warning: FanDuel file '${fanduel_filename}' not found. Skipping FanDuel wagers.`
        )
      } else {
        throw error
      }
    }
  }

  if (draftkings_filename) {
    try {
      const draftkings_wagers = await fs.readJson(
        `${data_path}/${draftkings_filename}`
      )
      wagers = wagers.concat(
        draftkings_wagers.flatMap((wager) =>
          standardize_wager_by_source({ wager, source: 'draftkings' })
        )
      )
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(
          `Warning: DraftKings file '${draftkings_filename}' not found. Skipping DraftKings wagers.`
        )
      } else {
        throw error
      }
    }
  }

  if (fanatics_filename) {
    try {
      const fanatics_wagers = await fs.readJson(
        `${data_path}/${fanatics_filename}`
      )
      wagers = wagers.concat(
        fanatics_wagers.flatMap((wager) =>
          standardize_wager_by_source({ wager, source: 'fanatics' })
        )
      )
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(
          `Warning: Fanatics file '${fanatics_filename}' not found. Skipping Fanatics wagers.`
        )
      } else {
        throw error
      }
    }
  }

  return { wagers, fanduel_round_robin_wagers }
}
