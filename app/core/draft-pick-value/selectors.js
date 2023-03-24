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
      return 36
    case 4:
      return 50
    default:
      return 60
  }
}

export function getDraftPickValueByPick(state, { pick }) {
  const values = state.get('draft_pick_value')
  const rank = getRank(pick)
  const item = values.find((value) => value.rank === rank)

  if (!item) {
    return 0
  }

  const avg =
    (3 * item.median_best_season_points_added_per_game +
      item.median_career_points_added_per_game) /
    4
  const weeks_remaining =
    constants.season.finalWeek - constants.fantasy_season_week

  return avg * weeks_remaining
}
