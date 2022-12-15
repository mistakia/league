// GSIS StatID Documentation: http://www.nflgsis.com/gsis/Documentation/Partners/StatIDs.html

export default function getPlayFromPlayStats({ esbid, playId, ...play }) {
  const play_row = { esbid, playId }
  const laterals = []

  for (const playStat of play.playStats) {
    switch (playStat.statId) {
      // Punt Blocked (Offense)
      case 2:
        // play_row.punt_blocked = 1
        // play_row.punt_attempt = 1
        // play_row.kick_distance = playStat.yards
        break

      // 1st Down Rushing
      case 3:
        play_row.fd = 1
        break

      // 1st Down Passing
      case 4:
        play_row.fd = 1
        break

      // 1st Down Penalty
      case 5:
        play_row.fd = 1
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
        play_row.bc_gsis = playStat.gsisId
        play_row.yds = playStat.yards
        break

      // Rushing Yards, TD
      case 11:
        play_row.fd = 1
        play_row.td = 1
        play_row.bc_gsis = playStat.gsisId
        play_row.yds = playStat.yards
        play_row.td_tm = playStat.clubCode
        play_row.td_gsis = playStat.gsisId
        break

      // Lateral Rushing Yards
      case 12:
        play_row.lateral = 1
        laterals.push({
          esbid,
          playId,
          gsis: playStat.gsisId,
          yds: playStat.yards,
          tm: playStat.clubCode
        })
        break

      // Lateral Rushing Yards, TD
      case 13:
        play_row.fd = 1
        play_row.td = 1
        play_row.lateral = 1
        laterals.push({
          esbid,
          playId,
          gsis: playStat.gsisId,
          yds: playStat.yards,
          tm: playStat.clubCode
        })
        play_row.td_tm = playStat.clubCode
        play_row.td_gsis = playStat.gsisId
        break

      // Pass Incomplete
      case 14:
        play_row.comp = 0
        play_row.psr_gsis = playStat.gsisId
        break

      // Passing Yards
      case 15:
        play_row.comp = 1
        play_row.psr_gsis = playStat.gsisId
        break

      // Passing Yards, TD
      case 16:
        play_row.comp = 1
        play_row.fd = 1
        play_row.psr_gsis = playStat.gsisId
        play_row.yds = playStat.yards
        break

      // Interception (by Passer)
      case 19:
        play_row.int = 1
        play_row.psr_gsis = playStat.gsisId
        break

      // Sack Yards (Offense)
      case 20:
        play_row.sk = 1
        play_row.psr_gsis = playStat.gsisId
        break

      // Pass Reception Yards
      case 21:
        play_row.comp = 1
        play_row.trg_gsis = playStat.gsisId
        play_row.yds = playStat.yards
        break

      // Pass Reception Yards, TD
      case 22:
        play_row.comp = 1
        play_row.td = 1
        play_row.fd = 1
        play_row.trg_gsis = playStat.gsisId
        play_row.yds = playStat.yards
        play_row.td_tm = playStat.clubCode
        play_row.td_gsis = playStat.gsisId
        break

      // Lateral Pass Reception Yards
      case 23:
        play_row.comp = 1
        play_row.lateral = 1
        laterals.push({
          esbid,
          playId,
          gsis: playStat.gsisId,
          yds: playStat.yards,
          tm: playStat.clubCode
        })
        break

      // Lateral Pass Reception Yards, TD
      case 24:
        play_row.comp = 1
        play_row.td = 1
        play_row.fd = 1
        play_row.lateral = 1
        laterals.push({
          esbid,
          playId,
          gsis: playStat.gsisId,
          yds: playStat.yards,
          tm: playStat.clubCode
        })
        play_row.td_tm = playStat.clubCode
        play_row.td_gsis = playStat.gsisId
        break

      // Interception Yards
      case 25:
        play_row.intp_gsis = playStat.gsisId
        play_row.ret_tm = playStat.clubCode
        play_row.ret_yds = playStat.yards
        break

      // Interception Yards, TD
      case 26:
        play_row.td = 1
        play_row.ret_td = 1
        play_row.td_tm = playStat.clubCode
        play_row.intp_gsis = playStat.gsisId
        play_row.ret_tm = playStat.clubCode
        play_row.ret_yds = playStat.yards
        play_row.td_gsis = playStat.gsisId
        break

      // Lateral Interception Yards
      case 27:
        play_row.ret_tm = playStat.clubCode
        play_row.ret_yds = playStat.yards // TODO
        break

      // Lateral Interception Yards, TD
      case 28:
        play_row.td = 1
        play_row.ret_td = 1
        play_row.td_tm = playStat.clubCode
        play_row.ret_tm = playStat.clubCode
        play_row.ret_yds = playStat.yards // TODO
        play_row.td_gsis = playStat.gsisId
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
        play_row.td_gsis = playStat.gsisId
        break

      // Lateral Punt Return Yards
      case 35:
        // TODO
        break

      // Lateral Punt Return Yards, TD
      case 36:
        play_row.td_gsis = playStat.gsisId
        // TODO
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
        // TODO
        break

      // Kickoff Return Yards, TD
      case 46:
        play_row.td_gsis = playStat.gsisId
        // TODO
        break

      // Lateral Kickoff Return Yards
      case 47:
        // TODO
        break

      // Kickoff Return Yards, TD
      case 48:
        play_row.td_gsis = playStat.gsisId
        // TODO
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
        play_row.td_gsis = playStat.gsisId
        break

      // Lateral Own Recovery Yards
      case 57:
        // TODO
        break

      // Lateral Own Recovery Yards, TD
      case 58:
        play_row.td_gsis = playStat.gsisId
        // TODO
        break

      // Opponent Recovery Yards
      case 59:
        break

      // Opponent Recovery Yards, TD
      case 60:
        play_row.td_gsis = playStat.gsisId
        break

      // Lateral Opponent Recovery Yards
      case 61:
        // TODO
        break

      // Lateral Opponent Recovery Yards, TD
      case 62:
        play_row.td_gsis = playStat.gsisId
        // TODO
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
        play_row.fuml = 1
        play_row.player_fuml_gsis = playStat.gsisId
        break

      // Own Kickoff Recovery
      case 107:
        break

      // Own Kickoff Recovery, TD
      case 108:
        play_row.td_gsis = playStat.gsisId
        break

      // Quarterback Hit
      case 110:
        break

      // Pass Length, Completion
      case 111:
        play_row.comp = 1
        play_row.psr_gsis = playStat.gsisId
        play_row.dot = playStat.yards
        break

      // Pass Length, No Completion
      case 112:
        play_row.psr_gsis = playStat.gsisId
        play_row.dot = playStat.yards
        break

      // Yardage Gained After the Catch
      case 113:
        play_row.comp = 1
        play_row.trg_gsis = playStat.gsisId
        play_row.yac = playStat.yards
        break

      // Pass Target
      case 115:
        play_row.trg_gsis = playStat.gsisId
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

  return { play_row, laterals }
}
