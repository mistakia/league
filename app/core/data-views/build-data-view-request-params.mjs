// Builds the params for one data-view results request. Shared by the data-views
// page and the plays page, which mirror each other closely enough that they had
// the SAME defect below in two copies -- one place is what keeps the next fix
// from landing on only one of them.
//
// This exists as its own function for one reason: `offset` is a per-REQUEST
// cursor and must NOT be inherited from table_state, and the only thing
// enforcing that inside an object literal is key ORDER. Reorder the spread and
// the bug below comes back silently, which is why the rule is named and tested
// here rather than left as a spread ordering nobody would think to preserve.
//
// The bug: `offset` used to be STORED in table_state. Every table_state change
// spreads the previous state forward, so scrolling to page two left
// `offset: 500` on the view, and the next column add, sort or filter re-ran the
// query from row 500. Those requests replace rather than append, so the top 500
// rows dropped out of the table. A shared /u/<hash> link was the one path that
// never showed it, because parse-table-state-from-url rebuilds table_state from
// a whitelist with no offset in it.
//
// Pinning the cursor here makes that unrepresentable: a request that did not
// ask to paginate starts at row 0 no matter what a saved view, a localStorage
// snapshot or a URL is still carrying, so legacy stored offsets are inert
// rather than needing a migration.
// `query_id` is a property of the VIEW, not of table_state, and it is carried
// here rather than inside the spread for the reason SQL never enters
// table_state at all: table_state is a pure display contract that crosses five
// representations, two of which are hand-maintained URL key whitelists that
// drop what they do not know about, silently. One scalar named alongside
// `view_id` crosses them by the same route `view_id` already does.
export default function build_data_view_request_params({
  view_id,
  table_state,
  query_id = null,
  offset = 0,
  append_results = false
}) {
  return {
    view_id,
    ...table_state,
    ...(query_id ? { query_id } : {}),
    offset,
    append_results
  }
}
