/**
 * GSIS StatID Documentation:
 * - Official: http://www.nflgsis.com/gsis/Documentation/Partners/StatIDs.html
 * - Reference: https://www.nflfastr.com/reference/stat_ids.html
 * - Local: docs/nfl-gsis-stat-ids.md
 *
 * IMPORTANT: Some stat IDs are team-level stats without player associations:
 * - Stat ID 3 (1st Down Rushing) - Team-level, use play.first_down + rushing stats for player attribution
 * - Stat ID 4 (1st Down Passing) - Team-level, use play.first_down + receiving stats for player attribution
 */

export default function getPlayFromPlayStats(play) {
  const playRow = {
    tacklers_solo: [],
    tacklers_with_assisters: [],
    tackle_assisters: []
  }

  for (const playStat of play.playStats) {
    switch (playStat.statId) {
      // Punt Blocked (Offense) - punt was blocked
      case 2:
        // playRow.punt_blocked = true
        // playRow.punt_attempt = true
        // playRow.kick_distance = playStat.yards
        break

      // 1st Down Rushing (TEAM STAT - no player association)
      // First down or TD occurred due to a rush. Player attribution tracked via
      // play-level first_down flag on rushing stats (10, 11) instead.
      case 3:
        playRow.first_down = true
        break

      // 1st Down Passing (TEAM STAT - no player association)
      // First down or TD occurred due to a pass. Player attribution tracked via
      // play-level first_down flag on receiving stats (21, 22) instead.
      case 4:
        playRow.first_down = true
        break

      // 1st Down Penalty - first down or TD occurred due to a penalty
      case 5:
        playRow.first_down = true
        break

      // 3rd Down Attempt Converted - 3rd down play resulted in first down or TD
      case 6:
        break

      // 3rd Down Attempt Failed - 3rd down play did NOT result in first down
      case 7:
        break

      // 4th Down Attempt Converted - 4th down play resulted in first down or TD
      case 8:
        break

      // 4th Down Attempt Failed - 4th down play did NOT result in first down
      case 9:
        break

      // Rushing Yards - rushing yards with credit for rushing attempt
      case 10:
        playRow.bc_gsis = playStat.gsisId
        playRow.rush_yds = playStat.yards
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        break

      // Rushing Touchdown - rushing TD with yards and attempt credit
      case 11:
        playRow.first_down = true
        playRow.td = true
        playRow.rush_td = true
        playRow.bc_gsis = playStat.gsisId
        playRow.rush_yds = playStat.yards
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        playRow.td_tm = playStat.teamAbbr
        break

      // Lateral Rushing - yards after lateral (no attempt credit)
      case 12:
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        break

      // Lateral Rushing Touchdown - rushing TD after lateral (no attempt credit)
      case 13:
        playRow.first_down = true
        playRow.td = true
        playRow.rush_td = true
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        playRow.td_tm = playStat.teamAbbr
        break

      // Passing Incomplete - incomplete pass attempt
      case 14:
        playRow.comp = false
        playRow.psr_gsis = playStat.gsisId
        break

      // Passing Yards - completed pass with yards
      case 15:
        playRow.comp = true
        playRow.psr_gsis = playStat.gsisId
        playRow.pass_yds = playStat.yards
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        break

      // Passing Touchdown - passing TD with yards
      case 16:
        playRow.comp = true
        playRow.first_down = true
        playRow.td = true
        playRow.pass_td = true
        playRow.psr_gsis = playStat.gsisId
        playRow.pass_yds = playStat.yards
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        break

      // Interception - pass intercepted
      case 19:
        playRow.int = true
        playRow.psr_gsis = playStat.gsisId
        break

      // Sack Yards (Team) - team sack yardage lost
      case 20:
        playRow.sk = true
        playRow.psr_gsis = playStat.gsisId
        playRow.yds_gained = playStat.yards + (playRow.yds_gained || 0)
        break

      // Receiving Yards - reception with yards
      case 21:
        playRow.comp = true
        playRow.trg_gsis = playStat.gsisId
        playRow.recv_yds = playStat.yards
        break

      // Receiving Touchdown - receiving TD with yards
      case 22:
        playRow.comp = true
        playRow.first_down = true
        playRow.td = true
        playRow.pass_td = true
        playRow.trg_gsis = playStat.gsisId
        playRow.recv_yds = playStat.yards
        playRow.td_tm = playStat.teamAbbr
        break

      // Lateral Receiving - yards after lateral (no reception credit)
      case 23:
        playRow.comp = true
        break

      // Lateral Receiving Touchdown - receiving TD after lateral (no reception credit)
      case 24:
        playRow.comp = true
        playRow.first_down = true
        playRow.td = true
        playRow.pass_td = true
        playRow.td_tm = playStat.teamAbbr
        break

      // Interception Return - interception return with yards
      case 25:
        playRow.intp_gsis = playStat.gsisId
        playRow.ret_tm = playStat.teamAbbr
        playRow.ret_yds = playStat.yards
        break

      // Interception Return Touchdown - interception returned for TD
      case 26:
        playRow.td = true
        playRow.ret_td = true
        playRow.td_tm = playStat.teamAbbr
        playRow.intp_gsis = playStat.gsisId
        playRow.ret_tm = playStat.teamAbbr
        playRow.ret_yds = playStat.yards
        break

      // Lateral Interception Return - INT return yards after lateral
      case 27:
        playRow.ret_tm = playStat.teamAbbr
        playRow.ret_yds = playStat.yards
        break

      // Lateral Interception Return Touchdown - INT return TD after lateral
      case 28:
        playRow.td = true
        playRow.ret_td = true
        playRow.td_tm = playStat.teamAbbr
        playRow.ret_tm = playStat.teamAbbr
        playRow.ret_yds = playStat.yards
        break

      // Punt Yards - punt with yards
      case 29:
        break

      // Punt Inside 20 - punt downed inside opponent's 20
      case 30:
        break

      // Punt Into Endzone - punt into endzone (touchback)
      case 31:
        break

      // Punt (No Return) - punt with no return
      case 32:
        break

      // Punt Return Yards - punt return with yards
      case 33:
        break

      // Punt Return Touchdown - punt returned for TD
      case 34:
        playRow.td = true
        break

      // Lateral Punt Return - punt return yards after lateral
      case 35:
        break

      // Lateral Punt Return Touchdown - punt return TD after lateral
      case 36:
        playRow.td = true
        break

      // Punt Out of Bounds - punt went out of bounds
      case 37:
        break

      // Punt Downed - punt downed by coverage
      case 38:
        break

      // Punt Fair Catch - punt fair caught
      case 39:
        break

      // Punt (Attempt) - punt attempt
      case 40:
        break

      // Kickoff Yards - kickoff with yards
      case 41:
        break

      // Kickoff Inside 20 - kickoff resulted in possession inside 20
      case 42:
        break

      // Kickoff Into Endzone - kickoff into endzone
      case 43:
        break

      // Kickoff (No Yards) - kickoff attempt with no return
      case 44:
        break

      // Kickoff Return Yards - kickoff return with yards
      case 45:
        break

      // Kickoff Return Touchdown - kickoff returned for TD
      case 46:
        playRow.td = true
        playRow.ret_td = true
        break

      // Lateral Kickoff Return - kickoff return yards after lateral
      case 47:
        break

      // Lateral Kickoff Return Touchdown - kickoff return TD after lateral
      case 48:
        playRow.td = true
        playRow.ret_td = true
        break

      // Kickoff Out of Bounds - kickoff went out of bounds
      case 49:
        break

      // Kickoff Fair Catch - kickoff fair caught
      case 50:
        break

      // Kickoff (Attempt) - kickoff attempt
      case 51:
        break

      // Forced Fumble - fumble forced by defender
      case 52:
        playRow.player_fuml_gsis = playStat.gsisId
        break

      // Fumble Not Forced - fumble not forced
      case 53:
        playRow.player_fuml_gsis = playStat.gsisId
        break

      // Fumble Out of Bounds - fumble went out of bounds
      case 54:
        playRow.player_fuml_gsis = playStat.gsisId
        break

      // Fumble Recovery (Own) - own fumble recovered with return yards
      case 55:
        break

      // Fumble Recovery Touchdown (Own) - own fumble recovered for TD
      case 56:
        playRow.td = true
        break

      // Lateral Fumble Recovery (Own) - own fumble recovery yards after lateral
      case 57:
        break

      // Lateral Fumble Recovery TD (Own) - own fumble recovery TD after lateral
      case 58:
        playRow.td = true
        break

      // Fumble Recovery (Opponent) - opponent fumble recovered with return yards
      case 59:
        break

      // Fumble Recovery Touchdown (Opponent) - opponent fumble recovered for TD
      case 60:
        playRow.td = true
        break

      // Lateral Fumble Recovery (Opponent) - opponent fumble recovery yards after lateral
      case 61:
        break

      // Lateral Fumble Recovery TD (Opponent) - opponent fumble recovery TD after lateral
      case 62:
        playRow.td = true
        break

      // Misc Stat - miscellaneous statistic
      case 63:
        break

      // Touchdown (Team) - team touchdown
      case 64:
        playRow.td = true
        break

      // Timeout - timeout called
      case 68:
        break

      // Field Goal Missed - missed field goal attempt
      case 69:
        break

      // Field Goal Made - made field goal with distance
      case 70:
        break

      // Field Goal Blocked - field goal blocked
      case 71:
        break

      // Extra Point Made - made extra point
      case 72:
        break

      // Extra Point Missed - missed extra point
      case 73:
        break

      // Extra Point Blocked - extra point blocked
      case 74:
        break

      // Two Point Rush Good - two point conversion rushing successful
      case 75:
        break

      // Two Point Rush Failed - two point conversion rushing failed
      case 76:
        break

      // Two Point Pass Good - two point conversion passing successful
      case 77:
        break

      // Two Point Pass Failed - two point conversion passing failed
      case 78:
        break

      // Solo Tackle - unassisted tackle
      case 79:
        playRow.tacklers_solo.push(playStat.gsisId)
        break

      // Assisted Tackle - tackle with assist
      // You made the tackle and got assisted by one or more team mates (h/t seb)
      case 80:
        playRow.tacklers_with_assisters.push(playStat.gsisId)
        break

      // 1/2 Tackle - half tackle credit
      case 81:
        break

      // Tackle Assist - assist on a tackle
      // Your team mate made the tackle and you were among the players who assisted (h/t seb)
      case 82:
        playRow.tackle_assisters.push(playStat.gsisId)
        break

      // Sack (Player) - individual player sack
      case 83:
        break

      // Sack Assist - assisted sack
      case 84:
        break

      // Pass Defended - pass deflected/defended
      case 85:
        break

      // Punt Blocked (Player) - player who blocked punt
      case 86:
        break

      // Extra Point Blocked (Player) - player who blocked extra point
      case 87:
        break

      // Blocked Field Goal (Player) - player who blocked field goal
      case 88:
        break

      // Safety - safety scored
      case 89:
        break

      // Forced Fumble (Player) - player who forced fumble
      case 91:
        break

      // Penalty (Player) - penalty with yards
      case 93:
        break

      // Tackle for Loss - tackle resulting in loss of yards
      case 95:
        break

      // Extra Point Safety - safety on extra point attempt
      case 96:
        break

      // Two Point Rush Safety - safety on two point rush attempt
      case 99:
        break

      // Two Point Pass Safety - safety on two point pass attempt
      case 100:
        break

      // Kickoff Downed - kickoff downed
      case 102:
        break

      // Lateral Sack - sack with lateral
      case 103:
        break

      // Two Point Reception Good - two point conversion reception successful
      case 104:
        break

      // Two Point Reception Failed - two point conversion reception failed
      case 105:
        break

      // Fumble Lost - fumble lost to opponent
      case 106:
        playRow.fuml = true
        playRow.player_fuml_gsis = playStat.gsisId
        break

      // Own Kickoff Recovery - own kickoff recovered
      case 107:
        break

      // Own Kickoff Recovery Touchdown - own kickoff recovered for TD
      case 108:
        playRow.td = true
        break

      // QB Hit - quarterback hit
      case 110:
        break

      // Air Yards Complete - completed pass air yards (depth of target)
      case 111:
        playRow.comp = true
        playRow.psr_gsis = playStat.gsisId
        playRow.dot = playStat.yards
        break

      // Air Yards Incomplete - incomplete pass air yards (depth of target)
      case 112:
        playRow.psr_gsis = playStat.gsisId
        playRow.dot = playStat.yards
        break

      // Yards After Catch - yards gained after the catch
      case 113:
        playRow.comp = true
        playRow.trg_gsis = playStat.gsisId
        playRow.yards_after_catch = playStat.yards
        break

      // Target - pass target (intended receiver)
      case 115:
        playRow.trg_gsis = playStat.gsisId
        break

      // Tackle for Loss (Player) - player who made tackle for loss
      case 120:
        break

      // Extra Point Aborted - extra point attempt aborted
      case 301:
        break

      // Defensive Two Point Attempt - defensive two point conversion attempt
      case 403:
        break

      // Defensive Two Point Conversion - defensive two point conversion successful
      case 404:
        break

      // Defensive Extra Point Attempt - defensive extra point attempt
      case 405:
        break

      // Defensive Extra Point Conversion - defensive extra point successful
      case 406:
        break

      // Kickoff (Player) - kickoff attempt (player credit)
      case 410:
        break

      // Two Point Return - defensive two point return
      case 420:
        break
    }
  }

  return playRow
}
