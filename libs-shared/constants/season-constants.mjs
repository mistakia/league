import season_dates from '../season-dates.mjs'
import Season from '../season.mjs'

export const current_season = new Season(season_dates)
export const current_week = current_season.week
export const current_year = current_season.year
export const current_fantasy_season_week = current_season.fantasy_season_week
export const is_offseason = current_season.isOffseason
export const is_regular_season = current_season.isRegularSeason
export const league_default_rfa_announcement_hour = 24
export const league_default_rfa_processing_hour = 0

export const nfl_draft_rounds = [0, 1, 2, 3, 4, 5, 6, 7]

export const league_defaults = {
  LEAGUE_ID: 0
}

export const ui_color_palette = [
  '#e6194B', // red
  '#f58231', // orange
  '#ffe119', // yellow
  '#fabed4', // pink
  '#3cb44b', // green
  '#42d4f4', // cyan
  '#4363d8', // blue
  '#000075', // navy
  '#f032e6', // magenta
  '#911eb4', // purple
  '#dcbeff', // lavender
  '#aaffc3', // mint
  '#800000', // maroon
  '#9A6324', // brown
  '#fffac8', // beige
  '#a9a9a9', // grey
  '#bfef45' // lime
]

const get_available_years = () => {
  const arr = []
  for (let i = current_season.year; i >= 2000; i--) {
    arr.push(i)
  }
  return arr
}

export const available_years = get_available_years()

export const regular_fantasy_weeks = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
]
export const fantasy_weeks = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17
]
export const nfl_weeks = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21
]
export const game_days = ['WED', 'THU', 'TN', 'FRI', 'SAT', 'SUN', 'MN', 'SN']
export const nfl_quarters = [1, 2, 3, 4, 5]
export const nfl_downs = [1, 2, 3, 4]
export const nfl_season_types = ['PRE', 'REG', 'POST']
