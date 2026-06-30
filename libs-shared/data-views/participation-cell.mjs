// Shared, pure null -> marker decision for participation-aware numeric cells.
// No React, no DOM -- importable by the client render hook (app/), the client
// export hook (table-menu via the column def), and the server export route
// (api/) alike. This module is the single source of the participation_status
// enum strings: the server CASE that emits the signal
// (libs-server/data-views/participation-status-cte.mjs) imports these same
// constants so the produced value and the decode here cannot drift.

export const PARTICIPATION_STATUS = {
  // gamelog row exists with active = true -> a null/zero numeric stat means the
  // player played but recorded zero, rendered as 0 (distinct from did-not-play).
  ACTIVE: 'active',
  // no gamelog row and none of the player's season teams played that week.
  BYE: 'bye'
}

// Decide what an otherwise-null numeric cell shows, given the row's hidden
// participation_status:
//   'active' -> '0'   (played, recorded zero)
//   'bye'    -> 'BYE'
//   anything else (inactive / dnp / not-rostered / no signal) -> '' (blank)
// Returns a string in every branch so callers can render or export it directly.
export const render_participation_null = ({ participation_status }) => {
  if (participation_status === PARTICIPATION_STATUS.ACTIVE) return '0'
  if (participation_status === PARTICIPATION_STATUS.BYE) return 'BYE'
  return ''
}
