#!/usr/bin/env node

/**
 * Emits the explicit `GRANT SELECT` list for each scoped reader role.
 *
 * Two roles exist, and they are deliberately NOT one role holding the union:
 *
 *   - `league_data_view_reader` -- the sandboxed-SQL data-view tier, whose
 *     caller writes the statement.
 *   - `league_contribution_reader` -- the contribution reproduction substrate,
 *     which re-executes registry-generated SQL from a captured table_state to
 *     confirm a reported bug.
 *
 * They read overlapping but different relation sets. Widening the data-view
 * tier's allowlist to serve reproduction would weaken a user-facing control for
 * an unrelated reason, so each role's list is reviewed on its own terms and the
 * shared machinery is only the classification method below.
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
 *   node db/tools/generate-reader-role-grants.mjs --role <role>            # grant lines
 *   node db/tools/generate-reader-role-grants.mjs --role <role> --report   # + exclusions
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

export const DATA_VIEW_ROLE = 'league_data_view_reader'
export const CONTRIBUTION_ROLE = 'league_contribution_reader'

// Every excluded relation and the reason, for the data-view role. Grouped by
// why, because the reason is what a reviewer checks -- a name alone cannot be
// reviewed.
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

  // The sandbox's own audit trail. A sandbox that can read back every
  // statement other users have run is not one.
  ['data_view_sql_audit', "the sandbox's own audit trail"],

  // The statements themselves, for the same reason one line up and one degree
  // sharper: these are the saved statements OTHER users wrote against this very
  // role, and user_data_views is already excluded as "every other user's saved
  // data views". A query-backed view is a saved data view whose definition
  // happens to be SQL.
  ['data_view_queries', "every other user's saved SQL statement"],

  // Migration bookkeeping: no analytical content, and a moving target
  ['league_migrations', 'migration bookkeeping'],
  ['league_migrations_lock', 'migration bookkeeping'],

  // Materialized views. Until 2026-08-31 these were invisible to this tool --
  // it matched CREATE TABLE and CREATE VIEW only, so a MATERIALIZED VIEW was
  // neither granted nor classified, and `--report` claimed to enumerate every
  // relation in public while silently omitting them. They are denied to the
  // data-view role here rather than granted, which preserves the shipped
  // allowlist exactly: the tier has always been unable to read them, and this
  // entry makes that a reviewed decision instead of an accident of a regex.
  ['opening_days', 'not reachable by the registry tier; denied pending review'],
  [
    'nfl_year_week_timestamp',
    'not reachable by the registry tier; denied pending review'
  ]
])

// The contribution reproduction substrate re-executes registry-generated SQL,
// which reaches three relations the data-view tier's caller cannot name. All
// three were measured against the 280 stored data-view fixtures on 2026-08-31:
// without them, 53 of 280 fail to execute.
//
// `rosters_players` is the one worth a second look. It is excluded above
// because it backs the viewer-scoped roster tags, which is a correctness
// concern for an agent composing its own SQL rather than a secrecy one. The
// reproduction path re-runs a query a visitor already ran, so it reaches
// nothing that visitor could not already see.
const CONTRIBUTION_ADDITIONS = new Set([
  'opening_days',
  'nfl_year_week_timestamp',
  'rosters_players'
])

export const EXCLUDED_RELATIONS_BY_ROLE = new Map([
  [DATA_VIEW_ROLE, EXCLUDED_RELATIONS],
  [
    CONTRIBUTION_ROLE,
    new Map(
      [...EXCLUDED_RELATIONS].filter(
        ([relation]) => !CONTRIBUTION_ADDITIONS.has(relation)
      )
    )
  ]
])

const relations_from_schema = (schema_sql) => {
  const tables = []
  const views = []
  const table_pattern = /^CREATE TABLE public\.([a-z0-9_]+) \(/gm
  // `CREATE VIEW` must not also swallow `CREATE MATERIALIZED VIEW`: the two are
  // classified alike here but a matview's body is introduced differently, and
  // the view-body check below indexes on the exact CREATE line.
  const view_pattern = /^CREATE VIEW public\.([a-z0-9_]+) AS/gm
  const materialized_view_pattern =
    /^CREATE MATERIALIZED VIEW public\.([a-z0-9_]+) AS/gm
  let match
  while ((match = table_pattern.exec(schema_sql))) tables.push(match[1])
  while ((match = view_pattern.exec(schema_sql))) views.push(match[1])
  const materialized_views = []
  while ((match = materialized_view_pattern.exec(schema_sql))) {
    materialized_views.push(match[1])
  }
  return { tables, views, materialized_views }
}

// A view runs with its OWNER's privileges, so granting SELECT on a view hands
// out everything the view reads regardless of the table-level exclusions. This
// reads each granted view's body out of the dump and refuses any that names an
// excluded relation.
const assert_no_view_reads_an_excluded_relation = ({
  schema_sql,
  views,
  materialized_views = [],
  excluded_relations
}) => {
  const bodies = [
    ...views.map((view) => ({ view, header: `CREATE VIEW public.${view} AS` })),
    // A matview runs with its owner's privileges exactly as a view does, so
    // granting one hands out everything it reads. Same check, same reason.
    ...materialized_views.map((view) => ({
      view,
      header: `CREATE MATERIALIZED VIEW public.${view} AS`
    }))
  ]
  for (const { view, header } of bodies) {
    const start = schema_sql.indexOf(header)
    if (start === -1) throw new Error(`view ${view} not found in schema dump`)
    const end = schema_sql.indexOf('\n\n', start)
    const body = schema_sql.slice(start, end === -1 ? undefined : end)
    for (const excluded of excluded_relations.keys()) {
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

const assert_no_stale_exclusion = ({
  tables,
  views,
  materialized_views,
  excluded_relations
}) => {
  const present = new Set([...tables, ...views, ...materialized_views])
  const stale = [...excluded_relations.keys()].filter((r) => !present.has(r))
  if (stale.length) {
    throw new Error(
      `exclusion list names ${stale.length} relation(s) absent from the schema: ${stale.join(', ')}`
    )
  }
}

/**
 * @param {string} schema_sql
 * @param {object} [opts]
 * @param {string} [opts.role] - one of DATA_VIEW_ROLE, CONTRIBUTION_ROLE
 */
export const build_grant_plan = (
  schema_sql,
  { role = DATA_VIEW_ROLE } = {}
) => {
  const excluded_relations = EXCLUDED_RELATIONS_BY_ROLE.get(role)
  if (!excluded_relations) {
    throw new Error(
      `unknown reader role ${role}; expected one of ${[...EXCLUDED_RELATIONS_BY_ROLE.keys()].join(', ')}`
    )
  }

  const { tables, views, materialized_views } =
    relations_from_schema(schema_sql)
  assert_no_stale_exclusion({
    tables,
    views,
    materialized_views,
    excluded_relations
  })

  const granted_tables = tables.filter((t) => !excluded_relations.has(t))
  const granted_views = views.filter((v) => !excluded_relations.has(v))
  const granted_materialized_views = materialized_views.filter(
    (v) => !excluded_relations.has(v)
  )
  assert_no_view_reads_an_excluded_relation({
    schema_sql,
    views: granted_views,
    materialized_views: granted_materialized_views,
    excluded_relations
  })

  const all_relations = [...tables, ...views, ...materialized_views]
  return {
    role,
    granted: [
      ...granted_tables,
      ...granted_views,
      ...granted_materialized_views
    ].sort(),
    excluded: all_relations
      .filter((r) => excluded_relations.has(r))
      .sort()
      .map((r) => ({ relation: r, reason: excluded_relations.get(r) })),
    relation_count: all_relations.length
  }
}

export const read_schema_sql = () =>
  fs.readFileSync(path.join(repo_root, 'db', 'schema.postgres.sql'), 'utf8')

const main = () => {
  const role_index = process.argv.indexOf('--role')
  const role = role_index === -1 ? DATA_VIEW_ROLE : process.argv[role_index + 1]
  const plan = build_grant_plan(read_schema_sql(), { role })
  const report = process.argv.includes('--report')

  if (report) {
    console.log(`-- role ${plan.role}`)
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
    console.log(`GRANT SELECT ON public.${relation} TO ${plan.role};`)
  }
}

if (
  process.argv[1] &&
  process.argv[1].endsWith('generate-reader-role-grants.mjs')
) {
  main()
}
