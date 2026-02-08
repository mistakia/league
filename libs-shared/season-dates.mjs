const season_dates = {
  // use unix timestamp, start of day, new york timezone

  // super bowl
  offseason: 1739077200,

  // Two Tuesdays before first game
  regular_season_start: 1756180800,

  // super bowl (end of day to include game day)
  end: 1770613200,

  // first game
  openingDay: 1756958400,

  finalWeek: 17,
  nflFinalWeek: 18,
  regularSeasonFinalWeek: 14,
  wildcardWeek: 15,

  // Number of bye weeks between conference championship and super bowl
  // (Pro Bowl week - no playoff games)
  superBowlByeWeeks: 1
}

export default season_dates
