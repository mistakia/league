# scripts/

One-off and maintenance CLI scripts for the league platform. All scripts follow the `is_main` pattern and are invoked directly with Node.js. Scripts that touch the production database require `NODE_ENV=production`.

```
NODE_ENV=production node scripts/<script-name>.mjs [options]
```

---

## generate-data-view-llm-tags.mjs

**Status:** scaffolding pending integration with the thread-metadata-style LLM setup. Not currently executed against production — initial seeding (2026-05-12) ran via an interactive Claude session writing batched `db/adhoc/2026-05-12-seed-llm-tags-batch-*.sql` files; the embedded prompt template and validation rules in this script captured what the interactive run used and what the future automation will reuse.

Generates LLM-derived descriptor tags for saved user data views. Tags are persisted to `user_data_view_tags` with `source='llm'` and complement the deterministic auto-tags produced at render time.

### CLI Invocation

```bash
# All views that have never been tagged or whose view was updated since last tagging (default)
NODE_ENV=production ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-data-view-llm-tags.mjs

# One user's views (e.g. the two power users)
NODE_ENV=production ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-data-view-llm-tags.mjs --user-id 130
NODE_ENV=production ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-data-view-llm-tags.mjs --user-id 1

# One-off refresh of a single view
NODE_ENV=production ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-data-view-llm-tags.mjs --view-id <uuid>

# Dry-run: calls Claude and validates output but does NOT write to DB
NODE_ENV=production ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-data-view-llm-tags.mjs --dry-run --limit 20

# Limit views processed (for testing)
NODE_ENV=production ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-data-view-llm-tags.mjs --limit 10 --dry-run
```

**Required environment variable:** `ANTHROPIC_API_KEY` — the script exits with an error and non-zero status if unset. Never commit the key.

### Cost / Latency Profile

Model: `claude-haiku-4-5-20251001`

Approximate token budget per view:

- System prompt (cached): ~400 tokens input. With prompt caching the repeated system prompt costs ~0.03/1M tokens (cache read) after the first request in the batch.
- User message (per-view): ~150-250 tokens input.
- Output: 20-60 tokens.

Claude Haiku 4.5 pricing (as of May 2026):

- Input: $0.80 / 1M tokens
- Cache write: $1.00 / 1M tokens (first call)
- Cache read: $0.08 / 1M tokens (subsequent calls)
- Output: $4.00 / 1M tokens

Estimated cost for the 166-view power-user backfill (C5):

- System prompt cache write (first call): 400 tokens × $1.00/1M ≈ $0.0004
- System prompt cache reads (165 remaining): 165 × 400 × $0.08/1M ≈ $0.005
- User messages: 166 × 200 tokens × $0.80/1M ≈ $0.027
- Output: 166 × 40 tokens × $4.00/1M ≈ $0.027
- **Total estimated cost: ~$0.06 for 166 views**

Latency per view: 1-3 seconds (Haiku is fast). Full 166-view batch expected in 3-8 minutes depending on rate limiting.

### Prompt Anatomy

The system prompt (cached across the batch) provides:

1. The task description and output format rules (JSON array, 1-4 tags, kebab-case)
2. The complete auto-tag vocabulary exclusion list — tags that collide with this list are rejected at validation time
3. Worked examples covering the main view clusters (DFS, dynasty, matchup-preview, game-situation, research, weekly-split)

The per-view user message (not cached) provides:

- `view_name` and `view_description`
- Top 20 column IDs by occurrence frequency in `table_state.columns`
- Where-clause column IDs and values from `table_state.where`
- Splits from `table_state.splits`
- The user's existing `source='user'` tags for that view, as anchors

### Idempotency and Source-Collision Guarantees

**Idempotency:** each run is tracked by `user_data_views.llm_tags_generated_at`. The default selection filters to views where `llm_tags_generated_at IS NULL OR updated_at > llm_tags_generated_at`. Re-running the script only processes stale or untagged views.

**Source-collision rule (LLM never overwrites user):** the insert uses `ON CONFLICT (user_id, view_id, tag_name) DO NOTHING`. If the user has manually added a tag with the same name, the user row is preserved untouched. The LLM job first deletes its prior `source='llm'` rows for that view, then inserts the new set — so prior LLM tags are refreshed but user tags are never deleted.

**Reverse direction (user promotes LLM tag):** when a user manually adds a tag whose name matches an existing `source='llm'` row, `add-user-tag.mjs` uses `ON CONFLICT DO UPDATE SET source = 'user'`, promoting the LLM row to a user row. From that point forward the LLM job's `DO NOTHING` preserves the promoted user row.

### llm_tags_generated_at Freshness Marker

`user_data_views.llm_tags_generated_at` is updated per-view upon successful tag generation. Operators can inspect freshness directly:

```sql
SELECT view_id, view_name, llm_tags_generated_at, updated_at
FROM user_data_views
WHERE llm_tags_generated_at IS NULL
   OR updated_at > llm_tags_generated_at
ORDER BY updated_at DESC;
```

### Per-View Error Handling

Each view is processed inside a `try/catch`. A failure (Anthropic API error, validation failure, DB error) logs a structured error line and continues with the next view. The process exits with code 1 if any view failed, enabling monitoring in CI or cron.

### Logging

Structured JSON to stdout, one line per view:

```json
{"view_id":"...","user_id":130,"view_name":"Air Yards by week","tags":["weekly-split","air-yards-share"],"duration_ms":1234,"status":"ok"}
{"view_id":"...","user_id":1,"view_name":"KTC Values","error":"Expected 1-4 tags, got 0","duration_ms":800,"status":"failed"}
```

---

## create-data-view-query.mjs

Persists a **query-backed data view** from a hand-written SELECT: a `data_view_queries` row holding the statement and its `column_annotations`, plus a `user_data_views` row referencing it.

This is what lets the whole query-backed representation ship with no LLM in it. The guard, the executor, the pg type resolver, the deriver, the render path and the share link are all exercised end to end by a human typing SQL, so every one of them is validated before an agent exists to produce one. The generation agent's emit branch calls the same exported function, inheriting a path already walked by hand.

The order is the point — parse, run, reconcile, and only then persist. A row that reaches the table has already produced a renderable result once, and the two inserts share one transaction so a half-created pair cannot be collected by the unreferenced-query sweep.

### CLI Invocation

```bash
# Validate, execute and derive without writing anything
NODE_ENV=production node scripts/create-data-view-query.mjs \
  --sql-file /tmp/view.sql --annotations-file /tmp/annotations.json \
  --view-name 'Air yards by week' --dry-run

# Persist, owned by a user
NODE_ENV=production node scripts/create-data-view-query.mjs \
  --sql-file /tmp/view.sql --annotations-file /tmp/annotations.json \
  --view-name 'Air yards by week' --user-id 130
```

The annotations block is keyed by projected alias and carries ONLY what the query cannot supply: `column_title` (required), `header_label`, `fixed`, `size`, and `data_type` in the one case where an alias's pg type has no mapping. Reconciliation is total in both directions, and a `data_type` declared for an alias whose type IS derivable is a rejection rather than a hint — that is the whole class of "declared type disagrees with the real one" failure this representation deletes.

JSON on stdout on success; a named code on stderr and a non-zero exit on refusal, never a plausible empty result.

---

## scrape-pfr-coaches.mjs

Acquires the canonical `{full_name, dob, first_season_pfr}` for each `nfl_coaches.pfr_coach_id` from Pro-Football-Reference's `/coaches/<id>.htm` pages. Output is `static-data/pfr-coaches.json`, the source-of-record fixture for the DOB-anchored own-id coach identity (see `nfl_coaches.coach_id` derivation).

Run before the `nfl_coaches` importer when new `pfr_coach_id` values appear in samhoppen's unresolved log (the importer raises `pipeline_failure` if a samhoppen row names a coach without a PFR-fixture match). Outputs to `static-data/pfr-coaches.json`; existing rows are merged so incremental rescrapes are non-destructive.

### CLI Invocation

```bash
# Full scrape (all pfr_coach_ids currently in nfl_coaches; ~40-100 min)
NODE_ENV=production node scripts/scrape-pfr-coaches.mjs

# Incremental rescrape of a specific subset
NODE_ENV=production node scripts/scrape-pfr-coaches.mjs --ids BeliBi0,MoraJi1
```

Uses the sandboxed PFR browser-task at `private/scripts/browser-tasks/pro-football-reference.mjs` via the `_stealth-browser` UID sandbox (`/usr/local/bin/run-as-stealth-browser-node`). PFR blocks default User-Agents (403); the CloakBrowser-backed sandbox resolves Cloudflare challenges and returns raw HTML, which this script parses with JSDOM. Rate-limited at `--wait-between-ms 5000` (12 req/min).

---

## generate-tag-board.mjs

Emits the **tag board** as JSON: the per-franchise decision surface behind the league-manager homepages in user-base (`text/homepage/<username>.md`). Development and host-side only — wired into neither cron nor PM2, so it sidesteps the deploy hazards in the repository root `CLAUDE.md`.

Arithmetic lives in `libs-server/tag-board/build-tag-board.mjs`, a pure builder with no `#db` import; this script is loading and CLI only. That split is what lets `test/tag-board.spec.mjs` cover the rules against fixtures with no database.

### CLI Invocation

```bash
# Public board for every franchise, to stdout
NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
  node scripts/generate-tag-board.mjs --year 2026

# One viewer's board, written to the user-base runtime directory
NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
  node scripts/generate-tag-board.mjs --year 2026 --tid 6 \
  --output ~/user-base/runtime/home-dynasty-league/board/team-6.json
```

`--lid` defaults to 1, `--year` is required. The `NODE_ENV=production` + tunnel redirect is the standard host-side invocation described in the repository root `CLAUDE.md`; `NODE_ENV=development` does not work.

### Information Boundary

`--tid` is the enforcement point, not a filter applied downstream. It names the **viewer**, and scopes the `private` block to that franchise alone:

- **`league_cutlist`** — standing intent naming exactly which players a manager would shed and in what order. The viewer's own list is theirs to see; a rival's must never be rendered. The query is scoped by `--tid`, so a rival's list never enters the artifact.
- **Restricted free agency offers** — blind by constitution Article IX §2, but written to `restricted_free_agency_bids` at submission and readable until processing. **No offer amount reaches any board, including the offering manager's own**: the loader never selects the `bid` column, so neither the amount nor the retention threshold derived from it exists downstream. The board reports only that a nomination exists.

Omitting `--tid` yields the public board with an empty private block. One board per opponent is what keeps the private block scoped to a single rendered page.

### Guardrails

Each of these is a place a naive implementation gets it wrong, and each is covered by a fixture case:

- **Contract value is the latest transaction per team and player**, not a column on the roster row.
- **Post-deadline salary is tag-dependent, and two tags REPLACE the value rather than freezing it.** Regular extends up the ladder (`value + (extensions + 1) * 5`); Franchise becomes the stored position price (`seasons.fqb`/`frb`/`fwr`/`fte`); Rookie becomes `$0`; restricted free agency is left unchanged, pending the auction. Treating a tag as "value unchanged" misstates every tagged franchise, and it is invisible in the data because a tagged player still carries his pre-tag value until the deadline fires.
- **The rookie `$0` follows the constitution, not the code.** `libs-shared/get-extension-amount.mjs` returns the unchanged value for a ROOKIE tag, and the `player_league_extended_salary` data-view column carries the same divergence; Article VIII §3 sets it to `$0`. The board follows the constitution.
- **`league_format_id` is read from the `seasons` row**, never hardcoded.
- **Lever budgets are netted** against tags already set, from `seasons.tag2`/`tag3`/`tag4`.
- **The three-consecutive-year franchise check is an eligibility filter applied before any ranking**, scoped to the tagging team to match `libs-server/validate-franchise-tag.mjs`. Note that the code scopes it to the team while constitution Article X §3 states it player-wide; the divergence is live and deliberate.
- **The franchise screen carries a worth floor** — projected points added above zero — because a large ladder saving usually means the contract climbed while the player declined. It vetoes only; a missing projection does not suppress.
- **Rookie eligibility resolves to the most recent completed draft class**, not the current draft year. During the extension window the current class is undrafted, so encoding the season year yields an empty rookie band on every team.
- **Candidate lists are lever-netted at construction.** `row.franchise_eligible` / `row.rookie_eligible` are the mechanical screen alone; the `eligibility.*` flags on each emitted row also require the budget. Every rival-facing aggregate — `candidate_concentration`, `teams_with_franchise_candidate`, `teams_with_rookie_candidate`, and the `empty_screen` rival count — is built from the netted maps so it cannot disagree with those flags.
- **Bid capacity is cap room plus attachable release salary**, never cap room alone. A bid can carry conditional releases and the cutlist drains at execution, so an over-cap team can bid well beyond visible room; room alone misidentifies which teams are constrained.
- **Coverage annotates, it does not gate.** `rank_precision` is `precise` or `band`. Below `coverage_precise_min` the composite rests on one source, so adjacent distinctions are noise and the board reports a coarse band instead of a rank. A player with no dynasty row at all carries `no_market_value: true` and is never dropped.
- **Deadline timestamps are read at computation time** into `calendar_freshness`, rather than carried forward from a previous artifact. Seeded pages went stale silently once already.

### Ordinal, Not Cardinal

The board emits **no dollar-denominated player value**. Contract values, extension prices, position prices and savings are exact and mechanical; a player's multi-year _worth_ is expressed only as `dynasty_rank` / `dynasty_band` against `dynasty_market_pool_size`. No oracle prices a multi-year hold in cap dollars, so a later change cannot silently reintroduce that comparison.

The one exception is structural: `projected_market_salary` appears on `divergence` rows only, never on `tag_board` rows. It is `league_format_player_projection_values.market_salary`, a single-season redraft price normalized to this league's cap, and it is the right horizon for an auction bid that settles within one season. It must never be differenced against a franchise or rookie price.

### Consumers

| Consumer                                                         | Reads                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `user:workflow/home-dynasty-league/generate-league-landscape.md` | merges the public board into `runtime/home-dynasty-league/homepage-landscape.json` under `board` |
| `user:workflow/homepage/generate-team-homepage.md`               | reads `runtime/home-dynasty-league/board/team-<tid>.json` per rendered page                      |

Changing a key, or the meaning of one, is a cross-repository contract change: the page workflow renders board rows directly and has no schema check to catch a rename.
