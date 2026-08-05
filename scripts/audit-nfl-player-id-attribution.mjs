import fs from 'fs/promises'

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
import {
  fetch_all_listed_players,
  load_name_match_scope,
  resolve_unique_candidate
} from './import-nfl-player-ids.mjs'

const log = debug('audit-nfl-player-id-attribution')
debug.enable('audit-nfl-player-id-attribution')

// Is each stored `player.nfl_player_id` on the RIGHT person?
//
// The era audit (`audit-conflated-player-identity.mjs`) cannot answer this. It
// measures disagreement between identifier-era votes, so it only sees an id
// that names the wrong DECADE. A shuffle within a single draft cohort leaves
// every era vote agreeing — the ids are all 2563xxx-2564xxx, all voting 2020,
// all correct about the era and all attached to the wrong person. That class is
// invisible to any internal oracle, because nothing internal disagrees.
//
// So the oracle has to be external. NFL.com's own listing states a name for
// each shield id, which settles it directly. Measured 2026-08-05: 23 of the 459
// then-adjudicable values sat on the wrong row, concentrated almost entirely in
// the 2020 cohort — 2564007 is Jordan Love and rode Jeff Okudah's row.
//
// ## Adjudicate on LAST NAME
//
// NFL.com serves display names and we store legal names, so a full-string
// comparison reports the same person as a defect: kenny/kenneth gainwell,
// jj/jonathan mccarthy, theo/theodore johnson, will/william shipley, and
// robbie chosen (who legally changed his name from robbie anderson). Of 34 raw
// disagreements only 23 were real. A first-initial check would also fail
// several of these, so last name alone is the test, and the residue is small
// enough to read by hand.
//
// ## Coverage is the active population only
//
// The listing holds roughly 1,036 players, so it can adjudicate only the ids we
// hold that appear in it. It says nothing about the rest, and an id it does not
// mention is unexamined rather than clean.
//
// ## The remedy is RELEASE, never reassignment
//
// It is tempting to repair a wrong id by moving it to the row whose name
// matches, and to fill the vacated row from the listing entry bearing ITS name.
// That is the era-unscoped name attach this cluster exists to close, and it
// fails immediately in practice: the first draft of this script offered
// `2543509` as the correct id for `alton robinson` on a last-name-plus-initial
// match, and 2543509 is **Allen** Robinson's id, a 2014 entrant, correctly held
// by `ALLE-ROBI-007116`. Taking that suggestion would have destroyed a good
// value to fix a bad one.
//
// So this audit only ever proposes NULL. Releasing a contradicted value is
// recoverable and provably correct — the feed says the row is wrong — while
// choosing its replacement by name is the guess that caused the damage. The
// importer then refills from the feed's own id-to-name statement, which is
// authoritative rather than inferred.
//
// Two independent contradictions, and the second is the one a naive audit
// misses. A stored id can name someone else (`held_by_other_person`), and a row
// can hold something other than what the feed says that person's id is
// (`row_holds_wrong_id`). A shuffle within one cohort produces both halves at
// once, and clearing only the first leaves the correct id homeless: the row it
// belongs to still holds a wrong value, so it is not free for the importer to
// fill.

const normalize = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim()

export const last_name_of = (name) => {
  const parts = normalize(name).split(/\s+/).filter(Boolean)
  if (!parts.length) return ''

  // Drop a generational suffix so `Ricky White III` compares as `white`.
  const suffixes = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])
  const trimmed = parts.filter((part) => !suffixes.has(part))
  const usable = trimmed.length ? trimmed : parts

  return usable[usable.length - 1]
}

// A LEGAL NAME CHANGE defeats the last-name test, and it is the one shape that
// cannot be normalized away — the two surnames are genuinely unrelated, so the
// audit reads a correct value as a defect and would propose destroying it.
//
// Adjudications are pinned per pid AND per id, so that a value moving under a
// pid re-reports rather than inheriting the exception. Keep this list short and
// evidenced; it is not a place to silence a finding you have not explained.
const ACCEPTED_NAME_DIFFERENCES = [
  {
    pid: 'ROBB-ANDE-017101',
    nfl_player_id: 2556462,
    card_name: 'Robbie Chosen',
    reason:
      'legal name change from Robbie Anderson in 2022; nfl.com serves the new name, our row carries the old one'
  }
]

export const is_accepted_name_difference = ({
  pid,
  nfl_player_id,
  card_name
}) =>
  ACCEPTED_NAME_DIFFERENCES.some(
    (accepted) =>
      accepted.pid === pid &&
      accepted.nfl_player_id === Number(nfl_player_id) &&
      last_name_of(accepted.card_name) === last_name_of(card_name)
  )

const audit_nfl_player_id_attribution = async ({ output_path = null } = {}) => {
  const listed_players = await fetch_all_listed_players()
  log(`${listed_players.length} players listed by nfl.com`)

  const listed_by_id = new Map(
    listed_players.map((player) => [player.nfl_player_id, player])
  )

  const player_rows = await db('player')
    .select('pid', 'formatted_name', 'nfl_player_id', 'nfl_draft_year')
    .whereNotNull('nfl_player_id')

  const contradictions = new Map()

  const record = (row, reason, detail) => {
    const existing = contradictions.get(row.pid)
    if (existing) {
      existing.reasons.push(reason)
      return
    }
    contradictions.set(row.pid, {
      pid: row.pid,
      our_name: row.formatted_name,
      nfl_draft_year: row.nfl_draft_year,
      held_nfl_player_id: Number(row.nfl_player_id),
      reasons: [reason],
      ...detail
    })
  }

  // Contradiction one: the id we store names somebody else.
  let adjudicable = 0
  let accepted_name_differences = 0
  for (const row of player_rows) {
    const listed = listed_by_id.get(Number(row.nfl_player_id))
    if (!listed) continue

    adjudicable++
    if (last_name_of(row.formatted_name) === last_name_of(listed.name)) continue
    if (
      is_accepted_name_difference({
        pid: row.pid,
        nfl_player_id: row.nfl_player_id,
        card_name: listed.name
      })
    ) {
      accepted_name_differences++
      continue
    }

    record(row, 'held_by_other_person', { held_id_belongs_to: listed.name })
  }

  // Contradiction two: the feed gives this person a DIFFERENT id than the one
  // the row holds. Resolution reuses the importer's scope and its
  // unique-or-abstain narrowing, so the audit can only speak about rows the
  // importer could act on, and an ambiguous name is silently skipped rather
  // than adjudicated.
  const scope = await load_name_match_scope({ only_unfilled: false })
  for (const listed_player of listed_players) {
    const candidates = scope.get(listed_player.formatted_name) || []
    if (!candidates.length) continue

    const { player_row } = resolve_unique_candidate({
      candidates,
      listed_player
    })
    if (!player_row || !player_row.nfl_player_id) continue
    if (Number(player_row.nfl_player_id) === listed_player.nfl_player_id) {
      continue
    }

    record(player_row, 'row_holds_wrong_id', {
      feed_says_this_person_is: listed_player.nfl_player_id
    })
  }

  const release = [...contradictions.values()].sort(
    (a, b) => a.held_nfl_player_id - b.held_nfl_player_id
  )

  const summary = {
    stored: player_rows.length,
    adjudicable,
    contradicted_rows: release.length,
    accepted_name_differences,
    held_by_other_person: release.filter((row) =>
      row.reasons.includes('held_by_other_person')
    ).length,
    row_holds_wrong_id: release.filter((row) =>
      row.reasons.includes('row_holds_wrong_id')
    ).length
  }

  log(summary)
  for (const row of release) {
    log(
      `${row.pid} (${row.our_name}) holds ${row.held_nfl_player_id} — ${row.reasons.join(' + ')}${row.held_id_belongs_to ? `, that id is ${row.held_id_belongs_to}` : ''}${row.feed_says_this_person_is ? `, feed says this person is ${row.feed_says_this_person_is}` : ''}`
    )
  }

  if (output_path) {
    await fs.writeFile(
      output_path,
      JSON.stringify({ summary, release }, null, 2)
    )
    log(`wrote ${output_path}`)
  }

  return { summary, release }
}

export default audit_nfl_player_id_attribution

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv)).option('output_path', {
      type: 'string',
      describe: 'write the full misattribution set as JSON to this path'
    }).argv

    await audit_nfl_player_id_attribution({ output_path: argv.output_path })
  } catch (err) {
    error = err
    log(error)
  }

  await db.destroy()
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}
