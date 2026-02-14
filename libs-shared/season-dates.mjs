const season_dates = {
  // use unix timestamp, start of day, new york timezone
  // 2026 season (opening Thu Sep 10 2026, Super Bowl LX Feb 8 2027)

  // super bowl (after 2025 season)
  offseason: 1770526800,

  // Two Tuesdays before first game (Aug 25 2026)
  regular_season_start: 1787630400,

  // super bowl (end of day to include game day, Feb 9 2027)
  end: 1802149200,

  // first game (Sep 10 2026)
  openingDay: 1789012800,

  finalWeek: 17,
  nflFinalWeek: 18,
  regularSeasonFinalWeek: 14,
  wildcardWeek: 15,

  // Number of bye weeks between conference championship and super bowl
  // (Pro Bowl week - no playoff games)
  superBowlByeWeeks: 1
}

export default season_dates
