/**
 * Statistics mapping functions for converting Sportradar play statistics
 * to nfl_plays table fields
 */

import {
  transform_to_enum_value,
  map_play_direction
} from './sportradar-transforms.mjs'

/**
 * Map passing statistics to play fields
 */
export const map_passing_stats = async ({
  pass_stats,
  resolve_player,
  pos_team
}) => {
  const mapped = {}

  if (!pass_stats) return mapped

  // Passer player IDs
  if (pass_stats.player) {
    const passer = await resolve_player({
      sportradar_player_id: pass_stats.player.id,
      player_name: pass_stats.player.name,
      player_team_alias: pass_stats.team?.alias
    })
    if (passer) {
      mapped.psr_pid = passer.pid
      mapped.psr_gsis = passer.gsisid
    }
  }

  // Pass metrics
  mapped.pass_yds = pass_stats.yards || null
  mapped.comp = pass_stats.complete === 1
  mapped.incomp = pass_stats.complete === 0
  mapped.pass_td = pass_stats.touchdown === 1
  mapped.int = pass_stats.interception === 1
  mapped.sk = pass_stats.sack === 1

  // Sack yards (already negative from API)
  if (pass_stats.sack_yards !== undefined && pass_stats.sack_yards !== null) {
    mapped.yds_gained = pass_stats.sack_yards
  }

  // Pocket time (air_yards skipped - less accurate than nflfastR/NGS sources)
  mapped.pocket_time = pass_stats.pocket_time || null

  // Flags
  mapped.first_down_pass = pass_stats.firstdown === 1
  mapped.qb_hit = pass_stats.knockdown === 1
  mapped.qb_hurry = pass_stats.hurry === 1

  // Goal to go
  if (pass_stats.goaltogo === 1) {
    mapped.goal_to_go = true
  }

  return mapped
}

/**
 * Map receiving statistics to play fields
 */
export const map_receiving_stats = async ({
  receive_stats,
  resolve_player,
  pos_team
}) => {
  const mapped = {}

  if (!receive_stats) return mapped

  // Receiver player IDs
  if (receive_stats.player) {
    const receiver = await resolve_player({
      sportradar_player_id: receive_stats.player.id,
      player_name: receive_stats.player.name,
      player_team_alias: receive_stats.team?.alias
    })
    if (receiver) {
      mapped.trg_pid = receiver.pid
      mapped.trg_gsis = receiver.gsisid
    }
  }

  // Receiving metrics
  mapped.recv_yds = receive_stats.yards || null
  mapped.yards_after_catch = receive_stats.yards_after_catch || null
  mapped.yards_after_any_contact = receive_stats.yards_after_contact || null
  mapped.broken_tackles_rec = receive_stats.broken_tackles || 0
  mapped.td = receive_stats.touchdown === 1
  mapped.first_down_pass = receive_stats.firstdown === 1
  mapped.catchable_ball = receive_stats.catchable === 1
  mapped.dropped_pass = receive_stats.dropped === 1

  // Goal to go
  if (receive_stats.goaltogo === 1) {
    mapped.goal_to_go = true
  }

  return mapped
}

/**
 * Map rushing statistics to play fields
 */
export const map_rushing_stats = async ({
  rush_stats,
  resolve_player,
  pos_team,
  is_sack
}) => {
  const mapped = {}

  if (!rush_stats) return mapped

  // Ball carrier player IDs
  if (rush_stats.player) {
    const ball_carrier = await resolve_player({
      sportradar_player_id: rush_stats.player.id,
      player_name: rush_stats.player.name,
      player_team_alias: rush_stats.team?.alias
    })
    if (ball_carrier) {
      mapped.bc_pid = ball_carrier.pid
      mapped.bc_gsis = ball_carrier.gsisid
    }
  }

  // Rushing metrics
  mapped.rush_yds = rush_stats.yards || null
  mapped.rush_td = rush_stats.touchdown === 1
  mapped.broken_tackles_rush = rush_stats.broken_tackles || 0
  mapped.qb_kneel = rush_stats.kneel_down === 1
  mapped.qb_scramble = rush_stats.scramble === 1
  mapped.first_down_rush = rush_stats.firstdown === 1

  // Goal to go
  if (rush_stats.goaltogo === 1) {
    mapped.goal_to_go = true
  }

  // Yards after contact
  if (rush_stats.yards_after_contact !== undefined) {
    mapped.yards_after_any_contact = rush_stats.yards_after_contact
  }

  // If no sack, use rush yards for yds_gained
  if (!is_sack && rush_stats.yards !== undefined) {
    mapped.yds_gained = rush_stats.yards
  }

  return mapped
}

/**
 * Map field goal statistics to play fields
 */
export const map_field_goal_stats = async ({
  field_goal_stats,
  resolve_player,
  pos_team
}) => {
  const mapped = {}

  if (!field_goal_stats) return mapped

  mapped.fg_att = field_goal_stats.attempt === 1

  // Kicker player IDs
  if (field_goal_stats.kicker) {
    const kicker = await resolve_player({
      sportradar_player_id: field_goal_stats.kicker.id,
      player_name: field_goal_stats.kicker.name,
      player_team_alias: field_goal_stats.team?.alias
    })
    if (kicker) {
      mapped.kicker_pid = kicker.pid
      mapped.kicker_gsis = kicker.gsisid
      mapped.kicker_sportradar_id = field_goal_stats.kicker.id
    }
  }

  // Field goal metrics
  mapped.kick_distance = field_goal_stats.yards || null
  mapped.fg_blocked = field_goal_stats.blocked === 1

  // Map result to enum
  if (field_goal_stats.made === 1) {
    mapped.fg_result = 'made'
  } else if (field_goal_stats.missed === 1) {
    mapped.fg_result = 'missed'
  } else if (field_goal_stats.blocked === 1) {
    mapped.fg_result = 'blocked'
  }

  return mapped
}

/**
 * Map punt statistics to play fields
 */
export const map_punt_stats = async ({
  punt_stats,
  resolve_player,
  pos_team
}) => {
  const mapped = {}

  if (!punt_stats) return mapped

  mapped.punt_att = punt_stats.attempt === 1

  // Punter player IDs
  if (punt_stats.punter) {
    const punter = await resolve_player({
      sportradar_player_id: punt_stats.punter.id,
      player_name: punt_stats.punter.name,
      player_team_alias: punt_stats.team?.alias
    })
    if (punter) {
      mapped.punter_pid = punter.pid
      mapped.punter_gsis = punter.gsisid
      mapped.punter_sportradar_id = punt_stats.punter.id
    }
  }

  // Punt metrics
  mapped.punt_yds = punt_stats.yards || null
  mapped.punt_hang_time = punt_stats.hang_time || null
  mapped.punt_blocked = punt_stats.blocked === 1
  mapped.punt_inside_20 = punt_stats.inside_20 === 1
  mapped.punt_touchback = punt_stats.touchback === 1

  return mapped
}

/**
 * Map kickoff statistics to play fields
 */
export const map_kickoff_stats = async ({
  kick_stats,
  resolve_player,
  pos_team
}) => {
  const mapped = {}

  if (!kick_stats) return mapped

  mapped.kickoff_att = kick_stats.attempt === 1

  // Kicker player IDs
  if (kick_stats.player) {
    const kicker = await resolve_player({
      sportradar_player_id: kick_stats.player.id,
      player_name: kick_stats.player.name,
      player_team_alias: kick_stats.team?.alias
    })
    if (kicker) {
      mapped.kicker_pid = kicker.pid
      mapped.kicker_gsis = kicker.gsisid
      mapped.kicker_sportradar_id = kick_stats.player.id
    }
  }

  // Kickoff metrics
  mapped.kickoff_yds = kick_stats.yards || null
  mapped.kickoff_onside = kick_stats.onside_attempt === 1
  mapped.kickoff_touchback = kick_stats.touchback === 1

  return mapped
}

/**
 * Map return statistics to play fields
 */
export const map_return_stats = async ({
  return_stats,
  resolve_player,
  def_team
}) => {
  const mapped = {}

  if (!return_stats) return mapped

  // Returner player IDs
  if (return_stats.returner) {
    const returner = await resolve_player({
      sportradar_player_id: return_stats.returner.id,
      player_name: return_stats.returner.name,
      player_team_alias: return_stats.team?.alias
    })
    if (returner) {
      mapped.returner_pid = returner.pid
      mapped.returner_gsis = returner.gsisid
      mapped.returner_sportradar_id = return_stats.returner.id
    }
  }

  // Return metrics
  mapped.ret_yds = return_stats.yards || null
  mapped.ret_td = return_stats.touchdown === 1
  mapped.touchback = return_stats.touchback === 1
  mapped.punt_fair_catch = return_stats.faircatch === 1
  mapped.oob = return_stats.out_of_bounds === 1

  // For interceptions
  if (return_stats.category === 'interception' && return_stats.returner) {
    const intercepter = await resolve_player({
      sportradar_player_id: return_stats.returner.id,
      player_name: return_stats.returner.name,
      player_team_alias: return_stats.team?.alias
    })
    if (intercepter) {
      mapped.intp_pid = intercepter.pid
      mapped.intp_gsis = intercepter.gsisid
    }
  }

  return mapped
}

/**
 * Map penalty statistics to play fields
 */
export const map_penalty_stats = async ({
  penalty_stats,
  resolve_player,
  get_team_abbrev
}) => {
  const mapped = {}

  if (!penalty_stats || penalty_stats.length === 0) return mapped

  mapped.penalty = Boolean(penalty_stats.length)

  // Take first penalty for detailed tracking
  const primary_penalty = penalty_stats[0]
  mapped.pen_yds = primary_penalty.yards || null

  // Penalty player
  if (primary_penalty.player) {
    const penalty_player = await resolve_player({
      sportradar_player_id: primary_penalty.player.id,
      player_name: primary_penalty.player.name,
      player_team_alias: primary_penalty.team?.alias
    })
    if (penalty_player) {
      mapped.penalty_player_pid = penalty_player.pid
      mapped.penalty_player_gsis = penalty_player.gsisid
      mapped.penalty_player_sportradar_id = primary_penalty.player.id
    }
  }

  return mapped
}

/**
 * Extract and map play details (incomplete passes, field goal details, etc.)
 */
export const map_play_details = async ({
  details,
  resolve_player,
  get_team_abbrev,
  def_team
}) => {
  const mapped = {}

  if (!details || details.length === 0) return mapped

  // Penalty details
  const penalty_detail = details.find((d) => d.category === 'penalty')
  if (penalty_detail?.penalty) {
    mapped.penalty_type = penalty_detail.penalty.description
    mapped.pen_team = get_team_abbrev({
      sportradar_team_id: penalty_detail.penalty.team?.id,
      sportradar_alias: penalty_detail.penalty.team?.alias
    })

    if (penalty_detail.penalty.result) {
      mapped.penalty_declined = penalty_detail.penalty.result === 'declined'
      mapped.penalty_offset = penalty_detail.penalty.result === 'offset'
    }
  }

  // Incomplete pass type
  const incomp_detail = details.find((d) => d.category === 'pass_incompletion')
  if (incomp_detail?.incompletion_type) {
    mapped.incomplete_pass_type = transform_to_enum_value(
      incomp_detail.incompletion_type
    )
  }

  // Field goal result detail
  const fg_detail = details.find((d) => d.category === 'field_goal')
  if (fg_detail?.reason_missed) {
    mapped.fg_result_detail = transform_to_enum_value(fg_detail.reason_missed)
  }

  // Play direction from pass details
  const pass_detail = details.find(
    (d) =>
      d.category === 'pass_completion' || d.category === 'pass_incompletion'
  )
  if (pass_detail?.direction) {
    mapped.play_direction = map_play_direction(pass_detail.direction)
  }

  // Fumble tracking
  const forced_fumble_detail = details.find(
    (d) => d.category === 'forced_fumble'
  )
  if (forced_fumble_detail?.players?.[0]) {
    const forcer = await resolve_player({
      sportradar_player_id: forced_fumble_detail.players[0].id,
      player_name: forced_fumble_detail.players[0].name,
      player_team_alias: forced_fumble_detail.team?.alias
    })
    if (forcer) {
      mapped.fumble_forced_1_pid = forcer.pid
      mapped.fumble_forced_1_gsis = forcer.gsisid
      mapped.fumble_forced_1_sportradar_id = forced_fumble_detail.players[0].id
    }
  }

  const recovery_detail = details.find(
    (d) =>
      d.category === 'own_fumble_recovery' ||
      d.category === 'opponent_fumble_recovery'
  )
  if (recovery_detail?.players?.[0]) {
    const recoverer = await resolve_player({
      sportradar_player_id: recovery_detail.players[0].id,
      player_name: recovery_detail.players[0].name,
      player_team_alias: recovery_detail.team?.alias
    })
    if (recoverer) {
      const recovery_team = get_team_abbrev({
        sportradar_team_id: recovery_detail.team?.id,
        sportradar_alias: recovery_detail.team?.alias
      })
      mapped.fumble_recovered_1_pid = recoverer.pid
      mapped.fumble_recovered_1_gsis = recoverer.gsisid
      mapped.fumble_recovered_1_sportradar_id = recovery_detail.players[0].id
      mapped.fumble_recovered_team = recovery_team
    }
  }

  // Sack players
  const sack_detail = details.find((d) => d.category === 'sack')
  if (sack_detail?.players) {
    const sack_players = sack_detail.players.filter((p) => p.role === 'sack')
    for (let i = 0; i < Math.min(sack_players.length, 2); i++) {
      const sacker = await resolve_player({
        sportradar_player_id: sack_players[i].id,
        player_name: sack_players[i].name,
        player_team_alias: sack_detail.team?.alias
      })
      if (sacker) {
        const idx = i + 1
        mapped[`sack_player_${idx}_pid`] = sacker.pid
        mapped[`sack_player_${idx}_gsis`] = sacker.gsisid
        mapped[`sack_player_${idx}_sportradar_id`] = sack_players[i].id
      }
    }
  }

  // Tackle for loss
  const tackle_detail = details.find((d) => d.category === 'tackle')
  if (tackle_detail?.loss && tackle_detail?.players) {
    mapped.tfl = true
    const tfl_players = tackle_detail.players.filter((p) => p.role === 'tackle')
    for (let i = 0; i < Math.min(tfl_players.length, 2); i++) {
      const tackler = await resolve_player({
        sportradar_player_id: tfl_players[i].id,
        player_name: tfl_players[i].name,
        player_team_alias: tackle_detail.team?.alias
      })
      if (tackler) {
        const idx = i + 1
        mapped[`tackle_for_loss_${idx}_pid`] = tackler.pid
        mapped[`tackle_for_loss_${idx}_gsis`] = tackler.gsisid
        mapped[`tackle_for_loss_${idx}_sportradar_id`] = tfl_players[i].id
      }
    }
  }

  if (details.some((d) => d.category === 'safety')) {
    mapped.safety = true
  }

  return mapped
}
