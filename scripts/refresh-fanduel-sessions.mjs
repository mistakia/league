import debug from 'debug'

import { is_main } from '#libs-server'
import { fanduel_session_manager } from '#libs-server/session-manager.mjs'
import { test_fanduel_v3_connection } from '#libs-server/fanduel-v3.mjs'

const log = debug('refresh-fanduel-sessions')
debug.enable('refresh-fanduel-sessions')

const SESSION_HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_CONSECUTIVE_FAILURES = 3
const FAILURE_BACKOFF_MULTIPLIER = 2

const get_current_fanduel_session_status = async () => {
  try {
    const fanduel_config = await fanduel_session_manager.get_fanduel_config()

    if (!fanduel_config.v3_session_headers) {
      return {
        has_session: false,
        needs_refresh: true,
        reason: 'No V3 session headers found'
      }
    }

    const last_refresh = fanduel_config.v3_last_refresh
    const session_valid = fanduel_config.v3_session_valid
    const current_time = new Date()

    let hours_since_refresh = 0
    if (last_refresh) {
      hours_since_refresh =
        (current_time - new Date(last_refresh)) / (1000 * 60 * 60)
    }

    const session_status = {
      has_session: true,
      last_refresh,
      hours_since_refresh: Math.round(hours_since_refresh * 100) / 100,
      session_valid: session_valid || false
    }

    // Determine if refresh is needed
    session_status.needs_refresh =
      !session_status.session_valid || hours_since_refresh > 24 || !last_refresh

    if (session_status.needs_refresh) {
      if (!session_status.session_valid) {
        session_status.reason = 'Session marked as invalid'
      } else if (hours_since_refresh > 24) {
        session_status.reason = `Session too old: ${hours_since_refresh.toFixed(1)} hours`
      } else if (!last_refresh) {
        session_status.reason = 'No refresh timestamp found'
      }
    } else {
      session_status.reason = 'Session appears healthy'
    }

    return session_status
  } catch (error) {
    log(`Error getting session status: ${error.message}`)
    return {
      has_session: false,
      needs_refresh: true,
      reason: `Error checking session: ${error.message}`
    }
  }
}

const validate_current_fanduel_session = async () => {
  try {
    log('Testing current FanDuel session validity')

    const connection_test = await test_fanduel_v3_connection()

    if (connection_test.success) {
      log('Current FanDuel session is valid and working')
      return {
        is_valid: true,
        events_count: connection_test.events_count,
        markets_count: connection_test.markets_count
      }
    } else {
      log(`Current FanDuel session validation failed: ${connection_test.error}`)
      return {
        is_valid: false,
        error: connection_test.error
      }
    }
  } catch (error) {
    log(`Error validating current session: ${error.message}`)
    return {
      is_valid: false,
      error: error.message
    }
  }
}

const perform_fanduel_session_refresh = async ({
  force_refresh = false
} = {}) => {
  try {
    const session_status = await get_current_fanduel_session_status()

    log('=== FanDuel Session Status ===')
    log(`Has session: ${session_status.has_session}`)
    log(`Needs refresh: ${session_status.needs_refresh}`)
    log(`Reason: ${session_status.reason}`)

    if (session_status.has_session) {
      log(`Hours since refresh: ${session_status.hours_since_refresh}`)
      log(`Session valid: ${session_status.session_valid}`)
      log(`Last refresh: ${session_status.last_refresh}`)
    }

    // Skip refresh if not needed and not forced
    if (!session_status.needs_refresh && !force_refresh) {
      log('Session refresh not needed - skipping')
      return {
        success: true,
        action: 'skipped',
        reason: session_status.reason,
        session_status
      }
    }

    // Validate current session before refresh (if exists)
    if (session_status.has_session && !force_refresh) {
      const validation_result = await validate_current_fanduel_session()

      if (validation_result.is_valid) {
        log('Current session is still valid - skipping refresh')
        return {
          success: true,
          action: 'skipped',
          reason: 'Session validation passed',
          session_status,
          validation_result
        }
      } else {
        log(`Current session validation failed: ${validation_result.error}`)
      }
    }

    // Perform session refresh
    log('Starting FanDuel session refresh')

    const refresh_start_time = new Date()
    const refresh_success =
      await fanduel_session_manager.refresh_fanduel_session()
    const refresh_duration = new Date() - refresh_start_time

    if (refresh_success) {
      log(
        `FanDuel session refresh completed successfully in ${refresh_duration}ms`
      )

      // Validate the new session
      const post_refresh_validation = await validate_current_fanduel_session()

      return {
        success: true,
        action: 'refreshed',
        refresh_duration_ms: refresh_duration,
        validation_result: post_refresh_validation,
        previous_session_status: session_status
      }
    } else {
      log('FanDuel session refresh failed')

      return {
        success: false,
        action: 'refresh_failed',
        refresh_duration_ms: refresh_duration,
        previous_session_status: session_status,
        error: 'Session refresh returned false'
      }
    }
  } catch (error) {
    log(`Error during session refresh: ${error.message}`)

    return {
      success: false,
      action: 'error',
      error: error.message
    }
  }
}

const monitor_fanduel_session_health = async ({
  check_interval_ms = SESSION_HEALTH_CHECK_INTERVAL_MS
} = {}) => {
  log('Starting FanDuel session health monitoring')
  log(
    `Check interval: ${check_interval_ms}ms (${check_interval_ms / 1000 / 60} minutes)`
  )

  let consecutive_failures = 0
  let current_backoff_ms = check_interval_ms

  while (true) {
    try {
      log('=== Session Health Check ===')

      const refresh_result = await perform_fanduel_session_refresh()

      if (refresh_result.success) {
        log(`Session health check completed: ${refresh_result.action}`)
        consecutive_failures = 0
        current_backoff_ms = check_interval_ms // Reset backoff on success
      } else {
        consecutive_failures++
        log(
          `Session health check failed (attempt ${consecutive_failures}): ${refresh_result.error}`
        )

        // Apply exponential backoff on failures
        current_backoff_ms = Math.min(
          check_interval_ms *
            Math.pow(FAILURE_BACKOFF_MULTIPLIER, consecutive_failures - 1),
          60 * 60 * 1000 // Maximum 1 hour backoff
        )

        log(
          `Next check in ${current_backoff_ms / 1000 / 60} minutes (backoff applied)`
        )
      }

      // Break if too many consecutive failures
      if (consecutive_failures >= MAX_CONSECUTIVE_FAILURES) {
        log(
          `Too many consecutive failures (${consecutive_failures}), stopping monitor`
        )
        break
      }

      // Wait for next check
      await new Promise((resolve) => setTimeout(resolve, current_backoff_ms))
    } catch (error) {
      consecutive_failures++
      log(`Session health monitoring error: ${error.message}`)

      if (consecutive_failures >= MAX_CONSECUTIVE_FAILURES) {
        log(`Too many consecutive errors, stopping monitor`)
        break
      }

      await new Promise((resolve) => setTimeout(resolve, current_backoff_ms))
    }
  }

  log('FanDuel session health monitoring stopped')
}

const get_fanduel_session_info = async () => {
  try {
    const session_status = await get_current_fanduel_session_status()
    const validation_result = await validate_current_fanduel_session()

    return {
      session_status,
      validation_result,
      recommendations: generate_session_recommendations({
        session_status,
        validation_result
      })
    }
  } catch (error) {
    log(`Error getting session info: ${error.message}`)
    throw error
  }
}

const generate_session_recommendations = ({
  session_status,
  validation_result
}) => {
  const recommendations = []

  if (!session_status.has_session) {
    recommendations.push('Create new session - no session data found')
  } else if (!session_status.session_valid) {
    recommendations.push(
      'Immediate refresh required - session marked as invalid'
    )
  } else if (session_status.hours_since_refresh > 24) {
    recommendations.push(
      `Refresh recommended - session is ${session_status.hours_since_refresh.toFixed(1)} hours old`
    )
  } else if (!validation_result.is_valid) {
    recommendations.push('Refresh required - session validation failed')
  } else {
    recommendations.push('Session appears healthy - no action needed')
  }

  return recommendations
}

const main = async () => {
  try {
    const args = process.argv.slice(2)
    const command = args[0] || 'status'

    switch (command) {
      case 'status': {
        log('=== FanDuel Session Status ===')
        const session_info = await get_fanduel_session_info()
        console.log('\n=== Session Status ===')
        console.log(JSON.stringify(session_info.session_status, null, 2))
        console.log('\n=== Validation Result ===')
        console.log(JSON.stringify(session_info.validation_result, null, 2))
        console.log('\n=== Recommendations ===')
        session_info.recommendations.forEach((rec) => console.log(`- ${rec}`))
        break
      }

      case 'refresh': {
        log('=== Manual Session Refresh ===')
        const force_refresh = args.includes('--force')
        const refresh_result = await perform_fanduel_session_refresh({
          force_refresh
        })
        console.log('\n=== Refresh Result ===')
        console.log(JSON.stringify(refresh_result, null, 2))
        break
      }

      case 'monitor':
        log('=== Starting Session Health Monitor ===')
        await monitor_fanduel_session_health()
        break

      default:
        console.log('Usage:')
        console.log(
          '  node scripts/refresh-fanduel-sessions.mjs status    - Show session status'
        )
        console.log(
          '  node scripts/refresh-fanduel-sessions.mjs refresh   - Perform session refresh'
        )
        console.log(
          '  node scripts/refresh-fanduel-sessions.mjs refresh --force - Force session refresh'
        )
        console.log(
          '  node scripts/refresh-fanduel-sessions.mjs monitor   - Start continuous monitoring'
        )
        break
    }
    process.exit(0)
  } catch (error) {
    log(`Fatal error: ${error.message}`)
    console.error(error)
    process.exit(1)
  }
}

if (is_main(import.meta.url)) {
  main()
}

export {
  get_current_fanduel_session_status,
  validate_current_fanduel_session,
  perform_fanduel_session_refresh,
  monitor_fanduel_session_health,
  get_fanduel_session_info
}
