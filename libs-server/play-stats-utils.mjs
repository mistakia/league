import db from '#db'

export const get_play_stats = async ({ year, week, seas_type }) => {
  return db('nfl_play_stats')
    .select(
      'nfl_play_stats.*',
      'nfl_plays.drive_play_count',
      'nfl_plays.play_type_ngs',
      'nfl_plays.play_type_nfl',
      'nfl_plays.pos_team',
      'nfl_plays.ydl_100',
      'nfl_plays.dot',
      'nfl_plays.qb_kneel',
      'nfl_plays.first_down',
      'nfl_plays.play_type',
      'nfl_games.h',
      'nfl_games.v',
      'nfl_games.esbid',
      'nfl_games.year'
    )
    .join('nfl_games', 'nfl_play_stats.esbid', '=', 'nfl_games.esbid')
    .join('nfl_plays', function () {
      this.on('nfl_plays.esbid', '=', 'nfl_play_stats.esbid')
      this.andOn('nfl_plays.playId', '=', 'nfl_play_stats.playId')
    })
    .where('nfl_plays.year', year)
    .where('nfl_plays.week', week)
    .where('nfl_play_stats.valid', true)
    .where('nfl_plays.seas_type', seas_type)
}

export const is_successful_play = ({ yds_gained, yards_to_go, dwn }) => {
  if (!dwn || !yards_to_go || !yds_gained) return null

  if (dwn === 1) {
    return yds_gained >= 0.4 * yards_to_go
  } else if (dwn === 2) {
    return yds_gained >= 0.6 * yards_to_go
  } else if (dwn === 3 || dwn === 4) {
    return yds_gained >= yards_to_go
  }

  return null
}

export const get_play_type_ngs = (play_type_ngs) => {
  switch (play_type_ngs) {
    case 'play_type_field_goal':
    case 'play_type_xp':
      return 'FGXP'
    case 'play_type_kickoff':
      return 'KOFF'
    case 'play_type_pass':
    case 'play_type_sack':
      return 'PASS'
    case 'play_type_punt':
      return 'PUNT'
    case 'play_type_rush':
      return 'RUSH'
    case 'play_type_two_point_conversion':
      return 'CONV'
    case 'play_type_unknown':
      return 'NOPL'
    default:
      return null
  }
}

export const get_play_type_nfl = (play_type_nfl) => {
  switch (play_type_nfl) {
    case 'FIELD_GOAL':
    case 'XP_KICK':
      return 'FGXP'
    case 'KICK_OFF':
      return 'KOFF'
    case 'PASS':
    case 'SACK':
    case 'INTERCEPTION':
      return 'PASS'
    case 'PUNT':
      return 'PUNT'
    case 'RUSH':
      return 'RUSH'
    case 'PAT2':
      return 'CONV'
    case 'FREE_KICK':
      return 'FREE'
    case 'TIMEOUT':
    case 'UNSPECFIED':
    case 'PENALTY':
    case 'COMMENT':
    case 'GAME_START':
    case 'END_GAME':
    case 'END_QUARTER':
      return 'NOPL'
    default:
      return null
  }
}

export const get_completed_games = async ({ year, week, seas_type }) => {
  const completed_games = await db('nfl_games')
    .select('esbid')
    .where({ year, week, seas_type })
    .where(function () {
      // Method 1: Games with END_GAME play
      this.whereExists(function () {
        this.select('*')
          .from('nfl_plays')
          .whereRaw('nfl_plays.esbid = nfl_games.esbid')
          .where('play_type_nfl', 'END_GAME')
      })
        // Method 2: Games with final status
        .orWhere('status', 'like', 'FINAL%')
    })

  return completed_games.map((game) => game.esbid)
}
