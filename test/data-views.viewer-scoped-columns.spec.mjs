/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'
import data_views_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
import get_data_view_hash from '#libs-server/data-views/get-data-view-hash.mjs'
import { viewer_scoped_column_ids } from '#libs-server/data-views/viewer-scoped-columns.mjs'

const expect = chai.expect

const build_sql = async ({ column_id, user_id }) => {
  const { query } = await get_data_view_results_query({
    columns: [{ column_id, params: { lid: 1, year: [2024] } }],
    user_id
  })
  return query.toString()
}

describe('data-views viewer-scoped columns', () => {
  it('declares exactly the columns flagged is_viewer_scoped', () => {
    const flagged = Object.entries(data_views_column_definitions)
      .filter(([, definition]) => definition.is_viewer_scoped)
      .map(([column_id]) => column_id)

    expect([...viewer_scoped_column_ids].sort()).to.deep.equal(flagged.sort())
  })

  describe('restricted free agency tag disclosure', () => {
    it('shows an anonymous viewer only announced nominations', async () => {
      const sql = await build_sql({
        column_id: 'player_league_roster_tag',
        user_id: null
      })

      expect(sql).to.include('restricted_free_agency_nominations')
      expect(sql).to.include(
        'restricted_free_agency_nominations.announced_at IS NOT NULL'
      )
      // No identity in the query means no own-team carve-out.
      expect(sql).to.not.include('users_teams')
    })

    it('adds the own-team carve-out for a signed-in viewer', async () => {
      const sql = await build_sql({
        column_id: 'player_league_roster_tag',
        user_id: 5
      })

      expect(sql).to.include('users_teams.user_id = 5')
      expect(sql).to.include('rosters_players.tid IN (SELECT users_teams.tid')
      expect(sql).to.include('restricted_free_agency_nominations')
    })

    it('renders a hidden tag as regular rather than as a third value', async () => {
      const sql = await build_sql({
        column_id: 'player_league_roster_tag',
        user_id: null
      })

      // The RFA arm falls back to 'regular', so a hidden tag is
      // indistinguishable from an ordinary rostered player.
      expect(sql).to.include("ELSE 'regular' END")
    })

    it('gates the tag carried by player_league_roster_status', async () => {
      const sql = await build_sql({
        column_id: 'player_league_roster_status',
        user_id: null
      })

      // The raw tag integer must never reach the client alongside the status.
      // It survives only as the CASE subject, never as a selected value.
      expect(sql).to.not.include('rosters_players.tag AS tag')
      expect(sql).to.not.include('"rosters_players"."tag"')
      expect(sql).to.include('restricted_free_agency_nominations')
    })

    it('filters on the gated expression, not the raw tag', async () => {
      const { query } = await get_data_view_results_query({
        columns: ['player_league_roster_tag'],
        where: [
          {
            column_id: 'player_league_roster_tag',
            operator: '=',
            value: 'restricted_free_agency',
            params: { lid: 1, year: [2024] }
          }
        ],
        user_id: null
      })

      // A WHERE that bypassed the gate would let a caller enumerate hidden
      // tags by filtering for them.
      expect(query.toString()).to.include('restricted_free_agency_nominations')
    })
  })

  describe('result cache key', () => {
    const viewer_scoped_state = {
      columns: [{ column_id: 'player_league_roster_tag', params: { lid: 1 } }]
    }
    const plain_state = {
      columns: [{ column_id: 'player_name', params: {} }]
    }

    it('separates viewers on a viewer-scoped table state', () => {
      const anonymous = get_data_view_hash({
        ...viewer_scoped_state,
        user_id: null
      })
      const viewer_one = get_data_view_hash({
        ...viewer_scoped_state,
        user_id: 1
      })
      const viewer_two = get_data_view_hash({
        ...viewer_scoped_state,
        user_id: 2
      })

      expect(anonymous).to.not.equal(viewer_one)
      expect(viewer_one).to.not.equal(viewer_two)
    })

    it('keeps one shared key for every other table state', () => {
      expect(get_data_view_hash({ ...plain_state, user_id: null })).to.equal(
        get_data_view_hash({ ...plain_state, user_id: 42 })
      )
    })

    it('refuses a caller that omits the viewer', () => {
      expect(() => get_data_view_hash(plain_state)).to.throw(/requires user_id/)
    })
  })
})
