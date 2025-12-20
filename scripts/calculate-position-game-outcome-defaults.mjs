import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, batch_insert, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { current_season } from '#constants'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-position-game-outcome-defaults')
debug.enable('calculate-position-game-outcome-defaults')

// Minimum players for a valid position/archetype default
const MIN_PLAYERS_FOR_DEFAULT = 5

/**
 * Calculate position and archetype default correlations from player correlations.
 * Used for blending when player-specific data is insufficient.
 */
const calculate_position_game_outcome_defaults = async ({ year } = {}) => {
  if (!year) {
    throw new Error('year is required')
  }

  log(`Calculating position game outcome defaults for year ${year}`)

  // Get all player correlations with position and archetype data
  const player_correlations = await db('player_game_outcome_correlations')
    .join('player', 'player_game_outcome_correlations.pid', 'player.pid')
    .leftJoin('player_archetypes', function () {
      this.on('player.pid', 'player_archetypes.pid').andOn(
        db.raw('player_archetypes.year = ?', [year])
      )
    })
    .where('player_game_outcome_correlations.year', year)
    .where('player_game_outcome_correlations.outcome_type', 'game_script')
    .where('player_game_outcome_correlations.confidence', '>=', 0.5) // Only use confident correlations
    .select(
      'player_game_outcome_correlations.pid',
      'player_game_outcome_correlations.correlation',
      'player_game_outcome_correlations.confidence',
      'player.pos',
      'player_archetypes.archetype'
    )

  log(`Found ${player_correlations.length} player correlations`)

  // Group by position and archetype
  const position_groups = new Map()
  const archetype_groups = new Map()

  for (const pc of player_correlations) {
    const pos = pc.pos
    const archetype = pc.archetype
    const correlation = parseFloat(pc.correlation)
    const confidence = parseFloat(pc.confidence)

    if (isNaN(correlation)) continue

    // Add to position group
    if (!position_groups.has(pos)) {
      position_groups.set(pos, { correlations: [], confidences: [] })
    }
    position_groups.get(pos).correlations.push(correlation)
    position_groups.get(pos).confidences.push(confidence)

    // Add to archetype group (if archetype exists)
    if (archetype) {
      const archetype_key = `${pos}:${archetype}`
      if (!archetype_groups.has(archetype_key)) {
        archetype_groups.set(archetype_key, {
          pos,
          archetype,
          correlations: [],
          confidences: []
        })
      }
      archetype_groups.get(archetype_key).correlations.push(correlation)
      archetype_groups.get(archetype_key).confidences.push(confidence)
    }
  }

  const defaults_to_insert = []

  // Calculate position defaults (weighted by confidence)
  for (const [pos, data] of position_groups) {
    if (data.correlations.length < MIN_PLAYERS_FOR_DEFAULT) {
      log(`Skipping position ${pos}: only ${data.correlations.length} players`)
      continue
    }

    // Weighted average by confidence
    let weighted_sum = 0
    let weight_total = 0
    for (let i = 0; i < data.correlations.length; i++) {
      weighted_sum += data.correlations[i] * data.confidences[i]
      weight_total += data.confidences[i]
    }

    const default_correlation =
      weight_total > 0 ? weighted_sum / weight_total : 0

    defaults_to_insert.push({
      pos,
      archetype: null,
      year,
      outcome_type: 'game_script',
      default_correlation: default_correlation.toFixed(4),
      sample_size: data.correlations.length,
      calculated_at: new Date()
    })

    log(
      `Position ${pos}: ${default_correlation.toFixed(4)} (${data.correlations.length} players)`
    )
  }

  // Calculate archetype defaults (weighted by confidence)
  for (const [, data] of archetype_groups) {
    if (data.correlations.length < MIN_PLAYERS_FOR_DEFAULT) {
      continue
    }

    // Weighted average by confidence
    let weighted_sum = 0
    let weight_total = 0
    for (let i = 0; i < data.correlations.length; i++) {
      weighted_sum += data.correlations[i] * data.confidences[i]
      weight_total += data.confidences[i]
    }

    const default_correlation =
      weight_total > 0 ? weighted_sum / weight_total : 0

    defaults_to_insert.push({
      pos: data.pos,
      archetype: data.archetype,
      year,
      outcome_type: 'game_script',
      default_correlation: default_correlation.toFixed(4),
      sample_size: data.correlations.length,
      calculated_at: new Date()
    })

    log(
      `Archetype ${data.pos}/${data.archetype}: ${default_correlation.toFixed(4)} (${data.correlations.length} players)`
    )
  }

  log(`Inserting ${defaults_to_insert.length} position/archetype defaults`)

  // Insert in batches
  if (defaults_to_insert.length > 0) {
    await batch_insert({
      items: defaults_to_insert,
      batch_size: 100,
      save: async (batch) => {
        // Delete existing records for this year first (simpler than complex upsert)
        await db('position_game_outcome_defaults')
          .where({ year, outcome_type: 'game_script' })
          .delete()

        await db('position_game_outcome_defaults').insert(batch)
      }
    })
  }

  log(`Completed: inserted ${defaults_to_insert.length} defaults`)
  return defaults_to_insert.length
}

const main = async () => {
  let error
  try {
    const year = argv.year || current_season.year - 1

    await calculate_position_game_outcome_defaults({ year })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.CALCULATE_POSITION_GAME_OUTCOME_DEFAULTS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_position_game_outcome_defaults
