const season_dates = {
  // use unix timestamp, start of day, new york timezone
  // 2026 season (opening Thu Sep 10 2026, Super Bowl LXI Sun Feb 14 2027)

  // midnight ending Super Bowl LX day, Sun Feb 8 2026 (after the 2025 season)
  offseason: 1770613200,

  // Two Tuesdays before first game (Sep 1 2026)
  //
  // This is an ANCHOR, not a date anyone observes: `calculate_week` and the
  // `week` getter are both `diff(this.regular_season_start, 'weeks')`, so the
  // week a game resolves to is a pure function of its distance from here. The
  // invariant is `opening_day - regular_season_start === 777600` (nine days --
  // the Tuesday nine days before an always-Thursday opener), which makes the
  // opener land in week 1 and week N begin on the Tuesday preceding week N's
  // games. 2023, 2024 and 2025 all carry exactly that gap.
  //
  // 2026 was set to Aug 25 in eace61a48 -- three Tuesdays before the Sep 10
  // opener, a 16-day gap -- and every 2026 regular-season game therefore
  // resolved to week N+1. Nothing failed: `find_nfl_game` in every odds
  // importer looks up `nfl_games` by (week, seas_type, teams), missed on the
  // shifted week, and wrote `esbid: null`. All 4,632 2026 rows in
  // prop_markets_index were unlinked, across DraftKings, Pinnacle and FanDuel,
  // with no error anywhere. The offseason hid it from every other consumer,
  // since the `week` getter clamps to 0 until the anchor passes.
  //
  // When setting this for a new season, check the gap, not the calendar: the
  // subtraction is the thing that can be verified.
  regular_season_start: 1788235200,

  // Midnight ending Super Bowl day, so the game itself is still inside the
  // season -- `Season.year` flips here and five odds importers stop at it.
  //
  // Derive the date from the anchor, not from the header comment: the Super
  // Bowl is POST week 4, which `calculate_week` places at
  // `regular_season_start + (nfl_final_week + super_bowl_bye_weeks + 4)` weeks.
  // For 2026 that is Tue Feb 9, whose Sunday is Feb 14 2027.
  end: 1802667600,

  // first game (Sep 10 2026)
  opening_day: 1789012800,

  final_week: 17,
  nfl_final_week: 18,
  regular_season_final_week: 14,
  wildcard_week: 15,

  // Number of bye weeks between conference championship and super bowl
  // (Pro Bowl week - no playoff games)
  super_bowl_bye_weeks: 1
}

export default season_dates
