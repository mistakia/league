---
title: League Repository Graph Entry
type: text
description: >-
  Graph entry point for the league (xo.football) codebase, mapping how this repo relates to
  user-base text/league system docs, task directory, and sibling repos (react-table).
base_uri: user:repository/active/league/ABOUT.md
created_at: '2026-05-13T16:05:02.284Z'
entity_id: fad7fc09-ef9c-4eba-b891-f81f7a4159f9
observations:
  - >-
    [bug] 2026-06-17 Data-views had a year_offset double-shift: resolve_nfl_week_params baked the
    offset into an explicit nfl_week_id list AND resolve-view-scope.mjs re-applied it, shifting the
    source window to base+2*offset while the outer join shifted by 1*offset, silently blanking the
    bottom offset-cohort of base years (e.g. a 2020-rookie WR lost their 2021 next-year value).
  - >-
    [fix] 2026-06-17 Fixed the year_offset double-shift via a single-application invariant:
    resolve_nfl_week_params sets year_offset_applied_to_nfl_week_id; resolve-view-scope.mjs
    re-applies the offset only to lists lacking that marker. Shipped in commit d46440cc, deployed to
    API.
  - >-
    [verification] 2026-06-17 Confirmed live on xo.football: Tee Higgins 2020 WR row now shows 15.58
    in the year_offset+1 DraftKings PPG column (was blank); CeeDee Lamb populated too.
  - >-
    [testing] 2026-06-17 Local test suite needs Postgres >= 15 (schema uses NULLS NOT DISTINCT); the
    official postgres image also lacks the postgres/league_user/league_readonly roles the schema
    GRANTs to. Recipe documented in repo CLAUDE.md Testing section.
  - >-
    [bug] player_adp and its sibling columns (adp_min/max/stddev/sample_size/percent_drafted)
    silently returned base-year ADP for any year_offset after the adp_type -> adp_format CTE-attach
    migration, because player_adp_source.attach() filtered the CTE to params.year and correlated the
    join to the unshifted year_reference; the anchored range-offset case additionally emitted
    invalid SQL referencing an unregistered CTE.
  - >-
    [fix] Commit a45281ab threads year_offset through the player_adp CTE-attach bridge by
    offset-expanding the CTE year filter (new offset_expanded_years helper), correlating the join
    through the offset via the existing emit_year_match primitive, decoupling CTE registration from
    join emission via register_ctes (so range-offset-with-no-where still materializes the CTE), and
    adding a declarative range_offset_aggregate per column (adp/percent_drafted AVG, min_pick MIN,
    max_pick MAX, sample_size SUM); verified against production (base-2024 +1 returns 2025 ADP,
    range [1,2] returns AVG not SUM).
  - >-
    [architecture] year_offset handling in data-views is duplicated across 8+ emitters
    (is_year_offset_range reimplemented inline, resolve_year_offset_range used in only 2 sites) with
    select-string trusting an un-asserted "CTE pre-filtered itself" contract; the long-term shape is
    one shared offset-correlation primitive consumed by every year-grained source plus a declarative
    per-column range aggregate, with the silent-loss-prone empty-year_predicate branch removed.
  - >-
    [followup] The same year_offset-drop bug class affects other CTE-attach year-grained sources not
    yet fixed -- player_projected_* and keeptradecut (range offset) silently drop the offset, and
    dozens of rate/rank/grade columns (PFF grades, rankings, nfl_team_seasonlogs rate stats, cpoe,
    time_to_throw) are summed across the offset window instead of averaged; each needs migration
    onto the offset primitive and a declared range_offset_aggregate, gated by result-equivalence.
  - >-
    [verification] 2026-06-17 Deployed Stage 1 (player_adp year_offset CTE-attach fix,
    a45281ab/21acc4ab) to production: yarn deploy pulled origin/master cab220f3, pm2 server process
    reloaded online, load:main + worker-1 trees synced.
  - >-
    [security] 2026-06-17 Remediated Dependabot 1 critical + 8 high alerts (commit 01959ea, pushed
    origin/master): bcrypt 5.1.1->6.0.0 drops @mapbox/node-pre-gyp and its tar@6.2.1, clearing all 6
    high node-tar path-traversal advisories at once; immutable 4.3.7->4.3.8 (prototype pollution);
    resolutions pin shell-quote 1.8.4 (critical), serialize-javascript 7.0.5, tar 7.5.16.
  - >-
    [security] Dependabot tar/shell-quote/serialize-javascript advisories are install/build-time
    only (node-gyp/node-pre-gyp archive extraction, concurrently dev tool, webpack terser cache) and
    not reachable from API/workers/SPA runtime; immutable is the only runtime-reachable fix (SPA
    Redux state).
  - >-
    [gotcha] Dependency usage scans must include forked git-deps compiled from source (react-table,
    workerize-loader) whose src/ webpack bundles -- their imports count as real usage; an app/-only
    grep nearly dropped @mui/x-date-pickers (peer-imported by the react-table fork), caught only by
    a failing production build.
  - >-
    [completed] 2026-06-17 year_offset unification Stages 2-5:
    player_projected/game_source/keeptradecut offset fixes (bf703720/1d53f94c/622b2f63),
    range_offset_aggregate + has_numerator_denominator across
    pff/rankings/nfl_team_seasonlogs/dvoa/espn/from-plays (2a746f5b/96ba01b9), emit_year_match
    extracted to param-utils + rate-type joiners consolidated (92884467/2bc96d3b/3b3a36e5), and the
    result-equivalence harness (5c9392ce). All zero-regression vs the 27 measure-first baseline
    reds.
  - >-
    [followup] 2026-06-17 year_offset unification remainders: (1) pff_team_grades + team_unit_dvoa
    range offset still emit invalid SQL -- custom main_select reads the alias that
    get-data-view-results skip_join_for_offset_range drops; fix needs a bespoke
    main_select_string_year_offset_range (AVG over the team-grained window, like keeptradecut). (2)
    game_opponent range wants fanout (multiple opponents), so it needs the join NOT skipped for
    plain-main_select columns. (3) select-string's empty-year_predicate trust-the-CTE branch can't
    be deleted until player_adp's range-no-split path stops depending on it (needs explicit year IN
    via source.year_default).
  - >-
    [completed] 2026-06-17 year_offset range remainders fully resolved and deployed (pushed
    origin/master, yarn deploy, prod server pm2 online): pff_team_grades + team_unit_dvoa range
    offset now emit a self-contained correlated AVG/SUM subquery via a shared
    team_year_offset_range_select helper consumed as main_select_string_year_offset_range (grades
    AVG, record/scoring counts SUM, dvoa dynamic column, query_context passed to the override);
    game_opponent range no longer skips the source join for plain-main_select columns so it fans out
    (verified on prod with multiple opponents per player); select-string trust-the-CTE
    empty-year_predicate branch removed -- the CTE-backed path emits an explicit year IN from
    source.year_default crossed with the offset (player_adp gained year_default), and
    year_default-less from-plays CTEs yield no predicate by explicit contract.
  - >-
    [bug] 2026-06-17 Two latent year_offset bugs only executed-result parity (not SQL-snapshot)
    surfaced, fixed with the remainders: generic team-grain correlation hardcoded nfl_team (broke
    tm/team-keyed sources) -> now source.key_columns.team; extra_predicates gate keyed on
    inner_qualifies_via_alias dropped seas_type for real-table no-table_alias sources
    (player-espn-score) -> now source.table. Verified on prod.
  - >-
    [testing] 2026-06-17 Result-equivalence harness grown 1 -> 8 seeded fixtures
    (nfl_team_seasonlogs catch_rate, team_unit_dvoa, espn REG-only, player_projected single+range,
    rankings MIN/MAX, cpoe num/denom). keeptradecut range left snapshot-only (opening_days is a WITH
    NO DATA matview, unseedable in a rolled-back txn); game_opponent fanout snapshot-only but
    verified end-to-end on prod. Zero regression vs the 27 baseline.
  - >-
    [testing] Closed the three deferred year_offset range result-parity gaps (keeptradecut AVG,
    game_opponent fanout, pff grades-AVG-vs-wins-SUM) with seeded fixtures; non-CONCURRENT REFRESH
    of opening_days works inside the rolled-back fixture txn, no harness change (league 9fca8aae).
  - >-
    [testing] Cleared the 27-fixture SQL-snapshot baseline: all were stale from the 2026-06-17
    measure-first from-plays refactor (2024bbf9 aggregate-in-alias hash + count-expr SUM-vs-COUNT),
    not regenerated. Validated equivalent (25 byte-identical post token-remap, 2 count-expr proven
    equal by execution) and regenerated expected_query only; data-view-queries suite now 197
    passing, 0 failing (league 93c33a34).
  - >-
    [incident] 2026-06-20 import-players-nfl failed because api.nfl.com/v3/shield returned HTTP 500
    "Fastly error: unknown domain shield-jarvis-api.nfl.com" — an upstream NFL CDN backend
    deregistration, not an auth or cursor bug (session token valid with full roles, and the sibling
    experience/v1/games endpoint on the same host still returned 200 JSON); the after:"null" cursor
    is a red herring since the request dies at the Fastly edge before reaching GraphQL.
  - >-
    [refinement] 2026-06-20 hardened nfl.mjs fetch_json_with_context to throw on non-OK HTTP before
    JSON.parse (commit 3d32e6db, deployed to /root/league); import-players-nfl is the sole
    /v3/shield consumer and player rows are redundantly fed by nflverse/sleeper/espn, so impact is a
    degraded offseason feed that auto-resolves via runs oracle once NFL restores the backend.
  - >-
    [decision] 2026-06-20 demoted import-players-nfl from cron (commented 4 schedules) pending NFL
    /v3/shield restoration; sleeper + nflverse cover player rows. Gated re-enable/teardown owned by
    user:task/league/retire-or-reenable-nfl-shield-player-import.md.
  - >-
    [friction] 2026-06-20 `yarn prettier` runs prettier in --write mode across the whole repo;
    invoking it (even as `yarn prettier --check <file>`) silently reformatted 88 files. For
    verification use `npx prettier --check <file>` directly, or scope explicitly. Hardening (add a
    check-only script / narrow the write glob) is unwired — candidate sibling task.
  - >-
    [bug] 2026-06-30 Data-view share links (/u/<hash>) white-screened with a
    Cannot-read-properties-of-undefined-reading-forEach crash at players/reducer.js:591 whenever the
    view had been fetched over HTTP POST /data-views/search: that route cached the raw rows array
    under the same /data-views/<hash> redis key the websocket socket and export route populate with
    a {data_view_results, data_view_metadata} object, so on a socket cache hit
    cached_value.data_view_results was undefined and DATA_VIEW_RESULT shipped result:undefined to
    the unguarded reducer.
  - >-
    [fix] 2026-06-30 Commit 332bced0 unifies /data-views/search cache to the canonical object shape,
    makes the data_view socket tolerate legacy array entries and never emit result:undefined, and
    guards players/reducer.js with (payload.result || []).forEach; push/deploy pending behind the
    red-main CI gate (dispatched session fix-league-ci-red).
  - >-
    [ci] 2026-06-30 RED master CI (run 28474828891 / 86dd00e7, yarn test exit 3) was a stale-fixture
    regression, NOT a storage/LFS/Actions quota issue — all setup steps passed, only the test step
    failed. The participation_status auto-injection (get-data-view-results.mjs:2048) rewrote SQL for
    player-view week-split queries but fixture
    team-stats-from-plays-multi-year-week-split-no-wrap.json was never regenerated. Fixed in
    b4f238ac (fixture-only).
  - >-
    [finding] 2026-07-01 2026 rookies were 100% missing pff_id (all 323, 114 fantasy-relevant)
    because the only setter import-pff-seasonlogs --update_pff_ids needs PFF seasonlog rows that do
    not exist until the season starts, and dynastyprocess/nflverse crosswalks carry the 2026 class
    with pff_id=NA.
  - >-
    [finding] 2026-07-01 Offseason pff_id source: PFF big board (final post-draft version,
    premium-auth) resolves 89/114 rookies; union with consumer-api fantasy rankings (static api-key,
    no session) + get_pff_projections hits 103/114, ids match our pff_id space. Impl dispatched
    pff-rookie-id-import.
  - >-
    [bug] 2026-07-01 pff.mjs handle_login_if_needed uses stale pre-Clerk selectors so
    get_pff_session_cookie silently harvests a token-less cookie (no c_groot/_merlin_key); PFF
    importers then degrade to the 10-row preview with no auto-recovery once the session expires. Fix
    dispatched pff-session-cookie-fix.
public_read: false
relations:
  - follows [[user:guideline/directory-markdown-standards.md]]
tags:
  - user:tag/league-xo-football.md
updated_at: '2026-07-01T15:14:15.641Z'
user_public_key: 10ba842b1307fd60475b887df61ccc7e697970a2d222e7cbf011e51f5de3349b
---

## Purpose

This repository is the codebase for **xo.football** — an open-source platform for fantasy football league management, NFL analytics, DFS, and betting markets.

For public project overview and feature list, see [[README.md]]. For agent-facing build, deploy, and architecture conventions, see [[CLAUDE.md]].

## Context

Two domains of documentation cooperate:

- **In-repo** (`CLAUDE.md`, `README.md`, this file): development commands, code-level conventions, public-facing pitch.
- **User-base** ([[user:text/league/ABOUT.md]]): system infrastructure, data model, deploy topology, data sources, operational runbooks. Canonical for anything that isn't tied to a specific code path.

## Notable Context

**Tag**: [[user:tag/league-xo-football.md]] — entities related to the league system across code, tasks, and docs.

**Task directory**: [[user:task/league/]] — active work items for this codebase.

**Canonical system docs** in user-base (consult before duplicating into CLAUDE.md):

- [[user:text/league/league-system-architecture.md]] — overall topology and service layout
- [[user:text/league/league-server.md]] — main server configuration
- [[user:text/league/data-sources.md]] — external data integrations
- [[user:text/league/data-model-reference.md]] — database schema reference
- [[user:text/league/data-view-storage-architecture.md]] — custom data view persistence
- [[user:text/league/league-backup-system.md]] — backup posture
- [[user:text/league/landscape.md]] — domain landscape

**Sibling repositories**:

- [[user:repository/active/react-table/ABOUT.md]] — reusable React table component used by the data-view UI

**Governing guidelines**:

- [[user:guideline/directory-markdown-standards.md]] — structure for this file
- [[user:guideline/single-source-of-truth.md]] — system docs above are canonical; CLAUDE.md links to them rather than restating

## Scope

**Belongs in this repo**: app code, build/deploy scripts, in-repo tests, dev commands, code-level conventions.

**Belongs in user-base**:

- Infrastructure, deploy topology, data model reference → `text/league/`
- Open work, planned features, bugs → `task/league/`
- Constitution amendments and league-specific operational records → user-base
