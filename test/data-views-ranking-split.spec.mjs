/* global describe it */

import * as chai from 'chai'

import player_rankings_column_definitions from '#libs-server/data-views-column-definitions/player-rankings-column-definitions.mjs'
import {
  migrate_column_entry,
  RANKING_NAMES_MAP
} from '#libs-shared/data-views-nfl-week-migration.mjs'

chai.should()
const expect = chai.expect

describe('player_rankings season/week split', function () {
  describe('column definition exports', function () {
    it('exports 12 ranking fields (6 season + 6 week)', () => {
      const keys = Object.keys(player_rankings_column_definitions)
      expect(keys).to.have.length(12)
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

    it('exports player_week_* variants', () => {
      expect(player_rankings_column_definitions).to.have.property(
        'player_week_average_ranking'
      )
      expect(player_rankings_column_definitions).to.have.property(
        'player_week_overall_ranking'
      )
      expect(player_rankings_column_definitions).to.have.property(
        'player_week_position_ranking'
      )
      expect(player_rankings_column_definitions).to.have.property(
        'player_week_min_ranking'
      )
      expect(player_rankings_column_definitions).to.have.property(
        'player_week_max_ranking'
      )
      expect(player_rankings_column_definitions).to.have.property(
        'player_week_ranking_standard_deviation'
      )
    })

    it('season variants support only year split', () => {
      expect(
        player_rankings_column_definitions.player_season_average_ranking
          .supported_splits
      ).to.deep.equal(['year'])
    })

    it('week variants support year and week splits', () => {
      expect(
        player_rankings_column_definitions.player_week_average_ranking
          .supported_splits
      ).to.deep.equal(['year', 'week'])
    })
  })

  describe('migration helper rename behavior', function () {
    it('renames old ranking with absent week to season variant', () => {
      const out = migrate_column_entry({
        column_id: 'player_average_ranking',
        params: { year: [2024] }
      })
      expect(out.column_id).to.equal('player_season_average_ranking')
      expect(out.params.year).to.deep.equal([2024])
      expect(out.params.week).to.equal(undefined)
    })

    it('renames old ranking with week=0 to season variant', () => {
      const out = migrate_column_entry({
        column_id: 'player_overall_ranking',
        params: { year: [2023], week: [0] }
      })
      expect(out.column_id).to.equal('player_season_overall_ranking')
      expect(out.params.week).to.equal(undefined)
    })

    it('renames old ranking with week>0 to week variant with single_nfl_week_id', () => {
      const out = migrate_column_entry({
        column_id: 'player_position_ranking',
        params: { year: [2023], week: [5], seas_type: ['REG'] }
      })
      expect(out.column_id).to.equal('player_week_position_ranking')
      expect(out.params.single_nfl_week_id).to.deep.equal(['2023_REG_WEEK_5'])
      expect(out.params.year).to.equal(undefined)
      expect(out.params.week).to.equal(undefined)
    })

    it('covers all 6 old ranking names', () => {
      expect(Object.keys(RANKING_NAMES_MAP)).to.have.length(6)
    })
  })
})
