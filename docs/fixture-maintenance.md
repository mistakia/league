# External Fantasy Leagues — Fixture Maintenance

This document describes how to refresh the test fixtures used by the
`external-fantasy-leagues` test suite when a platform's API response shape
changes, when a season rolls over, or when new platforms are added.

The fixtures live under
`test/fixtures/external-fantasy-leagues/` and are split into two layers:

- `platform-responses/<platform>/*.json` — anonymized real API responses, the
  source of truth for what each platform actually returns.
- `expected-outputs/sleeper-*.json` — the canonical-format output produced by
  running the adapters/mappers against the platform responses, used as
  baselines by the spec suite.

## When to run this workflow

- A platform changes its API response schema (new fields, renamed fields).
- A new season rolls over and you want fixtures from the current year.
- An adapter or mapper is changed in a way that legitimately changes
  canonical output (in which case only the expected outputs need to be
  regenerated, not the platform responses).
- A new platform is wired up and needs initial fixtures.

## One-shot orchestrator

`scripts/update-fixtures.mjs` runs the per-platform collectors and the
expected-output generator in sequence:

```bash
# Collect every supported platform and regenerate all expected outputs:
node scripts/update-fixtures.mjs

# One platform at a time:
node scripts/update-fixtures.mjs --platform sleeper
node scripts/update-fixtures.mjs --platforms sleeper,espn

# Only regenerate expected outputs from the platform-responses already on disk
# (use this after changing an adapter/mapper but not the upstream API shape):
node scripts/update-fixtures.mjs --skip-collect

# Only re-collect platform responses, skip regeneration:
node scripts/update-fixtures.mjs --skip-generate

# Forward arguments to the collectors:
node scripts/update-fixtures.mjs --platform sleeper --league-id 1234567890
node scripts/update-fixtures.mjs --platform espn --season-year 2025

# Help:
node scripts/update-fixtures.mjs --help
```

The orchestrator shells out to:

- `scripts/collect-sleeper-fixtures.mjs`
- `scripts/collect-espn-fixtures.mjs`
- `scripts/generate-expected-outputs.mjs`

…all of which can also be run standalone if you only need part of the
workflow.

## Credentials

Sleeper's public API needs no credentials. ESPN private leagues require a
`SWID` cookie and an `espn_s2` token. Pass them to
`collect-espn-fixtures.mjs` via `--espn-s2 <value> --swid <value>`, or set
them under the `espn.credentials` key of the platform config file
(`libs-server/external-fantasy-leagues/external-platforms.json`) — see that
collector's `--help` for the full lookup order. Never commit real cookie
values; supply them locally per run.

If a collector fails with an authentication error, the cookie values are
stale or wrong — re-extract them from the browser and retry before re-running
the orchestrator.

## Anonymization

Both collectors anonymize data by default (`--no-anonymize` disables it).
Anonymization replaces personally identifying league/user/team names with
generic placeholders while preserving the structural shape and the public
NFL player data. Always commit anonymized fixtures unless you have a
specific reason to keep raw data and have confirmed nothing personal will
be checked in.

## Verifying a fixture refresh

After running the orchestrator:

1. Inspect the diff in `test/fixtures/external-fantasy-leagues/` to confirm
   the changes look reasonable (counts, key shapes, no leaked PII).
2. Run the affected specs:

   ```bash
   yarn test --reporter min test/external-fantasy-leagues-*.spec.mjs
   ```

3. If a spec assertion now fails because the fixture content changed
   (different number of teams, transactions, players), update the assertion
   to match the new authentic baseline. **Do not** revert the fixture change
   to make the assertion pass — the fixture is the source of truth.
4. If a spec fails because an adapter or mapper produced unexpected
   canonical output, that's a regression in the adapter/mapper, not the
   fixture. Investigate the code, not the assertion.

## Adding a new platform

1. Implement the adapter under
   `libs-server/external-fantasy-leagues/adapters/<platform>.mjs`.
2. Add a collector script `scripts/collect-<platform>-fixtures.mjs`
   following the pattern of the existing Sleeper/ESPN collectors.
3. Register the new platform in
   `scripts/update-fixtures.mjs`'s `supported_platforms` list and
   `collector_scripts` map.
4. Extend `scripts/generate-expected-outputs.mjs` to produce baselines for
   the new platform (if it needs them — small, one-platform mappers may not).
5. Add authentic-fixture specs under `test/external-fantasy-leagues-*.spec.mjs`.

## Known gaps

- `TransactionMapper.bulk_map_transactions` currently maps 0/296 real
  Sleeper transactions because `map_sleeper_fields` reads singular
  `player_id`/`roster_id` while Sleeper nests player IDs in `adds`/`drops`
  dicts and uses plural `roster_ids`. Recorded as a `[bug]` observation on
  task `user:task/github/mistakia/league/162-import-and-sync-external-leagues.md`.
  The expected-output baseline for `sleeper-transaction-mappings.json`
  records this gap; the corresponding spec assertions are regression
  baselines that will need to be updated when the mapper is extended.
