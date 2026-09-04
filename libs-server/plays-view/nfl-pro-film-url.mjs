import db from '#db'

// Deep link a single nfl_plays row to its coaches-film clip on NFL Pro.
//
// NFL Pro has no play-level route. `/film/plays` is a filter page: it hands its
// entire query string to `/api/secured/videos/filmroom/plays` verbatim, sorts
// the response by (gameId, sequence), and auto-plays plays[0]. A URL that
// narrows the filter to one play therefore IS a play-level URL.
//
// The pin is `gameClock`, an undocumented filter the film-room API honours but
// the filter UI never exposes.
//
// MEASURED 2026-09-04 over 651 linked plays across four games and four seasons
// (2022, 2024, 2025), by replaying each generated URL's query string against the
// live film-room API: 649 resolve to exactly one play, 1 returns a short list
// whose FIRST play by sequence is the target (the one the page auto-plays), and
// 1 opens the wrong clip. None return an empty list. 99.85%.
//
// WATCH THE DENOMINATOR. An earlier revision measured 595 linked plays at 100%,
// and the difference is not an improvement in accuracy -- it is 56 plays that
// used to get NO LINK AT ALL and so never entered the corpus. Under a minute the
// description reads `(:52)` with no minutes, which failed a clock pattern that
// required a leading digit, and a play with no link cannot be a miss. 9.5% of
// prefixed plays were excluded that way. A rate measured only over the rows a
// rule accepted will always flatter the rule.
//
// Still a corpus, not a guarantee: four games, and the clock and distance values
// it leans on are our own charting, which can disagree with NFL Pro's on a play
// no game here contained. A separate twelve-game holdout scored 99.12% before
// the fixes below.
//
// The distinction between "the list contains the target" and "the target is
// first" is the one that matters and is easy to get wrong: the page sorts by
// (gameId, sequence) and plays plays[0], so a target sitting second in a
// three-play list is a wrong clip, not a near miss. Counting it as a hit is
// what made an earlier revision look like it had no failures at all.
//
// Four things that are not guessable, each measured rather than assumed:
//
//   1. `gameId` is our own esbid. No crosswalk -- the same value the NFL Pro
//      playlist importer already sends as `gameId`.
//   2. `gameClock` must be zero-padded MM:SS. `3:01` returns zero plays;
//      `03:01` returns the play.
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
// The last 4 needed YARDS_TO_GO_PARAM, and adding it was checked in BOTH
// directions: it fixed all four, and re-running 195 already-exact plays with it
// regressed none. A tiebreaker that narrows is only safe if you measure what it
// narrows away.
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
      then null
      else ${FILM_PLAYS_URL} || nfl_plays.season_year
        || '&seasonType=' || nfl_plays.season_type
        || '&weekSlug=' || (${WEEK_SLUG})
        || '&gameId=' || nfl_plays.esbid
        || '&quarter=' || nfl_plays.quarter
        || '&gameClock=' || (${PADDED_FILM_CLOCK})
        || (${PLAY_TYPE_PARAM})
        || (${YARDS_TO_GO_PARAM})
    end${alias ? ` as ${alias}` : ''}`
  )
