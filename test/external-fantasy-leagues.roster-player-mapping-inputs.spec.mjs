/* global describe it */

// The sync's question is "which pids are on these rosters?", not "what is this
// platform's entire player universe?". Those were conflated: roster sync called
// adapter.get_players() for a global catalog and intersected it with the
// rosters. ESPN's get_players() returned [] unconditionally, so the
// intersection was empty, every ESPN roster player failed to resolve, and the
// sync still reported success with players_mapped: 0.
//
// The fix severs the sync from get_players() -- mapping inputs are built from
// the roster entries themselves, whose external id IS the mapping identity.
// These cases hold that severing in place. The DB-seeded roster-sync-writes
// spec cannot: it injects player_mappings straight into the sync context and so
// never executes this path at all.
//
// Hermetic on purpose. Nothing here needs a roster row, a league or a database.

import * as chai from 'chai'

import ESPNAdapter from '#libs-server/external-fantasy-leagues/adapters/espn.mjs'
import SleeperAdapter from '#libs-server/external-fantasy-leagues/adapters/sleeper.mjs'
import { RosterSync } from '#libs-server/external-fantasy-leagues/sync/roster-sync.mjs'

const expect = chai.expect

describe('external fantasy leagues roster player mapping inputs', function () {
  describe('mapping inputs come from the roster entries', function () {
    it('builds one input per rostered player, carrying the fallback fields', function () {
      const roster_sync = new RosterSync()

      const inputs = roster_sync._build_player_mapping_inputs({
        platform: 'SLEEPER',
        external_players: [
          {
            player_ids: { sleeper_id: '4034' },
            player_name: 'Christian McCaffrey',
            player_position: 'RB',
            player_team: 'SF'
          }
        ]
      })

      expect(inputs).to.deep.equal([
        {
          external_id: '4034',
          fallback_data: {
            name: 'Christian McCaffrey',
            position: 'RB',
            team: 'SF'
          }
        }
      ])
    })

    it('reads the same field names from an ESPN roster entry', function () {
      // The two adapters must agree on the roster-entry shape, because the sync
      // has one code path for both. Before this change the builder read
      // `team_abbreviation` -- Sleeper's CATALOG field name -- so an ESPN entry
      // passed team: undefined into fallback matching even when populated.
      const roster_sync = new RosterSync()

      const inputs = roster_sync._build_player_mapping_inputs({
        platform: 'ESPN',
        external_players: [
          {
            player_ids: { espn_id: '3117251' },
            player_name: 'Christian McCaffrey',
            player_position: 'RB',
            player_team: 'SF'
          }
        ]
      })

      expect(inputs).to.have.lengthOf(1)
      expect(inputs[0].fallback_data.team).to.equal('SF')
      expect(inputs[0].fallback_data.position).to.equal('RB')
    })

    it('drops an entry with no external id rather than mapping a null identity', function () {
      const roster_sync = new RosterSync()

      const inputs = roster_sync._build_player_mapping_inputs({
        platform: 'SLEEPER',
        external_players: [
          { player_ids: { sleeper_id: '4034' }, player_name: 'A' },
          { player_ids: {}, player_name: 'B' },
          { player_name: 'C' }
        ]
      })

      expect(inputs.map((input) => input.external_id)).to.deep.equal(['4034'])
    })

    it('passes a null name rather than a name assembled from absent parts', function () {
      const roster_sync = new RosterSync()

      const inputs = roster_sync._build_player_mapping_inputs({
        platform: 'SLEEPER',
        external_players: [{ player_ids: { sleeper_id: '4034' } }]
      })

      expect(inputs[0].fallback_data.name).to.equal(null)
    })
  })

  describe('the sync never asks an adapter for a global catalog', function () {
    it('maps every rostered player without calling get_players', async function () {
      const roster_sync = new RosterSync()

      let get_players_calls = 0
      const adapter = {
        get_players: async () => {
          get_players_calls += 1
          return []
        }
      }

      let received_inputs = null
      roster_sync.player_mapper = {
        bulk_map_to_internal: async ({ players }) => {
          received_inputs = players
          return new Map([['4034', 'CHRI-MCCA-000001']])
        }
      }

      const sync_context = {
        platform: 'SLEEPER',
        player_mappings: new Map()
      }
      const sync_stats = {}

      await roster_sync._setup_player_mappings({
        sync_context,
        sync_stats,
        rosters: [
          {
            players: [
              {
                player_ids: { sleeper_id: '4034' },
                player_name: 'Christian McCaffrey',
                player_position: 'RB',
                player_team: 'SF'
              }
            ]
          }
        ]
      })

      // The adapter is not even a parameter any more; this asserts the sync
      // cannot have reached a catalog by any route.
      expect(get_players_calls).to.equal(0)
      expect(adapter.get_players).to.be.a('function')

      expect(received_inputs).to.have.lengthOf(1)
      expect(received_inputs[0].external_id).to.equal('4034')
      expect(sync_context.player_mappings.get('4034')).to.equal(
        'CHRI-MCCA-000001'
      )
      expect(sync_stats.players_mapped).to.equal(1)
    })

    it('gathers players across every roster, not just the first', async function () {
      const roster_sync = new RosterSync()

      let received_inputs = null
      roster_sync.player_mapper = {
        bulk_map_to_internal: async ({ players }) => {
          received_inputs = players
          return new Map()
        }
      }

      await roster_sync._setup_player_mappings({
        sync_context: { platform: 'SLEEPER', player_mappings: new Map() },
        sync_stats: {},
        rosters: [
          { players: [{ player_ids: { sleeper_id: '1' } }] },
          { players: [{ player_ids: { sleeper_id: '2' } }] },
          // A roster with no players key at all must not abort the gather.
          {},
          { players: [{ player_ids: { sleeper_id: '3' } }] }
        ]
      })

      expect(received_inputs.map((input) => input.external_id)).to.deep.equal([
        '1',
        '2',
        '3'
      ])
    })
  })

  describe('an adapter with no catalog says so instead of returning empty', function () {
    it('ESPN get_players throws rather than reporting an empty universe', async function () {
      // Returning [] is the defect this whole change exists for: it is
      // indistinguishable from "this platform has no players" and mapped every
      // ESPN roster player to nothing while the sync reported success.
      const adapter = new ESPNAdapter()

      let threw = null
      try {
        await adapter.get_players()
      } catch (error) {
        threw = error
      }

      expect(threw).to.be.an('error')
      expect(threw.message).to.match(/not yet implemented/)
    })

    it('Sleeper still has a real catalog, so it must not throw', function () {
      // Guards against over-applying the ESPN fix -- Sleeper's /players/nfl is
      // a genuine global endpoint and get_players there is not a stub.
      const adapter = new SleeperAdapter()
      expect(adapter.get_players).to.be.a('function')
    })
  })
})
