import db from '#db'

// Deep link an nfl_plays row to its coaches-film clip on NFL Pro.
//
// NFL Pro has no play-level route. `/film/plays` is a filter page: it sends a
// query string to `/api/secured/videos/filmroom/plays`, sorts the response by
// (gameId, sequence), and auto-plays plays[0]. So the narrower the filter, the
// closer plays[0] sits to the target play.
//
// THE PAGE AND THE API ARE TWO DIFFERENT CONSUMERS, AND THIS FILE HAS TO SATISFY
// THE PAGE. Measured 2026-09-05 in a real browser on an entitled account: before
// issuing the request, the page reconciles the incoming query against its own
// filter vocabulary and DROPS every key it cannot resolve, rewriting the address
// bar as it goes. Two of ours were dropped:
//
//   - `gameClock` is not in the page's filter vocabulary, so the page deletes
//     it -- but NOT before using it once. See THE TWO-REQUEST RACE below: the
//     first request the page issues carries the whole query verbatim, clock
//     included, and is play-exact. Keep sending it. It is the only reason a
//     click ever lands on the individual play.
//   - `gameId` as our ESBID resolved against no option in the page's game list,
//     so it was dropped too, leaving a filter with no game in it. The playlist
//     then spanned the whole WEEK, sorted by gameId, and auto-played the first
//     play of the earliest game. Every link in a saved view opened the wrong
//     game that way, which is the defect this file was rewritten to fix.
//
// So `gameId` is `nfl_games.shield_game_id`, the NFL shield UUID, NOT the esbid.
// The API accepts either; the page accepts only the UUID. Measured on the same
// play: with the esbid the page loaded 198 plays across 16 games, and with the
// UUID it loaded 15 plays, all from the right game.
//
// HOW THIS WAS MISSED FOR THREE REVISIONS, because the shape recurs: every
// earlier accuracy figure -- 595 plays at 100%, 651 at 99.85%, a twelve-game
// holdout at 99.12% -- came from replaying the query string against the API with
// curl. That path never loads the page, so it cannot see a page that discards
// half the query, and it reported a near-perfect score against links that opened
// the wrong game in every browser. Measure the surface the user actually uses.
//
// THE TWO-REQUEST RACE, measured 2026-09-05 by intercepting the page's own XHRs
// in a real browser. The page does NOT sanitise the query before it fetches. Its
// FilmPlaysPage.checkQuery hands `this.$route.query` straight to
// /api/secured/videos/filmroom/plays, so on any load it issues two requests:
//
//   1. the query VERBATIM, gameClock included -- which the API honours, and
//      which therefore returns the single target play and mounts its clip; then
//   2. the same URL MINUS gameClock, after the filter panel reconciles the query
//      against its own storeKey vocabulary and does a $router.replace, which the
//      route watcher answers by calling checkQuery a second time.
//
// The second response replaces the first. So the clip a user ends up on is
// decided by a race this code does not control: catch the page early and it is
// the exact play, catch it late and it is the situation playlist. That race,
// not a regression on NFL's side, is what makes this link look like it "used to
// work" -- it did, transiently, and it still does, transiently.
//
// WHAT THIS LINK CAN AND CANNOT PROMISE. The right GAME, ten times out of ten in
// a browser, against zero out of ten before the shield-UUID fix. The right PLAY,
// only if request 1 wins the race. Once request 2 lands, the page holds a
// playlist of the game's plays matching (quarter, playType, yardsToGoType, down)
// -- one to nine of them in the sample -- and auto-plays the earliest by
// sequence. So the guaranteed floor is the situation, and the play is the
// unguaranteed upside. Describe the column by its floor.
//
// The page has NO per-play route to link to instead. The full Nuxt route table,
// dumped live, carries /film/plays and /film/plays-debug and nothing with a
// playId segment. /film/plays-debug does KEEP a playId query key that
// /film/plays drops, and then ignores it -- selectedPlay stayed on the game's
// first play either way. Our nfl_plays.play_id IS their playId and
// nfl_games.shield_game_id IS their fapiGameId, so the identifiers are in hand
// if a consumer for them ever appears; today there is none.
//
// The distinction between "the list contains the target" and "the target is
// first" is the one that matters: the page plays plays[0], so a target sitting
// second in a three-play list is a wrong clip, not a near miss. Any future
// narrowing has to be judged on that, and the filters left to reach for are the
// static charting ones -- playAction, pressure, completion, airYardType.
//
// Three things that are not guessable, each measured rather than assumed:
//
//   1. `gameId` is the shield UUID, per above. `nfl_games` carries it for every
//      game from 2022 on, which is also where film coverage starts.
//   2. `gameClock` must be zero-padded MM:SS. `3:01` returns zero plays from the
//      API; `03:01` returns the play. The page drops it either way.
//   3. nfl_plays.game_clock_start is the WRONG clock. It is the snap clock and
//      trails the film feed's clock by a few seconds; using it directly drops
//      the exact-hit rate from 96% to 65%. The film feed's clock is the one in
//      the `(MM:SS)` prefix of play_description. game_clock_start is only a
//      fallback for the plays that carry no prefix (kickoffs, extra points).
//   4. `playType` is sent for EVERY play, not just special teams. An earlier
//      revision restricted it to special teams on the belief that filtering
//      scrimmage plays by type cost accuracy; a controlled comparison over the
//      full 595-play corpus refuted that outright -- restricted, 31 plays open
//      the wrong clip, and unrestricted only 4, with zero empty results either
//      way. See PLAY_TYPE_PARAM for the sack case that has to be routed.
//
// Everything the page keeps is a filter with a STATIC option list -- quarter,
// down, playType, yardsToGoType. Everything it resolves against loaded data is
// a UUID there (game, player, team). That is the rule to apply before adding a
// parameter here: a value the page cannot match against an option is not a
// weaker pin, it is silently no pin at all.
//
// Film coverage starts at 2022 (pro.nfl.com publishes `filmSeasons` as the
// current season plus four back). The floor is a constant rather than a rolling
// window because the window only ever grows forward, and a season we do not
// have plays for cannot produce a row here anyway.
const FIRST_FILM_SEASON = 2022

// `chr(63)` is the `?` that opens the query string, and it has to be spelled
// that way. knex.raw reads a bare `?` in the SQL as a bind placeholder, so a
// literal one throws at query build time. Passing the URL as a BINDING instead
// looks like the obvious fix and is a worse one: this expression is reused as
// the ORDER BY column, and knex interpolates a nested Raw's bindings only on the
// select path -- on the sort path the placeholder reaches Postgres untyped and
// the query dies with `could not determine data type of parameter`. Keeping the
// expression binding-free is what lets one definition serve both.
const FILM_PLAYS_URL = `'https://pro.nfl.com/film/plays' || chr(63) || 'season='`

// The clock as the film feed sees it: the `(MM:SS)` prefix of the description,
// falling back to the snap clock for plays that carry no prefix.
//
// The `~ '^\d{1,2}:\d{2}$'` test is load-bearing, not belt-and-braces. Some rows
// carry game_clock_start as an EMPTY STRING rather than NULL, which survives
// every `is null` guard and then reaches the padding below, where
// `lpad(split_part('', ':', 1), 2, '0')` yields '00' and the URL ends in a
// gameClock of `00:`. That shipped 13 dead links into the holdout before this
// test was added -- an empty string is not a missing value to Postgres, and the
// only reliable check is on the SHAPE of what came out.
const FILM_CLOCK = `nullif(
  coalesce(
    substring(nfl_plays.play_description from '^\\((\\d{0,2}:\\d{2})\\)'),
    case
      when nfl_plays.game_clock_start ~ '^\\d{1,2}:\\d{2}$'
      then nfl_plays.game_clock_start
    end
  ),
  ''
)`

// Zero-pad to MM:SS. A single-digit minute is a zero-result on the film API.
const PADDED_FILM_CLOCK = `lpad(split_part(${FILM_CLOCK}, ':', 1), 2, '0')
  || ':' || split_part(${FILM_CLOCK}, ':', 2)`

const WEEK_SLUG = `case nfl_plays.season_type
  when 'REG' then 'WEEK_' || nfl_plays.week
  when 'PRE' then case when nfl_plays.week = 0 then 'HOF' else 'P' || nfl_plays.week end
  when 'POST' then case nfl_plays.week
    when 1 then 'WC'
    when 2 then 'DIV'
    when 3 then 'CONF'
    when 4 then 'SB'
  end
end`

// The tiebreaker, and it carries every play rather than only the special teams
// ones. What collides on a clock is almost always a play of a DIFFERENT type:
// NFL Pro stamps a kickoff, an extra point or a two-point try with the same
// clock as the scrimmage play beside it, and the lower sequence sorts first, so
// the scrimmage play is the one that loses. Filtering the scrimmage play by its
// own type is what wins it back.
//
// A sack is a pass in our play_type and its own filter value in theirs, so it
// has to be routed separately -- sending play_type_pass for a sack is the one
// way this parameter returns nothing at all. is_sack NULL falls to the pass
// branch, which is what the measurement covered.
//
// `play_type_unknown` is how NFL Pro types a penalty that wiped the snap, and it
// is NOT in the filter UI's vocabulary -- the dropdown offers eight values and
// this is not one of them. The API honours it anyway, which is what lets a
// no-play be told apart from the kickoff sharing its clock.
const PLAY_TYPE_PARAM = `case nfl_plays.play_type
  when 'KOFF' then '&playType=play_type_kickoff'
  when 'PUNT' then '&playType=play_type_punt'
  when 'CONV' then '&playType=play_type_two_point_conversion'
  when 'RUSH' then '&playType=play_type_rush'
  when 'NOPL' then case
    when nfl_plays.play_description ilike '%punt%' then '&playType=play_type_punt'
    when nfl_plays.play_description ilike '%kicks%' then '&playType=play_type_kickoff'
    when nfl_plays.play_description ilike '%extra point%' then '&playType=play_type_xp'
    when nfl_plays.play_description ilike '%field goal%' then '&playType=play_type_field_goal'
    when nfl_plays.play_description ilike '%two-point%' then '&playType=play_type_two_point_conversion'
    else '&playType=play_type_unknown'
  end
  when 'PASS' then case
    when nfl_plays.is_sack then '&playType=play_type_sack'
    else '&playType=play_type_pass'
  end
  when 'FGXP' then case
    when nfl_plays.play_description ilike '%extra point%' then '&playType=play_type_xp'
    else '&playType=play_type_field_goal'
  end
  else ''
end`

// The second tiebreaker, for the collisions playType cannot reach: a penalty
// enforced from the same spot as the play that follows it shares the clock AND
// the type, and only the distance differs. A delay of game on the punt team is
// the worked example -- 4th & 2 and 4th & 7 at 7:12, both play_type_punt.
//
// Buckets measured against the API rather than guessed, because they are not
// the obvious thirds: SHORT is 1-2, MID is 3-6, LONG is 7 and up.
//
// GATED ON PLAY TYPE, which took two tries to get right. NFL Pro reports a
// distance of 0 on every kickoff, extra point and two-point try, but our rows do
// not always agree: an ONSIDE KICK is recorded here as 1st & 10 because the
// kicking team can recover it. So neither `yards_to_go > 0` nor a down of 1-4
// excludes it -- both were tried, and both left the band on an onside kick,
// where it matched nothing and produced the only dead link in the corpus.
//
// Naming the types that are run from scrimmage is the gate that actually holds,
// and it is also the only place the tiebreaker is ever needed.
const YARDS_TO_GO_PARAM = `case
  when nfl_plays.play_type in ('PASS', 'RUSH', 'PUNT', 'NOPL')
    and nfl_plays.yards_to_go > 0
  then '&yardsToGoType=' || case
    when nfl_plays.yards_to_go <= 2 then 'SHORT'
    when nfl_plays.yards_to_go <= 6 then 'MID'
    else 'LONG'
  end
  else ''
end`

// The third tiebreaker, and the only one the page keeps that the earlier
// revisions did not send: down. It is a static four-option filter, so it
// survives the page's reconciliation, and within one game it cuts a
// (quarter, playType, yardsToGoType) playlist by roughly a further quarter.
//
// Gated on the same scrimmage play types as YARDS_TO_GO_PARAM, for the same
// reason -- an onside kick is recorded here as 1st & 10 and NFL Pro has no down
// on a kick, so sending one matches nothing and returns an empty playlist.
const DOWN_PARAM = `case
  when nfl_plays.play_type in ('PASS', 'RUSH', 'PUNT', 'NOPL')
    and nfl_plays.down_number between 1 and 4
  then '&down=' || nfl_plays.down_number
  else ''
end`

// A row earns a link only if it is a play that was actually run. A `(MM:SS)`
// prefix marks a snapped play; kickoffs, punts, extra points and two-point
// tries carry no prefix but are real plays. Everything else on NOPL rows --
// timeouts, injury updates, GAME, END QUARTER -- has a clock but no film, and
// would otherwise link to whichever play happened to share that second.
// COALESCED TO FALSE, and that is the whole point of the wrapper. play_type is
// nullable, so `play_type in (...)` is NULL rather than false on a row that has
// none; `false or NULL` is NULL, `not NULL` is NULL, and a CASE arm whose
// condition is NULL is not taken -- so the guard fell through to the ELSE and
// built a URL for exactly the rows it exists to reject. Three-valued logic turns
// a guard into a pass-through silently, which is how 13 malformed links reached
// the holdout.
const IS_FILMABLE_PLAY = `coalesce(
  nfl_plays.play_description ~ '^\\(\\d{0,2}:\\d{2}\\)'
  or nfl_plays.play_type in ('KOFF', 'PUNT', 'FGXP', 'CONV'),
  false
)`

/**
 * SQL for the NFL Pro coaches-film deep link of an nfl_plays row, or NULL when
 * the play predates film coverage, is not a filmable play, or is missing any
 * component the URL needs.
 *
 * Reads `nfl_games.shield_game_id`, so every caller must join `nfl_games` --
 * `join_nfl_games` in the plays-view overrides does it for both the select and
 * the sort. Without the join Postgres raises 42P01 rather than emitting a link
 * with a missing game, which is the failure mode to prefer here.
 *
 * Carries no bind parameters, so the same expression is valid in a select and in
 * an ORDER BY. See FILM_PLAYS_URL for why that constraint exists.
 *
 * @param {object} [param0]
 * @param {string} [param0.alias] Column alias to append, for use in a select.
 * @returns {import('knex').Knex.Raw} A raw SQL expression usable in select and order by.
 */
export const nfl_pro_film_url_sql = ({ alias } = {}) =>
  db.raw(
    `case
      when nfl_plays.season_year < ${FIRST_FILM_SEASON}
        or nfl_plays.quarter is null
        or not ${IS_FILMABLE_PLAY}
        or ${WEEK_SLUG} is null
        or ${FILM_CLOCK} is null
        or nfl_games.shield_game_id is null
      then null
      else ${FILM_PLAYS_URL} || nfl_plays.season_year
        || '&seasonType=' || nfl_plays.season_type
        || '&weekSlug=' || (${WEEK_SLUG})
        || '&gameId=' || nfl_games.shield_game_id
        || '&quarter=' || nfl_plays.quarter
        || '&gameClock=' || (${PADDED_FILM_CLOCK})
        || (${PLAY_TYPE_PARAM})
        || (${YARDS_TO_GO_PARAM})
        || (${DOWN_PARAM})
    end${alias ? ` as ${alias}` : ''}`
  )
