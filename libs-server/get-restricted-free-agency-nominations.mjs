import dayjs from 'dayjs'

import db from '#db'
import { current_season } from '#constants'

// Load a league's restricted free agency nominations, keyed by player.
//
// The nomination is the auction: one row per (league, player, season), holding
// the window timestamps that describe the PLAYER's nomination rather than any
// one bid. Before this table existed those timestamps were written onto the
// nominating team's own bid, so every competing bid carried a null `announced`
// and reading it per bid coerced to epoch 0 -- placing the bid tens of thousands
// of windows in the past and making it due the instant it was submitted.
//
// `announced_at` is a timestamptz, so it is converted with `dayjs(value).unix()`
// and never `dayjs.unix(value)` or `Number(value)`: the first of those yields a
// nonsense year and the second yields milliseconds, and neither throws.
export default async function get_restricted_free_agency_nominations({
  lid,
  year = current_season.year
}) {
  const nomination_rows = await db('restricted_free_agency_nominations').where({
    league_id: lid,
    season_year: year
  })

  const nominations_by_pid = {}
  for (const row of nomination_rows) {
    nominations_by_pid[row.player_id] = {
      nomination_id: row.nomination_id,
      original_team_id: row.original_team_id,
      announced: row.announced_at ? dayjs(row.announced_at).unix() : null,
      nominated: row.nominated_at ? dayjs(row.nominated_at).unix() : null
    }
  }

  return nominations_by_pid
}
