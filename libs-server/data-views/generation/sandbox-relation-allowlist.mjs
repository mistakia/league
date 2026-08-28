import {
  build_grant_plan,
  read_schema_sql
} from '#db/tools/generate-data-view-reader-grants.mjs'

// The parse-time table allowlist and the role's GRANT list are the SAME list,
// derived from the same classification, so they cannot drift apart. Two hand
// maintained copies would, and the direction of that drift is a statement the
// parser accepts and the role then denies -- or worse, the reverse once the
// GRANT list is widened.
//
// Why the parser needs a table allowlist at all when the GRANTs already bound
// what the role can read: pg_stat_statements is granted to PUBLIC, so no
// per-table GRANT can deny it. That is the one relation where "the allowlist
// ratchets in the safe direction" is false, and only the parser stops it.
//
// Built lazily and memoized. The oracle is db/schema.postgres.sql, a 2MB file,
// and the cost belongs on the first sandboxed query rather than on every server
// start.
let memoized_allowlist = null

export const get_sandbox_relation_allowlist = () => {
  if (!memoized_allowlist) {
    memoized_allowlist = new Set(build_grant_plan(read_schema_sql()).granted)
  }
  return memoized_allowlist
}
