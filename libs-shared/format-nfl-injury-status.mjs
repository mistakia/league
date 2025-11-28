import { player_nfl_injury_status } from '#constants'

export default (status_string) => {
  status_string = status_string ? status_string.toUpperCase().trim() : null

  if (!status_string) {
    return null
  }

  switch (status_string) {
    case player_nfl_injury_status.PROBABLE:
    case 'P':
      return player_nfl_injury_status.PROBABLE

    case player_nfl_injury_status.DOUBTFUL:
    case 'D':
      return player_nfl_injury_status.DOUBTFUL

    case player_nfl_injury_status.QUESTIONABLE:
    case 'Q':
    case 'QUES':
    case 'QUEST':
      return player_nfl_injury_status.QUESTIONABLE

    case player_nfl_injury_status.OUT:
    case 'O':
      return player_nfl_injury_status.OUT

    default:
      throw new Error(`Invalid injury status: ${status_string}`)
  }
}
