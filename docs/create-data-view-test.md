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
    "splits": ["year", "week"],
    "limit": 10
  },
  "expected_query": "...",
  "tags": ["player", "splits", "parameters"],
  "timeout_ms": 35000
}
```

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

`player`, `team`, `splits`, `year`, `week`, `plays`, `seasonlogs`, `parameters`, `filters`, `sorting`, `cte`, `joins`, `rate_type`, `basic`

## Running All Tests

```bash
# Run entire test suite
node scripts/data-view-test-cli.mjs --all

# Update all failing tests (use with caution)
node scripts/data-view-test-cli.mjs --all --update

# Run full test suite with yarn
yarn test --reporter min --grep "data view"
```

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
