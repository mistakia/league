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
  check_league_format_removal_safety
} from './data-checker.mjs'
import { remove_format_data } from './cleanup-manager.mjs'

/**
 * Check whether a step is excluded by the skip_steps / only_steps options
 * @param {string} step_name - Name of the step
 * @param {object} options - Options object
 * @returns {boolean}
 */
const is_step_excluded = (step_name, options) => {
  const { skip_steps = [], only_steps = [] } = options

  if (skip_steps.includes(step_name)) {
    return true
  }

  if (only_steps.length > 0 && !only_steps.includes(step_name)) {
    return true
  }

  return false
}

/**
 * Warn when a step is about to run without prerequisites it declares
 *
 * Only prerequisites that belong to this format type's own step list are
 * checked. A league step declares scoring steps as dependencies, and those are
 * satisfied by the earlier scoring pass in process_format_type rather than by
 * this list, so treating their absence here as a problem would warn on every
 * league run.
 *
 * @param {string} step_name - Name of the step about to run
 * @param {string[]} steps - Full ordered step list for this format type
 * @param {object} options - Options object
 */
const warn_on_excluded_dependencies = (step_name, steps, options) => {
  const dependencies = generation_scripts[step_name]?.dependencies ?? []
  const excluded = dependencies.filter(
    (dependency) =>
      steps.includes(dependency) && is_step_excluded(dependency, options)
  )

  if (excluded.length > 0) {
    console.warn(
      `Warning: ${step_name} will run without its prerequisites: ${excluded.join(', ')}`
    )
  }
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
 *
 * Every failure is a real failure. This used to classify any error message
 * containing 'not found', 'missing or invalid', or 'undefined' as "the format
 * still needs generating" and swallow it, which could not be right on either
 * half: generate_format_data already skips formats absent from the database,
 * and execute_script reports a failed child as an exit code rather than
 * forwarding its message, so the substrings only ever matched a genuine crash.
 *
 * @param {Error} error - The error that occurred
 * @param {string} step_name - Name of the step that failed
 * @param {string} format_name - Name of the format being processed
 * @param {object} options - Options object
 */
export const handle_step_error = (error, step_name, format_name, options) => {
  console.error(
    `Failed to execute step ${step_name} for ${format_name}:`,
    error.message
  )

  if (!options.continue_on_error) {
    throw error
  }
}

/**
 * Execute a single generation step
 * @param {string} step_name - Name of the step
 * @param {string} format_name - Name of the format
 * @param {string} format_id - Identifier of the format
 * @param {object} options - Options object
 */
export const execute_generation_step = async (
  step_name,
  format_name,
  format_id,
  options
) => {
  const config = generation_scripts[step_name]
  if (!config) {
    throw new Error(`Unknown generation step: ${step_name}`)
  }

  // Check if script exists
  const exists = await script_exists({ script_name: config.script })
  if (!exists) {
    throw new Error(
      `Generation script not found for step ${step_name}: ${config.script}`
    )
  }

  console.log(`\nStep: ${step_name}`)
  console.log(`   Description: ${config.description}`)
  console.log(`   Tables: ${config.tables.join(', ')}`)

  if (options.dry_run) {
    console.log(`   DRY RUN: Would execute ${config.script}`)
    return
  }

  try {
    const args = prepare_script_args({
      args: config.args,
      format_hash: format_id
    })
    await execute_script({ script_name: config.script, args })
  } catch (error) {
    handle_step_error(error, step_name, format_name, options)
  }
}

/**
 * Generate data for a specific format
 * @param {string} format_name - Name of the format
 * @param {string} format_id - Identifier of the format
 * @param {string} format_type - Type of format ('scoring' or 'league')
 * @param {string[]} steps - Array of step names to execute
 * @param {object} options - Options object
 */
export const generate_format_data = async (
  format_name,
  format_id,
  format_type,
  steps,
  options = {}
) => {
  console.log(`\n${'='.repeat(80)}`)
  console.log(
    `GENERATING DATA FOR ${format_type.toUpperCase()} FORMAT: ${format_name}`
  )
  console.log(`Format ID: ${format_id}`)
  console.log(`${'='.repeat(80)}`)

  // Check if format exists in database first
  const format_exists = await check_format_exists({ format_id, format_type })
  if (!format_exists) {
    console.log(
      `Format ${format_name} (${format_id}) not found in database - skipping`
    )
    return
  }

  const { only_missing = false } = options

  for (const step_name of steps) {
    // Check if step should be skipped
    if (is_step_excluded(step_name, options)) {
      console.log(`Skipping step: ${step_name}`)
      continue
    }

    warn_on_excluded_dependencies(step_name, steps, options)

    // Check if data already exists when only_missing is enabled
    if (only_missing) {
      const data_exists = await check_format_data_exists({
        format_id,
        format_type,
        step_name
      })

      if (data_exists) {
        console.log(`Skipping step ${step_name}: Data already exists`)
        continue
      }
    }

    await execute_generation_step(step_name, format_name, format_id, options)
  }
}

/**
 * Process formats of a specific type
 * @param {string} format_type - Type of format ('scoring' or 'league')
 * @param {object} formats - Object containing format data
 * @param {string[]} steps - Array of step names to execute
 * @param {object} options - Options object
 */
export const process_format_type = async (
  format_type,
  formats,
  steps,
  options
) => {
  const format_entries = Object.entries(formats)
  console.log(`\nProcessing ${format_entries.length} ${format_type} formats...`)

  for (let index = 0; index < format_entries.length; index++) {
    const [format_name, format_data] = format_entries[index]

    if (!should_process_format(format_name, options.formats)) {
      continue
    }

    await generate_format_data(
      format_name,
      format_data.id,
      format_type,
      steps,
      options
    )

    // Add a small delay between formats to prevent connection exhaustion in
    // the generation scripts. A dry run spawns nothing, and there is nothing
    // left to protect after the final format.
    const is_last_format = index === format_entries.length - 1
    if (!options.dry_run && !is_last_format) {
      await new Promise((resolve) =>
        setTimeout(resolve, SCRIPT_CONFIG.format_delay)
      )
    }
  }
}

/**
 * Process a single format (generate or remove data)
 * @param {object} format_info - Format information
 * @param {string} format_info.hash - Format identifier
 * @param {string} format_info.name - Format name
 * @param {string} format_info.type - Format type
 * @param {object} options - Options object
 */
export const process_single_format = async (
  { hash: format_id, name, type },
  options = {}
) => {
  const { remove = false, dry_run = false } = options

  console.log(`\n${'='.repeat(80)}`)
  console.log(
    `${remove ? 'REMOVING' : 'GENERATING'} DATA FOR ${type.toUpperCase()} FORMAT: ${name}`
  )
  console.log(`Format ID: ${format_id}`)
  console.log(`${'='.repeat(80)}`)

  if (remove) {
    // Check if removal is safe
    if (type === 'league') {
      const { safe, reasons } = await check_league_format_removal_safety({
        format_id
      })
      if (!safe) {
        throw new Error(
          `Cannot remove format '${format_id}' - ${reasons.join('; ')}`
        )
      }
    }

    // Remove data
    const removal_counts = await remove_format_data({
      format_hash: format_id,
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

    await generate_format_data(name, format_id, type, steps, options)
  }
}
