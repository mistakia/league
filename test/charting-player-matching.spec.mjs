/* global describe it */

import * as chai from 'chai'

import {
  extract_players_from_plays,
  extract_players_from_matchups
} from '#libs-server/charting-data/player-matching.mjs'

chai.should()
const expect = chai.expect

describe('LIBS-SERVER charting-data player-matching', function () {
  describe('extract_players_from_plays', function () {
    it('extracts unique players from play data', () => {
      const plays = [
        {
          sumerPlayerPlaysInGameNflsBySumerPlayIdAndSeasonList: [
            {
              sumerPlayerId: 'player-1',
              footballName: 'Patrick',
              lastName: 'Mahomes',
              currentTeamCode: 'KC',
              jerseyNumber: 15,
              position: 'QB'
            },
            {
              sumerPlayerId: 'player-2',
              footballName: 'Travis',
              lastName: 'Kelce',
              currentTeamCode: 'KC',
              jerseyNumber: 87,
              position: 'TE'
            }
          ]
        },
        {
          sumerPlayerPlaysInGameNflsBySumerPlayIdAndSeasonList: [
            {
              sumerPlayerId: 'player-1',
              footballName: 'Patrick',
              lastName: 'Mahomes',
              currentTeamCode: 'KC',
              jerseyNumber: 15,
              position: 'QB'
            },
            {
              sumerPlayerId: 'player-3',
              footballName: 'Tyreek',
              lastName: 'Hill',
              currentTeamCode: 'MIA',
              jerseyNumber: 10,
              position: 'WR'
            }
          ]
        }
      ]

      const result = extract_players_from_plays(plays)
      expect(result).to.have.length(3)
      expect(result[0].sumer_player_id).to.equal('player-1')
      expect(result[0].football_name).to.equal('Patrick')
      expect(result[0].last_name).to.equal('Mahomes')
      expect(result[0].team_code).to.equal('KC')
      expect(result[0].jersey_number).to.equal(15)
      expect(result[0].position).to.equal('QB')
      expect(result[1].sumer_player_id).to.equal('player-2')
      expect(result[2].sumer_player_id).to.equal('player-3')
    })

    it('deduplicates by sumer_player_id', () => {
      const plays = [
        {
          sumerPlayerPlaysInGameNflsBySumerPlayIdAndSeasonList: [
            {
              sumerPlayerId: 'player-1',
              footballName: 'Patrick',
              lastName: 'Mahomes',
              currentTeamCode: 'KC'
            }
          ]
        },
        {
          sumerPlayerPlaysInGameNflsBySumerPlayIdAndSeasonList: [
            {
              sumerPlayerId: 'player-1',
              footballName: 'Patrick',
              lastName: 'Mahomes',
              currentTeamCode: 'KC'
            }
          ]
        }
      ]

      const result = extract_players_from_plays(plays)
      expect(result).to.have.length(1)
    })

    it('handles plays without nested player data', () => {
      const plays = [
        { someField: 'value' },
        { sumerPlayerPlaysInGameNflsBySumerPlayIdAndSeasonList: [] }
      ]

      const result = extract_players_from_plays(plays)
      expect(result).to.have.length(0)
    })

    it('handles empty plays array', () => {
      const result = extract_players_from_plays([])
      expect(result).to.have.length(0)
    })

    it('skips entries without sumer_player_id', () => {
      const plays = [
        {
          sumerPlayerPlaysInGameNflsBySumerPlayIdAndSeasonList: [
            { footballName: 'Unknown', lastName: 'Player' }
          ]
        }
      ]

      const result = extract_players_from_plays(plays)
      expect(result).to.have.length(0)
    })
  })

  describe('extract_players_from_matchups', function () {
    it('extracts unique players from matchup data', () => {
      const matchups = [
        {
          offensePlayerId: 'off-1',
          offensePlayerFirstName: 'Davante',
          offensePlayerLastName: 'Adams',
          offenseTeamCode: 'LV',
          offenseJerseyNumber: 17,
          offensePosition: 'WR',
          defensePlayerId: 'def-1',
          defensePlayerFirstName: 'Jalen',
          defensePlayerLastName: 'Ramsey',
          defenseTeamCode: 'MIA',
          defenseJerseyNumber: 5,
          defensePosition: 'CB'
        },
        {
          offensePlayerId: 'off-1',
          offensePlayerFirstName: 'Davante',
          offensePlayerLastName: 'Adams',
          offenseTeamCode: 'LV',
          defensePlayerId: 'def-2',
          defensePlayerFirstName: 'Xavien',
          defensePlayerLastName: 'Howard',
          defenseTeamCode: 'MIA',
          defenseJerseyNumber: 25,
          defensePosition: 'CB'
        }
      ]

      const result = extract_players_from_matchups(matchups)
      expect(result).to.have.length(3)

      const ids = result.map((p) => p.sumer_player_id)
      expect(ids).to.include('off-1')
      expect(ids).to.include('def-1')
      expect(ids).to.include('def-2')
    })

    it('extracts correct player details', () => {
      const matchups = [
        {
          offensePlayerId: 'off-1',
          offensePlayerFirstName: 'Davante',
          offensePlayerLastName: 'Adams',
          offenseTeamCode: 'LV',
          offenseJerseyNumber: 17,
          offensePosition: 'WR',
          defensePlayerId: 'def-1',
          defensePlayerFirstName: 'Jalen',
          defensePlayerLastName: 'Ramsey',
          defenseTeamCode: 'MIA',
          defenseJerseyNumber: 5,
          defensePosition: 'CB'
        }
      ]

      const result = extract_players_from_matchups(matchups)
      const offense = result.find((p) => p.sumer_player_id === 'off-1')
      expect(offense.football_name).to.equal('Davante')
      expect(offense.last_name).to.equal('Adams')
      expect(offense.team_code).to.equal('LV')

      const defense = result.find((p) => p.sumer_player_id === 'def-1')
      expect(defense.football_name).to.equal('Jalen')
      expect(defense.last_name).to.equal('Ramsey')
      expect(defense.team_code).to.equal('MIA')
    })

    it('handles empty matchup data', () => {
      const result = extract_players_from_matchups([])
      expect(result).to.have.length(0)
    })

    it('skips matchup entries without player IDs', () => {
      const matchups = [
        {
          offensePlayerFirstName: 'Unknown',
          defensePlayerFirstName: 'Unknown'
        }
      ]

      const result = extract_players_from_matchups(matchups)
      expect(result).to.have.length(0)
    })
  })
})
