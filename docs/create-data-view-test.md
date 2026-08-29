---
title: Create Data View Test
type: workflow
description: Create and validate data view query test cases using the CLI tool
created_at: '2025-12-13T00:00:00.000Z'
entity_id: a7b2c4d1-8e3f-4a5b-9c6d-2e1f3a4b5c6d
observations:
  - '[testing] JSON test files capture request configuration and expected SQL output'
  - '[validation] CLI diff mode enables visual comparison of query changes'
  - '[automation] Update flag simplifies expected query maintenance'
relations:
  - follows [[repository/active/league/docs/data-views-system.md]]
  - uses [[repository/active/league/scripts/data-view-test-cli.mjs]]
  - follows [[repository/active/base/system/guideline/write-workflow.md]]
updated_at: '2025-12-13T00:00:00.000Z'
user_public_key: 0000000000000000000000000000000000000000000000000000000000000000
---

<task>
Create new data view tests that verify SQL query generation for specific feature cases or bug fixes. Tests validate that the data view system correctly generates SQL queries from request configurations.
</task>

<context>
Data view tests are JSON files stored in `test/data-view-queries/` that define a request configuration and the expected SQL query output. These tests ensure that the data view query generation system works correctly for various scenarios including edge cases, parameter combinations, and complex features.

The test CLI tool (`scripts/data-view-test-cli.mjs`) provides commands to create, run, validate, and update test cases.
</context>

<instructions>

## Test File Structure

Test files are JSON in `test/data-view-queries/` with the following structure:

```json
{
  "name": "descriptive test name in plain english",
  "description": "Brief explanation of what edge case or feature is being tested",
  "request": {
    "columns": ["player_name", {"column_id": "...", "params": {...}}],
    "prefix_columns": ["player_name"],
    "where": [{"column_id": "...", "operator": "...", "value": "..."}],
    "sort": [{"column_id": "...", "desc": true}],
    "row_axes": ["year", "week"],
    "limit": 10
  },
  "expected_query": "...",
  "tags": ["player", "row_axes", "parameters"],
  "timeout_ms": 35000
}
```

## Environment

**Every command below needs `NODE_ENV` and a database, and the CLI gives a bad error without them.** Run bare it dies in `config/index.mjs` on `ENOENT ... config/config-undefined.json`, which reads as a broken checkout rather than a missing variable. Some fixtures also resolve a scoring format through `#db`, so the connection is not optional even though most of the work is `.toString()` on a query builder.

```bash
export LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=5433 \
  LEAGUE_DB_DATABASE=league_test_<slug> NODE_ENV=test TZ=America/New_York
```

Start the database with `yarn test:db:up` (Postgres 16 on :5433). Give yourself a private database rather than sharing `league_test` — the container is a shared singleton and a sibling's run drops every table mid-run.

## Creating a Test

### 1. Generate Test File with CLI

```bash
# Create new test with auto-generated expected query
node scripts/data-view-test-cli.mjs test/data-view-queries/your-test-name.json \
  --create \
  --request '{"columns":["player_name"],"limit":10}'
```

Alternatively, you can manually create the JSON file in `test/data-view-queries/` using kebab-case naming (e.g., `my-new-test-case.json`).

### 2. Run and Verify

```bash
# Run with beautified diff view
node scripts/data-view-test-cli.mjs test/data-view-queries/your-test-name.json --beautify --diff

# Update expected query if correct
node scripts/data-view-test-cli.mjs test/data-view-queries/your-test-name.json --update
```

### 3. Refine Test Case

Edit the JSON file to:

- Add meaningful `name` and `description`
- Add relevant `tags` for categorization
- Adjust `timeout_ms` if needed (30000-40000 typical)
- Add `expected_metadata` if testing cache behavior

## Naming Conventions

- Use kebab-case for filenames
- Be descriptive and specific: `player-target-share-from-plays-with-a-where-clause.json`
- Include the key feature being tested in the name

## Common Tags

`player`, `team`, `row_axes`, `year`, `week`, `plays`, `seasonlogs`, `parameters`, `filters`, `sorting`, `cte`, `joins`, `rate_type`, `basic`

## Running All Tests

```bash
# Run entire test suite
node scripts/data-view-test-cli.mjs --all

# Update all failing tests (use with caution)
node scripts/data-view-test-cli.mjs --all --update   # blesses whatever the emitter currently produces -- see the warning above

# Run full test suite with yarn
yarn test --reporter min --grep "data view"
```

## What a query-match test CANNOT check

**Both comparison paths normalize table-alias hashes away.** `normalize_sql_for_comparison` (this CLI) and `test/utils/compare-queries.mjs` (the mocha spec) each rewrite every distinct 32-character hash to a positional `table_0`, `table_1`, ... before comparing. So:

- **Caught:** join count, join order, boundary expressions, predicates, projections, sort ordinals — an alias COLLAPSE, where two columns fall onto one join, changes the count and turns the test red.
- **NOT caught:** an alias hash that merely MOVES. That silently invalidates every cached redis entry and saved view keyed on it, and `--all` prints `✓ Queries match!` straight over it.

To pin that a hash did not move, assert the literal alias in a spec (see `test/data-views.keeptradecut-as-of-month-day.spec.mjs`) or diff the emitted SQL against a worktree pinned to an explicit pre-change hash. Same family as `skip_query_match`: the fixture looks like coverage while the property you care about was never compared.

**An assertion anchored on the SHAPE of a table alias matches any join, so it passes whether or not the join you mean is there.** Every join in a data-view query carries a `get_table_hash` alias, so `expect(sql).to.match(/left join "t[0-9a-f]{32}" on/)` is satisfied by the column's own source join and proves nothing about a CTE you added. Measured 2026-08-29: that assertion was written to pin that a new pre-aggregation CTE was LEFT-joined, passed green, and `player-career-year-with-other-columns.json` contains the identical substring with no such CTE anywhere in it. It survived a review pass, because the pattern looks specific.

Anchor on the relation's NAME, not its shape. Import `get_table_hash` in the spec, compute the same alias the emitter computes, and assert against that:

```js
const cte_name = get_table_hash(`career_year_projection/${year}`)
expect(sql).to.include(`"${cte_name}" as (`)
expect(sql).to.include(`left join "${cte_name}" on`)
```

Two details that cost a red run each. The emitted CTE is rarely FIRST in the `with` list — `base_years` and `player_years` usually precede it — so anchoring on `with "<name>" as (` fails on a correct query. And the same rule kills the neighbouring temptation to assert on a bare SQL fragment such as `group by pid`, which sits one quoted-vs-unquoted character away from an unrelated column's knex-generated `group by "pid"`: a false green and a false red waiting on whichever lands first.

**An alias-separation fixture proves a NECESSARY condition, never a sufficient one — do not read it as covering "these two columns show different numbers".** Two columns getting two joins is what makes different values POSSIBLE; it does not make them different. The two properties come apart whenever the divergence is semantic rather than structural, and then the query-match fixture is green over a live defect by construction, because the SQL is valid and correctly shaped in both worlds.

That is not hypothetical. `keeptradecut-as-of-month-day-alias-separation.json` pins that two `as_of_month_day` anchors emit four distinct aliases and four separate joins, and it stayed green throughout a production defect where two such columns rendered byte-identical values on all 500 rows (`/u/f8d929780fc3378dd7e69978153bf03c`, 2026-08-16): each column had its own alias, its own join and its own `make_date` anchor, and an outer `LEAST(..., now())` then mapped both anchors onto the same instant. Nothing structural was wrong.

So when a param's whole purpose is to make two columns differ, the coverage has to be a `result_equivalence` fixture asserting they resolve DIFFERENT seeded observations — `keeptradecut-as-of-month-day-two-days-diverge-result-equivalence.json` is the worked example. Pair it with the alias fixture rather than choosing between them: one catches a collapse, the other catches a collapse-in-value.

## Result equivalence: when a query-match test is not enough

A query-match test pins the SQL TEXT and never executes it, so it cannot see semantics that valid SQL gets wrong — a boundary resolving the wrong observation, a filter that matches nothing. For those, add a `result_equivalence` block, which seeds rows in a rolled-back transaction and compares executed output against an oracle:

```json
"result_equivalence": {
  "seed": ["INSERT INTO ...", "REFRESH MATERIALIZED VIEW opening_days"],
  "expected_rows": [{ "some_column_0": 3000 }],
  "compare_columns": ["some_column_0"]
}
```

Exactly one of `expected_rows` or `reference_sql` is the oracle. Four things to get right:

1. **Seeds isolate on `primary_position: 'MLB'`** and the request filters on it; the harness asserts no shared fixture player claims that value.
2. **Derive expected values from the seed, never from current output** — a value copied out of a passing run is a screenshot, not an oracle. `update-data-view-snapshots.mjs` only rewrites `expected_query`, so a wrong oracle can never be repaired by regenerating.
3. **Row order does not matter** (`normalize_rows` sorts), but every projected row must be distinguishable.
4. **Prove it can go red.** Mutate the code the fixture exists to catch and confirm it fails; a fixture never seen red is not coverage.

## Best Practices

1. **Focus on edge cases**: Create tests for specific bugs, parameter combinations, or complex features
2. **Minimal viable request**: Use simplest request that reproduces the case
3. **Descriptive names**: Make it obvious what scenario is being tested
4. **Add context in description**: Explain WHY this test exists, especially for bug fixes
5. **Verify manually first**: Ensure expected query is actually correct before committing

</instructions>

<output_format>

- Test file: `test/data-view-queries/{test-name}.json`
- All tests passing with `--all` flag
- Full test suite green before commit
  </output_format>
