/**
 * Canonical pid SHAPES.
 *
 * These MIRROR the `player_pid_format` CHECK constraint on `public.player`,
 * which is the enforced authority. Anything narrower here rejects an identity
 * the database accepts, and does it silently -- every consumer below is a
 * FILTER, so a shape that stops matching drops rows rather than raising.
 *
 * A PERSON pid is `FNAM-LNAM-<serial>`. `libs-server/generate-player-id.mjs`
 * mints exactly four letters per half (a shorter name is X-padded), but the
 * constraint allows ONE to four, so match what is STORABLE rather than what
 * today's minter happens to emit -- the minting rule is free to change and the
 * constraint is what every stored row has actually satisfied.
 *
 * The serial is zero-padded to six digits and is EXPLICITLY allowed to grow
 * past six as `player_pid_serial_seq` advances (45,631 as of 2026-08-28).
 * Pinning it at exactly six is a shape this repo has already paid for: between
 * 2026-07-20 and 2026-08-02 a pid re-key left this matcher hitting ZERO of
 * 28,166 players, so `optimizeLineup` returned correct point totals with an
 * empty starter list and `process-projections` wrote 85 starter rows an hour
 * where it had written 1,513 -- reporting success 1,073 times out of 1,073,
 * because nothing asserted on the output. `check_lineup_starter_identity_oracle`
 * in that script is the production backstop; the specs in
 * `test/libs-shared.player-id-constants.spec.mjs` are the cheap one.
 *
 * A TEAM unit pid is the 2-3 letter nfl abbreviation, optionally suffixed with
 * the unit it names. Only the bare form is minted today (32 DST rows).
 */

export const player_pid_pattern = '[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{6,}'
export const team_pid_pattern = '[A-Z]{2,3}(-(OFF|DEF|DST))?'

// The union, anchored -- this is the string the api spec's `PlayerId` schema
// publishes, so the spec and the runtime matchers cannot drift apart.
export const pid_pattern = `^(${player_pid_pattern}|${team_pid_pattern})$`

// Matched against the KEYS of an LP solver result to tell chosen players and
// team units apart from the solver's own bookkeeping keys (`result`,
// `feasible`, `bounded`, `isIntegral`) and from the synthetic `pid_<POS>`
// baseline variables `optimize-lineup.mjs` adds. None of those carry the two
// hyphens a person pid needs or the bare-abbreviation shape a team pid has.
export const player_id_regex = new RegExp(`^${player_pid_pattern}$`, 'i')
export const team_id_regex = new RegExp(`^${team_pid_pattern}$`, 'i')
