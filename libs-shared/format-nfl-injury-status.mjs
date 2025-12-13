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

    // Values that indicate no injury status (return null)
    case 'NA': // Not Applicable/Available (Sleeper uses this for healthy players)
      return null

    // Roster/NFL statuses that some platforms incorrectly put in injury_status field
    // These are not game-day injury designations, so return null
    case 'IR': // Injured Reserve (roster status, not injury designation)
    case 'PUP': // Physically Unable to Perform (roster status)
    case 'SUS': // Suspended (roster status)
    case 'COV': // COVID IR (roster status)
    case 'DNR': // Did Not Report (roster status)
    case 'NFI': // Non-Football Injury (roster status)
      return null

    default:
      throw new Error(`Invalid injury status: ${status_string}`)
  }
}
