#!/usr/bin/env node

/**
 * Emits the explicit `GRANT SELECT` list for `league_data_view_reader`, the
 * role the sandboxed-SQL data-view tier connects as.
 *
 * The method is the point. An earlier draft of this allowlist was "grant
 * broadly across the football-data tables, minus these exclusions", with the
 * exclusions written from recollection. A 2026-08-28 review against the live
 * cluster found that method had missed `public.config` (27 rows of third-party
 * API credentials and a Discord webhook), the admission-vote table that
 * actually holds ballot content, a second saved-views table, and seven others.
 * A recalled exclusion list is applied once against the schema of the day and
 * never re-examined.
 *
 * So the grant is ENUMERATED: every relation in `public` is classified here by
 * name, the granted ones are printed one per line with no wildcard and no
 * `ALL TABLES IN SCHEMA` form, and every exclusion carries the reason it is
 * excluded. A relation added to the schema later is denied by default -- the
 * role deliberately receives no `ALTER DEFAULT PRIVILEGES` grant on either the
 * TABLES or the SEQUENCES arm -- so the allowlist ratchets in the safe
 * direction and widening it later is a reviewed edit to this file.
 *
 * The oracle is `db/schema.postgres.sql`, which `yarn export:schema` generates
 * from the live database and which the schema-conformance ratchet keeps honest.
 *
 * Usage:
 *   node db/tools/generate-data-view-reader-grants.mjs            # grant lines
 *   node db/tools/generate-data-view-reader-grants.mjs --report   # + exclusions
 *
 * This is a TOOL, not a gate: it carries no verdict wired to a run. It does
 * throw on the two conditions that would make its output wrong -- a granted
 * VIEW whose definition reads an excluded relation (a view executes with its
 * owner's privileges, so a table-level exclusion does not bind it), and an
 * exclusion naming a relation that no longer exists (a stale entry excludes
 * nothing while reading as a deliberate exclusion).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

export const SANDBOX_ROLE = 'league_data_view_reader'

// Every excluded relation and the reason. Grouped by why, because the reason
// is what a reviewer checks -- a name alone cannot be reviewed.
export const EXCLUDED_RELATIONS = new Map([
  // Account and identity
  ['users', 'password hash, email, invite code'],
  ['invite_codes', 'grants account creation'],
  ['manager_waitlist_submissions', 'candidate PII from non-members'],

  // Admission voting -- the whole family. The ballot CONTENT is in
  // admission_vote_ballot_preferences, not the ballots table an earlier draft
  // named; the candidate tables join straight back to the waitlist PII.
  ['admission_votes', 'admission vote family: secret ballot process'],
  [
    'admission_vote_ballots',
    'admission vote family: ballot submission metadata'
  ],
  [
    'admission_vote_ballot_preferences',
    'admission vote family: the secret ballot content itself'
  ],
  [
    'admission_vote_candidates',
    'admission vote family: candidate names, joins to waitlist PII'
  ],
  [
    'admission_vote_candidate_sponsors',
    'admission vote family: who sponsored whom'
  ],
  ['admission_vote_eligible_teams', 'admission vote family: electorate roll'],

  // Credentials and third-party secrets
  ['config', 'third-party API credentials and the Discord webhook URL'],
  ['sources', 'source endpoint URLs, which can carry an embedded API key'],
  ['jobs', 'failure reasons quote vendor responses and request URLs'],

  // Wagering
  ['placed_wagers', "the operator's own wager history"],

  // Saved views and their metadata -- every other user's work
  ['user_data_views', "every other user's saved data views"],
  ['user_plays_views', "every other user's saved plays views"],
  ['user_data_view_favorites', 'saved-view metadata keyed to a user'],
  ['user_data_view_tags', 'saved-view metadata keyed to a user'],
  ['urls', 'every shared view URL, including unlisted ones'],

  // Viewer-scoped roster state. Arbitrary SQL over this defeats the
  // viewer-scoping the data-view cache key protects.
  ['rosters_players', 'backs the viewer-scoped roster tags'],

  // In-league private strategy. A pending bid is secret by the rules of the
  // game until it processes, and these tables hold pending ones.
  ['waivers', 'pending waiver bids: amount and bidder before processing'],
  [
    'waiver_releases',
    'the conditional releases attached to a pending waiver bid'
  ],
  ['restricted_free_agency_bids', 'pending restricted free agency bid amounts'],
  ['bid_changelog', 'bid amendment history across both bid types'],
  ['league_cutlist', "a team's private cut priority order"],

  // External league imports -- third-party credentials and the private league
  // contents they were used to fetch.
  ['external_league_connections', 'credentials_encrypted'],
  ['external_league_import_jobs', 'raw_data, mapped_data, error_context'],
  ['external_leagues', 'imported third-party private league contents'],
  ['external_league_memberships', 'imported third-party league membership'],
  ['external_league_users', 'third-party display names'],
  ['external_league_trades', 'imported third-party private league contents'],
  [
    'external_league_trade_legs',
    'imported third-party private league contents'
  ],

  // User-generated contributions, including uploaded images
  ['contribution_submissions', 'contribution family: user-submitted content'],
  ['contribution_answers', 'contribution family: user-submitted content'],
  ['contribution_questions', 'contribution family: user-submitted content'],
  ['contribution_events', 'contribution family: user-submitted content'],
  ['contribution_screenshots', 'contribution family: image_data'],
  [
    'contribution_trust_overrides',
    'contribution family: per-user trust adjudication'
  ],

  // Per-user association and delivery
  ['league_notifications', 'notification delivery addressed to a user'],
  ['users_sources', 'per-user source association'],
  ['users_teams', 'per-user team association'],

  // Operator identity on internal adjudication
  ['player_field_override', "carries the adjudicating operator's identity"],

  // Migration bookkeeping: no analytical content, and a moving target
  ['league_migrations', 'migration bookkeeping'],
  ['league_migrations_lock', 'migration bookkeeping']
])

const relations_from_schema = (schema_sql) => {
  const tables = []
  const views = []
  const table_pattern = /^CREATE TABLE public\.([a-z0-9_]+) \(/gm
  const view_pattern = /^CREATE VIEW public\.([a-z0-9_]+) AS/gm
  let match
  while ((match = table_pattern.exec(schema_sql))) tables.push(match[1])
  while ((match = view_pattern.exec(schema_sql))) views.push(match[1])
  return { tables, views }
}

// A view runs with its OWNER's privileges, so granting SELECT on a view hands
// out everything the view reads regardless of the table-level exclusions. This
// reads each granted view's body out of the dump and refuses any that names an
// excluded relation.
const assert_no_view_reads_an_excluded_relation = ({ schema_sql, views }) => {
  for (const view of views) {
    const start = schema_sql.indexOf(`CREATE VIEW public.${view} AS`)
    if (start === -1) throw new Error(`view ${view} not found in schema dump`)
    const end = schema_sql.indexOf('\n\n', start)
    const body = schema_sql.slice(start, end === -1 ? undefined : end)
    for (const excluded of EXCLUDED_RELATIONS.keys()) {
      const reads_it = new RegExp(`\\bpublic\\.${excluded}\\b`).test(body)
      if (reads_it) {
        throw new Error(
          `view ${view} reads excluded relation ${excluded}; a view executes ` +
            'with its owner privileges, so it cannot be granted'
        )
      }
    }
  }
}

const assert_no_stale_exclusion = ({ tables, views }) => {
  const present = new Set([...tables, ...views])
  const stale = [...EXCLUDED_RELATIONS.keys()].filter((r) => !present.has(r))
  if (stale.length) {
    throw new Error(
      `exclusion list names ${stale.length} relation(s) absent from the schema: ${stale.join(', ')}`
    )
  }
}

export const build_grant_plan = (schema_sql) => {
  const { tables, views } = relations_from_schema(schema_sql)
  assert_no_stale_exclusion({ tables, views })

  const granted_tables = tables.filter((t) => !EXCLUDED_RELATIONS.has(t))
  const granted_views = views.filter((v) => !EXCLUDED_RELATIONS.has(v))
  assert_no_view_reads_an_excluded_relation({
    schema_sql,
    views: granted_views
  })

  return {
    granted: [...granted_tables, ...granted_views].sort(),
    excluded: [...tables, ...views]
      .filter((r) => EXCLUDED_RELATIONS.has(r))
      .sort()
      .map((r) => ({ relation: r, reason: EXCLUDED_RELATIONS.get(r) })),
    relation_count: tables.length + views.length
  }
}

export const read_schema_sql = () =>
  fs.readFileSync(path.join(repo_root, 'db', 'schema.postgres.sql'), 'utf8')

const main = () => {
  const plan = build_grant_plan(read_schema_sql())
  const report = process.argv.includes('--report')

  if (report) {
    console.log(`-- ${plan.relation_count} relations in public`)
    console.log(
      `-- ${plan.granted.length} granted, ${plan.excluded.length} excluded`
    )
    console.log('--')
    for (const { relation, reason } of plan.excluded) {
      console.log(`-- EXCLUDED ${relation}: ${reason}`)
    }
    console.log('--')
  }

  for (const relation of plan.granted) {
    console.log(`GRANT SELECT ON public.${relation} TO ${SANDBOX_ROLE};`)
  }
}

if (
  process.argv[1] &&
  process.argv[1].endsWith('generate-data-view-reader-grants.mjs')
) {
  main()
}
