/* global describe it */

import * as chai from 'chai'

import { simulation } from '#libs-server'
import { simulation as simulation_pure } from '#libs-shared'

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
