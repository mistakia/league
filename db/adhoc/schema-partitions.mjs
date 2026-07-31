// Partition-child membership for the league schema, derived from the dump.
//
// Shared by db/adhoc/audit-schema-conformance.mjs and
// db/adhoc/generate-migration-inventory.mjs. Both previously carried their own
// copy of a `<base>_year_YYYY` regex, and both were wrong the same way: that is
// one of four child-naming schemes actually present in this schema, so each tool
// silently treated 27-35 partition children as logical tables of their own.
//
// pg_dump writes an `ALTER TABLE ... ATTACH PARTITION` line for every child, so
// membership can be READ rather than guessed. That is what makes this
// recurrence-proof: a future partition scheme with a fifth naming convention is
// recognised with no edit to this file. It is also self-checking -- the set it
// returns matches `pg_class.relispartition` in league_production exactly (116
// children as of 2026-07-31), and total parsed tables minus this set is the 171
// logical tables production reports.

// Every table attached as a partition of another table.
export function parse_partition_children(sql) {
  const children = new Set()
  const re =
    /^ALTER TABLE ONLY (?:public\.)?[A-Za-z0-9_]+ ATTACH PARTITION (?:public\.)?([A-Za-z0-9_]+)/gm
  let m
  while ((m = re.exec(sql))) children.add(m[1])
  return children
}

// Parent -> sorted child list, for callers that want to record the partitions
// alongside the logical table rather than just skip them.
export function parse_partition_map(sql) {
  const map = new Map()
  const re =
    /^ALTER TABLE ONLY (?:public\.)?([A-Za-z0-9_]+) ATTACH PARTITION (?:public\.)?([A-Za-z0-9_]+)/gm
  let m
  while ((m = re.exec(sql))) {
    if (!map.has(m[1])) map.set(m[1], [])
    map.get(m[1]).push(m[2])
  }
  for (const kids of map.values()) kids.sort()
  return map
}
