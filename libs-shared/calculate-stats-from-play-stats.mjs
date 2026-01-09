import { create_empty_fantasy_stats } from '#constants'

/**
 * Calculate player statistics from NFL GSIS play-by-play stat records.
 *
 * NFL GSIS Stat ID Documentation:
 * - Official: http://www.nflgsis.com/gsis/Documentation/Partners/StatIDs.html
 * - Reference: https://www.nflfastr.com/reference/stat_ids.html
 * - Local: docs/nfl-gsis-stat-ids.md
 *
 * IMPORTANT: Some stat IDs are team-level stats without player associations:
 * - Stat ID 3 (1st Down Rushing) - Team-level, use play.first_down + rushing stats for player attribution
 * - Stat ID 4 (1st Down Passing) - Team-level, use play.first_down + receiving stats for player attribution
 */
const calculateStatsFromPlayStats = (playStats) => {
  const stats = create_empty_fantasy_stats()

  stats._fga = []
  stats._fgm = []
  stats.passing_air_yards = 0
  stats.targeted_air_yards = 0
  stats.longest_reception = 0
  stats.redzone_targets = 0
  stats.recv_yards_15_plus_count = 0
  stats.longest_rush = 0
  stats.rush_attempts_redzone = 0
  stats.rush_attempts_goaline = 0

  // New statistics for fantasy points support
  stats.rush_first_down = 0
  stats.rec_first_down = 0
  stats.ry_excluding_kneels = 0

  for (const playStat of playStats) {
    switch (playStat.statId) {
      case 2:
        // Punt Blocked (Offense) - punt was blocked
        break

      case 3:
        // 1st Down Rushing (TEAM STAT - no player association)
        // First down or TD occurred due to a rush. Player attribution tracked via
        // play-level first_down flag on rushing stats (10, 11) instead.
        break

      case 4:
        // 1st Down Passing (TEAM STAT - no player association)
        // First down or TD occurred due to a pass. Player attribution tracked via
        // play-level first_down flag on receiving stats (21, 22) instead.
        break

      case 5:
        // 1st Down Penalty - first down or TD occurred due to a penalty
        break

      case 6:
        // 3rd Down Attempt Converted - 3rd down play resulted in first down or TD
        break

      case 7:
        // 3rd Down Attempt Failed - 3rd down play did NOT result in first down
        break

      case 8:
        // 4th Down Attempt Converted - 4th down play resulted in first down or TD
        break

      case 9:
        // 4th Down Attempt Failed - 4th down play did NOT result in first down
        break

      case 10:
        // Rushing Yards - rushing yards with credit for rushing attempt
        stats.ra += 1
        stats.ry += playStat.yards

        // Track rushing yards excluding QB kneels
        if (!playStat.qb_kneel) {
          stats.ry_excluding_kneels += playStat.yards
        }

        // Track rushing first downs using play-level first_down flag
        if (playStat.first_down) {
          stats.rush_first_down += 1
        }

        stats.longest_rush = Math.max(stats.longest_rush, playStat.yards)
        if (playStat.ydl_100 <= 20) {
          stats.rush_attempts_redzone += 1
        }
        if (playStat.ydl_100 <= 5) {
          stats.rush_attempts_goaline += 1
        }
        break

      case 11:
        // Rushing Touchdown - rushing TD with yards and attempt credit
        stats.ra += 1
        stats.ry += playStat.yards

        // Track rushing yards excluding QB kneels
        if (!playStat.qb_kneel) {
          stats.ry_excluding_kneels += playStat.yards
        }

        // Track rushing first downs using play-level first_down flag
        if (playStat.first_down) {
          stats.rush_first_down += 1
        }

        stats.longest_rush = Math.max(stats.longest_rush, playStat.yards)
        if (playStat.ydl_100 <= 20) {
          stats.rush_attempts_redzone += 1
        }
        if (playStat.ydl_100 <= 5) {
          stats.rush_attempts_goaline += 1
        }
        stats.tdr += 1
        break

      case 12:
        // Lateral Rushing - yards after lateral (no attempt credit)
        stats.ry += playStat.yards

        // Track rushing yards excluding QB kneels
        if (!playStat.qb_kneel) {
          stats.ry_excluding_kneels += playStat.yards
        }

        stats.longest_rush = Math.max(stats.longest_rush, playStat.yards)
        break

      case 13:
        // Lateral Rushing Touchdown - rushing TD after lateral (no attempt credit)
        stats.ry += playStat.yards

        // Track rushing yards excluding QB kneels
        if (!playStat.qb_kneel) {
          stats.ry_excluding_kneels += playStat.yards
        }

        stats.longest_rush = Math.max(stats.longest_rush, playStat.yards)
        stats.tdr += 1
        break

      case 14:
        // Passing Incomplete - incomplete pass attempt
        stats.pa += 1
        break

      case 15:
        // Passing Yards - completed pass with yards
        stats.pa += 1
        stats.pc += 1
        stats.py += playStat.yards
        break

      case 16:
        // Passing Touchdown - passing TD with yards
        stats.pa += 1
        stats.pc += 1
        stats.py += playStat.yards
        stats.tdp += 1
        break

      case 19:
        // Interception - pass intercepted
        stats.ints += 1
        stats.pa += 1
        break

      case 20:
        // Sack Yards (Team) - team sack yardage lost
        break

      case 21:
        // Receiving Yards - reception with yards
        stats.rec += 1
        stats.recy += playStat.yards
        stats.longest_reception = Math.max(
          stats.longest_reception,
          playStat.yards
        )
        if (playStat.yards >= 15) {
          stats.recv_yards_15_plus_count += 1
        }
        // Track receiving first downs using play-level first_down flag
        if (playStat.first_down) {
          stats.rec_first_down += 1
        }
        break

      case 22:
        // Receiving Touchdown - receiving TD with yards
        stats.rec += 1
        stats.tdrec += 1
        stats.recy += playStat.yards
        stats.longest_reception = Math.max(
          stats.longest_reception,
          playStat.yards
        )
        if (playStat.yards >= 15) {
          stats.recv_yards_15_plus_count += 1
        }
        // Track receiving first downs using play-level first_down flag
        if (playStat.first_down) {
          stats.rec_first_down += 1
        }
        break

      case 23:
        // Lateral Receiving - yards after lateral (no reception credit)
        stats.recy += playStat.yards
        break

      case 24:
        // Lateral Receiving Touchdown - receiving TD after lateral (no reception credit)
        stats.recy += playStat.yards
        stats.tdrec += 1
        break

      case 25:
        // Interception Return - interception return with yards
        break

      case 26:
        // Interception Return Touchdown - interception returned for TD
        break

      case 27:
        // Lateral Interception Return - INT return yards after lateral
        break

      case 28:
        // Lateral Interception Return Touchdown - INT return TD after lateral
        break

      case 29:
        // Punt Yards - punt with yards
        break

      case 30:
        // Punt Inside 20 - punt downed inside opponent's 20
        break

      case 31:
        // Punt Into Endzone - punt into endzone (touchback)
        break

      case 32:
        // Punt (No Return) - punt with no return
        break

      case 33:
        // Punt Return Yards - punt return with yards
        break

      case 34:
        // Punt Return Touchdown - punt returned for TD
        stats.prtd += 1
        break

      case 35:
        // Lateral Punt Return - punt return yards after lateral
        break

      case 36:
        // Lateral Punt Return Touchdown - punt return TD after lateral
        stats.prtd += 1
        break

      case 37:
        // Punt Out of Bounds - punt went out of bounds
        break

      case 38:
        // Punt Downed - punt downed by coverage
        break

      case 39:
        // Punt Fair Catch - punt fair caught
        break

      case 40:
        // Punt (Attempt) - punt attempt
        break

      case 41:
        // Kickoff Yards - kickoff with yards
        break

      case 42:
        // Kickoff Inside 20 - kickoff resulted in possession inside 20
        break

      case 43:
        // Kickoff Into Endzone - kickoff into endzone
        break

      case 44:
        // Kickoff (No Yards) - kickoff attempt with no return
        break

      case 45:
        // Kickoff Return Yards - kickoff return with yards
        break

      case 46:
        // Kickoff Return Touchdown - kickoff returned for TD
        stats.krtd += 1
        break

      case 47:
        // Lateral Kickoff Return - kickoff return yards after lateral
        break

      case 48:
        // Lateral Kickoff Return Touchdown - kickoff return TD after lateral
        stats.krtd += 1
        break

      case 49:
        // Kickoff Out of Bounds - kickoff went out of bounds
        break

      case 50:
        // Kickoff Fair Catch - kickoff fair caught
        break

      case 51:
        // Kickoff (Attempt) - kickoff attempt
        break

      case 52:
        // Forced Fumble - fumble forced by defender
        break

      case 53:
        // Fumble Not Forced - fumble not forced
        break

      case 54:
        // Fumble Out of Bounds - fumble went out of bounds
        break

      case 55:
        // Fumble Recovery (Own) - own fumble recovered with return yards
        break

      case 56:
        // Fumble Recovery Touchdown (Own) - own fumble recovered for TD
        stats.fum_ret_td += 1
        break

      case 57:
        // Lateral Fumble Recovery (Own) - own fumble recovery yards after lateral
        break

      case 58:
        // Lateral Fumble Recovery TD (Own) - own fumble recovery TD after lateral
        stats.fum_ret_td += 1
        break

      case 59:
        // Fumble Recovery (Opponent) - opponent fumble recovered with return yards
        break

      case 60:
        // Fumble Recovery Touchdown (Opponent) - opponent fumble recovered for TD
        stats.fum_ret_td += 1
        break

      case 61:
        // Lateral Fumble Recovery (Opponent) - opponent fumble recovery yards after lateral
        break

      case 62:
        // Lateral Fumble Recovery TD (Opponent) - opponent fumble recovery TD after lateral
        stats.fum_ret_td += 1
        break

      case 63:
        // Misc Stat - miscellaneous statistic
        break

      case 64:
        // Touchdown (Team) - team touchdown
        break

      case 68:
        // Timeout - timeout called
        break

      case 69:
        // Field Goal Missed - missed field goal attempt
        stats.fga += 1
        stats._fga.push(playStat.yards)
        break

      case 70:
        // Field Goal Made - made field goal with distance
        stats.fgm += 1
        stats.fga += 1
        stats.fgy += Math.max(playStat.yards, 30)
        stats._fgm.push(playStat.yards)
        if (playStat.yards < 20) {
          stats.fg19 += 1
        } else if (playStat.yards < 30) {
          stats.fg29 += 1
        } else if (playStat.yards < 40) {
          stats.fg39 += 1
        } else if (playStat.yards < 50) {
          stats.fg49 += 1
        } else {
          stats.fg50 += 1
        }
        break

      case 71:
        // Field Goal Blocked - field goal blocked
        break

      case 72:
        // Extra Point Made - made extra point
        stats.xpa += 1
        stats.xpm += 1
        break

      case 73:
        // Extra Point Missed - missed extra point
        stats.xpa += 1
        break

      case 74:
        // Extra Point Blocked - extra point blocked
        break

      case 75:
        // Two Point Rush Good - two point conversion rushing successful
        stats.twoptc += 1
        break

      case 76:
        // Two Point Rush Failed - two point conversion rushing failed
        break

      case 77:
        // Two Point Pass Good - two point conversion passing successful
        stats.twoptc += 1
        break

      case 78:
        // Two Point Pass Failed - two point conversion passing failed
        break

      case 79:
        // Solo Tackle - unassisted tackle
        break

      case 80:
        // Assisted Tackle - tackle with assist
        break

      case 82:
        // Tackle Assist - assist on a tackle
        break

      case 83:
        // Sack (Player) - individual player sack
        break

      case 84:
        // Sack Assist - assisted sack
        break

      case 85:
        // Pass Defended - pass deflected/defended
        break

      case 86:
        // Punt Blocked (Player) - player who blocked punt
        break

      case 87:
        // Extra Point Blocked (Player) - player who blocked extra point
        break

      case 88:
        // Blocked Field Goal (Player) - player who blocked field goal
        break

      case 89:
        // Safety - safety scored
        break

      case 91:
        // Forced Fumble (Player) - player who forced fumble
        break

      case 93:
        // Penalty (Player) - penalty with yards
        break

      case 95:
        // Tackle for Loss - tackle resulting in loss of yards
        break

      case 96:
        // Extra Point Safety - safety on extra point attempt
        break

      case 99:
        // Two Point Rush Safety - safety on two point rush attempt
        break

      case 100:
        // Two Point Pass Safety - safety on two point pass attempt
        break

      case 102:
        // Kickoff Downed - kickoff downed
        break

      case 103:
        // Lateral Sack - sack with lateral
        break

      case 104:
        // Two Point Reception Good - two point conversion reception successful
        stats.twoptc += 1
        break

      case 105:
        // Two Point Reception Failed - two point conversion reception failed
        break

      case 106:
        // Fumble Lost - fumble lost to opponent
        stats.fuml += 1
        break

      case 107:
        // Own Kickoff Recovery - own kickoff recovered
        break

      case 108:
        // Own Kickoff Recovery Touchdown - own kickoff recovered for TD
        break

      case 110:
        // QB Hit - quarterback hit
        break

      case 111:
        // Air Yards Complete - completed pass air yards (depth of target)
        stats.passing_air_yards += playStat.yards
        break

      case 112:
        // Air Yards Incomplete - incomplete pass air yards (depth of target)
        stats.passing_air_yards += playStat.yards
        break

      case 113:
        // Yards After Catch - yards gained after the catch
        break

      case 115:
        // Target - pass target (intended receiver)
        stats.trg += 1
        stats.targeted_air_yards += playStat.dot
        if (playStat.ydl_100 <= 20) {
          stats.redzone_targets += 1
        }
        break

      case 120:
        // Tackle for Loss (Player) - player who made tackle for loss
        break

      case 301:
        // Extra Point Aborted - extra point attempt aborted
        break

      case 402:
        // Unknown - unknown statistic type
        break

      case 403:
        // Defensive Two Point Attempt - defensive two point conversion attempt
        break

      case 404:
        // Defensive Two Point Conversion - defensive two point conversion successful
        break

      case 405:
        // Defensive Extra Point Attempt - defensive extra point attempt
        break

      case 406:
        // Defensive Extra Point Conversion - defensive extra point successful
        break

      case 410:
        // Kickoff (Player) - kickoff attempt (player credit)
        break

      case 420:
        // Two Point Return - defensive two point return
        break

      default:
        break
    }
  }

  return stats
}

export default calculateStatsFromPlayStats
