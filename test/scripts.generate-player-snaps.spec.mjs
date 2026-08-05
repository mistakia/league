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
  const offense_gsis_it_id = 990001
  const defense_gsis_it_id = 990002

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
  const play_row = (play_id, play_type) => ({
    esbid,
    play_id,
    season_year,
    week,
    updated: 1,
    offense_nfl_team,
    defense_nfl_team,
    play_type,
    ydl_100: 50,
    score_diff: 0,
    win_probability: 0.5,
    is_no_huddle: false,
    sec_rem_half: 900,
    yards_to_go: 10,
    down_number: 1,
    quarter: 1
  })

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
      year: season_year,
      week,
      seas_type: season_type,
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

    await db('nfl_plays').insert([
      play_row(1, 'PASS'),
      play_row(2, 'RUSH'),
      play_row(3, 'PASS')
    ])

    await db('nfl_snaps').insert([
      { esbid, play_id: 1, gsis_it_id: offense_gsis_it_id, season_year },
      { esbid, play_id: 2, gsis_it_id: offense_gsis_it_id, season_year },
      { esbid, play_id: 1, gsis_it_id: defense_gsis_it_id, season_year }
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
    await db('player').whereIn('pid', [offense_pid, defense_pid]).del()
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
    expect(row.snaps_off).to.equal(2)
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
    expect(row.snaps_def).to.equal(1)
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
    expect(rows[0].snaps_off).to.equal(2)
    // A column the writer does not name must survive the merge.
    expect(rows[0].targets).to.equal(7)
  })
})
