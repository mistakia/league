import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  fixTeam,
  format_nfl_status,
  format_nfl_injury_status
} from '#libs-shared'
import { fantasy_positions, is_offseason } from '#constants'
import {
  is_main,
  find_player_row,
  updatePlayer,
  createPlayer,
  resolve_canonical_player,
  describe_resolution,
  CREATE_PLAYER_REQUIRED_FIELDS,
  report_job,
  fetch_with_retry,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-players-sleeper')
// Guarded because a bare debug.enable REPLACES the namespace set for the whole
// process: importing this module from a spec would clobber every other spec's
// logging for the rest of the mocha run. Matches libs-server/create-player.mjs.
if (!process.env.DEBUG) {
  debug.enable(
    'import-players-sleeper,update-player,create-player,get-player,fetch,resolve-canonical-player'
  )
}
const timestamp = Math.round(Date.now() / 1000)

// The Sleeper /players/nfl endpoint is a monotonically growing historical dump
// carrying 12,219 entries on 2026-08-17, so a payload below this floor is
// unambiguously wrong rather than a quiet season. Injectable ONLY so a spec can
// drive run() with a handful of synthetic players; main() takes the default.
export const DEFAULT_PAYLOAD_FLOOR = 10_000

/*
  EVERY BOUND HERE IS A MEASUREMENT against the live payload and the live table on
  2026-08-17, not a guess, and each sits off its measured value by enough margin
  to absorb ordinary drift. Re-measure before changing one.

    considered              12,219
    updated_by_sleeper_id    9,406
    skipped_exists              83
    skipped_unknown             26
    created                    464  (first repaired run; ~0 in steady state)

  Injectable as ONE object for the same reason the payload floor is: a bound
  calibrated to a 12,219-entry payload is not satisfiable by a stub-driven spec,
  so hard-coding it makes the spec that proves this oracle works impossible to
  write. A caller that overrides these is declaring its own scale; main() takes
  the measured defaults.
*/
export const DEFAULT_BOUNDS = {
  updated_by_sleeper_id_floor: 8_500,
  skipped_exists_floor: 50,
  skipped_exists_ceiling: 120,
  skipped_unknown_floor: 10,
  skipped_unknown_ceiling: 40,
  created_ceiling: 550,
  unusable_entry_ceiling_ratio: 0.1
}

const run = async ({
  payload_floor = DEFAULT_PAYLOAD_FLOOR,
  bounds: bounds_override = {}
} = {}) => {
  /*
    MERGED, not substituted. `bounds = DEFAULT_BOUNDS` as a default parameter
    only fires when the whole object is absent, so a caller overriding ONE knob
    left every other bound `undefined` -- and both `x < undefined` and
    `x > undefined` evaluate false, so each unnamed check became unfireable and
    read as green. That is the same fails-silently shape this oracle exists to
    remove, one layer down in its own plumbing.
  */
  const bounds = { ...DEFAULT_BOUNDS, ...bounds_override }
  const URL = 'https://api.sleeper.app/v1/players/nfl'
  // use_proxy: false -- Sleeper documents this as a public bulk-polling
  // endpoint (no auth, no per-IP restriction called out), unlike the
  // per-league scrape in import-sleeper-external-league-trades.mjs. Flagged
  // as ambiguous rather than verified; revisit if Sleeper starts rate-limiting.
  const result = await fetch_with_retry({
    url: URL,
    use_proxy: false,
    response_type: 'json'
  })
  const sleeper_player_count = result ? Object.keys(result).length : 0

  // Checked BEFORE the loop. The old check sat after the full loop AND after the
  // players_status insert, which is too late to refuse anything.
  if (sleeper_player_count < payload_floor) {
    return {
      fields: {},
      shortfall: `Sleeper /players/nfl returned ${sleeper_player_count} entries, below the floor of ${payload_floor} -- API outage, cached empty response, or a truncated payload`
    }
  }

  const statuses = []
  const fields = {}
  let changeCount = 0
  let players_with_injury_status = 0

  /*
    One counter per disposition, and they MUST partition `considered` with no
    remainder. Every counter defined relative to createPlayer being called is
    blind to whatever stopped it being called -- which is how this importer's
    own fourteen-month outage presented, and how an over-matching existence
    check would present. An earlier revision counted only the create-branch
    outcomes and its conservation identity broke by ~11,600 on every healthy
    run, because 9,400 ordinary updates and 1,800 non-fantasy skips were not in
    it.

    Increment at the disposition, never at the bottom of the loop.
  */
  const counts = {
    considered: 0,
    skipped_no_name_or_pos: 0,
    skipped_lookup_error: 0,
    updated_by_sleeper_id: 0,
    updated_by_name: 0,
    skipped_guard_hijack: 0,
    skipped_guard_collision: 0,
    skipped_non_fantasy: 0,
    skipped_duplicate_placeholder: 0,
    refused: 0,
    skipped_exists: 0,
    skipped_unknown: 0,
    created: 0,
    failed: 0,
    threw: 0
  }

  // The skip buckets are the only record that distinguishes a correct refusal
  // from a real player the rule cannot recognize, so they are logged by name and
  // pid rather than counted alone.
  const skipped_members = []
  let first_writer_error = null

  for (const sleeper_id in result) {
    const item = result[sleeper_id]
    const name = item.full_name || ''
    const team = fixTeam(item.team)
    const pos = item.position

    counts.considered += 1

    if (!name || !pos) {
      counts.skipped_no_name_or_pos += 1
      continue
    }

    for (const field in item) {
      fields[field] = true
    }

    let player_row
    let matched_by_sleeper_id = false
    try {
      player_row = await find_player_row({ sleeper_player_id: sleeper_id })
      if (player_row) {
        matched_by_sleeper_id = true
      } else {
        player_row = await find_player_row({
          name,
          pos,
          teams: [team, 'INA'],
          ignore_retired: true
        })
      }
    } catch (err) {
      counts.skipped_lookup_error += 1
      log(err)
      log({ name, pos, team, sleeper_id })
      log(item)
      continue
    }

    // Reused-name external ID hijack guard. When we fall through to
    // name-based matching and Sleeper's rookie_year is materially newer than
    // the matched pid's nfl_draft_year, we are almost certainly about to
    // hijack the wrong pid (older relative). Skip rather than corrupt.
    // Also refuse silent overwrite of an existing different sleeper_id /
    // gsisid / espn_id on the name-matched pid.
    if (player_row && !matched_by_sleeper_id) {
      const source_draft_year = Number(item.metadata?.rookie_year) || null
      const matched_draft_year = Number(player_row.nfl_draft_year) || null
      if (
        source_draft_year &&
        matched_draft_year &&
        source_draft_year - matched_draft_year > 1
      ) {
        counts.skipped_guard_hijack += 1
        log(
          `SKIP probable name-match hijack: sleeper_id=${sleeper_id} name="${name}" rookie_year=${source_draft_year} matched_pid=${player_row.pid} (draft_year=${matched_draft_year}).`
        )
        continue
      }

      const protected_collision = [
        ['sleeper_player_id', sleeper_id, player_row.sleeper_player_id],
        [
          'gsis_player_id',
          item.gsis_id ? item.gsis_id.trim() : null,
          player_row.gsis_player_id
        ],
        ['espn_player_id', item.espn_id, player_row.espn_player_id]
      ].find(
        ([, incoming, existing]) =>
          incoming != null &&
          existing != null &&
          String(incoming) !== String(existing)
      )
      if (protected_collision) {
        const [field, incoming, existing] = protected_collision
        counts.skipped_guard_collision += 1
        log(
          `SKIP ${field} overwrite: matched_pid=${player_row.pid} already has ${field}=${existing}, Sleeper reports ${incoming} for "${name}".`
        )
        continue
      }
    }

    const {
      active,
      depth_chart_order,
      depth_chart_position,
      injury_body_part,
      injury_start_date,
      injury_status,
      injury_notes,
      practice_participation,
      practice_description,
      status,
      search_rank,

      rotoworld_id,
      high_school,
      rotowire_id,
      gsis_id,
      sportradar_id,
      espn_id,
      fantasy_data_id,
      yahoo_id
      // stats_id,
    } = item

    const data = {
      rotoworld_player_id: rotoworld_id,
      high_school,
      rotowire_player_id: rotowire_id,
      gsis_player_id: gsis_id ? gsis_id.trim() : null,
      sportradar_player_id: sportradar_id || null,
      espn_player_id: espn_id,
      fantasy_data_player_id: fantasy_data_id,
      yahoo_player_id: yahoo_id,
      // stats_global_id: stats_id,
      sleeper_player_id: sleeper_id,
      current_nfl_team: team
    }

    // check to see if status matches game designation first (OUT, QUESTIONABLE, DOUBTFUL, PROBABLE)
    try {
      data.game_designation = format_nfl_injury_status(injury_status)
    } catch (err) {
      log(err)
      log(item)
    }

    // injury status could be PUP which is a roster status
    if (injury_status && !data.game_designation) {
      try {
        data.roster_status = format_nfl_status(injury_status)
      } catch (err) {
        log(err)
        log(item)
      }
    } else if (!data.game_designation) {
      data.roster_status = format_nfl_status(status)
    }

    if (!player_row) {
      if (!fantasy_positions.includes(item.position)) {
        counts.skipped_non_fantasy += 1
        continue
      }
      if (item.first_name === 'Duplicate' || item.first_name === 'Player') {
        counts.skipped_duplicate_placeholder += 1
        continue
      }

      const player_data = {
        first_name: item.first_name,
        last_name: item.last_name,
        primary_position: item.position,
        secondary_position: item.position,
        height_inches: item.height,
        weight_pounds: item.weight,
        date_of_birth: item.birth_date,
        college: item.college,
        current_nfl_team: item.team,
        jersey_number: item.number,

        position_depth: item.position,
        // Renamed from `start` by 9631a948c (2025-06-16); this file was never
        // swept, so every creation raised Postgres 42703 for fourteen months.
        // Sourced from rookie_year ALONE -- metadata.start_year does not exist
        // anywhere in the payload (0 of 12,219 entries). Coerced to a positive
        // integer or null because rookie_year is always a string and arrives as
        // '0' or '' for 54 entries, both of which are truthy and would insert 0.
        nfl_draft_year:
          Number(item.metadata?.rookie_year) > 0
            ? Number(item.metadata.rookie_year)
            : null,

        ...data
      }

      // Evaluate createPlayer's own predicate BEFORE calling, so a REFUSAL is
      // separable from a FAILURE (it returns null for both). Done before the
      // resolver because a payload that can never produce a row does not need an
      // existence question asked about it.
      const missing_field = CREATE_PLAYER_REQUIRED_FIELDS.find(
        (field) => !player_data[field]
      )
      if (missing_field) {
        counts.refused += 1
        log(
          `REFUSED create: sleeper_id=${sleeper_id} name="${name}" missing ${missing_field}`
        )
        continue
      }

      // Does this person already exist? `!player_row` above only means "no row
      // matched my narrow UPDATE criteria", and reading that as "this person does
      // not exist" is what would write 109 rows for people already in the table.
      // player_data already carries every external id, because `data` is spread
      // into it above -- so this hands the resolver the SAME id values the
      // insert is about to attempt, which is what makes the unique-constraint
      // pre-check exact rather than approximate.
      const resolution = await resolve_canonical_player({
        name,
        date_of_birth: item.birth_date,
        external_ids: player_data
      })

      if (resolution.status !== 'new') {
        counts[
          resolution.status === 'exists' ? 'skipped_exists' : 'skipped_unknown'
        ] += 1
        skipped_members.push(
          `${describe_resolution({
            name,
            date_of_birth: item.birth_date,
            resolution
          })} sleeper_id=${sleeper_id}`
        )
        continue
      }

      try {
        player_row = await createPlayer(player_data)
        if (player_row) {
          counts.created += 1
        } else {
          // The refusal predicate already passed, so a null here is a writer
          // fault rather than an incomplete entry.
          counts.failed += 1
          first_writer_error =
            first_writer_error ||
            `createPlayer returned null for sleeper_id=${sleeper_id} name="${name}" after the required-field predicate passed`
        }
      } catch (err) {
        // createPlayer can RAISE before returning: format_nfl_status throws on
        // any unmapped status string, normalize_position throws, first_name
        // .match(/[a-zA-Z]/).pop() throws on a letterless name, and the pid
        // sequence read can fail. Without its own bucket the iteration falls
        // through counted by nothing and the conservation identity breaks by one,
        // reporting "identity not closing" instead of naming the exception.
        counts.threw += 1
        first_writer_error =
          first_writer_error ||
          `createPlayer threw for sleeper_id=${sleeper_id} name="${name}": ${err.message}`
        log(err)
        log(item)
      }
    } else {
      counts[
        matched_by_sleeper_id ? 'updated_by_sleeper_id' : 'updated_by_name'
      ] += 1
      const changes = await updatePlayer({
        player_row,
        update: data,
        source: 'sleeper'
      })
      changeCount += changes
    }

    if (!player_row || !injury_status) continue
    players_with_injury_status += 1

    const status_insert = {
      pid: player_row.pid,
      sleeper_player_id: sleeper_id,

      is_active: active,
      depth_chart_order,
      depth_chart_position,
      injury_body_part,
      injury_start_date: injury_start_date || null,
      source_injury_status: injury_status,
      injury_notes,
      practice_participation,
      practice_description,
      source_status: status,
      search_rank,

      observed_at: new Date(timestamp * 1000)
    }

    // Try to parse as game designation first (OUT, QUESTIONABLE, DOUBTFUL, PROBABLE)
    try {
      status_insert.game_designation = format_nfl_injury_status(injury_status)
    } catch (err) {
      log(err)
      log(item)
    }

    // If not a game designation, try parsing as roster status
    if (!status_insert.game_designation) {
      try {
        status_insert.roster_status = format_nfl_status(status)
      } catch (err) {
        log(err)
        log(item)
      }
    }

    statuses.push(status_insert)
  }

  if (statuses.length) {
    await db('players_status').insert(statuses)
  }

  /*
    Report through console.log, not debug: a scheduled job's log is its audit
    trail and must not depend on winning the namespace negotiation.
  */
  console.log(`[import-players-sleeper] ${JSON.stringify(counts)}`)
  console.log(`[import-players-sleeper] updated ${changeCount} player fields`)
  for (const member of skipped_members) {
    console.log(`[import-players-sleeper] SKIP ${member}`)
  }

  const shortfalls = []

  // A writer-level fault is never routine and does not depend on any ratio.
  if (counts.failed > 0 || counts.threw > 0) {
    shortfalls.push(
      `Sleeper create path: ${counts.failed} failed and ${counts.threw} threw -- ${first_writer_error}`
    )
  }

  /*
    The conservation identity. A disposition falling on the floor is exactly the
    silent-skip class this importer's own outage belonged to.
  */
  const accounted =
    counts.skipped_no_name_or_pos +
    counts.skipped_lookup_error +
    counts.updated_by_sleeper_id +
    counts.updated_by_name +
    counts.skipped_guard_hijack +
    counts.skipped_guard_collision +
    counts.skipped_non_fantasy +
    counts.skipped_duplicate_placeholder +
    counts.refused +
    counts.skipped_exists +
    counts.skipped_unknown +
    counts.created +
    counts.failed +
    counts.threw
  if (accounted !== counts.considered) {
    shortfalls.push(
      `Sleeper disposition accounting broke: considered ${counts.considered} against ${accounted} accounted (difference ${counts.considered - accounted}) -- a loop path reaches no counter`
    )
  }

  // Distinct from the pre-loop payload floor: catches a payload that arrives at
  // full size carrying entries the loop cannot use.
  const unusable_ratio = counts.considered
    ? counts.skipped_no_name_or_pos / counts.considered
    : 0
  if (unusable_ratio > bounds.unusable_entry_ceiling_ratio) {
    shortfalls.push(
      `Sleeper payload arrived at ${counts.considered} entries but ${counts.skipped_no_name_or_pos} carry no name or position (${(unusable_ratio * 100).toFixed(1)}%, ceiling ${bounds.unusable_entry_ceiling_ratio * 100}%) -- the payload is full but its contents are degraded`
    )
  }

  /*
    The existence check is bounded in BOTH directions, and the floor is the
    important one. A ceiling alone sees over-matching, which merely starves
    creates. Under-matching is the dangerous direction: if format_player_name
    changes, the alias subquery breaks, or the predicate regresses, the resolver
    answers `new` for everyone, skipped_exists collapses toward zero, created
    jumps back to ~573 and the run mints every duplicate this check exists to
    prevent -- with every ceiling green.

    Both bounds are durable rather than transitional precisely because the
    resolver never writes a sleeper_player_id: the ~83 matched rows never become
    linked, so skipped_exists stays near 83 indefinitely instead of decaying to
    zero and forcing a retune.
  */
  if (
    counts.skipped_exists < bounds.skipped_exists_floor ||
    counts.skipped_exists > bounds.skipped_exists_ceiling
  ) {
    shortfalls.push(
      `Sleeper existence check resolved ${counts.skipped_exists} candidates to an existing row, outside the expected ${bounds.skipped_exists_floor}-${bounds.skipped_exists_ceiling} -- the name predicate has moved in one direction or the other`
    )
  }

  /*
    Bounded in BOTH directions for the same reason skipped_exists is, and the
    FLOOR is again the one that matters. The unknown buckets are where the
    resolver refuses rather than creates, so a regression collapsing any unknown
    rung toward `new` mints duplicate people -- and it does so with every other
    bound green. Turning rung 6 (BIRTH_DATES_DIFFER) back into a create, the
    exact design resolve-canonical-player records as tried and rejected, reads
    skipped_unknown 26 -> ~10, created ~0 -> ~16 and skipped_exists unmoved at
    83: inside 50-120, under the 40 ceiling, under the 550 ceiling. Silent.
  */
  if (
    counts.skipped_unknown < bounds.skipped_unknown_floor ||
    counts.skipped_unknown > bounds.skipped_unknown_ceiling
  ) {
    shortfalls.push(
      `Sleeper existence check could not adjudicate ${counts.skipped_unknown} candidates, outside the expected ${bounds.skipped_unknown_floor}-${bounds.skipped_unknown_ceiling} -- a refusal rung has moved in one direction or the other`
    )
  }

  // Deliberately NOT `created === 0`: 16 payload entries permanently fail the
  // required-field predicate, so once the backlog exists a healthy run creates
  // nothing on nearly every one of its 8 daily executions. This catches the
  // duplicate-minting signature instead.
  if (counts.created > bounds.created_ceiling) {
    shortfalls.push(
      `Sleeper created ${counts.created} rows, above the ceiling of ${bounds.created_ceiling} -- the backlog should already exist, so this is the existence check failing open`
    )
  }

  // Not monotone: a dedupe merge removes rows, and two rows holding one sleeper
  // id make find_player_row throw. So the floor sits well under the current
  // value rather than at it.
  if (counts.updated_by_sleeper_id < bounds.updated_by_sleeper_id_floor) {
    shortfalls.push(
      `Sleeper matched only ${counts.updated_by_sleeper_id} rows by sleeper_player_id, below the floor of ${bounds.updated_by_sleeper_id_floor}`
    )
  }

  // changeCount is logged today and checked by nothing, and updatePlayer silently
  // drops a key naming a nonexistent column -- so the update path can go to zero
  // writes with every create-side counter healthy.
  if (changeCount === 0 && counts.updated_by_sleeper_id > 0) {
    shortfalls.push(
      `Sleeper wrote zero player field changes across ${counts.updated_by_sleeper_id} id-matched rows -- the update path is silently dropping every key`
    )
  }

  // In-season-only monitors. Both run after a successful API liveness check
  // and emit shortfalls into the unified signal queue via throw_if_shortfall.
  if (!is_offseason) {
    // E3: value-level health canary. The 2022 Sleeper blackout kept the API
    // shape intact (player objects returned with the same keys) but stripped
    // injury_status content -- a key-hash canary would not have caught it.
    // Threshold of 5 active injuries is comfortably above any plausible
    // in-season floor; any in-season Tuesday-Sunday window normally
    // carries hundreds.
    if (players_with_injury_status < 5) {
      shortfalls.push(
        `Sleeper value-level canary: only ${players_with_injury_status} players carry injury_status in this in-season run (floor 5) -- possible 2022-style content stripping`
      )
    }

    // E1: blackout monitor. Zero injury_status changelog writes from the
    // sleeper source in the last 48h during the in-season window means
    // either the API stripped content (caught above) or our writer is
    // broken upstream. The 2022 blackout ran 23 weeks undetected; this
    // catches a recurrence on day 3.
    const cutoff = new Date((timestamp - 48 * 3600) * 1000)
    const [{ c: recent_writes }] = await db('player_changelog')
      .where({ source: 'sleeper', column_name: 'injury_status' })
      .andWhere('changed_at', '>=', cutoff)
      .count({ c: '*' })
    if (Number(recent_writes) === 0) {
      shortfalls.push(
        `Sleeper blackout monitor: zero source='sleeper' injury_status changelog writes in the last 48h during in-season -- 2022-style blackout suspected`
      )
    }
  }

  // Accumulated and joined rather than returned on the first: run() used to
  // return early, so one reason reached the jobs row and the rest were masked.
  return {
    fields,
    counts,
    shortfall: shortfalls.length ? shortfalls.join(' | ') : null
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const { fields, shortfall } = await run()
    if (argv.fields) {
      log(`Complete field list: ${Object.keys(fields)}`)
    }
    throw_if_shortfall(shortfall)
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYERS_SLEEPER,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
