// Columns whose emitted SQL depends on WHO is asking.
//
// The data-view result cache is keyed on the table state alone
// (`get-data-view-hash.mjs`), and that key namespace is shared by the HTTP
// search route, the export route and the websocket. A column that renders
// differently per viewer therefore cannot go into that cache under a
// viewer-independent key -- the first requester's rows would be served
// verbatim to everyone else, including anonymous callers.
//
// This list is what lets the hash stay viewer-independent for the overwhelming
// majority of views (pure NFL data, no identity in the answer) while sharding
// only the ones that need it. Keeping it as a bare id set, rather than reading
// the column definitions, keeps this module free of the column-definition
// import graph so it can be used from the routes and the socket.
//
// `test/data-views.viewer-scoped-columns.spec.mjs` asserts this set is exactly
// the set of definitions carrying `is_viewer_scoped: true`, so the two cannot
// drift.
export const viewer_scoped_column_ids = new Set([
  'player_league_roster_tag',
  'player_league_roster_status'
])

const get_column_id = (column) =>
  typeof column === 'string' ? column : column?.column_id

export const table_state_is_viewer_scoped = ({
  columns = [],
  prefix_columns = [],
  where = []
} = {}) =>
  [...columns, ...prefix_columns, ...where].some((entry) =>
    viewer_scoped_column_ids.has(get_column_id(entry))
  )
