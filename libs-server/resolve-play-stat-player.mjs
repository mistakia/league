/**
 * Resolve an `nfl_play_stats` row to a single player pid.
 *
 * The row carries two identifier columns, and the long-standing framing of them
 * as two independent vendor assertions is wrong. `smart_player_id` is a UUID
 * template with the player's `gsis_player_id` hex-embedded in it at the offset
 * `decode_id` reads (see `scripts/import-plays-nfl-v1.mjs`): 10,483 of the
 * 10,897 `player` rows carrying one decode to that same row's OWN
 * `gsis_player_id`. So the column holds no independent identity information,
 * and "which identifier wins" was never an identity question.
 *
 * That reframing does most of the work. Of the 5,224 play-stat rows whose two
 * identifiers resolve to different people, 3,585 have a `smart_player_id` that
 * decodes to the row's own `gsis_player_id` -- the row agrees with itself, and
 * the disagreement lives entirely in the `player` table, where 36 rows hold
 * another player's encoded gsis id. Those resolve structurally, with no
 * heuristic (tier `decoded_self`). Only the remaining ~1,629 rows carry two
 * genuinely conflicting gsis ids and need a tiebreak.
 *
 * For those, the arbiter is `nfl_play_stats.player_name` -- the one column in
 * the chain that no local process has rewritten. `gsis_player_id` is itself
 * derived (decoded to an Elias key, looked up against `player.esb_player_id`)
 * and has been fuzzily backfilled from name+team;
 * `player.smart_player_id` is assigned by majority vote over these same rows.
 * Measured against 400,000 rows whose identity is not in doubt (both
 * identifiers resolve to one pid), normalized first-initial-plus-surname
 * matching is right 99.58% of the time.
 *
 * Deliberately NOT used as evidence here: `nfl_plays.<role>_pid`. Those columns
 * are a re-derivation of `nfl_play_stats.gsis_player_id` through a player-table
 * index lookup and never read `smart_player_id` at all, so agreeing with them
 * is checking a value against itself.
 */

// Generational suffixes carried on the feed's name string but never on
// `player.formatted_name`, so they have to come off before comparison.
const NAME_SUFFIX_PATTERN = /\s+(jr|sr|ii|iii|iv|v)\.?$/i

// Stat ids whose credited player has a position the stat itself implies. Used
// only as a last tiebreak between two candidates the name cannot separate, so
// the trick-play exposure is bounded: it decides which of two similarly-named
// players threw a pass, never whether a pass can be thrown by a non-quarterback.
const STAT_ID_POSITION_CLASS = {
  14: 'pass',
  15: 'pass',
  16: 'pass',
  19: 'pass',
  20: 'pass',
  111: 'pass',
  112: 'pass',
  21: 'skill',
  22: 'skill',
  113: 'skill',
  115: 'skill',
  10: 'skill',
  11: 'skill',
  29: 'kicking',
  30: 'kicking',
  31: 'kicking',
  32: 'kicking',
  33: 'kicking',
  2: 'kicking',
  3: 'kicking',
  4: 'kicking',
  5: 'kicking',
  44: 'kicking',
  45: 'kicking'
}

const POSITIONS_BY_CLASS = {
  pass: new Set(['QB']),
  kicking: new Set(['K', 'P']),
  skill: new Set([
    'WR',
    'TE',
    'RB',
    'FB',
    'HB',
    'QB',
    'TB',
    'WB',
    'FL',
    'BB',
    'KR',
    'KOR'
  ])
}

const hex_to_ascii = (hex_string) => {
  let ascii = ''
  for (let i = 0; i < hex_string.length; i += 2) {
    ascii += String.fromCharCode(parseInt(hex_string.substring(i, i + 2), 16))
  }
  return ascii
}

/**
 * Recover the `gsis_player_id` hex-embedded in a `smart_player_id`.
 *
 * Mirrors the offset `decode_id` reads in `scripts/import-plays-nfl-v1.mjs`,
 * which uses it to derive an Elias key. Returns null for anything that is not a
 * 36-character dashed UUID, or whose decoded bytes are not a gsis id.
 */
export const decode_smart_player_id = (smart_player_id) => {
  if (!smart_player_id || smart_player_id.length !== 36) return null

  const decoded = hex_to_ascii(
    smart_player_id.replace(/-/g, '').substring(4, 24)
  )
  return /^\d{2}-\d{7}$/.test(decoded) ? decoded : null
}

const name_key = (name) => {
  if (!name) return null

  const without_suffix = name.replace(NAME_SUFFIX_PATTERN, '')
  const initial = (without_suffix.match(/[a-z]/i) || [''])[0].toLowerCase()
  // Everything after the last separator is the surname. The feed writes
  // "S.Weatherford", "R. Brown" and "Ray Brown" interchangeably, so both a dot
  // and a space have to terminate the given name.
  const surname = without_suffix
    .replace(/^.*[. ]/, '')
    .replace(/[^a-z]/gi, '')
    .toLowerCase()

  if (!initial || !surname) return null

  return {
    initial,
    surname,
    squashed: without_suffix.replace(/[^a-z]/gi, '').toLowerCase()
  }
}

/**
 * Does the feed's per-row name string denote this player?
 *
 * Compares first initial plus surname after stripping punctuation, which is
 * what makes the comparison survive the feed's inconsistent formatting. Falls
 * back to a separator-free comparison for the "RayBrown" shape, where there is
 * no boundary to split on.
 */
export const play_stat_name_matches_player = ({ player_name, player }) => {
  const feed = name_key(player_name)
  const candidate = name_key(player.formatted_name)
  if (!feed || !candidate) return false

  if (feed.initial === candidate.initial && feed.surname === candidate.surname)
    return true

  // No separator to split on ("RayBrown", "PeytonManning"), so `surname` above
  // captured the whole string. Compare against both spellings the player row
  // could reduce to.
  return (
    feed.squashed === candidate.squashed ||
    feed.squashed === `${candidate.initial}${candidate.surname}`
  )
}

const position_is_plausible = ({ stat_id, player }) => {
  const position_class = STAT_ID_POSITION_CLASS[stat_id]
  if (!position_class || !player.primary_position) return null

  return POSITIONS_BY_CLASS[position_class].has(player.primary_position)
}

const resolve_conflict = ({
  play_stat,
  season_year,
  smart_player,
  gsis_player
}) => {
  // The row agrees with itself once the smart id is decoded, so the smart-side
  // `player` row is the one holding a foreign encoding. No heuristic needed.
  if (
    decode_smart_player_id(play_stat.smart_player_id) ===
    play_stat.gsis_player_id
  ) {
    return { pid: gsis_player.pid, tier: 'decoded_self' }
  }

  const smart_name_matches = play_stat_name_matches_player({
    player_name: play_stat.player_name,
    player: smart_player
  })
  const gsis_name_matches = play_stat_name_matches_player({
    player_name: play_stat.player_name,
    player: gsis_player
  })

  if (smart_name_matches && !gsis_name_matches)
    return { pid: smart_player.pid, tier: 'name' }
  if (gsis_name_matches && !smart_name_matches)
    return { pid: gsis_player.pid, tier: 'name' }

  // Both names match -- the candidates share a surname and an initial. Whichever
  // had not yet entered the league cannot have recorded the stat.
  if (smart_name_matches && gsis_name_matches && season_year) {
    const smart_debuted = smart_player.nfl_draft_year <= season_year
    const gsis_debuted = gsis_player.nfl_draft_year <= season_year
    if (smart_debuted && !gsis_debuted)
      return { pid: smart_player.pid, tier: 'era' }
    if (gsis_debuted && !smart_debuted)
      return { pid: gsis_player.pid, tier: 'era' }
  }

  const smart_position_plausible = position_is_plausible({
    stat_id: play_stat.stat_id,
    player: smart_player
  })
  const gsis_position_plausible = position_is_plausible({
    stat_id: play_stat.stat_id,
    player: gsis_player
  })
  if (smart_position_plausible === true && gsis_position_plausible === false)
    return { pid: smart_player.pid, tier: 'position' }
  if (gsis_position_plausible === true && smart_position_plausible === false)
    return { pid: gsis_player.pid, tier: 'position' }

  return null
}

/**
 * Resolve one play-stat row to a pid.
 *
 * @returns {{ pid: string, tier: string }|null} null when the row names no
 *   player, or names two the tiers cannot separate -- callers should drop and
 *   log rather than guess, since attributing a stat to the wrong player is
 *   worse than not counting it.
 */
export const resolve_play_stat_player = ({
  play_stat,
  players_by_smart_player_id,
  players_by_gsis_player_id,
  season_year
}) => {
  // A `smart_player_id` that resolves to nothing is absent, not a signal --
  // 236,572 valid rows carry a fabricated one, and treating it as evidence
  // would resolve them to whichever player happens to hold the encoding.
  const smart_player = play_stat.smart_player_id
    ? players_by_smart_player_id.get(play_stat.smart_player_id)
    : null
  const gsis_player = play_stat.gsis_player_id
    ? players_by_gsis_player_id.get(play_stat.gsis_player_id)
    : null

  if (!smart_player && !gsis_player) return null
  if (!gsis_player) return { pid: smart_player.pid, tier: 'smart_only' }
  if (!smart_player) return { pid: gsis_player.pid, tier: 'gsis_only' }
  if (smart_player.pid === gsis_player.pid)
    return { pid: gsis_player.pid, tier: 'agreed' }

  return resolve_conflict({
    play_stat,
    season_year,
    smart_player,
    gsis_player
  })
}

export default resolve_play_stat_player
