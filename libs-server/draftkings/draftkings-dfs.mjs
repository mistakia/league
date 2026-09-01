import debug from 'debug'

import { fetch_with_retry } from '#libs-server/proxy-manager.mjs'
import { get_draftkings_config } from './draftkings-config.mjs'

const api_log = debug('draft-kings:dfs:api')

// The residential-egress pool every DK DFS fetch goes over. The shared `default`
// (Toolip) pool is co-tenanted, and DraftKings blocks it: measured 2026-08-31
// from base-storage against the lobby endpoint, `default` failed 2 of 10 calls
// with `HTTP 403: Forbidden` while `nfl_pro` and direct each failed 0 of 10.
// That 403 is the same string the salary importer logged on 43 runs, which is
// how weeks 2025 REG 6, 7, 9, 12 and 17 ended up with no salaries at all.
//
// Spelled as a literal for the same reason `import-espn-line-win-rates.mjs`
// spells it: `private/` is an empty directory in any clone and on the runner, so
// this must not import the NFL Pro module that names the same pool.
//
// Shared blast radius: these are three dedicated ISP addresses also used by NFL
// Pro and ESPN, so a DK flag costs those feeds too. Keep request volume modest
// and paced. See [[user:guideline/software/vendor-egress-proxy-posture.md]].
const DRAFTKINGS_PROXY_POOL = 'nfl_pro'

// requires_proxy is load-bearing, not decorative: proxy-manager fails OPEN twice
// (an unresolved pool name silently falls back to `default`, and an exhausted
// pool silently fetches direct out of the host WAN). Either would put us back on
// the egress this pin exists to leave, and neither raises anything.
const dfs_fetch = async ({ url, response_type = 'json' }) => {
  api_log(`DK API REQUEST: ${url}`)
  return fetch_with_retry({
    url,
    use_proxy: true,
    requires_proxy: true,
    proxy_pool: DRAFTKINGS_PROXY_POOL,
    response_type
  })
}

const get_draftkings_contests = async () => {
  const draftkings_config = await get_draftkings_config()
  return dfs_fetch({ url: draftkings_config.draftkings_contests_url })
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
  return dfs_fetch({ url })
}

// Draft-group METADATA, addressed by id. Note the path is not a sub-path of
// `draftkings_salary_url` (.../draftgroups/v1/draftgroups): the metadata route is
// one level up at .../draftgroups/v1/{id}, and .../draftgroups/{id} answers 404.
//
// The response is ~1KB against ~1MB for the matching draftables, which is what
// makes an id SCAN affordable — the backfill uses it to decide whether an id is
// worth a full fetch. Returns null for an id that does not exist, since scanning
// a range means asking about ids that never existed and that is not an error.
//
// DraftKings serves this for long-retired groups: verified 2026-08-31 back to
// draft group 58810 (2021 REG week 10).
export const get_draftkings_draft_group_metadata = async ({
  draft_group_id
}) => {
  const url = `https://api.draftkings.com/draftgroups/v1/${draft_group_id}?format=json`
  try {
    const data = await dfs_fetch({ url })
    return data?.draftGroup ?? null
  } catch (err) {
    if (/\b404\b/.test(String(err.message))) {
      return null
    }
    throw err
  }
}

// Classic NFL. This is the contest type the live lobby importer selects with
// `GameTypeId === 1`, and the id scan must select the SAME population or a
// backfilled week would not be comparable to an imported one.
//
// Derived empirically rather than reasoned about: every one of the 161 draft
// groups already present in `player_salaries` resolves to contestTypeId 21,
// with no other value appearing (measured 2026-08-31).
//
// `gameType: 'SalaryCap'` alone is far too broad — 66 NFL SalaryCap groups sit
// in the 2025 week 7 id range across 13 contest types, including Madden Stream
// simulations (158/159), employee-only pools (282), season-long tournaments
// (145), and single-stat prop pools (353/354). Only the four ctid-21 groups are
// real Classic slates over real games.
const DRAFTKINGS_NFL_CLASSIC_CONTEST_TYPE_ID = 21

export const is_nfl_salary_slate = (draft_group) => {
  if (!draft_group) return false
  const contest_type = draft_group.contestType || {}
  if (contest_type.sport !== 'NFL') return false
  return contest_type.contestTypeId === DRAFTKINGS_NFL_CLASSIC_CONTEST_TYPE_ID
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
  return dfs_fetch({ url })
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

    const ownership_percentage = parseFloat(pct_drafted_raw.replace('%', ''))
    const fpts = parseFloat(fpts_raw)

    if (isNaN(ownership_percentage)) continue

    // Deduplicate -- each player appears once in ownership data
    const player_key = `${player_name}_${roster_position}`
    if (seen_players.has(player_key)) continue
    seen_players.add(player_key)

    ownership_rows.push({
      player_name,
      roster_position,
      ownership_percentage,
      fpts: isNaN(fpts) ? null : fpts
    })
  }

  return ownership_rows
}
