// Stable system view_id constants extracted from app/core/data-views/default-data-views.js
// These IDs are persistence keys and must never change.
// Used by:
//   - libs-server/view-organization/load-view-organization.mjs (orphan-filter whitelist)
//   - scripts/generate-data-view-llm-tags.mjs (skip system views)
//   - app/core/data-views/default-data-views.js (imports from here)

export const SYSTEM_VIEW_IDS = {
  SEASON_FANTASY_POINTS: 'SEASON_FANTASY_POINTS',
  SEASON_PROJECTIONS: 'SEASON_PROJECTIONS',
  PASSING_STATS_BY_PLAY: 'PASSING_STATS_BY_PLAY',
  RUSHING_STATS_BY_PLAY: 'RUSHING_STATS_BY_PLAY',
  RECEIVING_STATS_BY_PLAY: 'RECEIVING_STATS_BY_PLAY'
}

export const system_view_ids_array = Object.values(SYSTEM_VIEW_IDS)
export const system_view_ids_set = new Set(system_view_ids_array)
