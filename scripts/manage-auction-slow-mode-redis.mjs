#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { redis_cache } from '#libs-server/redis_adapter.mjs'
import { constants } from '#libs-shared'
import {
  initialize_slow_mode_nomination,
  record_team_pass,
  update_current_bid,
  check_nomination_complete,
  complete_slow_mode_nomination,
  get_slow_mode_nomination_state,
  clear_slow_mode_nomination
} from '#libs-server/auction-slow-mode-redis.mjs'
import db from '#db'
import is_main from '#libs-server/is-main.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .command('list', 'List all active slow mode nominations', {
      year: {
        describe: 'Season year',
        type: 'number',
        default: constants.season.year
      },
      lid: {
        describe: 'League ID',
        type: 'number'
      }
    })
    .command('get', 'Get nomination state', {
      lid: {
        describe: 'League ID',
        type: 'number',
        demand: true
      },
      pid: {
        describe: 'Player ID',
        type: 'string',
        demand: true
      },
      year: {
        describe: 'Season year',
        type: 'number',
        default: constants.season.year
      }
    })
    .command('clear', 'Clear nomination state', {
      lid: {
        describe: 'League ID',
        type: 'number',
        demand: true
      },
      pid: {
        describe: 'Player ID',
        type: 'string',
        demand: true
      },
      year: {
        describe: 'Season year',
        type: 'number',
        default: constants.season.year
      }
    })
    .command('clear-all', 'Clear all slow mode nominations for a league', {
      lid: {
        describe: 'League ID',
        type: 'number',
        demand: true
      },
      year: {
        describe: 'Season year',
        type: 'number',
        default: constants.season.year
      },
      confirm: {
        describe: 'Confirm clearing all nominations',
        type: 'boolean',
        default: false
      }
    })
    .command('init', 'Initialize a nomination (testing)', {
      lid: {
        describe: 'League ID',
        type: 'number',
        demand: true
      },
      pid: {
        describe: 'Player ID',
        type: 'string',
        demand: true
      },
      bid: {
        describe: 'Initial bid amount',
        type: 'number',
        demand: true
      },
      teams: {
        describe: 'Eligible team IDs (comma-separated)',
        type: 'string',
        demand: true
      }
    })
    .command('pass', 'Record a team pass (testing)', {
      lid: {
        describe: 'League ID',
        type: 'number',
        demand: true
      },
      pid: {
        describe: 'Player ID',
        type: 'string',
        demand: true
      },
      tid: {
        describe: 'Team ID',
        type: 'number',
        demand: true
      }
    })
    .command('bid', 'Update bid (testing)', {
      lid: {
        describe: 'League ID',
        type: 'number',
        demand: true
      },
      pid: {
        describe: 'Player ID',
        type: 'string',
        demand: true
      },
      value: {
        describe: 'New bid amount',
        type: 'number',
        demand: true
      },
      tid: {
        describe: 'Bidding team ID',
        type: 'number',
        demand: true
      },
      teams: {
        describe: 'New eligible team IDs (comma-separated)',
        type: 'string'
      }
    })
    .command('complete', 'Complete a nomination (testing)', {
      lid: {
        describe: 'League ID',
        type: 'number',
        demand: true
      },
      pid: {
        describe: 'Player ID',
        type: 'string',
        demand: true
      }
    })
    .command('reset', 'Reset all slow mode data for a league', {
      lid: {
        describe: 'League ID',
        type: 'number',
        demand: true
      },
      year: {
        describe: 'Season year',
        type: 'number',
        default: constants.season.year
      },
      confirm: {
        describe: 'Confirm reset',
        type: 'boolean',
        default: false
      }
    })
    .help().argv
}

const format_state = (state) => {
  if (!state) return 'No state found'

  return `
=== Slow Mode Nomination State ===
Player ID: ${state.pid}
Current Bid: $${state.current_bid}
Bidding Team: ${state.bid_team_id}
Created: ${new Date(state.created_at).toLocaleString()}
Updated: ${state.updated_at ? new Date(state.updated_at).toLocaleString() : 'Never'}

Eligible Teams: ${state.eligible_teams.join(', ') || 'None'}
Passed Teams: ${state.passed_teams.join(', ') || 'None'}
Remaining Teams: ${state.eligible_teams.filter((t) => !state.passed_teams.includes(t)).join(', ') || 'None'}

Status: ${check_status(state)}
`
}

const check_status = (state) => {
  if (!state.eligible_teams || !state.passed_teams) {
    return '⚠️  Invalid state - missing team data'
  }

  const remaining = state.eligible_teams.filter(
    (t) => !state.passed_teams.includes(t)
  )
  if (remaining.length === 0) {
    return '✓ Complete - All teams have responded'
  } else if (remaining.length === 1) {
    return `⏳ Waiting for 1 team (${remaining[0]})`
  } else {
    return `⏳ Waiting for ${remaining.length} teams`
  }
}

const main = async () => {
  const argv = initialize_cli()
  const command = argv._[0]

  // Check if Redis is available
  if (!redis_cache.client) {
    console.log('⚠️  Redis is not available (not in production environment)')
    console.log(
      '   This script will only work in production where Redis is running'
    )
    console.log('')
  }

  try {
    switch (command) {
      case 'list': {
        const { year, lid } = argv
        const pattern = lid
          ? `auction_slow_mode:${year}:${lid}:*`
          : `auction_slow_mode:${year}:*`

        const keys = await redis_cache.keys(pattern)

        if (!keys || keys.length === 0) {
          console.log(
            'No active slow mode nominations found (Redis may not be available)'
          )
          break
        }

        // Filter out _passes and _eligible keys
        const nomination_keys = keys.filter(
          (k) => !k.includes('_passes') && !k.includes('_eligible')
        )

        if (nomination_keys.length === 0) {
          console.log('No active slow mode nominations found')
          break
        }

        console.log(`\nFound ${nomination_keys.length} active nomination(s):\n`)

        for (const key of nomination_keys) {
          const parts = key.split(':')
          const pid = parts[parts.length - 1]
          const lid = parts[parts.length - 2]

          const state = await get_slow_mode_nomination_state({ lid, pid })
          if (state) {
            console.log(`League ${lid}, Player ${pid}:`)
            console.log(format_state(state))
            console.log('---')
          }
        }
        break
      }

      case 'get': {
        const { lid, pid } = argv
        const state = await get_slow_mode_nomination_state({ lid, pid })

        if (state) {
          console.log(format_state(state))
        } else {
          console.log(`No nomination found for player ${pid} in league ${lid}`)
        }
        break
      }

      case 'clear': {
        const { lid, pid } = argv
        const result = await clear_slow_mode_nomination(lid, pid)

        if (result) {
          console.log(`✓ Cleared nomination for player ${pid} in league ${lid}`)
        } else {
          console.log(`Failed to clear nomination`)
        }
        break
      }

      case 'clear-all': {
        const { lid, year, confirm } = argv

        if (!confirm) {
          console.log('Please add --confirm flag to clear all nominations')
          break
        }

        const pattern = `auction_slow_mode:${year}:${lid}:*`
        const keys = await redis_cache.keys(pattern)

        if (!keys || keys.length === 0) {
          console.log('No nominations to clear (Redis may not be available)')
          break
        }

        for (const key of keys) {
          await redis_cache.del(key)
        }

        console.log(`✓ Cleared ${keys.length} Redis keys for league ${lid}`)
        break
      }

      case 'init': {
        const { lid, pid, bid, teams } = argv
        const team_ids = teams.split(',').map((t) => parseInt(t.trim()))

        const result = await initialize_slow_mode_nomination({
          lid,
          pid,
          initial_bid: bid,
          eligible_teams: team_ids,
          nominating_team_id: team_ids[0] // Use first team as nominating team
        })

        if (result) {
          console.log(
            `✓ Initialized nomination for player ${pid} with bid $${bid}`
          )
          console.log(`  Eligible teams: ${team_ids.join(', ')}`)
        } else {
          console.log('Failed to initialize nomination')
        }
        break
      }

      case 'pass': {
        const { lid, pid, tid } = argv
        const result = await record_team_pass(lid, pid, tid)

        if (result) {
          console.log(`✓ Recorded pass for team ${tid}`)

          const is_complete = await check_nomination_complete({ lid, pid })
          if (is_complete.complete) {
            console.log(
              `  ⚠️  Nomination is now complete! (${is_complete.reason})`
            )
          }
        } else {
          console.log('Failed to record pass')
        }
        break
      }

      case 'bid': {
        const { lid, pid, value, tid, teams } = argv
        const team_ids = teams
          ? teams.split(',').map((t) => parseInt(t.trim()))
          : null

        const result = await update_current_bid(lid, pid, value, tid, team_ids)

        if (result) {
          console.log(`✓ Updated bid to $${value} from team ${tid}`)

          const is_complete = await check_nomination_complete({ lid, pid })
          if (is_complete.complete) {
            console.log(
              `  ⚠️  Nomination is now complete! (${is_complete.reason})`
            )
          }
        } else {
          console.log('Failed to update bid')
        }
        break
      }

      case 'complete': {
        const { lid, pid } = argv
        const result = await complete_slow_mode_nomination(lid, pid)

        if (result) {
          console.log(`✓ Completed nomination for player ${pid}`)
        } else {
          console.log('Failed to complete nomination')
        }
        break
      }

      case 'reset': {
        const { lid, year, confirm } = argv

        if (!confirm) {
          console.log('Please add --confirm flag to reset all data')
          break
        }

        // Clear all Redis keys for this league/year
        const patterns = [
          `auction_slow_mode:${year}:${lid}:*`,
          `auction_slow_mode_passes:${year}:${lid}:*`,
          `auction_slow_mode_eligible:${year}:${lid}:*`
        ]

        let total_deleted = 0
        for (const pattern of patterns) {
          const keys = await redis_cache.keys(pattern)
          if (keys && keys.length > 0) {
            for (const key of keys) {
              await redis_cache.del(key)
              total_deleted++
            }
          }
        }

        console.log(`✓ Reset complete - deleted ${total_deleted} Redis keys`)

        // Also reset slow mode flag in database if needed
        const update_result = await db('seasons')
          .where({ lid, year })
          .update({ free_agency_auction_slow_mode: false })

        if (update_result) {
          console.log(`✓ Disabled slow mode in database for league ${lid}`)
        }

        break
      }

      default:
        console.log('Unknown command. Use --help for available commands.')
    }

    process.exit(0)
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

// Only run if this is the main module
if (is_main(import.meta.url)) {
  main()
}
