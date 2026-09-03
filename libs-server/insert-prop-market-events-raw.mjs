import debug from 'debug'

import db from '#db'

const log = debug('insert-prop-market-events-raw')

// The event envelope is a SEPARATE grain from the market body, which is why it
// is a separate writer rather than another argument to insert_prop_markets.
//
// A market body carries what the derivation reads -- the line parameters, the
// selection array, the vendor's market type. The envelope carries what FIXTURE
// MATCHING reads: the event name and its start time. Neither appears on the
// other, and the envelope is one row per event where the body is one per
// market, so folding them together would duplicate the envelope once per market
// -- roughly 37 times over on a BetMGM run.
//
// Fixture matching is the reason this is captured at all. It has failed twice
// on payloads nobody kept: once when the vendor moved from " at " to " @ " in
// the event name, and once when a host-timezone week calculation put a Monday
// night game in the following week. Both were diagnosed against a dump a
// session happened to have saved by hand.
//
// Deduplicated on the way in. A vendor commonly repeats one event across the
// several market groups it serves, so the same envelope arrives many times in a
// run; the unique index would reject the batch outright rather than the
// duplicate rows.
export default async function insert_prop_market_events_raw(
  events,
  { dry_run = false } = {}
) {
  if (!events || events.length === 0) {
    return { inserted: 0 }
  }

  const unique_events = new Map()
  for (const event of events) {
    const { source_id, source_event_id, observed_at, raw_payload } = event

    if (!source_id) {
      throw new Error('source_id is required')
    }

    if (!source_event_id) {
      throw new Error('source_event_id is required')
    }

    if (!observed_at) {
      throw new Error('observed_at is required')
    }

    if (!raw_payload) {
      throw new Error('raw_payload is required')
    }

    unique_events.set(`${source_id}:${source_event_id}:${observed_at}`, {
      source_id,
      source_event_id,
      observed_at,
      raw_payload: JSON.stringify(raw_payload)
    })
  }

  const rows = [...unique_events.values()]

  if (dry_run) {
    log(`dry run: would write ${rows.length} event envelopes`)
    return { inserted: rows.length }
  }

  await db('prop_market_events_raw_history')
    .insert(rows)
    .onConflict(['source_id', 'source_event_id', 'observed_at'])
    .merge()

  log(`wrote ${rows.length} event envelopes`)

  return { inserted: rows.length }
}
