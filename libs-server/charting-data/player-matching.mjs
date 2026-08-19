import debug from 'debug'

import db from '#db'
import { fixTeam, format_player_name } from '#libs-shared'
import { current_season } from '#constants'
import player_cache from '#libs-server/player-cache.mjs'
import { player_could_have_played } from '#libs-server/player-era.mjs'

const log = debug('charting-data:player-matching')

// Columns the era falsifier reads. A lookup that selects only `pid` cannot be
// era-checked, and the check silently degrades to a pass -- so any query
// feeding a match here has to carry these.
const ERA_COLUMNS = ['pid', 'nfl_draft_year', 'draft_round', 'date_of_birth']

const sumer_id_cache = new Map()
let load_promise = null

async function load_sumer_id_cache() {
  if (sumer_id_cache.size > 0) return
  if (load_promise) return load_promise

  load_promise = (async () => {
    const rows = await db('player')
      .select('pid', 'sumer_player_id')
      .whereNotNull('sumer_player_id')
    for (const row of rows) {
      sumer_id_cache.set(row.sumer_player_id, row.pid)
    }
    log(`loaded ${sumer_id_cache.size} sumer_id mappings`)
  })()

  await load_promise
  load_promise = null
}

async function _query_player_by_last_name_and_jersey({
  last_name,
  jersey_number,
  normalized_team
}) {
  // Exact last name match with team
  const base_query = () =>
    db('player').select(ERA_COLUMNS).where('jersey_number', jersey_number)

  // Try: exact last_name + team
  if (normalized_team) {
    const rows = await base_query()
      .whereRaw('LOWER(last_name) = ?', [last_name.toLowerCase()])
      .where('current_nfl_team', normalized_team)
      .limit(2)
    if (rows.length === 1) return rows[0]
  }

  // Try: exact last_name without team (offseason moves)
  const rows_no_team = await base_query()
    .whereRaw('LOWER(last_name) = ?', [last_name.toLowerCase()])
    .limit(2)
  if (rows_no_team.length === 1) return rows_no_team[0]

  // Try: last_name starts with (handles "Walker" matching "Walker III")
  if (normalized_team) {
    const rows_prefix = await base_query()
      .whereRaw('LOWER(last_name) LIKE ?', [`${last_name.toLowerCase()} %`])
      .where('current_nfl_team', normalized_team)
      .limit(2)
    if (rows_prefix.length === 1) return rows_prefix[0]
  }

  const rows_prefix_no_team = await base_query()
    .whereRaw('LOWER(last_name) LIKE ?', [`${last_name.toLowerCase()} %`])
    .limit(2)
  if (rows_prefix_no_team.length === 1) return rows_prefix_no_team[0]

  return null
}

/**
 * @param {object} params
 * @param {number} [params.season_year] - the season the charting row belongs
 *   to. Supply it. Without it this falls back to matching a historical row
 *   against the player's team TODAY, which is the defect described below.
 */
export async function match_charting_player({
  sumer_player_id,
  football_name,
  last_name,
  team_code,
  jersey_number,
  position,
  season_year
}) {
  await load_sumer_id_cache()

  // Fast path: check existing sumer_id mapping
  if (sumer_player_id && sumer_id_cache.has(sumer_player_id)) {
    return sumer_id_cache.get(sumer_player_id)
  }

  // Fall back to name + team matching via player cache
  const normalized_team = team_code ? fixTeam(team_code) : null
  const full_name = [football_name, last_name].filter(Boolean).join(' ')
  const formatted_name = format_player_name(full_name)

  if (!formatted_name) {
    log(`cannot match player: no name provided (sumer_id: ${sumer_player_id})`)
    return null
  }

  // `player.current_nfl_team` and `player.roster_status` describe the player
  // TODAY. Against a historical charting row they are not weak evidence, they
  // are evidence about the wrong season -- and they fail in both directions at
  // once: the team filter excludes the right player once he has been traded,
  // while `ignore_retired` excludes every player who has since retired, which
  // for an old season is most of the roster. Neither says anything about who
  // was on the field in the season being imported.
  //
  // So for a historical season they are dropped rather than trusted, and the
  // era falsifier below replaces them. That trade is deliberate: dropping the
  // filters WIDENS the candidate set, but the widening is absorbed by
  // player_cache's own abstention -- it returns null on more than one match
  // rather than guessing -- so the failure mode moves from a confident wrong
  // match to an abstention, which is the direction this whole task wants.
  const is_historical_season =
    Boolean(season_year) && season_year < current_season.year
  const teams =
    !is_historical_season && normalized_team ? [normalized_team] : []
  let matched_player = player_cache.find_player({
    name: formatted_name,
    teams,
    ignore_retired: !is_historical_season,
    ignore_free_agent: !is_historical_season
  })

  // Fallback: try without team filter (handles offseason team changes). Already
  // unscoped on the historical path, so there is nothing left to relax.
  if (!matched_player && normalized_team && !is_historical_season) {
    matched_player = player_cache.find_player({
      name: formatted_name,
      teams: [],
      ignore_free_agent: false
    })
  }

  // Fallback: direct DB query by last name + jersey number
  // Handles nickname mismatches (e.g., "Cobie"/"Decobie", "Ikem"/"Ikemefuna")
  // and team changes where the name-based cache lookup returns multiple matches
  if (!matched_player && last_name && jersey_number) {
    matched_player = await _query_player_by_last_name_and_jersey({
      last_name,
      jersey_number,
      normalized_team: is_historical_season ? null : normalized_team
    })
  }

  if (!matched_player) {
    log(
      `unmatched player: ${full_name} (${normalized_team || 'no team'}, #${jersey_number || '?'}, ${position || '?'}, sumer_id: ${sumer_player_id})`
    )
    return null
  }

  // The era falsifier, and the reason dropping the filters above is safe. It
  // rejects only the provably impossible, so it cannot turn a correct match
  // into a miss -- but it does catch the case the recency filters never could:
  // a single same-named row that had not entered the league in this season.
  // Abstaining here is the point. The next step WRITES `sumer_player_id` onto
  // the row, which is what makes a wrong match permanent.
  if (
    season_year &&
    !player_could_have_played({ player: matched_player, season_year })
  ) {
    log(
      `era-impossible charting match refused: ${full_name} (sumer_id: ${sumer_player_id}) matched ${matched_player.pid}, which could not have played in ${season_year} (nfl_draft_year=${matched_player.nfl_draft_year}, draft_round=${matched_player.draft_round}, date_of_birth=${matched_player.date_of_birth})`
    )
    return null
  }

  // On successful match, update sumer_id for future lookups
  if (sumer_player_id) {
    try {
      // Check if another player already has this sumer_id
      const existing = await db('player')
        .where({ sumer_player_id })
        .first('pid')
      if (existing && existing.pid !== matched_player.pid) {
        log(
          `sumer_id ${sumer_player_id} already assigned to ${existing.pid}, skipping update for ${matched_player.pid}`
        )
      } else if (!existing) {
        await db('player')
          .where({ pid: matched_player.pid })
          .update({ sumer_player_id })
        sumer_id_cache.set(sumer_player_id, matched_player.pid)
        log(
          `mapped sumer_id ${sumer_player_id} -> ${matched_player.pid} (${full_name})`
        )
      }
    } catch (error) {
      log(
        `failed to update sumer_id for ${matched_player.pid}: ${error.message}`
      )
    }
  }

  return matched_player.pid
}

export function extract_players_from_plays(plays) {
  const players = new Map()

  for (const play of plays) {
    const nested_players =
      play.sumerPlayerPlaysInGameNflsBySumerPlayIdAndSeasonList || []
    for (const player_entry of nested_players) {
      const sumer_id = player_entry.sumerPlayerId
      if (!sumer_id || players.has(sumer_id)) continue

      players.set(sumer_id, {
        sumer_player_id: sumer_id,
        football_name: player_entry.footballName,
        last_name: player_entry.lastName,
        team_code: player_entry.currentTeamCode,
        jersey_number: player_entry.jerseyNumber,
        position: player_entry.position
      })
    }
  }

  return Array.from(players.values())
}

export function extract_players_from_matchups(matchup_stats) {
  const players = new Map()

  for (const matchup of matchup_stats) {
    const off_id = matchup.offensePlayerId
    if (off_id && !players.has(off_id)) {
      players.set(off_id, {
        sumer_player_id: off_id,
        football_name: matchup.offensePlayerFirstName,
        last_name: matchup.offensePlayerLastName,
        team_code: matchup.offenseTeamCode,
        jersey_number: matchup.offenseJerseyNumber,
        position: matchup.offensePosition
      })
    }

    const def_id = matchup.defensePlayerId
    if (def_id && !players.has(def_id)) {
      players.set(def_id, {
        sumer_player_id: def_id,
        football_name: matchup.defensePlayerFirstName,
        last_name: matchup.defensePlayerLastName,
        team_code: matchup.defenseTeamCode,
        jersey_number: matchup.defenseJerseyNumber,
        position: matchup.defensePosition
      })
    }
  }

  return Array.from(players.values())
}

export function reset_sumer_id_cache() {
  sumer_id_cache.clear()
  load_promise = null
}
