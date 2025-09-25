// Format processor module
// Main format processing orchestration

import {
  generation_scripts,
  SCRIPT_CONFIG,
  STEP_CONFIGURATION
} from './config.mjs'
import {
  execute_script,
  script_exists,
  prepare_script_args
} from './script-executor.mjs'
import {
  check_format_exists,
  check_format_data_exists,
  check_removal_safety
} from './data-checker.mjs'
import { remove_format_data } from './cleanup-manager.mjs'

/**
 * Check if a step should be skipped based on options
 * @param {string} step_name - Name of the step
 * @param {Object} options - Options object
 * @returns {boolean}
 */
const should_skip_step = (step_name, options) => {
  const { skip_steps = [], only_steps = [] } = options

  if (skip_steps.includes(step_name)) {
    console.log(`Skipping step: ${step_name}`)
    return true
  }

  if (only_steps.length > 0 && !only_steps.includes(step_name)) {
    console.log(`Skipping step (not in onlySteps): ${step_name}`)
    return true
  }

  return false
}

/**
 * Check if a format should be processed based on filter
 * @param {string} format_name - Name of the format
 * @param {string[]} format_filter - Array of format names to process
 * @returns {boolean}
 */
const should_process_format = (format_name, format_filter) => {
  if (!format_filter || format_filter.length === 0) {
    return true
  }

  if (!format_filter.includes(format_name)) {
    console.log(`Skipping format: ${format_name} (not in format filter)`)
    return false
  }

  return true
}

/**
 * Handle step execution error
 * @param {Error} error - The error that occurred
 * @param {string} step_name - Name of the step that failed
 * @param {string} format_name - Name of the format being processed
 * @param {Object} options - Options object
 */
export const handle_step_error = (error, step_name, format_name, options) => {
  console.error(`Failed to execute step ${step_name}:`, error.message)

  // Skip format data generation errors but show warning
  if (
    error.message.includes('not found') ||
    error.message.includes('missing or invalid') ||
    error.message.includes('undefined')
  ) {
    console.log(
      `Skipping ${step_name} for ${format_name} - format may need to be generated first`
    )
    if (!options.continue_on_error) {
      // Skip this step but continue with format
    }
  } else if (!options.continue_on_error) {
    throw error
  }
}

/**
 * Execute a single generation step
 * @param {string} step_name - Name of the step
 * @param {string} format_name - Name of the format
 * @param {string} format_hash - Hash of the format
 * @param {string} format_type - Type of format
 * @param {Object} options - Options object
 */
export const execute_generation_step = async (
  step_name,
  format_name,
  format_hash,
  format_type,
  options
) => {
  const config = generation_scripts[step_name]
  if (!config) {
    console.log(`Unknown step: ${step_name}`)
    return
  }

  // Check if script exists
  const exists = await script_exists({ script_name: config.script })
  if (!exists) {
    console.log(`Script not found: ${config.script}`)
    return
  }

  console.log(`\nStep: ${step_name}`)
  console.log(`   Description: ${config.description}`)
  console.log(`   Tables: ${config.tables.join(', ')}`)

  if (options.dry_run) {
    console.log(`   DRY RUN: Would execute ${config.script}`)
    return
  }

  try {
    const args = prepare_script_args({ args: config.args, format_hash })
    await execute_script({ script_name: config.script, args })
  } catch (error) {
    handle_step_error(error, step_name, format_name, options)
  }
}

/**
 * Generate data for a specific format
 * @param {string} format_name - Name of the format
 * @param {string} format_hash - Hash of the format
 * @param {string} format_type - Type of format ('scoring' or 'league')
 * @param {string[]} steps - Array of step names to execute
 * @param {Object} options - Options object
 */
export const generate_format_data = async (
  format_name,
  format_hash,
  format_type,
  steps,
  options = {}
) => {
  console.log(`\n${'='.repeat(80)}`)
  console.log(
    `GENERATING DATA FOR ${format_type.toUpperCase()} FORMAT: ${format_name}`
  )
  console.log(`Hash: ${format_hash}`)
  console.log(`${'='.repeat(80)}`)

  // Check if format exists in database first
  const format_exists = await check_format_exists({ format_hash, format_type })
  if (!format_exists) {
    console.log(
      `Format ${format_name} (${format_hash}) not found in database - skipping`
    )
    return
  }

  const { only_missing = false } = options

  for (const step_name of steps) {
    // Check if step should be skipped
    if (should_skip_step(step_name, options)) {
      continue
    }

    // Check if data already exists when only_missing is enabled
    if (only_missing) {
      const data_exists = await check_format_data_exists({
        format_hash,
        format_type,
        step_name
      })

      if (data_exists) {
        console.log(`Skipping step ${step_name}: Data already exists`)
        continue
      }
    }

    await execute_generation_step(
      step_name,
      format_name,
      format_hash,
      format_type,
      options
    )
  }
}

/**
 * Process formats of a specific type
 * @param {string} format_type - Type of format ('scoring' or 'league')
 * @param {Object} formats - Object containing format data
 * @param {string[]} steps - Array of step names to execute
 * @param {Object} options - Options object
 */
export const process_format_type = async (
  format_type,
  formats,
  steps,
  options
) => {
  const format_count = Object.keys(formats).length
  console.log(`\nProcessing ${format_count} ${format_type} formats...`)

  for (const [format_name, format_data] of Object.entries(formats)) {
    if (!should_process_format(format_name, options.formats)) {
      continue
    }

    await generate_format_data(
      format_name,
      format_data.hash,
      format_type,
      steps,
      options
    )

    // Add a small delay between formats to prevent connection exhaustion
    await new Promise((resolve) =>
      setTimeout(resolve, SCRIPT_CONFIG.format_delay)
    )
  }
}

/**
 * Process a single format (generate or remove data)
 * @param {Object} format_info - Format information
 * @param {string} format_info.hash - Format hash
 * @param {string} format_info.name - Format name
 * @param {string} format_info.type - Format type
 * @param {Object} options - Options object
 */
export const process_single_format = async (
  { hash, name, type },
  options = {}
) => {
  const { remove = false, dry_run = false } = options

  console.log(`\n${'='.repeat(80)}`)
  console.log(
    `${remove ? 'REMOVING' : 'GENERATING'} DATA FOR ${type.toUpperCase()} FORMAT: ${name}`
  )
  console.log(`Hash: ${hash}`)
  console.log(`${'='.repeat(80)}`)

  if (remove) {
    // Check if removal is safe
    if (type === 'league') {
      const is_safe = await check_removal_safety({ format_hash: hash })
      if (!is_safe) {
        throw new Error(
          `Cannot remove format '${hash}' - it is in use by active seasons`
        )
      }
    }

    // Remove data
    const removal_counts = await remove_format_data({
      format_hash: hash,
      format_type: type,
      options: { dry_run }
    })

    if (dry_run) {
      console.log('DRY RUN - No data was actually removed')
      console.log('The following data would be removed:')
    } else {
      console.log('Successfully removed format data')
      console.log('The following data was removed:')
    }

    for (const [table, count] of Object.entries(removal_counts)) {
      if (count > 0) {
        console.log(`  - ${table}: ${count} rows`)
      }
    }
  } else {
    // Generate data
    const steps =
      type === 'scoring'
        ? STEP_CONFIGURATION.scoring_steps
        : STEP_CONFIGURATION.league_steps

    await generate_format_data(name, hash, type, steps, options)
  }
}
