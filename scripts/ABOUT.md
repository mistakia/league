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
