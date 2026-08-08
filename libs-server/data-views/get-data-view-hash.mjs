import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { table_state_is_viewer_scoped } from '#libs-server/data-views/viewer-scoped-columns.mjs'

// `user_id` is REQUIRED rather than defaulted, and `undefined` throws.
//
// The cache key namespace is shared by the HTTP search route, the export route
// and the websocket. If a caller could silently omit the viewer, an
// authenticated request carrying a viewer-scoped column would hash as anonymous
// and write its own rows -- which may include another manager's private
// restricted free agency tags -- under the key every anonymous caller reads.
// A missing argument has to be loud; pass an explicit `null` for anonymous.
export default function get_data_view_hash({
  row_axes = [],
  row_grain = [],
  where = [],
  columns = [],
  prefix_columns = [],
  sort = [],
  offset = 0,
  limit = 500,
  user_id
}) {
  if (user_id === undefined) {
    throw new Error(
      'get_data_view_hash requires user_id; pass null for an anonymous viewer'
    )
  }

  // Only viewer-scoped table states get sharded. Everything else keeps the
  // viewer-independent key it has always had, so this change neither
  // invalidates the existing cache nor costs hit rate on ordinary views.
  const viewer = table_state_is_viewer_scoped({
    columns,
    prefix_columns,
    where
  })
    ? user_id
    : null

  // The row grain decides the SUBJECT of every row, so two table states that
  // differ only in it describe entirely different result sets -- one row per
  // player against one row per team. Omitting it here collided those two onto
  // one key: a team-grain view served the player-grain rows another caller had
  // written, ~500 players each repeating their team's numbers.
  //
  // `get_data_view_results` defaults an absent grain to player, so an absent
  // grain, `[]` and `['player']` are the same request and must hash alike.
  // Player grain is folded into the empty case for that reason, which also
  // keeps every existing player-grain key valid.
  const row_grain_id = row_grain[0] || 'player'

  return get_table_hash(
    JSON.stringify({
      row_axes,
      where,
      columns,
      prefix_columns,
      sort,
      offset,
      limit,
      ...(row_grain_id === 'player' ? {} : { row_grain: [row_grain_id] }),
      ...(viewer === null ? {} : { viewer })
    })
  )
}
