/* global describe before beforeEach after it */
import * as chai from 'chai'

import db from '#db'
import generate_player_snaps_for_week from '../scripts/generate-player-snaps.mjs'

const expect = chai.expect

// This writer had no spec at all until 2026-08-05, and CLAUDE.md cited this
// exact filename as its gate for the whole time it was missing. That is what let
// `6ba0d1d02`'s three nonexistent columns survive: the payload named `year`,
// `opp` and `pos` against `season_year`, `opponent_nfl_team` and
// `player_position`, so every run raised Postgres 42703 at the insert while
// `main()` caught the throw and called `process.exit()` -- exit 0, nothing
// written, 3166 other tests green.
//
// So the point of this file is narrow and it is not about snap arithmetic: it
// has to EXECUTE the insert against a real database. A test that inspects the
// payload object would have passed at the broken revision, because the payload
// was well-formed JavaScript naming columns that do not exist. Only the round
// trip can tell those apart.
describe('SCRIPTS generate-player-snaps', function () {
  this.timeout(30 * 1000)

  const esbid = 2025090700
  const season_year = 2025
  const week = 1
  const season_type = 'REG'
  const offense_nfl_team = 'NE'
  const defense_nfl_team = 'BUF'

  const offense_pid = 'SNAP-OFFN-900001'
  const defense_pid = 'SNAP-DEFN-900002'
  // Populates the SECOND game in the wrong-game block below, so that game has
  // team totals of its own. Unused by every other test in this file.
  const filler_pid = 'SNAP-FILL-900003'
  const offense_gsis_it_id = 990001
  const defense_gsis_it_id = 990002
  const filler_gsis_it_id = 990003

  const player_row = ({
    pid,
    last_name,
    gsis_it_player_id,
    primary_position
  }) => ({
    pid,
    first_name: 'snaps',
    last_name,
    short_name: `s.${last_name}`,
    formatted_name: `snaps ${last_name}`,
    primary_position,
    secondary_position: primary_position,
    current_nfl_team: offense_nfl_team,
    gsis_it_player_id
  })

  // A PASS or a RUSH is what the team-total loop counts as an offensive snap;
  // anything else contributes nothing and the player would be skipped for a
  // missing team total.
  //
  // `quarter` and `down_number` are given DISTINCT distributions on purpose --
  // see the plays table below. Every other field is held at a value that keeps
  // the buckets this file does not assert on stable: yard_line_100 50 (outside all
  // three field-position bands), score_difference 0 (neither leading nor trailing),
  // seconds_remaining_half 900 (outside both clock bands), yards_to_go 10 (neutral_long
  // rather than neutral_short, so the down split is what varies).
  const play_row = ({
    play_id,
    play_type,
    quarter,
    down_number,
    win_probability
  }) => ({
    esbid,
    play_id,
    season_year,
    week,
    updated: new Date(1000),
    offense_nfl_team,
    defense_nfl_team,
    play_type,
    yard_line_100: 50,
    score_difference: 0,
    win_probability,
    is_no_huddle: false,
    seconds_remaining_half: 900,
    yards_to_go: 10,
    down_number,
    quarter
  })

  // The thresholds are read off the script, not guessed: `snaps_neutral` is
  // `win_probability > 0.2 && < 0.8`, `snaps_low_probability` is `< 0.2`, and the
  // early/late down split is that same neutral band plus `down_number <= 2` /
  // `> 2`. NEUTRAL_WP sits inside the band and LOW_WP below it.
  const NEUTRAL_WP = 0.5
  const LOW_WP = 0.1

  // The fixture's whole point. `quarter` and `down_number` must not be
  // interchangeable, or a transposition of the two -- the natural failure of a
  // word-boundary replace across `qtr`/`dwn`/`wp` -- leaves every assertion
  // below green. So the two columns are given distributions of DIFFERENT shape:
  //
  //   quarter      q1 1, q2 1, q3 2, q4 1
  //   down_number  d1 2, d2 1, d3 1, d4 1
  //
  // Read as quarters, the down column would put 2 snaps in q1 and 1 in q3 --
  // the mirror image of the truth. Play 5 is the win-probability play: it is
  // the only one below the neutral band, so it lands in `snaps_low_probability` and in
  // NEITHER down bucket, which is what pins the wp half of the early/late-down
  // predicate rather than just the down half.
  const plays = [
    {
      play_id: 1,
      play_type: 'PASS',
      quarter: 1,
      down_number: 1,
      win_probability: NEUTRAL_WP
    },
    {
      play_id: 2,
      play_type: 'RUSH',
      quarter: 2,
      down_number: 1,
      win_probability: NEUTRAL_WP
    },
    {
      play_id: 3,
      play_type: 'PASS',
      quarter: 3,
      down_number: 2,
      win_probability: NEUTRAL_WP
    },
    {
      play_id: 4,
      play_type: 'PASS',
      quarter: 3,
      down_number: 3,
      win_probability: NEUTRAL_WP
    },
    {
      play_id: 5,
      play_type: 'RUSH',
      quarter: 4,
      down_number: 4,
      win_probability: LOW_WP
    }
  ]

  // The defender takes his snaps on plays 2 and 4 -- quarters 2 and 3 against
  // downs 1 and 3, so the defensive quarter columns are transposition-sensitive
  // for the same reason the offensive ones are.
  const defense_play_ids = [2, 4]

  // The gamelog is both an INPUT and the write target: the script joins it to
  // read opponent and position, then upserts the snap counts back onto the same
  // row via onConflict(['esbid', 'pid', 'season_year']).
  // `nfl_team` decides which side of each play the player is credited on -- the
  // script looks up its team totals by it -- so the defender needs his own team
  // here, not the offense's.
  const gamelog_row = ({ pid, player_position, nfl_team }) => ({
    esbid,
    pid,
    season_year,
    nfl_team,
    opponent_nfl_team:
      nfl_team === offense_nfl_team ? defense_nfl_team : offense_nfl_team,
    player_position
  })

  const run = () =>
    generate_player_snaps_for_week({
      season_year,
      week,
      season_type,
      dry_run: false
    })

  before(async () => {
    await db('player')
      .insert([
        player_row({
          pid: offense_pid,
          last_name: 'offense',
          gsis_it_player_id: offense_gsis_it_id,
          primary_position: 'WR'
        }),
        player_row({
          pid: defense_pid,
          last_name: 'defense',
          gsis_it_player_id: defense_gsis_it_id,
          primary_position: 'LB'
        }),
        player_row({
          pid: filler_pid,
          last_name: 'filler',
          gsis_it_player_id: filler_gsis_it_id,
          primary_position: 'WR'
        })
      ])
      .onConflict('pid')
      .ignore()
  })

  beforeEach(async () => {
    await db('nfl_snaps').where({ esbid }).del()
    await db('nfl_plays').where({ esbid }).del()
    await db('player_gamelogs').where({ esbid }).del()
    await db('nfl_games').where({ esbid }).del()

    await db('nfl_games').insert({
      esbid,
      season_year,
      week,
      season_type,
      home_nfl_team: offense_nfl_team,
      away_nfl_team: defense_nfl_team
    })

    await db('nfl_plays').insert(plays.map(play_row))

    await db('nfl_snaps').insert([
      ...plays.map(({ play_id }) => ({
        esbid,
        play_id,
        gsis_it_player_id: offense_gsis_it_id,
        season_year
      })),
      ...defense_play_ids.map((play_id) => ({
        esbid,
        play_id,
        gsis_it_player_id: defense_gsis_it_id,
        season_year
      }))
    ])

    await db('player_gamelogs').insert([
      gamelog_row({
        pid: offense_pid,
        player_position: 'WR',
        nfl_team: offense_nfl_team
      }),
      gamelog_row({
        pid: defense_pid,
        player_position: 'LB',
        nfl_team: defense_nfl_team
      })
    ])
  })

  // Mocha loads every spec into one process and `db/fixtures/league.mjs` does
  // not reset these tables, so rows left here outlive this file and land in
  // whichever spec runs next -- as a scatter of failures nowhere near the cause.
  after(async () => {
    await db('nfl_snaps').where({ esbid }).del()
    await db('nfl_plays').where({ esbid }).del()
    await db('player_gamelogs').where({ esbid }).del()
    await db('nfl_games').where({ esbid }).del()
    await db('player')
      .whereIn('pid', [offense_pid, defense_pid, filler_pid])
      .del()
  })

  it('executes its insert against the database', async () => {
    // The whole regression in one assertion. At `6ba0d1d02~1` this rejects with
    // 42703 `column "year" of relation "player_gamelogs" does not exist` before
    // any value is checked, which is exactly what production did nightly.
    await run()

    const row = await db('player_gamelogs')
      .where({ esbid, pid: offense_pid, season_year })
      .first()

    expect(row).to.not.equal(undefined)
    expect(row.snaps_offense).to.equal(plays.length)
  })

  it('writes the conformed column names, not their pre-rename spellings', async () => {
    await run()

    const row = await db('player_gamelogs')
      .where({ esbid, pid: offense_pid, season_year })
      .first()

    // `opp` was doubly dead: the source query selects `opponent_nfl_team` with
    // no alias, so the destructured `opp` was `undefined` and would have been
    // bound as DEFAULT even if the column name had resolved. Asserting the VALUE
    // rather than the key's presence is what catches that half.
    expect(row.season_year).to.equal(season_year)
    expect(row.opponent_nfl_team).to.equal(defense_nfl_team)
    expect(row.player_position).to.equal('WR')
  })

  it('counts defensive snaps for a player on the other side of the play', async () => {
    await run()

    const row = await db('player_gamelogs')
      .where({ esbid, pid: defense_pid, season_year })
      .first()

    expect(row).to.not.equal(undefined)
    expect(row.snaps_defense).to.equal(defense_play_ids.length)
  })

  // The three tests below are the ones the fixture above was widened for. Until
  // 2026-08-06 this file asserted on no column derived from `quarter`,
  // `down_number` or `win_probability`, and set the first two identically on
  // every play -- so transposing the two in the script left it 4/4 green. Each
  // of these is proven red under that transposition.
  it('counts offensive snaps into the quarter the play was in', async () => {
    await run()

    const row = await db('player_gamelogs')
      .where({ esbid, pid: offense_pid, season_year })
      .first()

    // The computed key `q${quarter}_off` is the specific thing worth pinning:
    // it is built by template literal from a renamed variable, so neither a
    // grep for the old name nor a column-existence check can reach it.
    expect(row.quarter_1_snaps_offense).to.equal(1)
    expect(row.quarter_2_snaps_offense).to.equal(1)
    expect(row.quarter_3_snaps_offense).to.equal(2)
    expect(row.quarter_4_snaps_offense).to.equal(1)
  })

  it('counts defensive snaps into the quarter the play was in', async () => {
    await run()

    const row = await db('player_gamelogs')
      .where({ esbid, pid: defense_pid, season_year })
      .first()

    expect(row.quarter_1_snaps_defense).to.equal(0)
    expect(row.quarter_2_snaps_defense).to.equal(1)
    expect(row.quarter_3_snaps_defense).to.equal(1)
    expect(row.quarter_4_snaps_defense).to.equal(0)
  })

  // Added 2026-08-15 with the pct -> percentage conform. Every assertion above
  // reads a COUNT column, so all 27 percentage columns on this table were
  // invisible to this file and the rename could not have failed it. The share
  // columns are a separate payload half -- a rename that moved the counts and
  // dropped the shares would still have been 8/8 green.
  //
  // The oracle is SHAPE rather than a single value. The offensive player is the
  // only one on his side, so his shares are all 1 by construction and prove
  // presence but not placement; the discriminating row is the DEFENDER. Every
  // offensive play is a defensive snap for the opponent, so his denominators are
  // the same q1 1 / q2 1 / q3 2 / q4 1 distribution the counts use, while he
  // played only plays 2 and 4 -- giving quarter shares of 0, 1, 0.5, 0. Those
  // four values are pairwise distinguishable, so a payload that wrote the wrong
  // quarter's share fails here rather than agreeing with itself.
  it('writes snap SHARE columns beside the counts', async () => {
    await run()

    const offense = await db('player_gamelogs')
      .where({ esbid, pid: offense_pid, season_year })
      .first()

    // Sole offensive player: his share of every offensive bucket is the whole.
    expect(Number(offense.snaps_offense_percentage)).to.equal(1)
    expect(Number(offense.quarter_1_snaps_offense_percentage)).to.equal(1)
    expect(Number(offense.quarter_2_snaps_offense_percentage)).to.equal(1)
    expect(Number(offense.quarter_3_snaps_offense_percentage)).to.equal(1)
    expect(Number(offense.quarter_4_snaps_offense_percentage)).to.equal(1)
    // He took no defensive snap, but the defense HAS a total, so this is a real
    // zero rather than the null a missing denominator produces.
    expect(Number(offense.snaps_defense_percentage)).to.equal(0)

    const defense = await db('player_gamelogs')
      .where({ esbid, pid: defense_pid, season_year })
      .first()

    // Two of the five defensive snaps.
    expect(Number(defense.snaps_defense_percentage)).to.equal(0.4)
    expect(Number(defense.quarter_1_snaps_defense_percentage)).to.equal(0)
    expect(Number(defense.quarter_2_snaps_defense_percentage)).to.equal(1)
    // The one value that separates a correct quarter mapping from a plausible
    // wrong one: q3 is the only quarter with two team snaps.
    expect(Number(defense.quarter_3_snaps_defense_percentage)).to.equal(0.5)
    expect(Number(defense.quarter_4_snaps_defense_percentage)).to.equal(0)
  })

  it('splits neutral snaps on down and counts the low win-probability play', async () => {
    await run()

    const row = await db('player_gamelogs')
      .where({ esbid, pid: offense_pid, season_year })
      .first()

    // Play 5 is below the neutral band, so it is in neither down bucket -- the
    // two counts sum to 4, not to all 5 offensive snaps.
    expect(row.snaps_neutral).to.equal(4)
    expect(row.snaps_neutral_early_down).to.equal(3)
    expect(row.snaps_neutral_late_down).to.equal(1)
    expect(row.snaps_low_probability).to.equal(1)
  })

  it('merges onto an existing gamelog rather than failing its conflict target', async () => {
    // onConflict is a column reference that does not look like one, and it was
    // fixed separately from the payload in `972690b57` -- a partial fix whose
    // commit message read as complete. Running twice is what exercises the
    // UPDATE half; a single run only ever proves the INSERT half resolves.
    await db('player_gamelogs')
      .where({ esbid, pid: offense_pid, season_year })
      .update({ targets: 7 })

    await run()
    await run()

    const rows = await db('player_gamelogs').where({
      esbid,
      pid: offense_pid,
      season_year
    })

    expect(rows).to.have.length(1)
    expect(rows[0].snaps_offense).to.equal(plays.length)
    // A column the writer does not name must survive the merge.
    expect(rows[0].targets).to.equal(7)
  })

  describe('a player with snaps in one game and a gamelog in ANOTHER', function () {
    // The measured production defect, end to end. Until 2026-09-03 this writer
    // looked the gamelog up by player across the WHOLE week, so a player whose
    // gamelog sat in a different game of the same week got a brand new row at
    // the snap's esbid carrying the other game's opponent and NO team -- the
    // insert never named nfl_team, so the row took the column DEFAULT of '' on
    // a NOT NULL column.
    //
    // It happened twice, to pid CALE-JOHN-027832 in 2024 preseason, and those
    // two rows were the only findings the team-abbreviation conformance check
    // reported. Asserting the ABSENCE of a row is the whole point here: the
    // defect's signature is a row that should not exist.
    const other_esbid = 2025090701
    const other_nfl_team = 'MIA'
    const third_nfl_team = 'NYJ'

    beforeEach(async () => {
      await db('nfl_snaps').where({ esbid: other_esbid }).del()
      await db('nfl_plays').where({ esbid: other_esbid }).del()
      await db('player_gamelogs').where({ esbid: other_esbid }).del()
      await db('nfl_games').where({ esbid: other_esbid }).del()

      await db('nfl_games').insert({
        esbid: other_esbid,
        season_year,
        week,
        season_type,
        home_nfl_team: other_nfl_team,
        away_nfl_team: third_nfl_team
      })

      // The other game needs PLAYS AND SNAPS of its own, and this is the part
      // that makes the case reproduce at all. The script looks its team totals
      // up by the gamelog's team and skips the player when there are none -- so
      // an empty other game makes the writer skip for the WRONG reason and every
      // assertion below passes under the defect too. In production the other
      // game was a real one whose team had snaps that week, and that is what let
      // the bad row through. Verified by control: with these rows absent, the
      // pre-fix pairing leaves this whole block green.
      await db('nfl_plays').insert(
        plays.map((play) => ({
          ...play_row(play),
          esbid: other_esbid,
          offense_nfl_team: other_nfl_team,
          defense_nfl_team: third_nfl_team
        }))
      )

      await db('nfl_snaps').insert(
        plays.map(({ play_id }) => ({
          esbid: other_esbid,
          play_id,
          gsis_it_player_id: filler_gsis_it_id,
          season_year
        }))
      )

      // The filler's own gamelog, so he is written rather than skipped and the
      // other game's team totals are reached the same way the real one's are.
      await db('player_gamelogs').insert({
        esbid: other_esbid,
        pid: filler_pid,
        season_year,
        nfl_team: other_nfl_team,
        opponent_nfl_team: third_nfl_team,
        player_position: 'WR'
      })

      // The offense player's ONLY gamelog this week now sits in the other game.
      // His snaps stay in `esbid`, exactly as the production case had it.
      await db('player_gamelogs').where({ esbid, pid: offense_pid }).del()
      await db('player_gamelogs').insert({
        esbid: other_esbid,
        pid: offense_pid,
        season_year,
        nfl_team: other_nfl_team,
        opponent_nfl_team: third_nfl_team,
        player_position: 'WR'
      })
    })

    after(async () => {
      await db('nfl_snaps').where({ esbid: other_esbid }).del()
      await db('nfl_plays').where({ esbid: other_esbid }).del()
      await db('player_gamelogs').where({ esbid: other_esbid }).del()
      await db('nfl_games').where({ esbid: other_esbid }).del()
    })

    it('writes NO row at the snap game rather than one with an empty team', async () => {
      await run()

      const row = await db('player_gamelogs')
        .where({ esbid, pid: offense_pid, season_year })
        .first()

      expect(
        row,
        'a row was minted at the snap game from another game gamelog'
      ).to.equal(undefined)
    })

    it('leaves the gamelog in the OTHER game untouched', async () => {
      await run()

      const row = await db('player_gamelogs')
        .where({ esbid: other_esbid, pid: offense_pid, season_year })
        .first()

      // The green above is worthless if the run did nothing at all, so this
      // pairs it: the other row must still be intact and unstamped with snaps
      // from a game it does not belong to.
      expect(row).to.not.equal(undefined)
      expect(row.nfl_team).to.equal(other_nfl_team)
      expect(row.snaps_offense).to.equal(null)
    })

    it('still writes the defense player, whose gamelog IS in the snap game', async () => {
      await run()

      // The discriminator. Without it, a writer that had simply stopped writing
      // anything would pass both assertions above.
      const row = await db('player_gamelogs')
        .where({ esbid, pid: defense_pid, season_year })
        .first()

      expect(row).to.not.equal(undefined)
      expect(row.snaps_defense).to.equal(defense_play_ids.length)
      expect(row.nfl_team).to.equal(defense_nfl_team)
    })
  })
})
