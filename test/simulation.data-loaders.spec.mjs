/* global describe it */

import * as chai from 'chai'

import { simulation } from '#libs-server'
import * as simulation_pure from '#libs-shared/simulation/index.mjs'

chai.should()
const expect = chai.expect

describe('LIBS-SERVER simulation data loaders', function () {
  describe('NFL_TEAMS constant', function () {
    it('should contain all 32 NFL teams', () => {
      expect(simulation.NFL_TEAMS).to.be.an('array')
      expect(simulation.NFL_TEAMS).to.have.lengthOf(32)
    })

    it('should contain expected teams', () => {
      expect(simulation.NFL_TEAMS).to.include('KC')
      expect(simulation.NFL_TEAMS).to.include('SF')
      expect(simulation.NFL_TEAMS).to.include('PHI')
      expect(simulation.NFL_TEAMS).to.include('BUF')
      expect(simulation.NFL_TEAMS).to.include('DAL')
    })
  })

  describe('pure function helpers', function () {
    describe('get_teams_on_bye', function () {
      it('should return teams on bye given schedule', () => {
        const schedule = {
          KC: { opponent: 'SF', esbid: 1001, is_home: true },
          SF: { opponent: 'KC', esbid: 1001, is_home: false },
          PHI: { opponent: 'DAL', esbid: 1002, is_home: true },
          DAL: { opponent: 'PHI', esbid: 1002, is_home: false }
        }

        const bye_teams = simulation_pure.get_teams_on_bye({
          schedule,
          all_nfl_teams: simulation.NFL_TEAMS
        })
        expect(bye_teams).to.be.an('array')
        // Teams not in any game should be on bye
        expect(bye_teams).to.include('NYG')
        expect(bye_teams).not.to.include('KC')
        expect(bye_teams).not.to.include('SF')
      })
    })

    describe('is_team_on_bye', function () {
      it('should return true for teams on bye', () => {
        const schedule = {
          KC: { opponent: 'SF', esbid: 1001, is_home: true },
          SF: { opponent: 'KC', esbid: 1001, is_home: false }
        }

        expect(
          simulation_pure.is_team_on_bye({ nfl_team: 'NYG', schedule })
        ).to.equal(true)
        expect(
          simulation_pure.is_team_on_bye({ nfl_team: 'PHI', schedule })
        ).to.equal(true)
      })

      it('should return false for teams playing', () => {
        const schedule = {
          KC: { opponent: 'SF', esbid: 1001, is_home: true },
          SF: { opponent: 'KC', esbid: 1001, is_home: false }
        }

        expect(
          simulation_pure.is_team_on_bye({ nfl_team: 'KC', schedule })
        ).to.equal(false)
        expect(
          simulation_pure.is_team_on_bye({ nfl_team: 'SF', schedule })
        ).to.equal(false)
      })
    })
  })

  describe('merge_player_projections', function () {
    // calculate-points falls back to the scoring registry defaults for any
    // column a config omits, so a bare object scores every stat at its default
    // rather than at zero. That is enough to exercise the merge.
    const league_settings = {}

    const merge = ({ player_ids, ...rest }) =>
      simulation.merge_player_projections({
        player_ids,
        traditional_projections: new Map(),
        traditional_stats: new Map(),
        market_projections: new Map(),
        player_info: new Map(),
        league_settings,
        ...rest
      })

    it('should report a market override as merged', () => {
      const { projections, sources } = merge({
        player_ids: ['WIDE-RECR-000001'],
        traditional_stats: new Map([
          ['WIDE-RECR-000001', { receiving_yards: 50, receptions: 4 }]
        ]),
        market_projections: new Map([
          ['WIDE-RECR-000001', { stats: { receiving_yards: 80 } }]
        ]),
        player_info: new Map([['WIDE-RECR-000001', { position: 'WR' }]])
      })

      expect(sources.get('WIDE-RECR-000001')).to.equal('merged')
      expect(projections.get('WIDE-RECR-000001')).to.be.a('number')
    })

    it('should report traditional-only stats as traditional', () => {
      const { sources } = merge({
        player_ids: ['WIDE-RECR-000002'],
        traditional_stats: new Map([
          ['WIDE-RECR-000002', { receiving_yards: 50, receptions: 4 }]
        ]),
        player_info: new Map([['WIDE-RECR-000002', { position: 'WR' }]])
      })

      expect(sources.get('WIDE-RECR-000002')).to.equal('traditional')
    })

    // DST and K short-circuit to null in merge_market_stats_with_traditional --
    // they have no stat-level projections to merge -- and fall back to the
    // pre-calculated projection. Presence in market_projections says nothing
    // about how they were scored, which is what the source label used to guess
    // from.
    it('should report a DST in market_projections as traditional', () => {
      const { projections, sources } = merge({
        player_ids: ['KC'],
        traditional_projections: new Map([['KC', 9.5]]),
        market_projections: new Map([['KC', { stats: { anytime_td: 0.1 } }]]),
        player_info: new Map([['KC', { position: 'DST' }]])
      })

      expect(projections.get('KC')).to.equal(9.5)
      expect(sources.get('KC')).to.equal('traditional')
    })

    it('should report a kicker in market_projections as traditional', () => {
      const { projections, sources } = merge({
        player_ids: ['KICK-ERRR-000001'],
        traditional_projections: new Map([['KICK-ERRR-000001', 7.25]]),
        market_projections: new Map([
          ['KICK-ERRR-000001', { stats: { anytime_td: 0.05 } }]
        ]),
        player_info: new Map([['KICK-ERRR-000001', { position: 'K' }]])
      })

      expect(projections.get('KICK-ERRR-000001')).to.equal(7.25)
      expect(sources.get('KICK-ERRR-000001')).to.equal('traditional')
    })

    // A pid with neither a merge result nor a pre-calculated projection is
    // dropped. Keeping sources in step with projections is what makes the
    // caller's counts unable to disagree with the map they summarize.
    it('should omit a player with no projection of either kind', () => {
      const { projections, sources } = merge({
        player_ids: ['MISS-INGG-000001'],
        player_info: new Map([['MISS-INGG-000001', { position: 'WR' }]])
      })

      expect(projections.has('MISS-INGG-000001')).to.equal(false)
      expect(sources.has('MISS-INGG-000001')).to.equal(false)
      expect(sources.size).to.equal(projections.size)
    })
  })

  describe('POSITION_RANKS constant', function () {
    it('should contain expected position ranks', () => {
      expect(simulation_pure.POSITION_RANKS).to.be.an('object')
      expect(simulation_pure.POSITION_RANKS).to.have.property('QB')
      expect(simulation_pure.POSITION_RANKS).to.have.property('WR1')
      expect(simulation_pure.POSITION_RANKS).to.have.property('RB1')
      expect(simulation_pure.POSITION_RANKS).to.have.property('TE1')
    })
  })
})
