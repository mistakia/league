import knex from '#db'
import {
  current_season,
  bid_change_types,
  bid_change_sources
} from '#constants'
import { record_restricted_free_agency_bid_change } from '#libs-server/record-bid-change.mjs'

// Seed a restricted free agency bid together with the nomination it belongs to.
//
// Fixtures used to write the auction's facts onto the bid row, which is what
// let `test/scripts.restricted-free-agency.spec.mjs` give competing bids an
// `announced` value that production never writes -- so the suite encoded a
// shape the writer could not produce, and stayed green through the defect that
// processed league 1's second 2026 nomination six hours early.
//
// Seeding through the nomination makes that fixture impossible to write: the
// announcement has exactly one home per (league, player, season), and every
// competing bid on the same player necessarily shares it.
export const insert_restricted_free_agency_nomination = async ({
  pid,
  lid,
  original_team_id,
  nominated_at = null,
  announced_at = null,
  processed_at = null,
  year = current_season.year
}) => {
  const rows = await knex('restricted_free_agency_nominations')
    .insert({
      league_id: lid,
      player_id: pid,
      season_year: year,
      original_team_id,
      nominated_at: nominated_at
        ? knex.raw('to_timestamp(?)', [nominated_at])
        : null,
      announced_at: announced_at
        ? knex.raw('to_timestamp(?)', [announced_at])
        : null,
      processed_at: processed_at
        ? knex.raw('to_timestamp(?)', [processed_at])
        : null
    })
    .onConflict(['league_id', 'player_id', 'season_year'])
    // A bare .merge() would write every inserted column, so seeding a competing
    // bid -- which passes no window timestamps -- would null out the
    // announcement the original team's nomination already carried, and the
    // auction would silently stop being due. Coalesce instead: a later bid on
    // the same auction adds nothing and erases nothing.
    .merge({
      original_team_id: knex.raw('excluded.original_team_id'),
      nominated_at: knex.raw(
        'coalesce(excluded.nominated_at, restricted_free_agency_nominations.nominated_at)'
      ),
      announced_at: knex.raw(
        'coalesce(excluded.announced_at, restricted_free_agency_nominations.announced_at)'
      ),
      processed_at: knex.raw(
        'coalesce(excluded.processed_at, restricted_free_agency_nominations.processed_at)'
      )
    })
    .returning('nomination_id')

  return rows[0].nomination_id
}

export const insert_restricted_free_agency_bid = async ({
  pid,
  lid,
  tid,
  bid_amount,
  userid = 1,
  original_team_id = tid,
  nominated_at = null,
  announced_at = null,
  processed = null,
  cancelled = null,
  is_successful = null,
  outcome = null,
  year = current_season.year
}) => {
  const nomination_id = await insert_restricted_free_agency_nomination({
    pid,
    lid,
    original_team_id,
    nominated_at,
    announced_at,
    year
  })

  const rows = await knex('restricted_free_agency_bids')
    .insert({
      pid,
      userid,
      bid_amount,
      tid,
      lid,
      nomination_id,
      season_year: year,
      submitted: Math.round(Date.now() / 1000),
      processed,
      cancelled,
      is_successful,
      outcome
    })
    .returning('uid')

  const bid_id = rows[0].uid

  // Seed the audit trail too, so no fixture can produce a bid that the writers
  // could not have produced. Every live write path records a change; a bid with
  // an empty changelog is a shape production cannot reach, and a fixture that
  // creates one lets a spec pass over code that never recorded anything -- the
  // same defect as the `announced`-on-a-competing-bid fixture this file already
  // exists to prevent.
  //
  // The change type follows the state being seeded rather than always being
  // `created`, because a fixture that seeds a settled or cancelled bid is
  // seeding the END of a history. Claiming a five-season-old processed bid was
  // just created would put a row in the trail that is right about when and
  // wrong about what.
  let change_type = bid_change_types.CREATED
  if (processed) {
    change_type = bid_change_types.SETTLED
  } else if (cancelled) {
    change_type = bid_change_types.CANCELLED
  }

  await record_restricted_free_agency_bid_change({
    db: knex,
    bid_id,
    change_type,
    change_source:
      change_type === bid_change_types.SETTLED
        ? bid_change_sources.SETTLEMENT_SCRIPT
        : bid_change_sources.API_BID_CREATE,
    changed_by_user_id: change_type === bid_change_types.SETTLED ? null : userid
  })

  return bid_id
}

export default insert_restricted_free_agency_bid
