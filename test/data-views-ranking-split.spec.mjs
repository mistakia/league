/* global describe it */

import * as chai from 'chai'

import player_rankings_column_definitions from '#libs-server/data-views-column-definitions/player-rankings-column-definitions.mjs'
import {
  migrate_column_entry,
  RANKING_NAMES_MAP
} from '#libs-shared/data-views-nfl-week-migration.mjs'

chai.should()
const expect = chai.expect

describe('player_rankings season-only fields', function () {
  describe('column definition exports', function () {
    it('exports 6 season ranking fields', () => {
      const keys = Object.keys(player_rankings_column_definitions)
      expect(keys).to.have.length(6)
    })

    it('exports player_season_* variants', () => {
      expect(player_rankings_column_definitions).to.have.property(
        'player_season_average_ranking'
      )
      expect(player_rankings_column_definitions).to.have.property(
        'player_season_overall_ranking'
      )
      expect(player_rankings_column_definitions).to.have.property(
        'player_season_position_ranking'
      )
      expect(player_rankings_column_definitions).to.have.property(
        'player_season_min_ranking'
      )
      expect(player_rankings_column_definitions).to.have.property(
        'player_season_max_ranking'
      )
      expect(player_rankings_column_definitions).to.have.property(
        'player_season_ranking_standard_deviation'
      )
    })

    it('season variants support only year split', () => {
      expect(
        player_rankings_column_definitions.player_season_average_ranking
          .granularity
      ).to.deep.equal(['player_year'])
    })
  })

  describe('migration helper rename behavior', function () {
    it('renames legacy ranking with absent week to season variant', () => {
      const out = migrate_column_entry({
        column_id: 'player_average_ranking',
        params: { year: [2024] }
      })
      expect(out.column_id).to.equal('player_season_average_ranking')
      expect(out.params.year).to.deep.equal([2024])
      expect(out.params.week).to.equal(undefined)
    })

    it('renames legacy ranking with week=0 to season variant and strips week params', () => {
      const out = migrate_column_entry({
        column_id: 'player_overall_ranking',
        params: { year: [2023], week: [0], seas_type: ['REG'] }
      })
      expect(out.column_id).to.equal('player_season_overall_ranking')
      expect(out.params.week).to.equal(undefined)
      expect(out.params.seas_type).to.equal(undefined)
    })

    it('renames legacy ranking with week>0 to season variant and strips week params', () => {
      const out = migrate_column_entry({
        column_id: 'player_position_ranking',
        params: {
          year: [2023],
          week: [5],
          seas_type: ['REG'],
          single_nfl_week_id: ['2023_REG_WEEK_5']
        }
      })
      expect(out.column_id).to.equal('player_season_position_ranking')
      expect(out.params.year).to.deep.equal([2023])
      expect(out.params.week).to.equal(undefined)
      expect(out.params.seas_type).to.equal(undefined)
      expect(out.params.single_nfl_week_id).to.equal(undefined)
    })

    it('covers all 6 legacy ranking names', () => {
      expect(Object.keys(RANKING_NAMES_MAP)).to.have.length(6)
    })
  })
})
