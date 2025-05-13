import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { googleDrive, is_main, wait } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('cleanup-backups')
debug.enable('cleanup-backups')

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Run without making any changes',
    default: false
  })
  .option('rate-limit', {
    alias: 'r',
    type: 'number',
    description: 'Maximum API requests per minute (default: 6000)',
    default: 6000
  })
  .help().argv

// Constants
const PARENT_FOLDER_ID = '1OnikVibAJ5-1uUhEyMHBRpkFGbzUM23v'
const FILENAME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2})(?:-([^.]+))?\.tar\.gz$/
const PAGE_SIZE = 150

/**
 * Convert hrtime to milliseconds
 * @param {[number, number]} hrtime - The high-resolution time tuple [seconds, nanoseconds]
 * @returns {number} - Time in milliseconds
 */
const hrtime_to_ms = (hrtime) => {
  return hrtime[0] * 1000 + hrtime[1] / 1000000
}

/**
 * Get current time in milliseconds using high-resolution timer
 * @returns {number} - Current time in milliseconds
 */
const hrtime_now = () => {
  return hrtime_to_ms(process.hrtime())
}

/**
 * Rate limiting helper to manage API quotas with high precision timing
 */
class RateLimiter {
  constructor({ requests_per_minute }) {
    this.requests_per_minute = requests_per_minute
    this.request_count = 0
    this.last_reset = hrtime_now()
    this.ms_per_request = 60000 / requests_per_minute
    this.last_request = 0
    log(
      'Rate limiter initialized: %d ms per request',
      this.ms_per_request.toFixed(3)
    )
  }

  async wait_if_needed() {
    const now = hrtime_now()

    // Reset counter if a minute has passed
    if (now - this.last_reset >= 60000) {
      log(
        'Rate limit counter reset (1 minute passed), processed %d requests',
        this.request_count
      )
      this.request_count = 0
      this.last_reset = now
    }

    // Increment request counter
    this.request_count++

    // Calculate minimum delay between requests to stay within rate limit
    const min_delay = this.ms_per_request
    const time_since_last = now - this.last_request

    if (time_since_last < min_delay) {
      const delay_ms = min_delay - time_since_last
      log('Rate limiting: waiting %d ms', delay_ms.toFixed(2))
      await wait({ ms: delay_ms })
    }

    this.last_request = hrtime_now()

    // If we're getting close to the limit, add some delay
    if (this.request_count > this.requests_per_minute * 0.8) {
      log(
        'Warning: Approaching rate limit (%d/%d), adding extra delay',
        this.request_count,
        this.requests_per_minute
      )
      await wait({ ms: 500 })
    }
  }

  get_stats() {
    return {
      request_count: this.request_count,
      requests_per_minute: this.requests_per_minute,
      time_since_reset: hrtime_now() - this.last_reset,
      utilization_percent: (this.request_count / this.requests_per_minute) * 100
    }
  }
}

/**
 * Extract date and type info from filename
 * @param {Object} params - Function parameters
 * @param {string} params.filename - The filename to parse
 * @returns {Object|null} - Object with date_key and type, or null if not matching pattern
 */
const extract_file_info = ({ filename }) => {
  const match = filename.match(FILENAME_PATTERN)
  if (!match) return null

  return {
    date_key: match[1],
    type: match[3] || 'default' // Use 'default' for files with no specific type
  }
}

/**
 * Determine if file is newer than the current newest file
 * @param {Object} params - Function parameters
 * @param {Object} params.file - The file to check
 * @param {Object|null} params.current_newest - The current newest file or null
 * @returns {boolean} - True if file is newer
 */
const is_newer_file = ({ file, current_newest }) => {
  if (!current_newest) return true
  return new Date(file.modifiedTime) > new Date(current_newest.modifiedTime)
}

/**
 * Trash a file in Google Drive
 * @param {Object} params - Function parameters
 * @param {Object} params.drive - Google Drive API client
 * @param {Object} params.file - The file to trash
 * @param {string} params.date_key - The date key for logging
 * @param {string} params.type - The file type for logging
 * @param {RateLimiter} params.rate_limiter - Rate limiter instance
 * @returns {Promise<boolean>} - True if successfully trashed, false otherwise
 */
const trash_file = async ({ drive, file, date_key, type, rate_limiter }) => {
  try {
    // Apply rate limiting
    await rate_limiter.wait_if_needed()

    const start_time = hrtime_now()
    await drive.files.update({
      fileId: file.id,
      requestBody: {
        trashed: true
      }
    })
    const duration = hrtime_now() - start_time

    log(
      'Trashed file for date %s, type %s: %s (took %d ms)',
      date_key,
      type,
      file.name,
      duration.toFixed(2)
    )
    return true
  } catch (error) {
    log('ERROR trashing file %s: %s', file.name, error.message)
    return false
  }
}

/**
 * Process a file to keep newest per day per type
 * @param {Object} params - Function parameters
 * @param {Object} params.drive - Google Drive API client
 * @param {Object} params.file - The file to process
 * @param {Object} params.newest_files_by_date_and_type - Nested map of dates/types to newest files
 * @param {boolean} params.dry_run - If true, don't actually trash files
 * @param {RateLimiter} params.rate_limiter - Rate limiter instance
 * @returns {Promise<boolean>} - True if file was trashed
 */
const process_file = async ({
  drive,
  file,
  newest_files_by_date_and_type,
  dry_run = false,
  rate_limiter
}) => {
  const file_info = extract_file_info({ filename: file.name })

  if (!file_info) {
    log('Skipping file with unrecognized format: %s', file.name)
    return false
  }

  const { date_key, type } = file_info

  // Initialize nested structure if needed
  if (!newest_files_by_date_and_type[date_key]) {
    newest_files_by_date_and_type[date_key] = {}
  }

  const current_newest = newest_files_by_date_and_type[date_key][type]

  if (is_newer_file({ file, current_newest })) {
    // If we already had a file for this date and type, trash the old one
    if (current_newest) {
      if (dry_run) {
        log(
          '[DRY RUN] Would trash older file for date %s, type %s: %s',
          date_key,
          type,
          current_newest.name
        )
      } else {
        await trash_file({
          drive,
          file: current_newest,
          date_key,
          type,
          rate_limiter
        })
      }
      log('Replaced with newer file for type %s: %s', type, file.name)
    } else {
      log('Keeping file for date %s, type %s: %s', date_key, type, file.name)
    }

    // Keep this newer file
    newest_files_by_date_and_type[date_key][type] = file
    return false
  } else {
    // This file is older than our current best for this type, trash it
    if (dry_run) {
      log(
        '[DRY RUN] Would trash older file for date %s, type %s: %s',
        date_key,
        type,
        file.name
      )
      return true
    } else {
      return await trash_file({ drive, file, date_key, type, rate_limiter })
    }
  }
}

/**
 * Get summary statistics of kept files
 * @param {Object} params - Function parameters
 * @param {Object} params.newest_files_by_date_and_type - Nested map of dates/types to newest files
 * @returns {Object} - Statistics about kept files
 */
const get_stats = ({ newest_files_by_date_and_type }) => {
  const stats = {
    total_kept: 0,
    days: 0,
    types: new Set(),
    by_type: {}
  }

  for (const date_key in newest_files_by_date_and_type) {
    stats.days++
    const types_for_date = newest_files_by_date_and_type[date_key]

    for (const type in types_for_date) {
      stats.total_kept++
      stats.types.add(type)

      if (!stats.by_type[type]) {
        stats.by_type[type] = 0
      }
      stats.by_type[type]++
    }
  }

  return stats
}

/**
 * Main function to run the backup cleanup process
 * @param {Object} params - Function parameters
 * @param {boolean} params.dry_run - If true, don't actually trash files
 * @param {number} params.rate_limit - Maximum API requests per minute
 * @returns {Promise<void>}
 */
const run = async ({ dry_run = false, rate_limit = 6000 } = {}) => {
  const drive = await googleDrive()

  if (dry_run) {
    log('Running in DRY RUN mode - no files will actually be trashed')
  }

  log('Rate limit set to %d requests per minute', rate_limit)
  const rate_limiter = new RateLimiter({ requests_per_minute: rate_limit })

  const list_params = {
    q: `"${PARENT_FOLDER_ID}" in parents`,
    orderBy: 'modifiedByMeTime asc',
    pageSize: PAGE_SIZE,
    fields: 'nextPageToken, files(id, name, modifiedTime, size)'
  }

  // Keep track of the newest file for each date and type
  const newest_files_by_date_and_type = {}
  let page_token = null
  let total_files_processed = 0
  let total_files_trashed = 0
  let api_requests = 0

  const start_time = hrtime_now()

  // Iterate through all pages of results
  try {
    do {
      if (page_token) {
        list_params.pageToken = page_token
      }

      // Apply rate limiting
      await rate_limiter.wait_if_needed()
      api_requests++

      const list_start = hrtime_now()
      const res = await drive.files.list(list_params)
      const list_duration = hrtime_now() - list_start

      const page_files = res.data.files
      page_token = res.data.nextPageToken

      total_files_processed += page_files.length
      log(
        'Retrieved page with %d files (took %d ms), total processed so far: %d',
        page_files.length,
        list_duration.toFixed(2),
        total_files_processed
      )

      // Process each file in this page
      for (const file of page_files) {
        const was_trashed = await process_file({
          drive,
          file,
          newest_files_by_date_and_type,
          dry_run,
          rate_limiter
        })
        if (was_trashed) {
          total_files_trashed++
        }
      }

      // Log rate limit status periodically
      if (total_files_processed % 1000 === 0) {
        const rate_stats = rate_limiter.get_stats()
        log(
          'Rate limit status: %d/%d requests (%d%% utilization)',
          rate_stats.request_count,
          rate_stats.requests_per_minute,
          rate_stats.utilization_percent.toFixed(1)
        )
      }
    } while (page_token)

    // Get statistics about the files we kept
    const stats = get_stats({ newest_files_by_date_and_type })
    const total_time = (hrtime_now() - start_time) / 1000 // convert to seconds

    log(
      'Finished processing %d files, %s %d files in %.2f seconds (%.2f files/sec)',
      total_files_processed,
      dry_run ? 'would trash' : 'trashed',
      total_files_trashed,
      total_time,
      total_files_processed / total_time
    )
    log(
      'Kept %d files across %d days and %d types',
      stats.total_kept,
      stats.days,
      stats.types.size
    )
    log('Files kept by type: %o', stats.by_type)
    log(
      'Total API requests: %d (%.2f requests/sec)',
      api_requests + total_files_trashed,
      (api_requests + total_files_trashed) / total_time
    )

    return {
      total_processed: total_files_processed,
      total_trashed: total_files_trashed,
      stats,
      api_requests: api_requests + total_files_trashed,
      execution_time_sec: total_time
    }
  } catch (error) {
    log('ERROR in cleanup process: %s', error.message)
    throw error
  }
}

export default run

/**
 * Entry point function when script is run directly
 */
const main = async () => {
  let error
  try {
    await run({
      dry_run: argv['dry-run'],
      rate_limit: argv['rate-limit']
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}
