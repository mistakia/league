/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, roster_slot_types } from '#constants'
import RosterSync from '#libs-server/external-fantasy-leagues/sync/roster-sync.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()
const { regular_season_start } = current_season

const EXTERNAL_TEAM_ID = 'sleeper-team-1'
const INTERNAL_TEAM_ID = 1

// The sync writes into the roster row for the week it targets, which the league
// fixture creates for every week of the season.
const sync_week = current_season.week

const build_sync_context = ({ player_mappings }) => ({
  platform: 'sleeper',
  external_league_id: 'sleeper-league-1',
  internal_league_id: 1,
  week: sync_week,
  year: current_season.year,
  team_mappings: new Map([[EXTERNAL_TEAM_ID, INTERNAL_TEAM_ID]]),
  player_mappings: new Map(player_mappings)
})

const build_external_roster = (players) => ({
  team_external_id: EXTERNAL_TEAM_ID,
  players
})

const external_player = ({ sleeper_id, roster_slot_category = 'BENCH' }) => ({
  player_ids: { sleeper_id },
  roster_slot_category
})

const read_roster_players = async () => {
  const roster_row = await knex('rosters')
    .where({
      lid: 1,
      tid: INTERNAL_TEAM_ID,
      week: sync_week,
      season_year: current_season.year
    })
    .first()

  return knex('rosters_players')
    .where({ roster_id: roster_row.roster_id })
    .select('pid', 'slot')
}

const insert_existing_roster_player = async ({ pid, slot }) => {
  const roster_row = await knex('rosters')
    .where({
      lid: 1,
      tid: INTERNAL_TEAM_ID,
      week: sync_week,
      season_year: current_season.year
    })
    .first()

  const player_row = await knex('player').where({ pid }).first()

  await knex('rosters_players').insert({
    roster_id: roster_row.roster_id,
    lid: 1,
    tid: INTERNAL_TEAM_ID,
    pid,
    slot,
    player_position: player_row.primary_position,
    week: sync_week,
    season_year: current_season.year,
    extensions: 0
  })
}

describe('External Fantasy Leagues - roster sync writes', function () {
  let roster_sync

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await league(knex)
    roster_sync = new RosterSync()
  })

  describe('an external player the mapper could not resolve', function () {
    it('still writes the players that did resolve, and removes nobody', async function () {
      const resolvable = await selectPlayer({ rookie: false, random: false })
      const already_rostered = await selectPlayer({
        rookie: false,
        random: false,
        exclude_pids: [resolvable.pid]
      })

      await insert_existing_roster_player({
        pid: already_rostered.pid,
        slot: roster_slot_types.BENCH
      })

      const sync_stats_errors = []
      const synced = await roster_sync.sync_single_roster({
        external_roster: build_external_roster([
          external_player({ sleeper_id: 'resolvable-1' }),
          // Present on the external roster, absent from player_mappings: an
          // IDP, a DST, an unsigned rookie, or a mapper exception.
          external_player({ sleeper_id: 'unresolvable-1' })
        ]),
        sync_context: build_sync_context({
          player_mappings: [['resolvable-1', resolvable.pid]]
        }),
        sync_stats_errors
      })

      synced.should.equal(true)

      const roster_players = await read_roster_players()
      const pids = roster_players.map((row) => row.pid)

      expect(
        pids,
        'the resolvable player must still be written -- abandoning the whole ' +
          'team over one unresolvable id makes that team never sync at all'
      ).to.include(resolvable.pid)

      expect(
        pids,
        'a player absent from an INCOMPLETE mapping may be on the external ' +
          'roster under an id that failed to resolve, so the hard delete must ' +
          'be suppressed'
      ).to.include(already_rostered.pid)

      sync_stats_errors.should.have.lengthOf(1)
      sync_stats_errors[0].type.should.equal('roster_player_mapping_missing')
    })
  })

  describe('a complete mapping', function () {
    it('removes a player who left the external roster', async function () {
      const kept = await selectPlayer({ rookie: false, random: false })
      const departed = await selectPlayer({
        rookie: false,
        random: false,
        exclude_pids: [kept.pid]
      })

      await insert_existing_roster_player({
        pid: departed.pid,
        slot: roster_slot_types.BENCH
      })

      const sync_stats_errors = []
      await roster_sync.sync_single_roster({
        external_roster: build_external_roster([
          external_player({ sleeper_id: 'kept-1' })
        ]),
        sync_context: build_sync_context({
          player_mappings: [['kept-1', kept.pid]]
        }),
        sync_stats_errors
      })

      const pids = (await read_roster_players()).map((row) => row.pid)

      pids.should.include(kept.pid)
      expect(
        pids,
        'with every external player resolved, an internal player absent from ' +
          'the external roster really did leave it'
      ).to.not.include(departed.pid)
      sync_stats_errors.should.have.lengthOf(0)
    })

    it("writes a rostered player's changed slot", async function () {
      const moved = await selectPlayer({ rookie: false, random: false })

      await insert_existing_roster_player({
        pid: moved.pid,
        slot: roster_slot_types.BENCH
      })

      await roster_sync.sync_single_roster({
        external_roster: build_external_roster([
          external_player({
            sleeper_id: 'moved-1',
            roster_slot_category: 'INJURED_RESERVE'
          })
        ]),
        sync_context: build_sync_context({
          player_mappings: [['moved-1', moved.pid]]
        })
      })

      const roster_players = await read_roster_players()
      const moved_row = roster_players.find((row) => row.pid === moved.pid)

      expect(
        moved_row.slot,
        'a slot mapping applied only to newly added players is correct on the ' +
          'first sync and permanently stale on every one after it'
      ).to.equal(roster_slot_types.RESERVE_SHORT_TERM)
    })
  })
})
