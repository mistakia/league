// WHO MAY START AN AGENT, which is a different question from who may submit.
//
// Anyone may submit -- the report surface is reachable logged out from
// /data-views and /plays, which is where most breakage is seen. What the trust
// tier decides is whether the submission can enter the autonomous planning path
// without the operator ruling on it first.
//
// The tier is resolved once, at insert, and STORED on the row rather than
// recomputed at read time. A submission is judged by the standing of its
// submitter when they filed it; recomputing later would retroactively rewrite
// what an already-queued row was admitted as, which is exactly the property an
// audit trail must not have.

export const ANONYMOUS_TRUST_TIER = 'untrusted'
export const DEFAULT_AUTHENTICATED_TRUST_TIER = 'standard'

// Ordered so a threshold comparison is a lookup rather than a chain of
// string equality tests. The poller in base reads a threshold VALUE and admits
// anything ranking at or above it, so re-tuning which submissions run
// autonomously is a data edit and never a deploy.
export const TRUST_TIER_RANK = Object.freeze({
  untrusted: 0,
  standard: 1,
  trusted: 2
})

export const is_trust_tier_at_least = (tier, threshold) =>
  (TRUST_TIER_RANK[tier] ?? -1) >= (TRUST_TIER_RANK[threshold] ?? Infinity)

// submitter_user_id absent means no valid session reached the route. That is a
// STRUCTURAL property of where this router is mounted rather than a check
// anyone has to remember: /api/contributions sits above the blanket auth guard
// in api/index.mjs, and express-jwt swallows a missing or malformed
// Authorization header, so req.auth is populated when a real token was
// presented and undefined otherwise. There is no ownership predicate here to
// invert for anonymous callers -- the two live privacy holes this repository
// has had were both exactly that.
export default async function resolve_trust_tier({ db, submitter_user_id }) {
  if (!submitter_user_id) {
    return ANONYMOUS_TRUST_TIER
  }

  const override = await db('contribution_trust_overrides')
    .where({ submitter_user_id })
    .first('submission_trust_tier')

  return override?.submission_trust_tier ?? DEFAULT_AUTHENTICATED_TRUST_TIER
}
