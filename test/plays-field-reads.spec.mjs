/* global describe it */

// Regression coverage for a class of latent bug in the plays surface: code
// reading a field name that exists on no schema version -- a raw vendor key, a
// nflfastR column name, or a pre-rename name that a rename pass missed. Each
// read silently yields undefined rather than throwing, so the defect surfaces
// as unpopulated columns or wrong aggregates instead of an error.

import * as chai from 'chai'

import getPlayFromPlayStats from '#libs-shared/get-play-from-play-stats.mjs'
import { enrich_fixed_drives } from '#libs-server/play-enrichment/fixed-drive-enrichment.mjs'

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

// A nfl_plays row as the enrichment pipeline sees it at phase 7. drive_seq is
// left unset so enrich_fixed_drives computes it.
const build_play = ({ play_id, play_type, offense_nfl_team, ...rest }) => ({
  esbid: 1,
  qtr: 1,
  play_id,
  play_type,
  offense_nfl_team,
  ...rest
})

const drive_seqs = (plays) =>
  enrich_fixed_drives(plays).map((play) => play.drive_seq)

describe('fixed-drive-enrichment drive boundaries', function () {
  it('starts a new drive when the same team regains possession after a lost fumble', () => {
    // KC fumbles on a rush, KC recovers. nflfastR counts this as a new drive
    // even though possession never changed hands.
    const plays = [
      build_play({ play_id: 1, play_type: 'RUSH', offense_nfl_team: 'KC' }),
      build_play({
        play_id: 2,
        play_type: 'RUSH',
        offense_nfl_team: 'KC',
        fumbles_lost: true
      }),
      build_play({ play_id: 3, play_type: 'RUSH', offense_nfl_team: 'KC' })
    ]

    expect(drive_seqs(plays)).to.deep.equal([1, 1, 2])
  })

  it('does not start a new drive when the lost fumble was returned for a touchdown', () => {
    const plays = [
      build_play({ play_id: 1, play_type: 'RUSH', offense_nfl_team: 'KC' }),
      build_play({
        play_id: 2,
        play_type: 'RUSH',
        offense_nfl_team: 'KC',
        fumbles_lost: true,
        td: true
      }),
      build_play({ play_id: 3, play_type: 'RUSH', offense_nfl_team: 'KC' })
    ]

    expect(drive_seqs(plays)).to.deep.equal([1, 1, 1])
  })

  it('ignores the nflfastR spelling fumble_lost', () => {
    const plays = [
      build_play({ play_id: 1, play_type: 'RUSH', offense_nfl_team: 'KC' }),
      build_play({
        play_id: 2,
        play_type: 'RUSH',
        offense_nfl_team: 'KC',
        fumble_lost: true
      }),
      build_play({ play_id: 3, play_type: 'RUSH', offense_nfl_team: 'KC' })
    ]

    expect(drive_seqs(plays)).to.deep.equal([1, 1, 1])
  })

  it('treats a kickoff recovered by the kicking team as its own drive', () => {
    const plays = [
      build_play({ play_id: 1, play_type: 'RUSH', offense_nfl_team: 'KC' }),
      build_play({
        play_id: 2,
        play_type: 'KOFF',
        offense_nfl_team: 'NE',
        defense_nfl_team: 'KC',
        fumbles_lost: true
      }),
      build_play({ play_id: 3, play_type: 'RUSH', offense_nfl_team: 'KC' })
    ]

    expect(drive_seqs(plays)).to.deep.equal([1, 2, 2])
  })

  it('does not treat a PAT after an offensive touchdown as the same drive', () => {
    // KC scores, KC is credited -- the PAT is a possession change away from the
    // scoring team's next unit, so the ordinary posteam rule applies.
    const plays = [
      build_play({
        play_id: 1,
        play_type: 'PASS',
        offense_nfl_team: 'KC',
        td: true,
        td_tm: 'KC'
      }),
      build_play({ play_id: 2, play_type: 'CONV', offense_nfl_team: 'NE' })
    ]

    expect(drive_seqs(plays)).to.deep.equal([1, 2])
  })

  it('does not start a new drive on a PAT following a defensive touchdown', () => {
    // NE intercepts and scores; NE now has the PAT despite KC being the
    // offense of record on the scoring play.
    const plays = [
      build_play({
        play_id: 1,
        play_type: 'PASS',
        offense_nfl_team: 'KC',
        td: true,
        td_tm: 'NE'
      }),
      build_play({ play_id: 2, play_type: 'CONV', offense_nfl_team: 'NE' })
    ]

    expect(drive_seqs(plays)).to.deep.equal([1, 1])
  })

  it('falls back to the possession rule when a touchdown has no scoring team', () => {
    // td_tm is unpopulated for historical plays. An unattributed touchdown must
    // not be read as a defensive touchdown, which would suppress the drive
    // boundary on every play that follows a score.
    const plays = [
      build_play({
        play_id: 1,
        play_type: 'PASS',
        offense_nfl_team: 'KC',
        td: true,
        td_tm: null
      }),
      build_play({ play_id: 2, play_type: 'CONV', offense_nfl_team: 'NE' })
    ]

    expect(drive_seqs(plays)).to.deep.equal([1, 2])
  })
})
