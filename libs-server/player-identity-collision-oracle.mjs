/*
  SQL for the player-identity collision oracle.

  The question this answers: a gsis id appears in `nfl_play_stats` with no
  `player` row -- is that person ALREADY in the table under another pid?

  It exists because neither registered duplicate check can see the rows an
  identity-repair sweep would create. `duplicate-person-rows` selects shells via
  `id_count = 0` (db/checks/registry.mjs), so a row carrying a gsis id has
  `id_count = 1` and is neither a shell nor a twin. `nickname-legal-name-
  duplicate-rows` restricts its population to rows holding `last_name`, `college`
  AND `nfl_draft_year`, excludes equal-name pairs by construction, and vetoes
  pairs whose `gsis_player_id` values differ -- which is every pair this oracle
  is for. The two checks hand this class to each other and neither holds it.

  Exported as SQL fragments rather than a JS predicate because the joins run over
  `player_gamelogs` and `nfl_play_stats` at full table scale; pulling the rows
  out to compare them in JS is not viable.
*/

/*
  Canonicalize a player name to `<initial><surname>`, lower-case, alpha only.

  `player.short_name` is `F.Last` by construction (libs-server/create-player.mjs)
  but `nfl_play_stats.player_name` is NOT, and the mismatch is the whole reason
  this function exists. Measured over the known-good set -- ledger rows whose
  gsis id already resolves to a player -- a raw lower-case comparison fails to
  find a matching name for 2.41% of ids; this normalization takes that to 0.64%.

  The classes it collapses, largest first:

  - a full first name in the ledger (`Brandon Facyson`)
  - a space after the initial (`C. Kriewaldt`)
  - a generational suffix on either side (`R.Carter Jr.`, `W.Thomas III`)
  - a MULTI-CHARACTER initial (`Ty.Campbell`, `Ald.Smith`, `Aa.Rodgers`)
  - apostrophes and hyphens in the first name (`Ja'Marr Chase`, `Al-Quadin`)
  - the ledger's `(3rd QB)` annotation

  The multi-character initial is the one that matters and the reason a naive
  join is worse than useless here: it is the NFL's OWN namesake-disambiguation
  prefix, so it appears precisely where two same-named players shared a roster.
  An unnormalized join is therefore blindest on exactly the case the oracle
  exists to catch, and it fails silently -- it returns few rows and reads as a
  clean gate.

  What it deliberately does NOT do is match on a surname prefix. `J.Franklin`
  against `J.Franklin-Myers` is the same person, but admitting prefixes would
  also pair genuinely different people, and this oracle's job is to be trusted
  when it says "no collision".

  NOTE the `[.]{0,1}` in the suffix pattern, which is `[.]?` written the long
  way. Every fragment here has to survive `db.raw()`, and knex parses a `?` in a
  raw string as a positional bind placeholder -- so a regex carrying one is
  rewritten BEFORE it reaches Postgres. The query still runs and still returns
  rows, so the corruption reads as a result rather than as an error. Keep this
  file free of `?`.
*/
export const short_name_key = (expr) => {
  const prepared = `regexp_replace(
    regexp_replace(
      regexp_replace(${expr}, '\\([^)]*\\)', '', 'g'),
      '[ ,]+(Jr|Sr|II|III|IV|V)[.]{0,1}[ ]*$', '', 'i'
    ),
    '^[ ]*([A-Za-z][A-Za-z''-]*)([.][ ]*|[ ]+)', '\\1|'
  )`
  return `lower(
    left(regexp_replace(split_part(${prepared}, '|', 1), '[^A-Za-z]', '', 'g'), 1)
    || regexp_replace(split_part(${prepared}, '|', 2), '[^A-Za-z]', '', 'g')
  )`
}

/*
  Season for a play-stat row.

  `nfl_games` is LEFT JOINed, not inner joined. 333 of the missing ids sit on
  2013 and 2014 preseason esbids that have NO `nfl_games` row at all, and an
  inner join drops them without saying so -- that is the entire difference
  between the 2,985 figure and the 2,652 one an earlier measurement reported.

  The fallback reads the season out of the esbid, which is `YYYYMMDDNN`. A
  January or February date belongs to the PRIOR season: esbid 1971010300 is
  season 1970. Validated over the 15,622 games carrying both an esbid and a
  known season -- this form mismatches on 0, the naive year-only form on 812.
*/
export const play_stat_season_sql = `COALESCE(
  g.season_year,
  (s.esbid/1000000) - CASE WHEN (s.esbid/10000) % 100 <= 2 THEN 1 ELSE 0 END
)`

/*
  A play-stat row with no `nfl_games` row is preseason by construction -- those
  esbids are 2013/2014 preseason and nothing else.
*/
export const play_stat_season_type_sql = `COALESCE(g.season_type, 'PRE')`

/*
  Every standard-format gsis id in the stat ledger with no `player` row, at
  (id, team, season, season type, ledger name) grain.

  The regex excludes 8 `XX-000000N` placeholder ids (95 rows). Dropping it
  yields 2,993 rather than 2,985.
*/
export const missing_gsis_ids_sql = `SELECT
    s.gsis_player_id,
    s.nfl_team,
    ${play_stat_season_sql} AS season_year,
    ${play_stat_season_type_sql} AS season_type,
    s.player_name,
    count(*) AS stat_rows
  FROM nfl_play_stats s
  LEFT JOIN nfl_games g ON g.esbid = s.esbid
  LEFT JOIN player p ON p.gsis_player_id = s.gsis_player_id
  WHERE p.gsis_player_id IS NULL
    AND s.gsis_player_id ~ '^00-00[0-9]{5}$'
  GROUP BY 1,2,3,4,5`

/*
  The PRE-FLIGHT. Run this BEFORE creating anything: it names the ids not to
  mint, rather than reporting duplicates after the fact.

  Returns (missing gsis id, incumbent pid) candidates that share a normalized
  name AND a team-season. `incumbent_gsis IS NULL` is the strong attach signal --
  the incumbent holds no gsis id, so nothing contradicts attaching this one. An
  incumbent holding a DIFFERENT gsis id points the other way, at a genuine
  namesake.

  Adjudication is per candidate and human-reviewed. This query proposes; it does
  not merge.
*/
export const collision_preflight_sql = ({
  scope_filter = 'TRUE'
} = {}) => `WITH missing AS (
  ${missing_gsis_ids_sql}
), incumbent_team_seasons AS (
  SELECT DISTINCT pid, nfl_team, season_year FROM player_gamelogs
  WHERE nfl_team IS NOT NULL AND season_year IS NOT NULL
), incumbent AS (
  SELECT p.pid, p.short_name, p.gsis_player_id, ${short_name_key('p.short_name')} AS name_key
  FROM player p WHERE p.short_name IS NOT NULL AND p.primary_position <> 'DST'
)
SELECT
  m.gsis_player_id,
  min(m.player_name) AS ledger_name,
  i.pid AS incumbent_pid,
  min(i.short_name) AS incumbent_name,
  min(i.gsis_player_id) AS incumbent_gsis,
  sum(m.stat_rows) AS shared_stat_rows,
  count(DISTINCT (m.nfl_team, m.season_year)) AS shared_team_seasons,
  bool_or(m.season_type <> 'PRE') AS is_graded
FROM missing m
JOIN incumbent i ON i.name_key = ${short_name_key('m.player_name')}
JOIN incumbent_team_seasons its
  ON its.pid = i.pid AND its.nfl_team = m.nfl_team AND its.season_year = m.season_year
WHERE ${scope_filter}
GROUP BY m.gsis_player_id, i.pid`

/*
  The TABLE-WIDE form, and a different question: which pairs of EXISTING player
  rows share a name and a team-season. This is the standing backlog the pre-flight
  sits on top of, not a result of any sweep.

  Reported both ways deliberately. The raw form reproduces the 736 pair-team-season
  / 248 name baseline exactly and is kept for that continuity; the normalized form
  finds 755 / 258, the extra being suffix and apostrophe variants between two
  player rows that the raw comparison cannot see.
*/
export const table_wide_collision_sql = ({ normalized = true } = {}) => {
  const key = (expr) => (normalized ? short_name_key(expr) : `lower(${expr})`)
  return `WITH player_team_seasons AS (
  SELECT DISTINCT pid, nfl_team, season_year FROM player_gamelogs
  WHERE nfl_team IS NOT NULL AND season_year IS NOT NULL
), named AS (
  SELECT p.pid, p.short_name, ${key('p.short_name')} AS name_key
  FROM player p WHERE p.short_name IS NOT NULL AND p.primary_position <> 'DST'
)
SELECT a.pid AS pid_a, a.short_name AS name_a, b.pid AS pid_b, b.short_name AS name_b,
       a.name_key, sa.nfl_team, sa.season_year
FROM player_team_seasons sa
JOIN player_team_seasons sb
  ON sb.nfl_team = sa.nfl_team AND sb.season_year = sa.season_year AND sb.pid > sa.pid
JOIN named a ON a.pid = sa.pid
JOIN named b ON b.pid = sb.pid AND b.name_key = a.name_key`
}
