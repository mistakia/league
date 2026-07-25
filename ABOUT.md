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
    official postgres image also lacks the postgres/league_writer/league_reader roles the schema
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
  - >-
    [architecture] League/team markdown context docs are served at human-path + .md (e.g.
    /leagues/1.md, /leagues/1/teams/5.md, /leagues/1/rules.md, /leagues/1/schedule.md) via
    api/routes/context-docs.mjs and libs-server/context-docs/; self-sufficiency (each doc complete
    for its level) is a contract, cap is computed from a bid-populated per-team getRoster source,
    and the full filterable transaction log lives behind the separate
    add-transactions-markdown-output-format task.
  - >-
    [bug] 2026-07-24 Fixed five always-undefined play-field reads (master 8a1aa708..5cae5a97): raw
    NFL vendor keys (teamAbbr, possessionTeam), untranslated nflfastR column names in the
    fixed-drive port (fumble_lost, touchdown, td_team, own_kickoff_recovery), and one read the
    2024-07-13 rename 5d9b7aec missed (intp); none were caused by the nfl-plays-snaps rename.
  - >-
    [risk] 2026-07-24 nfl_plays.td_tm/ret_tm are likely NULL for all history:
    get-play-from-play-stats is their only writer and read a nonexistent teamAbbr column since 2021,
    and both data-view column params are commented out; a backfill over historical play_stats is an
    open operator decision, deliberately not run mid-cutover.
  - >-
    [bug] 2026-07-24 prop-market-settlement load_nfl_plays preloaded 8 of the 13 nfl_plays columns
    its handler reads; a missing column settles rather than raises, so all 14 team-aggregate yardage
    market types settled every OVER as LOST and every UNDER as WON — exposure limited to manual
    scripts/process-market-results.mjs runs, which no crontab schedules.
  - >-
    [bug] The selected-player view dropped 2025 regular-season gamelogs because
    api/routes/players.mjs and stats.mjs filtered scoring_format_id/league_format_id in WHERE with
    an orWhereNull escape instead of inside the LEFT JOIN ON clause, which degrades the join to
    INNER whenever a gamelog carries rows under any other format and deletes the row entirely rather
    than returning null points.
  - >-
    [bug] stats-pipeline get_format_hashes built the generation set from live hosted leagues only,
    so when league 1 moved to the genesis format for 2025 every named catalog format stopped being
    generated, including the draftkings default backing the lid=0 league.
  - >-
    [fix] 2026-07-24 moved the format id into the join ON clause behind a shared
    attach-format-gamelog-columns helper, unioned the named catalog into get_format_ids, repaired
    four seasonlog generators still querying pre-conformance nfl_games year/seas_type, and
    backfilled the 9 regressed formats.
  - >-
    [followup] 21 named league formats have never had derived gamelog data generated;
    verify-format-data-coverage reports them without signalling, and the stats-pipeline catalog
    union now populates them going forward but historical seasons remain unbackfilled.
  - >-
    [bug] 2026-07-24 Sweeping the bare row-var read blind spot that check-plays-column-repoint.mjs
    documents it cannot gate found a sixth pre-existing instance (69e7567e): the charted-plays stats
    filter keyed on play.year/play.seas_type, which getChartedPlayByPlayQuery has never selected, so
    the week filter dropped every play and the view computed over an empty set.
  - >-
    [bug] api.nfl.com/v3/shield (NFL FDL v3) is decommissioned — deterministic Fastly 'unknown
    domain' 500 on every request. It also stored a fused legal firstName (e.g. "De'Zhaun-Ryan")
    distinct from the football name every feed and NFL's own displayName use ("De'Zhaun Stribling"),
    which silently broke name-fallback matching and left affected players unlinked (no KTC/sleeper
    ids, absent from data views).
  - >-
    [fix] 2026-07-24 scripts/import-players-nfl.mjs repointed from api.nfl.com/v3/shield to the
    public NFL Pro per-team roster endpoint (pro.nfl.com/api/teams/roster, referer header only, no
    session token), using footballName for clean first names. New
    libs-server/ensure-player-alias.mjs seeds a football-name alias whenever a stored name diverges.
    Commits: main 7ad47ca4, a8b2989b; private submodule 3860d11 (nfl-pro.mjs get_teams_roster).
    Validated end-to-end against production (28,166 players, no status throws) plus KTC/Sleeper
    re-imports; De'Zhaun Stribling (DEZH-STRI-000156) confirmed present in the DynastyIM WR data
    view with keeptradecut_player_id 1976 and KTC value 2828.
  - >-
    [data-gap] 2026-07-24 nfl_plays.td_tm and ret_tm are NULL on 100% of rows across all 26 seasons
    (0 of 1,483,695 plays; also 0 of 5,969 in nfl_plays_current_week):
    libs-shared/get-play-from-play-stats.mjs is their only writer and assigned the nonexistent
    playStat.teamAbbr from its 2021 introduction (f4cc6295) until 8a1aa708 repointed it to nfl_team,
    so every write silently evaluated to undefined; no importer, charted-CSV path, or backfill
    script ever populated them, so there is no partial-population era to reconcile.
  - >-
    [trap] 2026-07-24 Any backfill from nfl_play_stats into nfl_plays must fold SD->LAC: play-stat
    nfl_team is the raw feed value while plays offense/defense_nfl_team run through fix-team.mjs,
    and SD/LAC is the sole drifted pair (19,960 stat rows, 2002-2015).
  - >-
    [assessment] 2026-07-24 A bulk historical drive_seq recompute is NOT warranted after the td_tm
    backfill: enrich_fixed_drives only assigns drive_seq where it is NULL, so no populated value can
    change; only 1,270 already-NULL plays sit after an interception-return TD. If a recompute ever
    runs it must follow the backfill, never precede it.
  - >-
    [defect] 2026-07-24 enrich_fixed_drives fills only NULL drive_seq while running its own counter
    from zero, so in the 4,616 game-halves that mix populated and NULL drive_seq (21,310 NULL plays)
    any fill emits values incoherent with their neighbors -- independent of td_tm.
  - >-
    [bug] libs-server/get-roster.mjs sourced each rostered player salary through a leftJoin whose
    transactions.tid predicate sat in the WHERE (silently an inner join, dropping 306 rows, all of
    them league 54 which has zero transactions) and with no year/week bound, so 23,655 of 44,293
    rostered-player rows resolved to a transaction dated after the roster carrying them.
  - >-
    [fix] Commits 455656c6 and bd2f038b declare the get-roster transactions join INNER and move both
    the team id and a (year, week) as-of bound into the ON clause; inner is correct because
    transactions.value is the only source of the salary Roster sums into availableCap.
  - >-
    [correction] 2026-07-24 The b15afa72 drive_seq defect framing is misdirecting: its 4,616 mixed
    game-halves and 21,310 NULL plays reproduce exactly, but 98.3 percent of those plays are
    administrative (NOPL 79.0 percent, NULL play_type 19.3 percent) and correctly stay NULL, so they
    describe unfilled nulls rather than damage. The real damage is 48 games (2025: 32 PRE, 13 POST,
    3 REG) where the per-half counter restarts numbering at 1 mid-game, collapsing 782 true PRE
    drives into 443 distinct drive keys and 334 POST into 190.
  - >-
    [finding] 2026-07-24 A second, distinct drive_seq corruption class of 22 games (14 in 2025 REG,
    1 in 2025 PRE, 7 scattered 2001-2023) carries a mixed-authority splice rather than a
    half-restart: in 2026010401 quarter ranges overlap inside a single half (Q1 spans 1-6, Q2 spans
    5-10), which no restart can produce. A DENSE_RANK renumber does not fix these; they need their
    own characterization.
  - >-
    [trap] 2026-07-24 Two false leads when chasing drive_seq: a decreasing-drive_seq scan flags
    1,271 halves, all caused by malformed rows carrying qtr=1 with a play_id inside a later quarter;
    and 'deleted = false' silently drops the NULL-deleted rows, moving the violation counts from
    70/48/22 to 64/39/25. Use 'deleted IS NOT TRUE', which is how the JS predicates read it.
  - >-
    [supersedes] 2026-07-24 The earlier [assessment] that enrich_fixed_drives 'only assigns
    drive_seq where it is NULL' no longer holds: the module now declines for a whole game if any
    play in the batch carries a value, so it never splices two numbering authorities.
  - >-
    [backfill] The td_tm/ret_tm backfill (db/adhoc/2026-07-24-backfill-nfl-plays-td-tm-ret-tm.sql)
    executed against production 2026-07-24 after the nfl-plays-snaps rename landed, updating 50,723
    plays across all 26 seasons and leaving td_tm populated on 37,706 plays and ret_tm on 14,512,
    both exactly matching the pre-run projection.
  - >-
    [assessment] The expected 1,596 interception-return touchdowns was wrong; the verified value is
    1,439, reconciling from 1,495 stat-26/28 plays less 32 without td and 24 carrying the offense.
  - >-
    [trap] Production statement_timeout is 30s and a DO block is one top-level statement, so a
    per-season loop inside it never resets the clock; the loop buys partition pruning, not timeout
    batching.
  - >-
    [data-gap] Residue 1 is 127 plays with td_tm but not td=true, not 27: 100 in 2024 weeks 3-4 with
    td NULL (75 also play_type NULL, a partial import) and 27 in 2025 with td false but ret_td true.
  - >-
    [assessment] Residue 2 (239 plays whose ret_tm matches the offense) is old-feed noise, not a
    mapping error: none occur after 2015, they spread across many teams, and only 5 involve the
    SD-to-LAC fold.
  - >-
    [decision] Residue 3 is open: td_tm stays NULL for fumble-recovery (755), punt-return (404) and
    kickoff-return (328) touchdowns, leaving is_defensive_td blind for 1,487 plays.
  - >-
    [finding] GitHub Actions Test never checks out the private submodule (.github/workflows/test.yml
    uses actions/checkout with no submodules option), so any spec whose import chain reaches
    #private/... fails in CI with ERR_MODULE_NOT_FOUND while passing locally where private/ exists.
    Hit 2026-07-24 by test/plays-field-reads.spec.mjs importing scripts/import-plays-nfl-v1.mjs,
    which transitively reaches #private/libs-server/ngs.mjs via import-nfl-games-ngs.mjs.
  - >-
    [correction] The residue-1 figure of 100 plays in 2024 weeks 3-4 conflated season_type, since
    week numbering resets per type: it is 75 plays in preseason week 3 plus 25 across the final
    three postseason games.
  - >-
    [data-gap] All 2,964 plays of 2024 preseason week 3 are unenriched (play_type, offense_nfl_team,
    defense_nfl_team and td all NULL) because the enrichment pass never ran after a late catch-up
    re-import.
  - >-
    [data-gap] Unenriched weeks are a recurring failure family, not a 2024 one-off: 41 games across
    12 season/type groups carry zero td despite touchdown play descriptions, and 18 season/week
    groups show anomalous NULL rates.
  - >-
    [trap] A 2026-05-24 sportradar re-import with overwrite_existing cleared td on 32 plays; 5 are
    stat-60 fumble-recovery touchdowns left with td false, ret_td null and td_tm null, so they are
    invisible to every structured check.
  - >-
    [correction] My count of 349 unexplained ret_tm rows was wrong: it compared the raw team against
    defense while folding for offense. The correct figure is 82, being 63 true mismatches and 19
    rows with a null team.
  - >-
    [data-gap] 798 plays across 10 games in season 2001 have offense_nfl_team equal to
    defense_nfl_team, losing the actual opponent and breaking any opponent-keyed query for those
    games.
  - >-
    [assessment] The SD-to-LAC drift is not the only normalization gap, but the remaining drift
    lives in nfl_plays own team columns (raw STL beside normalized LA in 2001), so td_tm and ret_tm
    hold correct values and need no corrective pass.
  - >-
    [correction] Residue 3 is 1,698 plays across six stat families, not 1,487 across three: own
    fumble-recovery TD (84 plays), team TD from blocked punts and field goals (169) and own
    kickoff-recovery TD (2) were missed by the original switch-statement reading.
  - >-
    [trap] nfl_plays.offense_nfl_team itself retains raw SD (1,561 rows) and STL (23,579),
    concentrated ~97-100% on kickoff plays, so a kickoff-heavy backfill must fold only to compare
    and write back the row's own spelling.
  - >-
    [assessment] The td_tm rule is attribute whichever team's player has the ball, not assume the
    defense: a kicking team recovering a muffed return is a real case that is_defensive_td sorts
    correctly by comparing against offense.
  - >-
    [assessment] ret_tm has zero computational consumers, so it should be neither extended nor
    dropped inside a mapper fix; removal is a candidate for a dedicated cleanup touching schema, the
    export script and the data-view catalog.
  - >-
    [data-gap] Three plays in game 2021122201 have td true but zero nfl_play_stats rows, so no
    backfill can attribute them; they need a play-stats re-import for that game.
  - >-
    [assessment] The executed td_tm backfill is verified clean against the SD and STL drift: zero
    false-positive defensive touchdowns, because its stat families contain no kickoff plays where
    the raw codes concentrate.
  - >-
    [correction] The executed backfill did write raw team codes after all: td_tm holds 536 STL
    values and ret_tm 236, because the script folded SD to LAC only and never STL to LA. SD itself
    is clean at zero in both columns.
  - >-
    [assessment] Those 772 raw STL values cause no misclassification — a check folding both pairs
    finds zero plays where td_tm differs from offense_nfl_team by spelling alone — but they are
    normalization debt that a repair pass should fold with the other columns.
  - >-
    [data-gap] Raw team codes are systemic rather than a curiosity: 51,918 plays carry STL or SD in
    offense_nfl_team or defense_nfl_team across 2001-2016, so the clean end state normalizes all
    four team columns in one pass.
  - >-
    [trap] nfl_plays.td has exactly one writer, sportradar-stats-mappers.mjs line 110, which scopes
    it to receive_stats.touchdown and is therefore wrong by construction for every defensive and
    return touchdown.
  - >-
    [trap] process-plays ENRICHED_FIELD_NAMES omits td, comp and yds_gained, so
    yardage-stat-enrichment derives td correctly from play stats and the persistence layer silently
    discards it; re-running process-plays cannot repair td.
  - >-
    [correction] My claim of 18 anomalous enrichment groups was an over-read of normal preseason
    variance: 2024 preseason week 3 is the only true hollow-row week, distinguished by a 100 percent
    step function rather than the usual 0-17 percent noise floor.
  - >-
    [assessment] The 2024 preseason week 3 hollow rows do not affect fantasy scoring: gamelogs
    derive from nfl_play_stats which is healthy, and the only real casualty is targeted_air_yards,
    which calculate-points never references.
  - >-
    [data-gap] 37 games carry the orphaned-td signature of td being entirely NULL across the whole
    game despite touchdown-worded descriptions, and one further game misses only its touchdown rows
    through a different mechanism.
public_read: false
relations:
  - follows [[user:guideline/directory-markdown-standards.md]]
tags:
  - user:tag/league-xo-football.md
updated_at: '2026-07-25T00:55:33.332Z'
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
