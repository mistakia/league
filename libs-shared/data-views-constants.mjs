export const row_axis_params = ['year', 'week']

/*
  The recency floor on the KeepTradeCut year-axis as-of lookup, in days.

  Shared because two surfaces have to agree on it: the emitter builds the SQL
  interval from it, and the `as_of_month_day` control tells a reader when a
  chosen day's window opens. A second copy would drift in the direction that
  misleads -- the control promising a date the query does not use.

  30 days is ~10x the largest real gap in the feed (measured 2026-07-31 over
  2,237 scrape days: median 1 day, max 3), so it absorbs a scraper outage while
  dropping a player who has been off the board a month. See
  libs-server/data-views-column-definitions/player-keeptradecut-column-definitions.mjs
  for why the floor exists at all -- without it a delisted player's final rank
  is carried forward forever.
*/
export const KEEPTRADECUT_AS_OF_WINDOW_DAYS = 30
