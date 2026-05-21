import debug from 'debug'

import { fetch_with_retry } from '#libs-server/proxy-manager.mjs'
import { get_draftkings_config } from './draftkings-config.mjs'

const api_log = debug('draft-kings:dfs:api')

const get_draftkings_contests = async () => {
  const draftkings_config = await get_draftkings_config()
  const url = draftkings_config.draftkings_contests_url
  api_log(`DK API REQUEST: ${url}`)
  const data = await fetch_with_retry({ url, response_type: 'json' })
  return data
}

export const get_draftkings_draft_groups = async () => {
  const data = await get_draftkings_contests()
  return data.DraftGroups
}

export const get_draftkings_nfl_draft_groups = async () => {
  const draft_groups = await get_draftkings_draft_groups()
  return draft_groups.filter(
    (draft_group) => draft_group.Sport === 'NFL' && draft_group.GameTypeId === 1
  )
}

export const get_draftkings_draft_group_draftables = async ({
  draft_group_id
}) => {
  const draftkings_config = await get_draftkings_config()
  const url = `${draftkings_config.draftkings_salary_url}/${draft_group_id}/draftables`
  api_log(`DK API REQUEST: ${url}`)
  const data = await fetch_with_retry({ url, response_type: 'json' })
  return data
}

export const get_draftkings_nfl_lobby_contests = async () => {
  const data = await get_draftkings_contests()
  if (!data || !data.Contests) {
    return []
  }
  return data.Contests.filter(
    (contest) => contest.gameType === 'Classic' || contest.GameTypeId === 1
  )
}

export const get_draftkings_contest_detail = async ({ contest_id }) => {
  const url = `https://api.draftkings.com/contests/v1/contests/${contest_id}`
  api_log(`DK API REQUEST: ${url}`)
  const data = await fetch_with_retry({ url, response_type: 'json' })
  return data
}

export const parse_draftkings_ownership_csv = ({ csv_text }) => {
  if (!csv_text || csv_text.trim().length === 0) {
    return []
  }

  // CSV format: Rank,EntryId,EntryName,TimeRemaining,Points,Lineup,,Player,Roster Position,%Drafted,FPTS
  // Ownership data is in columns 7-10 (after empty separator column 6).
  // All rows (standings + overflow) contain ownership data in those columns.
  const lines = csv_text.split('\n')
  const ownership_rows = []
  const seen_players = new Set()

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue

    // Skip header row
    if (i === 0 && trimmed.includes('%Drafted')) continue

    const parts = trimmed.split(',')
    if (parts.length < 11) continue

    const player_name = parts[7].trim()
    const roster_position = parts[8].trim()
    const pct_drafted_raw = parts[9].trim()
    const fpts_raw = parts[10].trim()

    if (!player_name || !pct_drafted_raw) continue

    const ownership_pct = parseFloat(pct_drafted_raw.replace('%', ''))
    const fpts = parseFloat(fpts_raw)

    if (isNaN(ownership_pct)) continue

    // Deduplicate -- each player appears once in ownership data
    const player_key = `${player_name}_${roster_position}`
    if (seen_players.has(player_key)) continue
    seen_players.add(player_key)

    ownership_rows.push({
      player_name,
      roster_position,
      ownership_pct,
      fpts: isNaN(fpts) ? null : fpts
    })
  }

  return ownership_rows
}
