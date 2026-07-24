/* global describe it */

// Regression coverage for a class of latent bug in the plays surface: code
// reading a field name that exists on no schema version -- a raw vendor key, a
// nflfastR column name, or a pre-rename name that a rename pass missed. Each
// read silently yields undefined rather than throwing, so the defect surfaces
// as unpopulated columns or wrong aggregates instead of an error.

import * as chai from 'chai'

import getPlayFromPlayStats from '#libs-shared/get-play-from-play-stats.mjs'

const expect = chai.expect

// A nfl_play_stats DB row as get_play_stats() returns it. The full column set
// is esbid, play_id, nfl_team, player_name, stat_id, yards, gsis_player_id,
// smart_player_id, nfl_team_id, valid -- note there is no `teamAbbr`.
const play_stat_row = ({
  stat_id,
  nfl_team = null,
  gsis_player_id = null,
  yards = 0
}) => ({
  esbid: 1,
  play_id: 100,
  stat_id,
  nfl_team,
  gsis_player_id,
  yards
})

describe('get-play-from-play-stats scoring/return team attribution', function () {
  // statId -> the playRow field(s) it must populate from the stat row's team.
  const td_tm_stat_ids = [
    11, // Rushing Touchdown
    13, // Lateral Rushing Touchdown
    22, // Receiving Touchdown
    24, // Lateral Receiving Touchdown
    26, // Interception Return Touchdown
    28 // Lateral Interception Return Touchdown
  ]

  const ret_tm_stat_ids = [
    25, // Interception Return
    26, // Interception Return Touchdown
    27, // Lateral Interception Return
    28 // Lateral Interception Return Touchdown
  ]

  for (const stat_id of td_tm_stat_ids) {
    it(`statId ${stat_id} sets td_tm from the stat row nfl_team`, () => {
      const play_row = getPlayFromPlayStats({
        playStats: [play_stat_row({ stat_id, nfl_team: 'KC', yards: 7 })]
      })

      expect(play_row.td_tm).to.equal('KC')
    })
  }

  for (const stat_id of ret_tm_stat_ids) {
    it(`statId ${stat_id} sets ret_tm from the stat row nfl_team`, () => {
      const play_row = getPlayFromPlayStats({
        playStats: [play_stat_row({ stat_id, nfl_team: 'NE', yards: 12 })]
      })

      expect(play_row.ret_tm).to.equal('NE')
    })
  }

  it('does not read the raw NFL feed key teamAbbr', () => {
    // A row carrying only the vendor key must not populate the team fields --
    // this function is fed DB rows, never the raw play-stats payload.
    const play_row = getPlayFromPlayStats({
      playStats: [{ stat_id: 11, teamAbbr: 'KC', yards: 7 }]
    })

    expect(play_row.td_tm).to.equal(undefined)
  })

  it('leaves td_tm unset when the stat row has no team', () => {
    const play_row = getPlayFromPlayStats({
      playStats: [play_stat_row({ stat_id: 11, yards: 7 })]
    })

    expect(play_row.td_tm).to.equal(null)
  })
})
