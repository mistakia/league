import * as constants from './constants.mjs'

export default function getHistoricBaselines({
  league,
  weeks = constants.season.nflFinalWeek
}) {
  const historicBaselines = {}
  constants.positions.forEach((p) => {
    const per_game = league[`b_${p}`]
    historicBaselines[p] = per_game * (weeks - 1)
  })

  return historicBaselines
}
