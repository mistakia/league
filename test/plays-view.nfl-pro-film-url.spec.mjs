/* global describe before after it */
import * as chai from 'chai'

import db from '#db'
import { nfl_pro_film_url_sql } from '#libs-server/plays-view/nfl-pro-film-url.mjs'
import plays_view_column_definitions from '#libs-server/plays-view/column-definitions/index.mjs'
import get_plays_view_results from '#libs-server/plays-view/get-plays-view-results.mjs'
import { plays_view_columns } from '#libs-shared'

const expect = chai.expect

/*
  Coverage for the NFL Pro coaches-film deep link on the plays view.

  The URL is assembled in SQL, and every part of that assembly is a rule that was
  measured against the live film room rather than reasoned out -- the clock
  comes from the play description and not from game_clock_start, minutes are
  zero-padded, playType is sent for every play with sacks routed separately, and
  the whole thing is NULL before the 2022 season. A change to any of them produces a URL that still
  looks like a URL and quietly resolves to the wrong play, or to no play, which
  is exactly the failure no reader would notice in a table cell.

  `gameId` is the SHIELD UUID and not the esbid, which is the one rule here that
  a reasonable reader will try to simplify away. The film-room API accepts the
  esbid; the PAGE resolves the value against its own game list, finds nothing,
  drops the parameter, and serves a playlist spanning the whole week. Asserting
  the UUID is what stops that from coming back.

  Every case therefore asserts the resolved STRING, not the shape of the
  expression. Cases are seeded rather than read from production rows so the
  boundary cases -- a single-digit minute, a kickoff with no clock prefix, a
  playoff week slug -- are present at all; production has them but no query can
  promise it sampled one.
*/

// Outside every seeded fixture's range, so these rows cannot collide with
// another spec's and a leftover cannot be mistaken for one.
const esbid = 99000401

// The value the URL must carry, and it comes off nfl_games rather than
// nfl_plays -- deliberately unlike the esbid so a regression to the esbid fails
// here rather than passing on a value that happens to match.
const shield_game_id = 'f5919910-311e-11f0-b670-ae1250fadad1'

const seed_game = async ({
  season_year = 2025,
  season_type = 'REG',
  week = 1
}) =>
  db('nfl_games').insert({
    esbid,
    season_year,
    season_type,
    week,
    away_nfl_team: 'CIN',
    home_nfl_team: 'CLE',
    shield_game_id
  })

const seed_play = async ({
  play_id,
  season_year = 2025,
  season_type = 'REG',
  week = 1,
  quarter = 1,
  play_type = 'PASS',
  is_sack = null,
  down_number = 1,
  yards_to_go = null,
  game_clock_start = null,
  play_description = null,
  is_touchdown = null,
  is_completion = null,
  is_interception = null,
  offense_nfl_team = null,
  passer_gsis_player_id = null,
  target_gsis_player_id = null,
  ball_carrier_gsis_player_id = null
}) =>
  db('nfl_plays').insert({
    esbid,
    play_id,
    season_year,
    season_type,
    week,
    quarter,
    play_type,
    is_sack,
    down_number,
    yards_to_go,
    game_clock_start,
    play_description,
    is_touchdown,
    is_completion,
    is_interception,
    offense_nfl_team,
    passer_gsis_player_id,
    target_gsis_player_id,
    ball_carrier_gsis_player_id,
    updated: new Date()
  })

// The player rows the film link resolves its passerId, targetId and rusherId
// through. `gsis_it_player_id` is the id NFL Pro's filters match on;
// `nfl_player_id` is the well-formed integer that silently matches nothing, and
// it is seeded here deliberately so a regression to it fails on a value that is
// present rather than on a null.
const players = [
  {
    pid: 'FILM-PASS-999001',
    gsis_player_id: '00-0099001',
    gsis_it_player_id: 990001,
    nfl_player_id: 9990001,
    first_name: 'Film',
    last_name: 'Passer'
  },
  {
    pid: 'FILM-TARG-999002',
    gsis_player_id: '00-0099002',
    gsis_it_player_id: 990002,
    nfl_player_id: 9990002,
    first_name: 'Film',
    last_name: 'Target'
  },
  {
    pid: 'FILM-RUSH-999003',
    gsis_player_id: '00-0099003',
    gsis_it_player_id: 990003,
    nfl_player_id: 9990003,
    first_name: 'Film',
    last_name: 'Rusher'
  }
]

const seed_players = async () =>
  db('player')
    .insert(
      players.map((p) => ({
        ...p,
        short_name: `${p.first_name[0]}.${p.last_name}`,
        formatted_name: `${p.first_name} ${p.last_name}`.toLowerCase(),
        primary_position: 'QB',
        secondary_position: 'QB'
      }))
    )
    .onConflict('pid')
    .ignore()

// The joins are part of the contract: the expression reads nfl_games and three
// role-aliased copies of player, so every caller has to supply all four.
// `join_play_film_url` does this in the plays-view overrides; here they are
// spelled out so a missing join fails loudly rather than silently reading a
// column from the wrong place.
//
// The player joins key on the GSIS id and NOT on the pid columns. Those two
// paths disagree on roughly half a percent of production plays, and the GSIS
// path is the one the film-room filters were measured against.
const film_url_query = () =>
  db('nfl_plays')
    .leftJoin('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
    .leftJoin(
      'player as film_passer',
      'nfl_plays.passer_gsis_player_id',
      'film_passer.gsis_player_id'
    )
    .leftJoin(
      'player as film_target',
      'nfl_plays.target_gsis_player_id',
      'film_target.gsis_player_id'
    )
    .leftJoin(
      'player as film_rusher',
      'nfl_plays.ball_carrier_gsis_player_id',
      'film_rusher.gsis_player_id'
    )
    .select(nfl_pro_film_url_sql({ alias: 'play_film_url' }))

const film_url = async (play_id) => {
  const [row] = await film_url_query().where({
    'nfl_plays.esbid': esbid,
    play_id
  })
  return row.play_film_url
}

const clear = async () => {
  await db('nfl_plays').where({ esbid }).del()
  await db('nfl_games').where({ esbid }).del()
  await db('player')
    .whereIn(
      'pid',
      players.map((p) => p.pid)
    )
    .del()
}

describe('plays view / nfl pro film url', function () {
  this.timeout(30000)

  before(async () => {
    await clear()
    await seed_game({})
    await seed_players()
  })
  after(clear)

  describe('registration', function () {
    it('is defined on the server and described for the client', function () {
      expect(plays_view_column_definitions.play_film_url).to.be.an('object')
      expect(plays_view_columns.play_film_url.description).to.be.a('string')
    })

    it('carries no bind parameters', function () {
      // Two separate failures live here. A literal `?` in the SQL -- the one
      // that opens the query string -- is read by knex as a placeholder and
      // throws `Expected 0 bindings, saw 1` when the query is built. Passing the
      // URL as a binding instead moves the failure to the sort path below, where
      // it is quieter. Neither is possible while this stays empty.
      const { bindings } = nfl_pro_film_url_sql().toSQL()
      expect(bindings).to.be.empty
    })

    it('is a usable ORDER BY column through the plays view', async function () {
      // The select path and the sort path consume this expression differently.
      // A binding-carrying version selects fine and then dies at ORDER BY with
      // `could not determine data type of parameter`, because the plays view
      // interpolates the sort column into orderByRaw while knex still owns the
      // placeholder. Only a run through get_plays_view_results sees that --
      // calling .toString() on the expression here would resolve the binding and
      // report green against the very shape this guards.
      await seed_play({
        play_id: 150,
        play_description: '(09:00) pass short left.'
      })

      const { plays_view_results } = await get_plays_view_results({
        columns: ['play_desc', 'play_film_url'],
        where: [{ column_id: 'play_esbid', operator: '=', value: esbid }],
        sort: [{ column_id: 'play_film_url', desc: false }],
        limit: 5
      })

      expect(plays_view_results).to.not.be.empty
      expect(plays_view_results[0].play_film_url).to.include(
        'https://pro.nfl.com/film/plays?season='
      )
    })
  })

  describe('the clock', function () {
    it('takes the clock from the play description, not game_clock_start', async function () {
      // These two disagree on nearly every snapped play: game_clock_start is the
      // snap clock and the film feed indexes on the description's clock. Using
      // the column drops the exact-hit rate from 96% to 65%.
      await seed_play({
        play_id: 100,
        game_clock_start: '14:19',
        play_description: '(14:22) (Shotgun) K.Turpin right end to PHI 42.'
      })

      const url = await film_url(100)
      expect(url).to.include('gameClock=14:22')
      expect(url).to.not.include('14:19')
    })

    it('zero-pads a single-digit minute', async function () {
      // `3:01` returns zero plays from the film API; `03:01` returns the play.
      await seed_play({
        play_id: 101,
        game_clock_start: '03:01',
        play_description: '(3:01) (Shotgun) D.Prescott pass short left.'
      })

      expect(await film_url(101)).to.include('gameClock=03:01')
    })

    it('reads a sub-minute prefix, which carries no minutes at all', async function () {
      // Under a minute the description reads `(:52)`, not `(0:52)`. Requiring a
      // leading digit did not merely mis-clock those plays -- it failed the
      // filmable gate, so they got no link and never entered the denominator of
      // any accuracy figure. That silently excluded 9.5% of prefixed plays.
      await seed_play({
        play_id: 103,
        yards_to_go: 10,
        play_description:
          '(:52) (Shotgun) J.Winston pass deep middle to C.Olave.'
      })

      expect(await film_url(103)).to.include('gameClock=00:52')
    })

    it('falls back to game_clock_start when the description has no prefix', async function () {
      await seed_play({
        play_id: 102,
        play_type: 'KOFF',
        game_clock_start: '15:00',
        play_description: 'J.Elliott kicks 60 yards from PHI 35 to DAL 5.'
      })

      expect(await film_url(102)).to.include('gameClock=15:00')
    })
  })

  describe('playType', function () {
    it('is sent for a scrimmage play too', async function () {
      // What collides on a clock is usually a play of a different type -- the
      // kickoff or extra point NFL Pro stamps with the same clock, which sorts
      // first and wins. Restricting playType to special teams left 31 of 595
      // plays opening the wrong clip; sending it everywhere left 4.
      await seed_play({
        play_id: 110,
        play_type: 'RUSH',
        play_description: '(14:54) J.Williams left tackle to PHI 46.'
      })

      expect(await film_url(110)).to.include('playType=play_type_rush')
    })

    it('routes a sack to its own filter value rather than to pass', async function () {
      // A sack is a PASS in our play_type and play_type_sack in theirs. Sending
      // play_type_pass for one is the single way this parameter returns an empty
      // list instead of the play.
      await seed_play({
        play_id: 113,
        play_type: 'PASS',
        is_sack: true,
        play_description: '(08:00) J.Hurts sacked at PHI 20 for -7 yards.'
      })
      await seed_play({
        play_id: 114,
        play_type: 'PASS',
        play_description: '(07:00) J.Hurts pass short left to D.Goedert.'
      })

      expect(await film_url(113)).to.include('playType=play_type_sack')
      expect(await film_url(114)).to.include('playType=play_type_pass')
    })

    it('types a penalty no-play as unknown, which the filter UI never offers', async function () {
      // NFL Pro's dropdown has eight play types and this is not one of them; the
      // API honours it anyway. Without it a wiped snap cannot be told from the
      // kickoff sharing its clock.
      await seed_play({
        play_id: 115,
        play_type: 'NOPL',
        play_description:
          '(11:56) (Shotgun) D.Prescott pass incomplete short right. PENALTY on PHI, DPI.'
      })

      expect(await film_url(115)).to.include('playType=play_type_unknown')
    })

    it('types a wiped special-teams snap by what the description says', async function () {
      // A no-play is only `unknown` when the snap it wiped was from scrimmage.
      // NFL Pro types a penalised punt as play_type_punt, so sending unknown for
      // one returns an empty list -- the single dead link left in the holdout
      // after the clock bugs were fixed.
      await seed_play({
        play_id: 116,
        play_type: 'NOPL',
        yards_to_go: 13,
        play_description:
          '(2:50) J.Fox punts 52 yards to MIN 7, Center-J.McQuaide. PENALTY on MIN.'
      })

      expect(await film_url(116)).to.include('playType=play_type_punt')
    })

    it('splits FGXP into the extra point and field goal filters', async function () {
      // An extra point shares its clock with the kickoff that follows it, which
      // is the collision playType exists to break.
      await seed_play({
        play_id: 111,
        play_type: 'FGXP',
        game_clock_start: '11:49',
        play_description: 'B.Aubrey extra point is GOOD, Center-T.Sieg.'
      })
      await seed_play({
        play_id: 112,
        play_type: 'FGXP',
        game_clock_start: '02:00',
        play_description: 'B.Aubrey 42 yard field goal is GOOD, Center-T.Sieg.'
      })

      expect(await film_url(111)).to.include('playType=play_type_xp')
      expect(await film_url(112)).to.include('playType=play_type_field_goal')
    })
  })

  describe('yards to go', function () {
    it('buckets distance into the API own three bands', async function () {
      // Not even thirds: SHORT is 1-2, MID is 3-6, LONG is 7 and up. This is the
      // tiebreaker for a penalty enforced at the same clock and type as the play
      // after it -- 4th & 2 and 4th & 7 are both punts at 7:12.
      for (const [play_id, yards_to_go, band] of [
        [160, 2, 'SHORT'],
        [161, 6, 'MID'],
        [162, 7, 'LONG']
      ]) {
        await seed_play({
          play_id,
          yards_to_go,
          play_description: `(10:00) pass short left for ${yards_to_go}.`
        })
        expect(await film_url(play_id)).to.include(`yardsToGoType=${band}`)
      }
    })

    it('omits the band on an onside kick, which we record as 1st & 10', async function () {
      // The real row that produced the corpus's only dead link. NFL Pro reports
      // distance 0 on every kick; we record an onside kick as 1st & 10 because
      // the kicking team can recover it. So neither `yards_to_go > 0` nor a down
      // of 1-4 excludes it, and both were tried -- the gate has to name the play
      // types run from scrimmage.
      await seed_play({
        play_id: 163,
        play_type: 'KOFF',
        down_number: 1,
        yards_to_go: 10,
        game_clock_start: '02:53',
        play_description:
          'M.Gay kicks onside 12 yards from WAS 40 to GB 48. D.Wicks to GB 48 for no gain.'
      })

      expect(await film_url(163)).to.not.include('yardsToGoType')
    })
  })

  describe('week slug', function () {
    it('renders the regular season as WEEK_n', async function () {
      await seed_play({
        play_id: 120,
        week: 12,
        play_description: '(10:00) pass short left.'
      })

      expect(await film_url(120)).to.include('weekSlug=WEEK_12')
    })

    it('renders the postseason round rather than its week number', async function () {
      await seed_play({
        play_id: 121,
        season_type: 'POST',
        week: 3,
        play_description: '(10:00) pass short left.'
      })

      expect(await film_url(121)).to.include('weekSlug=CONF')
    })

    it('renders the preseason as Pn', async function () {
      await seed_play({
        play_id: 122,
        season_type: 'PRE',
        week: 2,
        play_description: '(10:00) pass short left.'
      })

      expect(await film_url(122)).to.include('weekSlug=P2')
    })
  })

  describe('rows that get no link', function () {
    it('returns null before film coverage begins', async function () {
      await seed_play({
        play_id: 130,
        season_year: 2021,
        play_description: '(10:00) pass short left.'
      })

      expect(await film_url(130)).to.equal(null)
    })

    it('returns null when play_type is NULL rather than falling through', async function () {
      // Three-valued logic, and it turned the guard into a pass-through. With a
      // NULL play_type, `play_type in (...)` is NULL, so the whole filmable test
      // is NULL, `not NULL` is NULL, and a CASE arm whose condition is NULL is
      // not taken -- the expression reached its ELSE and built a URL for exactly
      // the rows the guard exists to reject. 13 of these shipped into a holdout.
      await seed_play({
        play_id: 132,
        play_type: null,
        game_clock_start: '10:00',
        play_description: ''
      })

      expect(await film_url(132)).to.equal(null)
    })

    it('returns null when game_clock_start is an empty string', async function () {
      // An empty string is not a missing value to Postgres: it survives every
      // `is null` guard, and lpad(split_part('', ':', 1), 2, '0') then yields
      // '00', producing a live-looking URL ending in `gameClock=00:`.
      await seed_play({
        play_id: 133,
        play_type: 'KOFF',
        game_clock_start: '',
        play_description: ''
      })

      expect(await film_url(133)).to.equal(null)
    })

    it('returns null for a row that is not a play that was run', async function () {
      // A timeout carries a clock, so without this gate it would link to
      // whichever play happened to share that second.
      await seed_play({
        play_id: 131,
        play_type: 'NOPL',
        game_clock_start: '11:49',
        play_description: 'Timeout at 11:49.'
      })

      expect(await film_url(131)).to.equal(null)
    })
  })

  it('assembles every parameter the film room needs', async function () {
    await seed_play({
      play_id: 140,
      quarter: 3,
      week: 5,
      yards_to_go: 5,
      play_description: '(07:23) S.Barkley left tackle to DAL 3.'
    })

    const url = new URL(await film_url(140))
    expect(url.origin + url.pathname).to.equal('https://pro.nfl.com/film/plays')
    expect(Object.fromEntries(url.searchParams)).to.deep.equal({
      season: '2025',
      seasonType: 'REG',
      weekSlug: 'WEEK_5',
      gameId: shield_game_id,
      quarter: '3',
      gameClock: '07:23',
      playType: 'play_type_pass',
      yardsToGoType: 'MID',
      down: '1'
    })
  })

  describe('the game', function () {
    it('sends the shield uuid rather than the esbid', async function () {
      // The whole defect this file was rewritten for. The esbid resolves against
      // no option in the page's game list, so the page silently drops gameId and
      // serves the entire week's playlist -- a wrong GAME, not a wrong play.
      await seed_play({
        play_id: 170,
        play_description: '(10:00) pass short left.'
      })

      const url = await film_url(170)
      expect(url).to.include(`gameId=${shield_game_id}`)
      expect(url).to.not.include(String(esbid))
    })

    it('returns null when the game carries no shield id', async function () {
      // A link with no game in it is the failure mode being fixed, so a game we
      // cannot identify earns no link at all.
      const other_esbid = 99000402
      await db('nfl_games').insert({
        esbid: other_esbid,
        season_year: 2025,
        season_type: 'REG',
        week: 1,
        away_nfl_team: 'DAL',
        home_nfl_team: 'PHI'
      })
      await db('nfl_plays').insert({
        esbid: other_esbid,
        play_id: 171,
        season_year: 2025,
        season_type: 'REG',
        week: 1,
        quarter: 1,
        play_type: 'PASS',
        play_description: '(10:00) pass short left.',
        updated: new Date()
      })

      const [row] = await film_url_query().where({
        'nfl_plays.esbid': other_esbid,
        play_id: 171
      })

      expect(row.play_film_url).to.equal(null)

      await db('nfl_plays').where({ esbid: other_esbid }).del()
      await db('nfl_games').where({ esbid: other_esbid }).del()
    })
  })

  describe('down', function () {
    it('sends the down on a play run from scrimmage', async function () {
      await seed_play({
        play_id: 180,
        down_number: 3,
        yards_to_go: 8,
        play_description: '(10:00) (Shotgun) pass deep middle.'
      })

      expect(await film_url(180)).to.include('down=3')
    })

    it('omits the down on a kick, which NFL Pro records without one', async function () {
      // Same gate as yardsToGoType and for the same reason: an onside kick is
      // recorded here as 1st & 10, and a down on a kick matches nothing.
      await seed_play({
        play_id: 181,
        play_type: 'KOFF',
        down_number: 1,
        yards_to_go: 10,
        game_clock_start: '15:00',
        play_description: 'J.Elliott kicks 60 yards from PHI 35 to DAL 5.'
      })

      expect(await film_url(181)).to.not.include('down=')
    })
  })

  describe('the outcome filters', function () {
    it('serialises a boolean as 1 and never as true', async function () {
      // The single sharpest trap on this surface. The page writes its OWN
      // filters as `touchdown=true` into the address bar, and that exact string
      // fed back in on a cold load trips the filter panel's `clearAll`, which
      // nulls every key except season, seasonType, weekSlug and gameId. A bad
      // value does not cost its own key, it costs the WHOLE query.
      await seed_play({
        play_id: 200,
        play_type: 'RUSH',
        is_touchdown: true,
        play_description: '(08:00) J.Mixon right guard for 3 yards, TOUCHDOWN.'
      })

      const url = await film_url(200)
      expect(url).to.include('touchdown=1')
      expect(url).to.not.include('true')
    })

    it('asserts the negative polarity too', async function () {
      // Where most of the narrowing comes from. Sending an outcome only when it
      // is true moved target-first by two points across the corpus; sending both
      // polarities moved it by more than thirty.
      await seed_play({
        play_id: 201,
        play_type: 'RUSH',
        is_touchdown: false,
        play_description: '(08:00) J.Mixon right guard for 3 yards.'
      })

      expect(await film_url(201)).to.include('touchdown=0')
    })

    it('says nothing about a touchdown our row is silent on', async function () {
      // Before 2025 our rows encode "not a touchdown" as NULL and never as
      // false, so a NULL here is genuinely an absence of information rather than
      // a negative, and asserting either polarity on it would be a guess.
      await seed_play({
        play_id: 202,
        play_type: 'RUSH',
        is_touchdown: null,
        play_description: '(08:00) J.Mixon right guard for 3 yards.'
      })

      expect(await film_url(202)).to.not.include('touchdown=')
    })

    it('omits the touchdown filter on a play not run from scrimmage', async function () {
      // The single largest correction measured here: NFL Pro's touchdown flag
      // matches NOTHING on a kickoff, punt, field goal or two-point try,
      // whatever the polarity, so an assertion there is a dead link rather than
      // a narrower one. Gating to PASS and RUSH cleared 26 of 31 dead links.
      await seed_play({
        play_id: 203,
        play_type: 'KOFF',
        is_touchdown: false,
        game_clock_start: '15:00',
        play_description: 'J.Elliott kicks 60 yards from PHI 35 to DAL 5.'
      })

      expect(await film_url(203)).to.not.include('touchdown=')
    })

    it('sends the completion in both polarities on a pass', async function () {
      await seed_play({
        play_id: 204,
        yards_to_go: 10,
        is_completion: true,
        play_description: '(08:00) J.Burrow pass short right to J.Chase.'
      })
      await seed_play({
        play_id: 205,
        yards_to_go: 10,
        is_completion: false,
        play_description: '(08:00) J.Burrow pass incomplete short right.'
      })

      expect(await film_url(204)).to.include('completion=1')
      expect(await film_url(205)).to.include('completion=0')
    })

    it('omits the completion on a sack, which NFL Pro does not chart', async function () {
      // A sack is a pass in our play_type and its own value in theirs, and they
      // chart no completion on one -- so either polarity is a filter the target
      // play cannot satisfy. Same routing as playType, which sends
      // play_type_sack here.
      await seed_play({
        play_id: 206,
        is_sack: true,
        yards_to_go: 10,
        is_completion: false,
        play_description: '(08:00) J.Burrow sacked at CIN 20 for -7 yards.'
      })

      const url = await film_url(206)
      expect(url).to.include('playType=play_type_sack')
      expect(url).to.not.include('completion=')
    })

    it('omits the completion on a rush, which has no such concept', async function () {
      await seed_play({
        play_id: 207,
        play_type: 'RUSH',
        yards_to_go: 10,
        play_description: '(08:00) J.Mixon right guard for 3 yards.'
      })

      expect(await film_url(207)).to.not.include('completion=')
    })

    it('sends an interception only when it happened', async function () {
      // True only. `interception=0` holds for nearly every play, so it narrows
      // nothing while adding one more filter that can disagree with NFL's
      // charting -- the only cost side of this trade.
      await seed_play({
        play_id: 208,
        yards_to_go: 10,
        is_interception: true,
        play_description: '(08:00) J.Burrow pass deep middle INTERCEPTED.'
      })
      await seed_play({
        play_id: 209,
        yards_to_go: 10,
        is_interception: false,
        play_description: '(08:00) J.Burrow pass short right to J.Chase.'
      })

      expect(await film_url(208)).to.include('interception=1')
      expect(await film_url(209)).to.not.include('interception=')
    })
  })

  describe('the player pins', function () {
    it('sends gsis_it_player_id and never nfl_player_id', async function () {
      // Both are integers on `player` and both survive the page's
      // reconciliation intact. Only one matches anything: a wrong-id-space
      // passerId keeps the query whole and returns zero plays, which looks like
      // a broken link and not like a bad parameter. The seeded player carries
      // both ids so this fails on a value that is present.
      await seed_play({
        play_id: 210,
        yards_to_go: 10,
        passer_gsis_player_id: '00-0099001',
        play_description: '(08:00) F.Passer pass short right to F.Target.'
      })

      const url = await film_url(210)
      expect(url).to.include('passerId=990001')
      expect(url).to.not.include('9990001')
    })

    it('sends the target', async function () {
      await seed_play({
        play_id: 211,
        yards_to_go: 10,
        target_gsis_player_id: '00-0099002',
        play_description: '(08:00) F.Passer pass short right to F.Target.'
      })

      expect(await film_url(211)).to.include('targetId=990002')
    })

    it('sends the rusher on a rush', async function () {
      await seed_play({
        play_id: 212,
        play_type: 'RUSH',
        yards_to_go: 10,
        ball_carrier_gsis_player_id: '00-0099003',
        play_description: '(08:00) F.Rusher right guard for 3 yards.'
      })

      expect(await film_url(212)).to.include('rusherId=990003')
    })

    it('omits the rusher when the ball carrier is not rushing', async function () {
      // The carrier on a completed pass is the receiver, whom NFL Pro charts as
      // the target rather than the rusher, so rusherId matches nothing there.
      await seed_play({
        play_id: 213,
        yards_to_go: 10,
        ball_carrier_gsis_player_id: '00-0099003',
        play_description: '(08:00) F.Passer pass short right to F.Rusher.'
      })

      expect(await film_url(213)).to.not.include('rusherId=')
    })

    it('omits a player we cannot resolve rather than sending an empty pin', async function () {
      await seed_play({
        play_id: 214,
        yards_to_go: 10,
        passer_gsis_player_id: '00-0099999',
        play_description: '(08:00) pass short right.'
      })

      const url = await film_url(214)
      expect(url).to.not.include('passerId')
      expect(url).to.include('playType=play_type_pass')
    })
  })

  describe('the possession team', function () {
    it('sends NFL Pro numeric team id, zero padding included', async function () {
      // Their id is a four-CHARACTER string, not an integer: Carolina is `0750`
      // and not `750`. Nothing in our schema carries this id space --
      // nfl_games.home_team_id is the shield UUID and home_ngs_team_id is a
      // third space again -- so it is a literal map, read off NFL Pro's own film
      // payload over the sixteen week-1 games of 2024.
      await seed_play({
        play_id: 220,
        yards_to_go: 10,
        offense_nfl_team: 'CAR',
        play_description: '(08:00) B.Young pass short right.'
      })

      expect(await film_url(220)).to.include('possessionTeamId=0750')
    })

    it('maps every team the plays table carries', async function () {
      // The map is a literal, so the failure mode is a team quietly missing from
      // it and losing its pin -- invisible in any single-play check. Asserting
      // the whole vocabulary is what makes that loud.
      const teams = [
        ['ARI', '3800'],
        ['LA', '2510'],
        ['LAC', '4400'],
        ['LV', '2520'],
        ['WAS', '5110'],
        ['NYG', '3410'],
        ['NYJ', '3430'],
        ['JAX', '2250']
      ]

      for (const [index, [team, team_id]] of teams.entries()) {
        const play_id = 230 + index
        await seed_play({
          play_id,
          yards_to_go: 10,
          offense_nfl_team: team,
          play_description: '(08:00) pass short right.'
        })
        expect(await film_url(play_id)).to.include(
          `possessionTeamId=${team_id}`
        )
      }
    })

    it('omits the team when the play records no offense', async function () {
      await seed_play({
        play_id: 240,
        yards_to_go: 10,
        offense_nfl_team: null,
        play_description: '(08:00) pass short right.'
      })

      expect(await film_url(240)).to.not.include('possessionTeamId')
    })
  })
})
