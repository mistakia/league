import { restricted_free_agency_bid_outcomes } from '#constants'

// A restricted free agency bid that fails while it is the winning candidate
// carries its own outcome, and the code that raises the failure is the only
// place that knows which one it is.
//
// The alternative -- matching on `error.message` where the failure is caught --
// is what the retired `reason` column did, and it is the reason six seasons of
// history had to be reclassified: the settlement path recorded whatever English
// happened to be in scope, so the vocabulary was an accident of exception text
// and a reworded throw would silently have changed the stored outcome.
//
// Attaching the code at the throw site keeps the vocabulary closed. An error
// raised by anything else -- a database fault, a bug -- has no code and resolves
// to PROCESSING_ERROR, which is the honest answer for a failure nobody
// anticipated.
export const restricted_free_agency_bid_error = ({ outcome, message }) =>
  Object.assign(new Error(message), {
    restricted_free_agency_bid_outcome: outcome
  })

export const resolve_restricted_free_agency_bid_error_outcome = (error) =>
  error?.restricted_free_agency_bid_outcome ??
  restricted_free_agency_bid_outcomes.PROCESSING_ERROR
