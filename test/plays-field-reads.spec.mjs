/* global describe it */

// Regression coverage for a class of latent bug in the plays surface: code
// reading a field name that exists on no schema version -- a raw vendor key, a
// nflfastR column name, or a pre-rename name that a rename pass missed. Each
// read silently yields undefined rather than throwing, so the defect surfaces
// as unpopulated columns or wrong aggregates instead of an error.

import * as chai from 'chai'
import { readFile } from 'fs/promises'

import getPlayFromPlayStats from '#libs-shared/get-play-from-play-stats.mjs'
import { enrich_fixed_drives } from '#libs-server/play-enrichment/fixed-drive-enrichment.mjs'
import calculateStatsFromPlays from '#libs-shared/calculate-stats-from-plays.mjs'

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

describe('calculate-stats-from-plays interception attribution', function () {
  const pass_play = (rest) => ({
    play_type: 'PASS',
    offense_nfl_team: 'KC',
    passer_pid: 'PASS-ER-000001',
    ...rest
  })

  it('credits the passer an interception and an attempt on a picked pass', () => {
    const players = calculateStatsFromPlays([
      pass_play({ interceptor_pid: 'INTE-RCE-000002' })
    ])

    expect(players['PASS-ER-000001'].passing_interceptions).to.equal(1)
    expect(players['PASS-ER-000001'].passing_attempts).to.equal(1)
  })

  it('ignores the pre-rename spelling intp', () => {
    const players = calculateStatsFromPlays([pass_play({ intp: 'X' })])

    expect(players['PASS-ER-000001'].passing_interceptions).to.equal(0)
  })

  it('does not count an interception on an ordinary completion', () => {
    const players = calculateStatsFromPlays([
      pass_play({
        comp: true,
        target_pid: 'TARG-ET-000003',
        recv_yds: 12,
        pass_yds: 12
      })
    ])

    expect(players['PASS-ER-000001'].passing_interceptions).to.equal(0)
    expect(players['PASS-ER-000001'].passing_attempts).to.equal(1)
  })
})

describe('prop-market-settlement nfl_plays select coverage', function () {
  // The NFL_PLAYS handler reads play columns by name off preloaded rows. A
  // column absent from the preloader's select list reads undefined and settles
  // the market against a zero metric rather than raising, so the two must be
  // checked against each other rather than trusted to stay in sync.
  it('preloads every nfl_plays column the NFL_PLAYS handler reads', async () => {
    const { HANDLER_TYPES, market_type_mappings } = await import(
      '#libs-server/prop-market-settlement/market-type-mappings.mjs'
    )

    const required_columns = new Set()
    for (const mapping of Object.values(market_type_mappings)) {
      if (mapping.handler !== HANDLER_TYPES.NFL_PLAYS) continue

      for (const column of mapping.metric_columns || []) {
        required_columns.add(column)
      }
      if (mapping.player_column) required_columns.add(mapping.player_column)
      if (mapping.team_aggregate) required_columns.add('offense_nfl_team')
      if (mapping.quarter_filter || mapping.half_filter) {
        required_columns.add('qtr')
      }
      if (mapping.special_logic === 'first_touchdown_scorer') {
        // The first-scorer branch reads these directly off the play.
        required_columns.add('rush')
        required_columns.add('pass')
        required_columns.add('ball_carrier_pid')
        required_columns.add('target_pid')
      }
    }

    const preloader_source = await readFile(
      new URL(
        '../libs-server/prop-market-settlement/data-preloader.mjs',
        import.meta.url
      ),
      'utf8'
    )
    const select_list = preloader_source
      .split('const load_nfl_plays')[1]
      .split('.whereIn')[0]
    const selected_columns = new Set(
      [...select_list.matchAll(/'([a-z_0-9]+)'/g)].map((match) => match[1])
    )

    const missing = [...required_columns].filter(
      (column) => !selected_columns.has(column)
    )

    expect(missing).to.deep.equal([])
  })
})
