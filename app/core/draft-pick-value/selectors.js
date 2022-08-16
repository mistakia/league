import { constants } from '@common'

const getRank = ({ pick, round }) => {
  if (pick) {
    return pick
  }

  switch (round) {
    case 1:
      return 6
    case 2:
      return 18
    case 3:
      return 30
    case 4:
      return 40
    default:
      return 40
  }
}

export function getDraftPickValue(state, { pick, round }) {
  const values = state.get('draft_pick_value')
  const rank = getRank({ pick, round })
  const item = values.find((value) => value.rank === rank)

  if (!item) {
    return 0
  }

  const avg =
    (item.median_best_season_points_added_per_game +
      item.median_career_points_added_per_game) /
    2
  const weeks_remaining = constants.season.finalWeek - constants.week

  return avg * weeks_remaining
}
