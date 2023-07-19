// GSIS StatID Documentation: http://www.nflgsis.com/gsis/Documentation/Partners/StatIDs.html

export default function getPlayFromPlayStats(play) {
  const playRow = {}
  for (const playStat of play.playStats) {
    switch (playStat.statId) {
      // Punt Blocked (Offense)
      case 2:
        // playRow.punt_blocked = 1
        // playRow.punt_attempt = 1
        // playRow.kick_distance = playStat.yards
        break

      // 1st Down Rushing
      case 3:
        playRow.fd = 1
        break

      // 1st Down Passing
      case 4:
        playRow.fd = 1
        break

      // 1st Down Penalty
      case 5:
        playRow.fd = 1
        break

      // 3rd Down Attempt Converted
      case 6:
        break

      // 3rd Down Attempt Failed
      case 7:
        break

      // 4th Down Attempt Converted
      case 8:
        break

      // 4th Down Attempt Failed
      case 9:
        break

      // Rushing Yards
      case 10:
        playRow.bc_gsis = playStat.gsisId
        playRow.rush_yds = playStat.yards
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        break

      // Rushing Yards, TD
      case 11:
        playRow.fd = 1
        playRow.td = 1
        playRow.bc_gsis = playStat.gsisId
        playRow.rush_yds = playStat.yards
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        playRow.td_tm = playStat.teamAbbr
        break

      // Lateral Rushing Yards
      case 12:
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        break

      // Lateral Rushing Yards, TD
      case 13:
        playRow.fd = 1
        playRow.td = 1
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        playRow.td_tm = playStat.teamAbbr
        break

      // Pass Incomplete
      case 14:
        playRow.comp = 0
        playRow.psr_gsis = playStat.gsisId
        break

      // Passing Yards
      case 15:
        playRow.comp = 1
        playRow.psr_gsis = playStat.gsisId
        playRow.pass_yds = playStat.yards
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        break

      // Passing Yards, TD
      case 16:
        playRow.comp = 1
        playRow.fd = 1
        playRow.psr_gsis = playStat.gsisId
        playRow.pass_yds = playStat.yards
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        break

      // Interception (by Passer)
      case 19:
        playRow.int = 1
        playRow.psr_gsis = playStat.gsisId
        break

      // Sack Yards (Offense)
      case 20:
        playRow.sk = 1
        playRow.psr_gsis = playStat.gsisId
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        break

      // Pass Reception Yards
      case 21:
        playRow.comp = 1
        playRow.trg_gsis = playStat.gsisId
        playRow.recv_yds = playStat.yards
        break

      // Pass Reception Yards, TD
      case 22:
        playRow.comp = 1
        playRow.td = 1
        playRow.fd = 1
        playRow.trg_gsis = playStat.gsisId
        playRow.recv_yds = playStat.yards
        playRow.td_tm = playStat.teamAbbr
        break

      // Lateral Pass Reception Yards
      case 23:
        playRow.comp = 1
        break

      // Lateral Pass Reception Yards, TD
      case 24:
        playRow.comp = 1
        playRow.td = 1
        playRow.fd = 1
        playRow.td_tm = playStat.teamAbbr
        break

      // Interception Yards
      case 25:
        playRow.intp_gsis = playStat.gsisId
        playRow.ret_tm = playStat.teamAbbr
        playRow.ret_yds = playStat.yards
        break

      // Interception Yards, TD
      case 26:
        playRow.td = 1
        playRow.ret_td = 1
        playRow.td_tm = playStat.teamAbbr
        playRow.intp_gsis = playStat.gsisId
        playRow.ret_tm = playStat.teamAbbr
        playRow.ret_yds = playStat.yards
        break

      // Lateral Interception Yards
      case 27:
        playRow.ret_tm = playStat.teamAbbr
        playRow.ret_yds = playStat.yards
        break

      // Lateral Interception Yards, TD
      case 28:
        playRow.td = 1
        playRow.ret_td = 1
        playRow.td_tm = playStat.teamAbbr
        playRow.ret_tm = playStat.teamAbbr
        playRow.ret_yds = playStat.yards
        break

      // Punting Yards
      case 29:
        break

      // Punt Inside 20
      case 30:
        break

      // Punt Into End Zone
      case 31:
        break

      // Punt With Touchback
      case 32:
        break

      // Punt Return Yards
      case 33:
        break

      // Punt Return Yards, TD
      case 34:
        break

      // Lateral Punt Return Yards
      case 35:
        break

      // Lateral Punt Return Yards, TD
      case 36:
        break

      // Punt Out Of Bounds
      case 37:
        break

      // Punt Downed (No Return)
      case 38:
        break

      // Punt - Fair Catch
      case 39:
        break

      // Punt - Touchback (No Return)
      case 40:
        break

      // Kickoff Yards
      case 41:
        break

      // Kickoff Inside 20
      case 42:
        break

      // Kickoff Into End Zone
      case 43:
        break

      // Kickoff With Touchback
      case 44:
        break

      // Kickoff Return Yards
      case 45:
        break

      // Kickoff Return Yards, TD
      case 46:
        break

      // Lateral Kickoff Return Yards
      case 47:
        break

      // Kickoff Return Yards, TD
      case 48:
        break

      // Kickoff Out Of Bounds
      case 49:
        break

      // Kickoff - Fair Catch
      case 50:
        break

      // Kickoff - Touchback
      case 51:
        break

      // Fumble - Forced
      case 52:
        break

      // Fumble - Not Forced
      case 53:
        break

      // Fumble - Out Of Bounds
      case 54:
        break

      // Own Recovery Yards
      case 55:
        break

      // Own Recovery Yards, TD
      case 56:
        break

      // Lateral Own Recovery Yards
      case 57:
        break

      // Lateral Own Recovery Yards, TD
      case 58:
        break

      // Opponent Recovery Yards
      case 59:
        break

      // Opponent Recovery Yards, TD
      case 60:
        break

      // Lateral Opponent Recovery Yards
      case 61:
        break

      // Lateral Opponent Recovery Yards, TD
      case 62:
        break

      // Miscellaneous Yards
      case 63:
        break

      // Miscellaneous Yards, TD
      case 64:
        break

      // Timeout
      case 68:
        break

      // Field Goal Missed Yards
      case 69:
        break

      // Field Goal Yards
      case 70:
        break

      // Field Goal Blocked (Offense)
      case 71:
        break

      // Extra Point - Good
      case 72:
        break

      // Extra Point - Failed
      case 73:
        break

      // Extra Point - Blocked
      case 74:
        break

      // 2 Point Rush - Good
      case 75:
        break

      // 2 Point Rush - Failed
      case 76:
        break

      // 2 Point Pass - Good
      case 77:
        break

      // 2 Point Pass - Failed
      case 78:
        break

      // Solo Tackle
      case 79:
        break

      // Assisted Tackle
      case 80:
        break

      // 1/2 Tackle
      case 81:
        break

      // Tackle Assist
      case 82:
        break

      // Sack Yards (Defense) - unassisted sack
      case 83:
        break

      // 1/2 Sack Yards (Defense)
      case 84:
        break

      // Pass Defensed
      case 85:
        break

      // Punt Blocked (Defense)
      case 86:
        break

      // Extra Point Blocked (Defense)
      case 87:
        break

      // Field Goal Blocked (Defense)
      case 88:
        break

      // Safety (Defense)
      case 89:
        break

      // Forced Fumble (Defense)
      case 91:
        break

      // Penalty
      case 93:
        break

      // Tackled for a Loss
      case 95:
        break

      // Extra Point - Safety
      case 96:
        break

      // 2 Point Rush - Safety
      case 99:
        break

      // 2 Point Pass - Safety
      case 100:
        break

      // Kickoff - Kick Downed
      case 102:
        break

      // Sack Yards (Offense), No Sack
      case 103:
        break

      // 2 Point Pass Reception - Good
      case 104:
        break

      // 2 Point Pass Reception - Failed
      case 105:
        break

      // Fumble - Lost
      case 106:
        playRow.fuml = 1
        playRow.player_fuml_gsis = playStat.gsisId
        break

      // Own Kickoff Recovery
      case 107:
        break

      // Own Kickoff Recovery, TD
      case 108:
        break

      // Quarterback Hit
      case 110:
        break

      // Pass Length, Completion
      case 111:
        playRow.comp = 1
        playRow.psr_gsis = playStat.gsisId
        playRow.dot = playStat.yards
        break

      // Pass Length, No Completion
      case 112:
        playRow.psr_gsis = playStat.gsisId
        playRow.dot = playStat.yards
        break

      // Yardage Gained After the Catch
      case 113:
        playRow.comp = 1
        playRow.trg_gsis = playStat.gsisId
        playRow.yac = playStat.yards
        break

      // Pass Target
      case 115:
        playRow.trg_gsis = playStat.gsisId
        break

      // Tackle for a Loss
      case 120:
        break

      // Extra Point - Aborted
      case 301:
        break

      // Defensive Two Point Attempts
      case 403:
        break

      // Defensive Two Point Conversions
      case 404:
        break

      // Defensive Extra Point Attempts
      case 405:
        break

      // Defensive Extra Point Conversions
      case 406:
        break

      // Kickoff Length
      case 410:
        break

      // 2 Point Return - Good
      case 420:
        break
    }
  }

  return playRow
}
