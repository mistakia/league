import { constants } from '@common'

const views = {
  season_projections: {
    name: constants.season.isOffseason
      ? 'Season Projections'
      : 'Rest of Season Projections',
    order_by: constants.season.isOffseason ? 'vorp.0' : 'vorp.ros',
    fields: [
      // TODO player salary
      // TODO player points+
      // TODO player market salary
      // TODO player market adjusted salary
      constants.season.isOffseason ? 'vorp.0' : 'vorp.ros',
      constants.season.isOffSeason ? 'points.0.total' : 'points.ros.total',
      constants.season.isOffseason ? 'projection.0.py' : 'projection.ros.py',
      constants.season.isOffseason ? 'projection.0.tdp' : 'projection.ros.tdp',
      constants.season.isOffseason
        ? 'projection.0.ints'
        : 'projection.ros.ints',
      constants.season.isOffseason ? 'projection.0.ra' : 'projection.ros.ra',
      constants.season.isOffseason ? 'projection.0.ry' : 'projection.ros.ry',
      constants.season.isOffseason ? 'projection.0.tdr' : 'projection.ros.tdr',
      constants.season.isOffseason
        ? 'projection.0.fuml'
        : 'projection.ros.fuml',
      constants.season.isOffseason ? 'projection.0.trg' : 'projection.ros.trg',
      constants.season.isOffseason ? 'projection.0.rec' : 'projection.ros.rec',
      constants.season.isOffseason
        ? 'projection.0.recy'
        : 'projection.ros.recy',
      constants.season.isOffseason
        ? 'projection.0.tdrec'
        : 'projection.ros.tdrec'
    ]
  },
  week_projections: {
    name: 'Week Projections',
    order_by: 'vorp.week',
    fields: [
      'opponent',
      'opponent_strength',
      'vorp.week',
      'points.week.total',
      'projection.week.py',
      'projection.week.tdp',
      'projection.week.ints',
      'projection.week.ra',
      'projection.week.ry',
      'projection.week.tdr',
      'projection.week.fuml',
      'projection.week.trg',
      'projection.week.rec',
      'projection.week.recy',
      'projection.week.tdrec'
    ]
  },
  passing_stats_by_play: {
    name: 'Passing Stats by Play',
    order_by: 'stats.py',
    fields: [
      'stats.pts',
      'stats.py',
      'stats.pyac',
      'stats.tdp',
      'stats.ints',
      'stats.drppy',
      'stats.pc_pct',
      'stats.tdp_pct',
      'stats.ints_pct',
      'stats.intw_pct',
      'stats.pyac_pc',
      'stats._ypa',
      'stats.pdot_pa',
      'stats.pdot',
      'stats.pcay_pc',
      'stats._pacr',
      'stats.sk',
      'stats.sky',
      'stats.sk_pct',
      'stats.qbhi_pct',
      'stats.qbp_pct',
      'stats.qbhu_pct',
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

for (const key of Object.keys(views)) {
  views[key].key = key
}

export default views
