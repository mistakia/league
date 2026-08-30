/* global describe it */

// Two claims the orchestrator made and did not honor.
//
// 1. `success: true` was unconditional, so a sync that skipped every roster
//    reported success. The skips were already recorded in sync_stats.errors and
//    nothing read them for the verdict -- which is how ESPN's empty player
//    catalog stayed invisible: every roster failed to resolve and the caller
//    was told it worked.
//
// 2. `validate_only` was passed by BOTH API callers and read by nothing, so a
//    connection check did a full fetch -- rosters, transactions, and the whole
//    player catalog -- and then discarded all of it. A config field is only
//    real if the code path that enforces the behavior reads it.
//
// Hermetic: both are orchestrator-level decisions over a stubbed adapter, and
// neither needs a database.

import * as chai from 'chai'

import SyncOrchestrator from '#libs-server/external-fantasy-leagues/sync/sync-orchestrator.mjs'

const expect = chai.expect

const build_adapter = (calls) => ({
  authenticate: async () => {},
  get_league: async () => {
    calls.push('get_league')
    return { name: 'Test League', year: 2025, teams: [{ id: 1 }, { id: 2 }] }
  },
  get_rosters: async () => {
    calls.push('get_rosters')
    return [{ team_external_id: '1', players: [] }]
  },
  get_transactions: async () => {
    calls.push('get_transactions')
    return []
  },
  get_players: async () => {
    calls.push('get_players')
    return []
  }
})

const fetch_with = async ({ fetch_options }) => {
  const calls = []
  const orchestrator = new SyncOrchestrator()
  const adapter = build_adapter(calls)

  orchestrator.initialize_adapter = () => adapter
  orchestrator.sync_utils.fetch_transactions_in_range = async () => {
    calls.push('get_transactions')
    return []
  }

  const result = await orchestrator.fetch_league_data({
    platform_name: 'SLEEPER',
    external_league_id: 'test-league',
    credentials: {},
    fetch_options
  })

  return { result, calls }
}

describe('external fantasy leagues fetch and sync verdict', function () {
  describe('validate_only asks only whether the credentials reach the league', function () {
    it('fetches the league config and nothing else', async function () {
      const { calls } = await fetch_with({
        fetch_options: { validate_only: true }
      })

      expect(calls).to.deep.equal(['get_league'])
    })

    it('never reaches the player catalog, the expensive half', async function () {
      // Sleeper's catalog is ~11k entries and, since roster sync was severed
      // from get_players, get_rosters fetches it too -- so an unhonored
      // validate_only costs two catalog fetches, not one.
      const { calls } = await fetch_with({
        fetch_options: { validate_only: true }
      })

      expect(calls).to.not.include('get_players')
      expect(calls).to.not.include('get_rosters')
    })

    it('keeps every raw_data key present, because callers report them as parts', async function () {
      // Both the validation route and the import socket send
      // Object.keys(raw_data) as a `parts` summary. Omitting the skipped keys
      // would change that surface rather than just the work done.
      const { result } = await fetch_with({
        fetch_options: { validate_only: true }
      })

      expect(Object.keys(result.raw_data)).to.have.members([
        'league_config',
        'teams',
        'rosters',
        'transactions',
        'players'
      ])
      expect(result.raw_data.rosters).to.deep.equal([])
      expect(result.raw_data.players).to.deep.equal([])
      expect(result.raw_data.league_config.name).to.equal('Test League')
    })

    it('still fetches everything when validate_only is absent', async function () {
      // The negative control: without the flag the same path must do the full
      // fetch, or the cases above would pass on a broken orchestrator.
      const { calls } = await fetch_with({ fetch_options: {} })

      expect(calls).to.include('get_rosters')
      expect(calls).to.include('get_players')
      expect(calls).to.include('get_transactions')
    })
  })

  describe('a sync that skipped rosters does not report success', function () {
    const sync_with = async ({ skips, progress = [] }) => {
      const orchestrator = new SyncOrchestrator()

      orchestrator.initialize_adapter = () => ({
        authenticate: async () => {},
        get_league: async () => ({ name: 'Test League', teams: [] }),
        get_scoring_format: async () => ({})
      })
      orchestrator.team_sync = { sync_teams: async () => {} }
      orchestrator.transaction_sync = { sync_transactions: async () => {} }
      orchestrator.roster_sync = {
        sync_rosters: async ({ sync_stats }) => {
          for (const skip of skips) {
            sync_stats.errors.push(skip)
          }
        }
      }

      return orchestrator.sync_league({
        platform_name: 'SLEEPER',
        external_league_id: 'test-league',
        internal_league_id: 1,
        credentials: {},
        sync_options: {
          progress_callback: async (message, percentage, context_data) => {
            progress.push({ message, percentage, ...context_data })
          }
        }
      })
    }

    const terminal_progress = (progress) =>
      progress.filter((entry) => String(entry.step).startsWith('completed'))

    it('reports success when nothing was skipped', async function () {
      // Positive control. Without it, the failing case below would also pass
      // on an orchestrator that reported failure unconditionally.
      const result = await sync_with({ skips: [] })

      expect(result.success).to.equal(true)
    })

    it('reports failure when a roster was skipped', async function () {
      const result = await sync_with({
        skips: [{ error_type: 'roster_skip', error_message: 'no mapping' }]
      })

      expect(result.success).to.equal(false)
      expect(result.errors).to.have.lengthOf(1)
    })

    // The returned verdict and the STREAMED one are two different surfaces, and
    // fixing the first left the second saying the opposite. import-queue drives
    // the sync with a progress_callback that writes job progress, so a skipped
    // sync announced 'Sync completed successfully' at 100% and the job it
    // belongs to then landed as failed. The two cases below are a pair on
    // purpose: the success one is what makes the failure one mean anything.
    it('streams a successful completion when nothing was skipped', async function () {
      const progress = []
      await sync_with({ skips: [], progress })

      const terminal = terminal_progress(progress)
      expect(terminal).to.have.lengthOf(1)
      expect(terminal[0].step).to.equal('completed')
      expect(terminal[0].message).to.equal('Sync completed successfully')
    })

    it('does not stream success when a roster was skipped', async function () {
      const progress = []
      await sync_with({
        skips: [{ error_type: 'roster_skip', error_message: 'no mapping' }],
        progress
      })

      const terminal = terminal_progress(progress)
      expect(terminal).to.have.lengthOf(1)
      expect(terminal[0].message).to.not.match(/successfully/)
      expect(terminal[0].message).to.equal('Sync completed with errors')
      expect(terminal[0].step).to.equal('completed_with_errors')
      // Still terminal at 100: the run reached the end and wrote what it could,
      // so reporting 0% would be its own misreport in the other direction.
      expect(terminal[0].percentage).to.equal(100)
      expect(terminal[0].errors).to.have.lengthOf(1)
    })
  })
})
