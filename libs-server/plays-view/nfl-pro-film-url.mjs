import db from '#db'

// Deep link a single nfl_plays row to its coaches-film clip on NFL Pro.
//
// NFL Pro has no play-level route. `/film/plays` is a filter page: it hands its
// entire query string to `/api/secured/videos/filmroom/plays` verbatim, sorts
// the response by (gameId, sequence), and auto-plays plays[0]. A URL that
// narrows the filter to one play therefore IS a play-level URL.
//
// The pin is `gameClock`, an undocumented filter the film-room API honours but
// the filter UI never exposes. Measured against two full 2025 games (297 plays,
// 2026-09-04): 284 resolve to exactly the target play, 8 more return a 2-3 play
// list containing it, and 5 return nothing because NFL Pro's film feed does not
// carry that play at all. Nothing here can produce a dead link that our own data
// says should have worked.
//
// Four things that are not guessable, each of which was measured rather than
// assumed:
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
//   4. `playType` is added ONLY for special teams. An extra point shares its
//      clock with the kickoff that follows it, and playType splits them. Adding
//      it to PASS/RUSH instead COSTS accuracy: NFL Pro charts scrambles and
//      sacks differently than we do, and 12 of 297 plays went from a correct
//      result to zero results when playType was applied to every row.
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
const FILM_CLOCK = `coalesce(
  substring(nfl_plays.play_description from '^\\((\\d{1,2}:\\d{2})\\)'),
  nfl_plays.game_clock_start
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

const PLAY_TYPE_PARAM = `case nfl_plays.play_type
  when 'KOFF' then '&playType=play_type_kickoff'
  when 'PUNT' then '&playType=play_type_punt'
  when 'CONV' then '&playType=play_type_two_point_conversion'
  when 'FGXP' then case
    when nfl_plays.play_description ilike '%extra point%' then '&playType=play_type_xp'
    else '&playType=play_type_field_goal'
  end
  else ''
end`

// A row earns a link only if it is a play that was actually run. A `(MM:SS)`
// prefix marks a snapped play; kickoffs, punts, extra points and two-point
// tries carry no prefix but are real plays. Everything else on NOPL rows --
// timeouts, injury updates, GAME, END QUARTER -- has a clock but no film, and
// would otherwise link to whichever play happened to share that second.
const IS_FILMABLE_PLAY = `(
  nfl_plays.play_description ~ '^\\(\\d{1,2}:\\d{2}\\)'
  or nfl_plays.play_type in ('KOFF', 'PUNT', 'FGXP', 'CONV')
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
    end${alias ? ` as ${alias}` : ''}`
  )
