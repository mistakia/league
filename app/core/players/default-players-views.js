import { current_season } from '@constants'

const is_regular_season_finished =
  current_season.week > current_season.finalWeek

const season_projections_view = {
  name: current_season.isOffseason
    ? 'Season Projections'
    : 'Rest of Season Projections',
  order_by: current_season.isOffseason ? 'pts_added.0' : 'pts_added.ros',
  fields: [
    // TODO player salary
    // TODO player points+
    // TODO player market salary
    // TODO player market adjusted salary
    current_season.isOffseason ? 'pts_added.0' : 'pts_added.ros',
    current_season.isOffseason ? 'points.0.total' : 'points.ros.total',
    current_season.isOffseason
      ? 'projection.0.passing_attempts'
      : 'projection.ros.passing_attempts',
    current_season.isOffseason
      ? 'projection.0.passing_yards'
      : 'projection.ros.passing_yards',
    current_season.isOffseason
      ? 'projection.0.passing_touchdowns'
      : 'projection.ros.passing_touchdowns',
    current_season.isOffseason
      ? 'projection.0.passing_interceptions'
      : 'projection.ros.passing_interceptions',
    current_season.isOffseason
      ? 'projection.0.rushing_attempts'
      : 'projection.ros.rushing_attempts',
    current_season.isOffseason
      ? 'projection.0.rushing_yards'
      : 'projection.ros.rushing_yards',
    current_season.isOffseason
      ? 'projection.0.rushing_touchdowns'
      : 'projection.ros.rushing_touchdowns',
    current_season.isOffseason
      ? 'projection.0.fumbles_lost'
      : 'projection.ros.fumbles_lost',
    current_season.isOffseason
      ? 'projection.0.targets'
      : 'projection.ros.targets',
    current_season.isOffseason
      ? 'projection.0.receptions'
      : 'projection.ros.receptions',
    current_season.isOffseason
      ? 'projection.0.receiving_yards'
      : 'projection.ros.receiving_yards',
    current_season.isOffseason
      ? 'projection.0.receiving_touchdowns'
      : 'projection.ros.receiving_touchdowns'
  ]
}

const week_projections_view = {
  name: 'Week Projections',
  order_by: 'pts_added.week',
  fields: [
    'opponent',
    'opponent_strength',
    'opponent_strength_avg',
    'pts_added.week',
    'points.week.total',
    'projection.week.passing_attempts',
    'projection.week.passing_yards',
    'projection.week.passing_touchdowns',
    'projection.week.passing_interceptions',
    'opponent_pass_pa',
    'opponent_pass_pc',
    'opponent_pass_py',
    'opponent_pass_tdp',
    'opponent_pass_ints',
    'opponent_pass_rating',
    'opponent_pass_yards_per_attempt',
    'opponent_pass_comp_pct',
    'opponent_completion_percentage_over_expectation',
    'opponent_pass_epa_per_dropback',
    'opponent_avg_time_to_throw',
    'opponent_avg_time_to_pressure',
    'opponent_avg_time_to_sack',
    'opponent_pressure_rate_against',
    'opponent_blitz_rate',
    'opponent_air_yards_per_pass_att',
    'opponent_avg_target_separation',
    'opponent_deep_pass_att_pct',
    'opponent_tight_window_pct',
    'opponent_play_action_pct',
    'projection.week.rushing_attempts',
    'projection.week.rushing_yards',
    'projection.week.rushing_touchdowns',
    'projection.week.fumbles_lost',
    'opponent_rush_ra',
    'opponent_rush_ry',
    'opponent_rush_tdr',
    'opponent_rushing_yards_per_attempt',
    'opponent_rushing_success_rate',
    'opponent_rushing_yards_after_contact_per_attempt',
    'opponent_rushing_yards_over_expectation',
    'opponent_rushing_yards_over_expectation_per_attempt',
    'projection.week.targets',
    'projection.week.receptions',
    'projection.week.receiving_yards',
    'projection.week.receiving_touchdowns',
    'opponent_recv_trg',
    'opponent_recv_rec',
    'opponent_recv_recy',
    'opponent_recv_tdrec',
    'opponent_receiving_passer_rating',
    'opponent_catch_rate_over_expectation',
    'opponent_recv_yards_per_reception',
    'opponent_recv_yards_per_route',
    'opponent_receiving_epa_per_target',
    'opponent_receiving_epa_per_route',
    'opponent_receiving_yards_after_catch_over_expected'
  ]
}

const views = {
  passing_stats_by_play: {
    name: 'Passing Stats by Play',
    order_by: 'stats.passing_yards',
    fields: [
      'stats.pts',
      'stats.passing_attempts',
      'stats.passing_yards',
      'stats.pyac',
      'stats.passing_touchdowns',
      'stats.passing_interceptions',
      'stats.drppy',
      'stats.pc_pct',
      'stats.tdp_pct',
      'stats.ints_pct',
      'stats.int_worthy_pct',
      'stats.pyac_pc',
      'stats._ypa',
      'stats.pdot_pa',
      'stats.pdot',
      'stats.pcay_pc',
      'stats._pacr',
      'stats.sk',
      'stats.sky',
      'stats.sk_pct',
      'stats.qb_hit_pct',
      'stats.qb_pressure_pct',
      'stats.qb_hurry_pct',
      'stats._nygpa'
    ]
  },
  rushing_stats_by_play: {
    name: 'Rushing Stats by Play',
    order_by: 'stats.rushing_yards',
    fields: [
      'stats.pts',
      'stats.rushing_yards',
      'stats.rushing_attempts',
      'stats.rfd',
      'stats.rushing_touchdowns',
      'stats.ry_pra',
      'stats.posra',
      'stats.ryaco',
      'stats.ryaco_pra',
      'stats._stra',
      'stats._stry',
      'stats._fumlpra',
      'stats.posra_pra',
      'stats.rasucc_pra',
      'stats.mbt',
      'stats.mbt_pt'
    ]
  },
  receiving_stats_by_play: {
    name: 'Receiving Stats by Play',
    order_by: 'stats.receiving_yards',
    fields: [
      'stats.pts',
      'stats.receptions',
      'stats.receiving_yards',
      'stats.receiving_touchdowns',
      'stats.drops',
      'stats.dryprecy',
      'stats.targets',
      'stats.dptrg_pct',
      'stats._ayptrg',
      'stats.rdot',
      'stats._stray',
      'stats._sttrg',
      'stats._wopr',
      'stats._recypay',
      'stats._recyprec',
      'stats._recyptrg',
      'stats._ryacprec'
    ]
  }
}

if (!is_regular_season_finished) {
  views.season_projections = season_projections_view
  views.week_projections = week_projections_view
}

for (const key of Object.keys(views)) {
  views[key].key = key
}

export default views

export const default_players_view_key = is_regular_season_finished
  ? 'passing_stats_by_play'
  : 'season_projections'

export const default_players_view_order_by = is_regular_season_finished
  ? views.passing_stats_by_play.order_by
  : views.season_projections.order_by
