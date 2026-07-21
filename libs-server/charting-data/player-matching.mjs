import debug from 'debug'

import db from '#db'
import { fixTeam, format_player_name } from '#libs-shared'
import player_cache from '#libs-server/player-cache.mjs'

const log = debug('charting-data:player-matching')

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
    db('player').select('pid').where('jersey_number', jersey_number)

  // Try: exact last_name + team
  if (normalized_team) {
    const rows = await base_query()
      .whereRaw('LOWER(last_name) = ?', [last_name.toLowerCase()])
      .where('current_nfl_team', normalized_team)
      .limit(2)
    if (rows.length === 1) return { pid: rows[0].pid }
  }

  // Try: exact last_name without team (offseason moves)
  const rows_no_team = await base_query()
    .whereRaw('LOWER(last_name) = ?', [last_name.toLowerCase()])
    .limit(2)
  if (rows_no_team.length === 1) return { pid: rows_no_team[0].pid }

  // Try: last_name starts with (handles "Walker" matching "Walker III")
  if (normalized_team) {
    const rows_prefix = await base_query()
      .whereRaw('LOWER(last_name) LIKE ?', [`${last_name.toLowerCase()} %`])
      .where('current_nfl_team', normalized_team)
      .limit(2)
    if (rows_prefix.length === 1) return { pid: rows_prefix[0].pid }
  }

  const rows_prefix_no_team = await base_query()
    .whereRaw('LOWER(last_name) LIKE ?', [`${last_name.toLowerCase()} %`])
    .limit(2)
  if (rows_prefix_no_team.length === 1)
    return { pid: rows_prefix_no_team[0].pid }

  return null
}

export async function match_charting_player({
  sumer_player_id,
  football_name,
  last_name,
  team_code,
  jersey_number,
  position
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

  // Try with team filter first (handles most cases)
  const teams = normalized_team ? [normalized_team] : []
  let matched_player = player_cache.find_player({
    name: formatted_name,
    teams
  })

  // Fallback: try without team filter (handles offseason team changes)
  if (!matched_player && normalized_team) {
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
      normalized_team
    })
  }

  if (!matched_player) {
    log(
      `unmatched player: ${full_name} (${normalized_team || 'no team'}, #${jersey_number || '?'}, ${position || '?'}, sumer_id: ${sumer_player_id})`
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
