/* global describe it before */

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
// is esbid, play_id, nfl_team, player_name, stat_id, stat_yards,
// gsis_player_id, smart_player_id, nfl_team_id, valid -- note there is no
// `teamAbbr`.
const play_stat_row = ({
  stat_id,
  nfl_team = null,
  gsis_player_id = null,
  stat_yards = 0
}) => ({
  esbid: 1,
  play_id: 100,
  stat_id,
  nfl_team,
  gsis_player_id,
  stat_yards
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
    it(`statId ${stat_id} sets td_nfl_team from the stat row nfl_team`, () => {
      const play_row = getPlayFromPlayStats({
        playStats: [play_stat_row({ stat_id, nfl_team: 'KC', stat_yards: 7 })]
      })

      expect(play_row.td_nfl_team).to.equal('KC')
    })
  }

  for (const stat_id of ret_tm_stat_ids) {
    it(`statId ${stat_id} sets return_nfl_team from the stat row nfl_team`, () => {
      const play_row = getPlayFromPlayStats({
        playStats: [play_stat_row({ stat_id, nfl_team: 'NE', stat_yards: 12 })]
      })

      expect(play_row.return_nfl_team).to.equal('NE')
    })
  }

  it('does not read the raw NFL feed key teamAbbr', () => {
    // A row carrying only the vendor key must not populate the team fields --
    // this function is fed DB rows, never the raw play-stats payload.
    const play_row = getPlayFromPlayStats({
      playStats: [{ stat_id: 11, teamAbbr: 'KC', stat_yards: 7 }]
    })

    expect(play_row.td_nfl_team).to.equal(undefined)
  })

  it('leaves td_nfl_team unset when the stat row has no team', () => {
    const play_row = getPlayFromPlayStats({
      playStats: [play_stat_row({ stat_id: 11, stat_yards: 7 })]
    })

    expect(play_row.td_nfl_team).to.equal(null)
  })
})

// A nfl_plays row as the enrichment pipeline sees it at phase 7. drive_sequence is
// left unset so enrich_fixed_drives computes it.
const build_play = ({ play_id, play_type, offense_nfl_team, ...rest }) => ({
  esbid: 1,
  quarter: 1,
  play_id,
  play_type,
  offense_nfl_team,
  ...rest
})

const drive_seqs = (plays) =>
  enrich_fixed_drives(plays).map((play) => play.drive_sequence)

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
        is_fumble_lost: true
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
        is_fumble_lost: true,
        is_touchdown: true
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
        is_fumble_lost: true
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
        is_touchdown: true,
        td_nfl_team: 'KC'
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
        is_touchdown: true,
        td_nfl_team: 'NE'
      }),
      build_play({ play_id: 2, play_type: 'CONV', offense_nfl_team: 'NE' })
    ]

    expect(drive_seqs(plays)).to.deep.equal([1, 1])
  })

  it('falls back to the possession rule when a touchdown has no scoring team', () => {
    // td_nfl_team is unpopulated for historical plays. An unattributed touchdown must
    // not be read as a defensive touchdown, which would suppress the drive
    // boundary on every play that follows a score.
    const plays = [
      build_play({
        play_id: 1,
        play_type: 'PASS',
        offense_nfl_team: 'KC',
        is_touchdown: true,
        td_nfl_team: null
      }),
      build_play({ play_id: 2, play_type: 'CONV', offense_nfl_team: 'NE' })
    ]

    expect(drive_seqs(plays)).to.deep.equal([1, 2])
  })
})

// A two-half game: KC and NE alternate possession in Q1, then again in Q3.
// Under per-half numbering the second half restarts at 1 and every value
// collides with a first-half drive; under game-continuous numbering the halves
// share one 1..N sequence.
const two_half_game = ({ esbid = 1, drive_seq_by_play_id = {} } = {}) =>
  [
    { play_id: 1, quarter: 1, offense_nfl_team: 'KC' },
    { play_id: 2, quarter: 1, offense_nfl_team: 'KC' },
    { play_id: 3, quarter: 2, offense_nfl_team: 'NE' },
    { play_id: 4, quarter: 3, offense_nfl_team: 'KC' },
    { play_id: 5, quarter: 3, offense_nfl_team: 'NE' },
    { play_id: 6, quarter: 4, offense_nfl_team: 'KC' }
  ].map((play) => ({
    esbid,
    play_type: 'RUSH',
    drive_sequence: Object.prototype.hasOwnProperty.call(
      drive_seq_by_play_id,
      play.play_id
    )
      ? drive_seq_by_play_id[play.play_id]
      : null,
    ...play
  }))

const half_of = (play) => (play.quarter <= 2 ? 1 : 2)

describe('fixed-drive-enrichment game continuity', function () {
  it('numbers drives continuously across halftime rather than restarting', () => {
    // The defect: the counter reset to zero at halftime, so half 2's first
    // drive was numbered 1 while half 1 had already used 1.
    const enriched = enrich_fixed_drives(two_half_game())

    expect(enriched.map((play) => play.drive_sequence)).to.deep.equal([
      1, 1, 2, 3, 4, 5
    ])
  })

  it('forces a new drive at the start of the second half', () => {
    // KC has the ball on the last play of half 1 and the first play of half 2.
    // Possession did not change, but halftime is a drive boundary, so the
    // lookback must not reach across it.
    const plays = [
      { play_id: 1, quarter: 2, offense_nfl_team: 'KC' },
      { play_id: 2, quarter: 3, offense_nfl_team: 'KC' }
    ].map((play) => ({
      esbid: 1,
      play_type: 'RUSH',
      drive_sequence: null,
      ...play
    }))

    expect(
      enrich_fixed_drives(plays).map((play) => play.drive_sequence)
    ).to.deep.equal([1, 2])
  })

  it('never emits a drive_sequence value that appears in more than one half', () => {
    // This is the invariant scripts/audit-drive-seq-coherence.mjs measures
    // against production, asserted here at the writer.
    const enriched = enrich_fixed_drives(two_half_game())

    const pairs = new Set()
    const triples = new Set()
    for (const play of enriched) {
      pairs.add(`${play.esbid}_${play.drive_sequence}`)
      triples.add(`${play.esbid}_${half_of(play)}_${play.drive_sequence}`)
    }

    expect(triples.size).to.equal(pairs.size)
  })

  it('numbers each game independently when a batch carries several games', () => {
    const enriched = enrich_fixed_drives([
      ...two_half_game({ esbid: 1 }),
      ...two_half_game({ esbid: 2 })
    ])

    for (const esbid of [1, 2]) {
      const game_plays = enriched.filter((play) => play.esbid === esbid)
      expect(game_plays.map((play) => play.drive_sequence)).to.deep.equal([
        1, 1, 2, 3, 4, 5
      ])
    }
  })

  it('leaves a partially populated game entirely untouched', () => {
    // A populated drive_sequence came from NFL or Sportradar, which draw drive
    // boundaries differently. Filling only the gaps splices two numbering
    // authorities into one sequence that is monotonic but meaningless -- the
    // mechanism behind the second corruption class found in production. The
    // nulls must stay null, including the administrative plays that encode
    // "belongs to no drive" that way.
    const plays = two_half_game({
      drive_seq_by_play_id: { 1: 7, 2: 7, 4: 9 }
    })

    const enriched = enrich_fixed_drives(plays)

    expect(enriched.map((play) => play.drive_sequence)).to.deep.equal([
      7,
      7,
      null,
      9,
      null,
      null
    ])
  })

  it('declines only for the game that is already populated', () => {
    const enriched = enrich_fixed_drives([
      ...two_half_game({ esbid: 1, drive_seq_by_play_id: { 1: 7 } }),
      ...two_half_game({ esbid: 2 })
    ])

    const by_esbid = (esbid) =>
      enriched
        .filter((play) => play.esbid === esbid)
        .map((play) => play.drive_sequence)

    expect(by_esbid(1)).to.deep.equal([7, null, null, null, null, null])
    expect(by_esbid(2)).to.deep.equal([1, 1, 2, 3, 4, 5])
  })

  it('does not mutate the plays handed to it', () => {
    const plays = two_half_game()

    enrich_fixed_drives(plays)

    expect(plays.map((play) => play.drive_sequence)).to.deep.equal([
      null,
      null,
      null,
      null,
      null,
      null
    ])
  })
})

describe('import-plays-nfl-v1 live upsert drive_sequence protection', function () {
  // The live worker re-polls the full playlist for an in-progress game every 60
  // seconds and re-upserts every play, and getPlayData always sets the
  // drive_sequence key -- null for a play the NFL feed has not yet tagged. Under a
  // blanket .merge() those nulls overwrite stored values, which turns the
  // all-or-nothing enrichment rule into active data loss rather than a gap.

  // Imported from libs-server rather than from the importer script: that
  // script's transitive graph reaches the private submodule's NGS module (via
  // finalize-game.mjs -> import-nfl-games-ngs.mjs), and CI checks out without
  // submodules, so importing it here passes locally and dies with
  // ERR_MODULE_NOT_FOUND on the runner.
  const load_build_plays_merge = async () => {
    const module = await import('../libs-server/build-plays-merge.mjs')
    return module.build_plays_merge
  }

  const merge_sql = (merge, column) => merge[column].toString()

  it('resolves drive_sequence as a coalesce against the stored value', async () => {
    const build_plays_merge = await load_build_plays_merge()
    const merge = build_plays_merge('nfl_plays', [
      { esbid: 1, play_id: 2, season_year: 2025, drive_sequence: null }
    ])

    expect(merge_sql(merge, 'drive_sequence')).to.equal(
      'coalesce(EXCLUDED."drive_sequence", "nfl_plays"."drive_sequence")'
    )
  })

  it('leaves every other column on blanket-merge semantics', async () => {
    const build_plays_merge = await load_build_plays_merge()
    const merge = build_plays_merge('nfl_plays', [
      { esbid: 1, play_id: 2, drive_sequence: null, drive_yds: 30, quarter: 1 }
    ])

    expect(merge_sql(merge, 'drive_yds')).to.equal('EXCLUDED."drive_yds"')
    expect(merge_sql(merge, 'quarter')).to.equal('EXCLUDED."quarter"')
  })

  it('qualifies the coalesce with the table being written', async () => {
    const build_plays_merge = await load_build_plays_merge()
    const merge = build_plays_merge('nfl_plays_current_week', [
      { esbid: 1, play_id: 2, drive_sequence: null }
    ])

    expect(merge_sql(merge, 'drive_sequence')).to.equal(
      'coalesce(EXCLUDED."drive_sequence", "nfl_plays_current_week"."drive_sequence")'
    )
  })

  it('covers every column present on any row of the batch', async () => {
    const build_plays_merge = await load_build_plays_merge()
    const merge = build_plays_merge('nfl_plays', [
      { esbid: 1, play_id: 2, drive_sequence: 4 },
      { esbid: 1, play_id: 3, drive_sequence: null, is_penalty: true }
    ])

    expect(Object.keys(merge).sort()).to.deep.equal([
      'drive_sequence',
      'esbid',
      'is_penalty',
      'play_id'
    ])
  })

  it('survives a second pass whose batch carries null for a stored value', async () => {
    const build_plays_merge = await load_build_plays_merge()

    // Pass 1: the whole game is untagged, so the enrichment computes drive_sequence
    // for every play and the upsert stores it.
    const first_pass = enrich_fixed_drives(two_half_game())
    const stored = new Map(
      first_pass.map((play) => [play.play_id, play.drive_sequence])
    )
    expect([...stored.values()]).to.deep.equal([1, 1, 2, 3, 4, 5])

    // Pass 2, 60 seconds later: the feed has now tagged two plays, so the
    // enrichment declines for the game and hands the upsert explicit nulls for
    // the rest.
    const second_pass = enrich_fixed_drives(
      two_half_game({ drive_seq_by_play_id: { 1: 7, 2: 7 } })
    )
    expect(second_pass.map((play) => play.drive_sequence)).to.deep.equal([
      7,
      7,
      null,
      null,
      null,
      null
    ])

    // Apply the upsert's own conflict rule rather than a restatement of it: a
    // coalesce on drive_sequence, plain replacement everywhere else.
    const merge = build_plays_merge('nfl_plays', second_pass)
    const coalesces_drive_seq = merge_sql(merge, 'drive_sequence').startsWith(
      'coalesce('
    )

    for (const play of second_pass) {
      const previous = stored.get(play.play_id)
      const written =
        coalesces_drive_seq && play.drive_sequence === null
          ? previous
          : play.drive_sequence
      stored.set(play.play_id, written)
    }

    // No previously-computed value became null. The feed's own values landed.
    expect([...stored.values()]).to.deep.equal([7, 7, 2, 3, 4, 5])
    expect([...stored.values()].some((value) => value === null)).to.equal(false)
  })
})

describe('audit-drive-seq-coherence classification', function () {
  // Real production rows -- the distinct (esbid, quarter, drive_sequence) triples for
  // three games, one of each class, read 2026-07-24. A synthetic fixture cannot
  // distinguish correct game-continuous numbering from a per-half restart that
  // happens to look right over a handful of plays, which is exactly the failure
  // this auditor exists to catch.
  //
  //   2025080751 restart_at_1: half 1 reaches 16, half 2 restarts at 1
  //   2001092311 other:        no restart, but 13 spans the halftime boundary
  //   2025122900 coherent:     one unbroken 1..22 across both halves
  const production_rows = [
    [2001092311, 1, [1, 2, 3, 4, 5]],
    [2001092311, 2, [5, 6, 7, 8, 9, 10, 11, 12, 13]],
    [2001092311, 3, [13, 14, 15, 16]],
    [2001092311, 4, [17, 18, 19, 20, 21, 22, 23, 24, 25]],
    [2025080751, 1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
    [2025080751, 2, [10, 11, 12, 13, 14, 15, 16]],
    [2025080751, 3, [1, 2, 3, 4, 5, 6, 7]],
    [2025080751, 4, [7, 8, 9, 10, 11, 12, 13]],
    [2025122900, 1, [1, 2, 3, 4, 5]],
    [2025122900, 2, [5, 6, 7, 8, 9, 10, 11]],
    [2025122900, 3, [12, 13, 14, 15, 16]],
    [2025122900, 4, [16, 17, 18, 19, 20, 21, 22]]
  ].flatMap(([esbid, quarter, drive_seq_values]) =>
    drive_seq_values.map((drive_sequence) => ({
      esbid,
      quarter,
      drive_sequence
    }))
  )

  // Hoisted into a before hook with its own timeout: the auditor pulls in
  // #libs-server, which takes over a second to load cold. Importing it inside
  // an `it` runs that against mocha's 2000ms default and has intermittently
  // timed out, which would put master red on a slow runner for no defect.
  let classify_drive_seq_coherence

  before(async function () {
    this.timeout(30000)
    ;({ classify_drive_seq_coherence } = await import(
      '../scripts/audit-drive-seq-coherence.mjs'
    ))
  })

  const classify = (rows) => classify_drive_seq_coherence(rows)

  it('separates the two corruption classes and leaves coherent games alone', async () => {
    const { games_checked, violations, violation_counts_by_class } =
      await classify(production_rows)

    expect(games_checked).to.equal(3)
    expect(violation_counts_by_class).to.deep.equal({
      restart_at_1: 1,
      other: 1
    })

    const class_by_esbid = Object.fromEntries(
      violations.map((violation) => [
        violation.esbid,
        violation.violation_class
      ])
    )
    expect(class_by_esbid).to.deep.equal({
      2025080751: 'restart_at_1',
      2001092311: 'other'
    })
  })

  it('does not flag a game merely for a non-contiguous sequence', async () => {
    // Five production games have gaps in their drive_sequence values because plays
    // are missing from the feed, not because numbering broke. Asserting
    // contiguity would leave those permanently red.
    const rows = [
      { esbid: 1, quarter: 1, drive_sequence: 1 },
      { esbid: 1, quarter: 2, drive_sequence: 2 },
      { esbid: 1, quarter: 3, drive_sequence: 9 },
      { esbid: 1, quarter: 4, drive_sequence: 10 }
    ]

    const { violations } = await classify(rows)

    expect(violations).to.deep.equal([])
  })

  it('flags what the enrichment used to emit and clears what it emits now', async () => {
    // Drive the classifier with the writer's own output rather than a
    // hand-built sequence, so the two cannot drift apart.
    const enriched = enrich_fixed_drives(two_half_game())
    const { violations } = await classify(enriched)

    expect(violations).to.deep.equal([])

    // The pre-fix per-half counter, reproduced: each half numbered from 1.
    const per_half_numbered = two_half_game().map((play) => ({
      ...play,
      drive_sequence: half_of(play) === 1 ? play.play_id : play.play_id - 3
    }))
    const { violation_counts_by_class } = await classify(per_half_numbered)

    expect(violation_counts_by_class.restart_at_1).to.equal(1)
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
        is_completion: true,
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
        required_columns.add('quarter')
      }
      if (mapping.special_logic === 'first_touchdown_scorer') {
        // The first-scorer branch reads these directly off the play.
        required_columns.add('is_rushing_play')
        required_columns.add('is_passing_play')
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
