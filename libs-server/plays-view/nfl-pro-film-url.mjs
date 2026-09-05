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
// second in a three-play list is a wrong clip, not a near miss. Every figure
// below is stated on that basis.
//
// WHAT THE CHARTING FILTERS BOUGHT, measured over 1211 plays across eight games
// from 2022 to 2025 with gameClock EXCLUDED, so the figure is the deterministic
// floor rather than the race's lucky half:
//
//                        sole result   target first   dead
//   quarter/type/ytg/down     19.3%          42.2%     0.0%
//   plus the filters below    72.0%          83.7%     0.4%
//
// The trade is explicit and was taken deliberately: 0.4% of links now open
// nothing at all, against wrong-clip falling from 58% to 16%.
//
// THE VALUE VOCABULARY IS 1 AND 0, NOT true AND false, and this is the sharpest
// trap on the whole surface. The page serialises its OWN boolean filters as
// `touchdown=true` when it writes its address bar, and that exact string, fed
// back in on a cold load, trips the filter panel's `clearAll` -- which nulls
// every key except season, seasonType, weekSlug and gameId. One bad value does
// not get dropped in isolation; it costs the WHOLE query and the page hangs on
// a week-wide or empty state. Measured against controls on both sides, so it is
// the page's behaviour and not the rate limiter. `touchdown=1` narrows
// correctly on the same play.
//
// POLARITY IS WHERE THE GAIN LIVES. Sending an outcome filter only when it is
// true moved target-first by two points; sending it in BOTH polarities, so that
// a non-completion asserts `completion=0`, moved it by more than thirty. An
// outcome is therefore asserted whenever our row has a definite value for it,
// and omitted only where the row is genuinely silent.
//
// Two asymmetries in that rule, each measured rather than reasoned:
//
//   - `touchdown` is sent ONLY on PASS and RUSH. NFL Pro treats the touchdown
//     flag as an offensive-scrimmage concept, and asserting it on a kickoff,
//     punt, field goal or two-point try matches nothing whatever the polarity.
//     Gating it to scrimmage plays cleared 26 of the 31 dead links the
//     ungated version produced -- the single largest correction here.
//   - `interception` is sent only when TRUE. It has no useful negative: nearly
//     every play is not an interception, so `interception=0` narrows nothing
//     while adding a filter that can disagree.
//
// A note on `touchdown`'s coverage, because the gap is invisible from the
// column alone: before 2025 our rows encode "not a touchdown" as NULL and never
// as false, so on those seasons this can only ever assert `touchdown=1`.
// Reading that NULL as false was measured on the same corpus and moved
// sole-result by 0.3 points with no change in dead links -- too small to buy an
// assumption about what a NULL means, so the definite-value rule stands.
//
// THE PLAYER IDS ARE gsis_it_player_id, and the wrong one fails silently. NFL
// Pro's passerId, targetId and rusherId take `player.gsis_it_player_id`;
// `player.nfl_player_id` is a well-formed integer that survives the page's
// reconciliation intact and then matches nothing at all, returning an empty
// playlist. That is the second failure mode to keep separate from the first: an
// unknown VALUE on a known key trips clearAll and collapses the query, while a
// well-formed but WRONG value keeps the query whole and returns zero plays.
// Both look like a broken link and neither looks like a bad parameter.
//
// The remaining filters left to reach for are the other static charting ones --
// playAction, pressure, airYardType. Note that targetLocation is NOT pass
// direction: its values are OUTSIDE_NUMBERS, DOWN_SEAMS and BETWEEN_HASHES, a
// field-zone concept our pass_location LEFT/MIDDLE/RIGHT does not map onto, and
// sending LEFT returns zero plays.
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

// The outcome filters. Each is asserted in BOTH polarities wherever our row
// carries a definite value, which is where most of the narrowing comes from --
// see POLARITY IS WHERE THE GAIN LIVES above.
//
// `1` and `0`. Never `true` and `false`, which trip the page's clearAll and
// wipe the entire query rather than being dropped one key at a time.
//
// Gated to PASS and RUSH, because NFL Pro's touchdown flag matches nothing at
// all on a kickoff, punt, field goal or two-point try -- 26 of the 31 dead
// links in the corpus were exactly that.
const TOUCHDOWN_PARAM = `case
  when nfl_plays.play_type in ('PASS', 'RUSH')
    and nfl_plays.is_touchdown is not null
  then '&touchdown=' || case when nfl_plays.is_touchdown then '1' else '0' end
  else ''
end`

// A sack is a pass in our play_type and its own value in theirs, and NFL Pro
// does not chart a completion on one at all, so asserting either polarity there
// is a filter the target play cannot satisfy. is_sack NULL falls to the
// non-sack branch, matching how PLAY_TYPE_PARAM routes the same rows.
//
// is_completion NULL is what our rows carry for an interception, among others,
// and a row with no definite value asserts nothing.
const COMPLETION_PARAM = `case
  when nfl_plays.play_type = 'PASS'
    and not coalesce(nfl_plays.is_sack, false)
    and nfl_plays.is_completion is not null
  then '&completion=' || case when nfl_plays.is_completion then '1' else '0' end
  else ''
end`

// True only. `interception=0` holds for nearly every play, so it narrows
// nothing while adding one more filter that can disagree with NFL's charting.
const INTERCEPTION_PARAM = `case
  when nfl_plays.is_interception then '&interception=1'
  else ''
end`

// The player pins, and they are the strongest filters here after the game
// itself -- one passer's plays are a small fraction of a quarter's.
//
// `gsis_it_player_id`, NOT `nfl_player_id`. Both are integers on `player` and
// both survive the page's reconciliation; only one of them matches anything.
// See THE PLAYER IDS ARE gsis_it_player_id above.
//
// Each reads a role-aliased `player` join keyed on the play's GSIS id -- the
// same id space the corpus measurement resolved through. The pid columns beside
// them (passer_pid and friends) resolve to a different gsis_it_player_id on
// roughly half a percent of plays, so the join key is not interchangeable.
const PASSER_PARAM = `case
  when film_passer.gsis_it_player_id is not null
  then '&passerId=' || film_passer.gsis_it_player_id
  else ''
end`

const TARGET_PARAM = `case
  when film_target.gsis_it_player_id is not null
  then '&targetId=' || film_target.gsis_it_player_id
  else ''
end`

// Gated to RUSH, which is what the corpus measured. The gate is nearly a no-op
// on today's data -- ball_carrier_gsis_player_id is set on 73527 of 74593 rush
// plays and on 24 rows of every other type combined -- but those two dozen are
// carriers NFL Pro charts as a receiver or a returner rather than a rusher, so
// rusherId would match nothing on exactly the rows the gate excludes.
const RUSHER_PARAM = `case
  when nfl_plays.play_type = 'RUSH'
    and film_rusher.gsis_it_player_id is not null
  then '&rusherId=' || film_rusher.gsis_it_player_id
  else ''
end`

// NFL Pro's own numeric team id, which is a ZERO-PADDED four-character string
// and not an integer: Carolina is `0750`, not `750`. Nothing in our schema
// carries it -- `nfl_games.home_team_id` is the shield UUID and
// `home_ngs_team_id` is a different space again -- so it is a literal map, and
// a literal map is the honest shape for it. The vocabulary is 32 values that
// have not moved since the Rams' relocation, and film coverage starts in 2022,
// so no historical franchise can reach this.
//
// Learned from NFL Pro's own film payload rather than transcribed: every play
// carries homeTeamAbbr/homeTeamId and visitorTeamAbbr/visitorTeamId, so one
// request per game yields two rows of the map. It was built over the sixteen
// week-1 games of 2024, which covers all 32 exactly once, and each team was
// keyed by its SIDE in the game rather than by matching the two vocabularies'
// spellings -- theirs says AZ where ours says ARI, and a spelling join would
// have silently dropped that row. Cross-checked against the fifteen teams
// appearing in the corpus caches, with no disagreement.
const NFL_TEAM_IDS = {
  ARI: '3800',
  ATL: '0200',
  BAL: '0325',
  BUF: '0610',
  CAR: '0750',
  CHI: '0810',
  CIN: '0920',
  CLE: '1050',
  DAL: '1200',
  DEN: '1400',
  DET: '1540',
  GB: '1800',
  HOU: '2120',
  IND: '2200',
  JAX: '2250',
  KC: '2310',
  LA: '2510',
  LAC: '4400',
  LV: '2520',
  MIA: '2700',
  MIN: '3000',
  NE: '3200',
  NO: '3300',
  NYG: '3410',
  NYJ: '3430',
  PHI: '3700',
  PIT: '3900',
  SEA: '4600',
  SF: '4500',
  TB: '4900',
  TEN: '2100',
  WAS: '5110'
}

const POSSESSION_TEAM_PARAM = `case nfl_plays.offense_nfl_team
  ${Object.entries(NFL_TEAM_IDS)
    .map(([abbr, id]) => `when '${abbr}' then '&possessionTeamId=${id}'`)
    .join('\n  ')}
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
 * Reads four joined tables, so every caller must supply all four joins:
 * `nfl_games` for the shield id, and `player` aliased `film_passer`,
 * `film_target` and `film_rusher`, each keyed on the play's matching
 * `*_gsis_player_id`. `join_play_film_url` in the plays-view overrides does all
 * of it, for both the select and the sort. Without a join Postgres raises 42P01
 * rather than emitting a link that is quietly missing a filter, which is the
 * failure mode to prefer here -- a missing filter reads as a wrong clip.
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
        || (${TOUCHDOWN_PARAM})
        || (${COMPLETION_PARAM})
        || (${INTERCEPTION_PARAM})
        || (${PASSER_PARAM})
        || (${TARGET_PARAM})
        || (${RUSHER_PARAM})
        || (${POSSESSION_TEAM_PARAM})
    end${alias ? ` as ${alias}` : ''}`
  )
