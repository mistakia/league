// Display vocabulary for the roster-asset-lineage graph, shared by the trade
// review page and any other surface that narrates a holding's history.
//
// The integer values are the DDL column comments on
// roster_asset_transformation.transformation_type and
// roster_asset_holding.terminated_by, and are declared in JS at
// libs-server/roster-asset-lineage/constants.mjs. That module is server-only --
// the SPA has no @libs-server webpack alias -- so the labels live here instead
// of beside the enums. test/trade-review.spec.mjs asserts these two maps cover
// exactly the keys of those enums, so a value added there cannot silently
// render as a bare integer here.

export const transformation_type_labels = {
  1: 'Traded',
  2: 'Won at auction',
  3: 'Won in restricted free agency',
  4: 'Franchise tagged',
  5: 'Rookie tagged',
  6: 'Extended',
  7: 'Drafted',
  8: 'Claimed off waivers',
  9: 'Signed as a free agent',
  10: 'Signed to the practice squad',
  11: 'Poached',
  12: 'Released',
  13: 'Converted to a drafted player',
  14: 'Carried into the next season',
  15: 'Awarded by standings',
  16: 'Reassigned from a decommissioned team',
  17: 'Re-signed on super priority',
  18: 'Released for cap space',
  19: 'Kept after a failed poach',
  20: 'Protected'
}

export const terminated_by_labels = {
  1: 'Traded away',
  2: 'Released',
  3: 'Season ended',
  4: 'Extended',
  5: 'Expired to free agency',
  6: 'Converted to a drafted player',
  7: 'Released for cap space',
  8: 'Voided when the team was decommissioned',
  9: 'Re-signed on super priority',
  10: 'Still held'
}

// The two lineage_state values the grading engine emits, spelled out. An asset
// whose descendants are all closed is worth zero, exactly as an asset that was
// never worth anything is, so the label is the only thing separating "this team
// consumed the asset" from "this trade came to nothing".
export const lineage_state_labels = {
  no_longer_held: 'No longer held',
  held: 'Still held'
}

export const lineage_state_descriptions = {
  no_longer_held:
    'Every asset descended from this one has since been released, expired or converted, so it is worth nothing to this team today.',
  held: 'At least one asset descended from this one is still on a roster.'
}

const format_lineage_event = (transformation_type) =>
  transformation_type_labels[transformation_type] || 'Acquired'

export default format_lineage_event
