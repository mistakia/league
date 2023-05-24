import { constants } from '@libs-shared'

const players_page_views = {
  season_projections: {
    name: constants.season.isOffseason
      ? 'Season Projections'
      : 'Rest of Season Projections',
    order_by: constants.season.isOffseason
      ? 'player_season_projected_points_added'
      : 'player_rest_of_season_projected_points_added',
    fields: [
      // TODO player salary
      // TODO player points+
      // TODO player market salary
      // TODO player market adjusted salary
      constants.season.isOffseason
        ? 'player_season_projected_points_added'
        : 'player_rest_of_season_projected_points_added',
      constants.season.isOffseason
        ? 'player_season_projected_points'
        : 'player_rest_of_season_projected_points',
      constants.season.isOffseason
        ? 'player_season_projected_pass_yds'
        : 'player_rest_of_season_projected_pass_yds',
      constants.season.isOffseason
        ? 'player_season_projected_pass_tds'
        : 'player_rest_of_season_projected_pass_tds',
      constants.season.isOffseason
        ? 'player_season_projected_pass_ints'
        : 'player_rest_of_season_projected_pass_ints',
      constants.season.isOffseason
        ? 'player_season_projected_rush_atts'
        : 'player_rest_of_season_projected_rush_atts',
      constants.season.isOffseason
        ? 'player_season_projected_rush_yds'
        : 'player_rest_of_season_projected_rush_yds',
      constants.season.isOffseason
        ? 'player_season_projected_rush_tds'
        : 'player_rest_of_season_projected_rush_tds',
      constants.season.isOffseason
        ? 'player_season_projected_fumbles_lost'
        : 'player_rest_of_season_projected_fumbles_lost',
      constants.season.isOffseason
        ? 'player_season_projected_targets'
        : 'player_rest_of_season_projected_targets',
      constants.season.isOffseason
        ? 'player_season_projected_recs'
        : 'player_rest_of_season_projected_recs',
      constants.season.isOffseason
        ? 'player_season_projected_rec_yds'
        : 'player_rest_of_season_projected_rec_yds',
      constants.season.isOffseason
        ? 'player_season_projected_rec_tds'
        : 'player_rest_of_season_projected_rec_tds'
    ]
  },
  week_projections: {
    name: 'Week Projections',
    order_by: 'player_week_projected_points_added',
    fields: [
      'opponent',
      'opponent_strength',
      'player_week_projected_points_added',
      'player_week_projected_points',
      'player_week_projected_pass_yds',
      'player_week_projected_pass_tds',
      'player_week_projected_pass_ints',
      'opponent_pass_pa',
      'opponent_pass_pc',
      'opponent_pass_py',
      'opponent_pass_tdp',
      'opponent_pass_ints',
      'player_week_projected_rush_atts',
      'player_week_projected_rush_yds',
      'player_week_projected_rush_tds',
      'player_week_projected_fumbles_lost',
      'opponent_rush_ra',
      'opponent_rush_ry',
      'opponent_rush_tdr',
      'player_week_projected_targets',
      'player_week_projected_recs',
      'player_week_projected_rec_yds',
      'player_week_projected_rec_tds',
      'opponent_recv_trg',
      'opponent_recv_rec',
      'opponent_recv_recy',
      'opponent_recv_tdrec'
    ]
  },
  passing_stats_by_play: {
    name: 'Passing Stats by Play',
    order_by: 'stats.py',
    fields: [
      'stats.pts',
      'stats.pa',
      'stats.py',
      'stats.pyac',
      'stats.tdp',
      'stats.ints',
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
    order_by: 'stats.ry',
    fields: [
      'stats.pts',
      'stats.ry',
      'stats.ra',
      'stats.rfd',
      'stats.tdr',
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
    order_by: 'stats.recy',
    fields: [
      'stats.pts',
      'stats.rec',
      'stats.recy',
      'stats.tdrec',
      'stats.drp',
      'stats.dryprecy',
      'stats.trg',
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

for (const key of Object.keys(players_page_views)) {
  players_page_views[key].key = key
}

export default players_page_views
