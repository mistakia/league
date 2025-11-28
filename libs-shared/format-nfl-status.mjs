import { player_nfl_status } from '#constants'

export default (status_string) => {
  status_string = status_string ? status_string.toUpperCase().trim() : null

  if (!status_string) {
    return null
  }

  // TODO voluntary opt out
  // TODO NFI-A

  switch (status_string) {
    case player_nfl_status.ACTIVE:
    case 'ACT': // NFL
      return player_nfl_status.ACTIVE

    case player_nfl_status.INACTIVE:
    case 'INA': // NFL
      return player_nfl_status.INACTIVE

    case player_nfl_status.EXEMPT:
    case 'EXE': // NFL & Sportradar
    case 'EX':
    case 'RESERVE-EX':
      return player_nfl_status.EXEMPT

    case player_nfl_status.RESERVE_FUTURE:
    case 'FRES': // Sportradar
      return player_nfl_status.RESERVE_FUTURE

    case player_nfl_status.CUT:
    case 'CUT': // NFL
      return player_nfl_status.CUT

    case player_nfl_status.PRACTICE_SQUAD:
    case 'PRA': // Sportradar
    case 'DEV': // NFL
    case 'PRACTICE SQUAD':
      return player_nfl_status.PRACTICE_SQUAD

    case player_nfl_status.PRACTICE_SQUAD_INJURED_RESERVE:
    case 'PRA_IR': // Sportradar
      return player_nfl_status.PRACTICE_SQUAD_INJURED_RESERVE

    case player_nfl_status.NOT_WITH_TEAM:
    case 'NWT': // NFL & Sportradar
      return player_nfl_status.NOT_WITH_TEAM

    case player_nfl_status.PHYSICALLY_UNABLE_TO_PERFORM:
    case 'PUP': // NFL
    case 'IR-PUP':
    case 'PUP-R':
    case 'PHYSICALLY UNABLE TO PERFORM':
      return player_nfl_status.PHYSICALLY_UNABLE_TO_PERFORM

    case player_nfl_status.INJURED_RESERVE:
    case 'INJURED RESERVE':
    case 'IR': // Sportradar
    case 'RES': // NFL
      return player_nfl_status.INJURED_RESERVE

    case player_nfl_status.INJURED_RESERVE_DESIGNATED_TO_RETURN:
    case 'IRD': // Sportradar
    case 'IR-R':
      return player_nfl_status.INJURED_RESERVE_DESIGNATED_TO_RETURN

    case player_nfl_status.NON_FOOTBALL_RELATED_INJURED_RESERVE:
    case 'NON': // NFL & Sportradar
    case 'IR-NFI':
    case 'NFI':
    case 'NFI-R':
    case 'NON FOOTBALL INJURY':
    case 'NON-FOOTBALL INJURY':
    case 'NON FOOTBALL ILLNESS':
    case 'NON-FOOTBALL ILLNESS':
      return player_nfl_status.NON_FOOTBALL_RELATED_INJURED_RESERVE

    case player_nfl_status.RETIRED:
    case 'RET': // NFL & Sportradar
      return player_nfl_status.RETIRED

    case player_nfl_status.RESTRICTED_FREE_AGENT:
    case 'RFA': // NFL
      return player_nfl_status.RESTRICTED_FREE_AGENT

    case player_nfl_status.SUSPENDED:
    case 'SUS': // NFL & Sportradar
    case 'SUSP':
    case 'RESERVE-SUS':
    case 'RESERVE-SUSP':
      return player_nfl_status.SUSPENDED

    case player_nfl_status.UNDRAFTED_FREE_AGENT:
    case 'UDF': // NFL & Sportradar
      return player_nfl_status.UNDRAFTED_FREE_AGENT

    case player_nfl_status.UNSIGNED_FREE_AGENT:
    case 'UFA': // NFL & Sportradar
      return player_nfl_status.UNSIGNED_FREE_AGENT

    case player_nfl_status.DID_NOT_REPORT:
    case 'DNR': // NFL
    case 'DID NOT REPORT':
      return player_nfl_status.DID_NOT_REPORT

    case player_nfl_status.INJURED_RESERVE_COVID:
    case 'COV':
    case 'COVID-IR':
    case 'IR-COVID':
    case 'RESERVE/COVID-19':
    case 'RESERVE-COVID-19':
    case 'COVID-19':
    case 'IRC': // NFL
      return player_nfl_status.INJURED_RESERVE_COVID

    case player_nfl_status.COMMISSIONER_EXEMPT_LIST:
    case 'COMMISSIONER EXEMPT LIST':
    case 'CEL':
    case 'RESERVE-CEL':
    case 'COM': // NFL
      return player_nfl_status.COMMISSIONER_EXEMPT_LIST

    case player_nfl_status.WAIVED:
    case 'WAV': // NFL
      return player_nfl_status.WAIVED

    case player_nfl_status.EXCLUSIVE_RIGHTS_FREE_AGENT:
    case 'ERF': // NFL
      return player_nfl_status.EXCLUSIVE_RIGHTS_FREE_AGENT

    // missing status codes
    case 'RSN': // NFL
    case 'TRL': // NFL
    case 'TRC': // NFL
    case 'TRD': // NFL
    case 'TRT': // NFL
    case 'RSR': // NFL
    case 'ANI': // NFL
    case 'ANJ': // NFL
    case 'DTR': // NFL
    case 'DOL': // NFL
    case 'DUS': // NFL
    case 'EXR': // NFL
    case 'FRR': // NFL
    case 'FPL': // NFL
    case 'FUT': // NFL
    case 'IDR': // NFL
    case 'MIL': // NFL
    case 'NOS': // NFL
    case 'RNI': // NFL
    case 'TRN': // NFL
    case 'VFA': // NFL
    case 'DIN': // NFL
      throw new Error(`status not implemented: ${status_string}`)

    default:
      throw new Error(`status not implemented: ${status_string}`)
  }
}
