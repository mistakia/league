import React from 'react'
import PropTypes from 'prop-types'

const create_row_group = (key, head, cells) => (
  <div className='row__group' key={key}>
    {head && <div className='row__group-head'>{head}</div>}
    <div className='row__group-body'>
      {cells.map((cell, index) => (
        <div key={index} className='table__cell'>
          {cell}
        </div>
      ))}
    </div>
  </div>
)

const snaps_header = (snaps_types) =>
  create_row_group('snaps', 'Snaps', snaps_types)

// Map fantasy stat fields to their header labels
const FANTASY_STAT_HEADER_MAP = {
  points: 'FP',
  points_pos_rnk: 'Rnk',
  points_per_game: 'FP/G',
  points_per_game_pos_rnk: 'Rnk',
  points_added: 'Pts+',
  points_added_rnk: 'Ovr',
  points_added_pos_rnk: 'Rnk',
  points_added_per_game: 'Pts+/G',
  points_added_per_game_rnk: 'Ovr',
  points_added_per_game_pos_rnk: 'Rnk'
}

// Order of fantasy stats (must match FANTASY_STATS in player-selected-row.js)
const FANTASY_STATS_ORDER = [
  'points',
  'points_pos_rnk',
  'points_per_game',
  'points_per_game_pos_rnk',
  'points_added',
  'points_added_rnk',
  'points_added_pos_rnk',
  'points_added_per_game',
  'points_added_per_game_rnk',
  'points_added_per_game_pos_rnk'
]

const get_fantasy_stats_headers = (fantasy_stats_filter = null) => {
  if (!fantasy_stats_filter) {
    // Return all headers in the original order
    return FANTASY_STATS_ORDER.map((stat) => FANTASY_STAT_HEADER_MAP[stat])
  }

  // Return headers for filtered stats, preserving order
  return FANTASY_STATS_ORDER.filter((stat) =>
    fantasy_stats_filter.includes(stat)
  ).map((stat) => FANTASY_STAT_HEADER_MAP[stat])
}

const categories = {
  fantasy_stats: [
    'FP',
    'Rnk',
    'FP/G',
    'Rnk',
    'Pts+',
    'Ovr',
    'Rnk',
    'Pts+/G',
    'Ovr',
    'Rnk'
  ],
  passing_production: ['ATT', 'YDS', 'TD', 'INT', 'DB', 'CAY', 'YAC'],
  passing_efficiency: ['RTG', 'Y/A', 'CMP%', 'xCMP%', 'CPOE', 'EPA/DB'],
  passing_usage: [
    'TTT',
    'TTP',
    'TTS',
    'PRS',
    'PRS%',
    'BLZ%',
    'DRP',
    'DR%',
    'AY/A',
    'SEP',
    'DP%',
    'TW%',
    'PA%'
  ],
  rushing_production: ['ATT', 'YDS', 'TD', 'FUM', 'EPA'],
  rushing_opportunities: ['xYDS', 'RSH%', 'WO'],
  rushing_efficiency: ['RYOE', 'RYOE/A', 'YAC/A', 'SR%', 'Y/A'],
  rushing_explosiveness: ['LNG', '10+', '15+MPH', '20+MPH'],
  rushing_redzone: ['RZ ATT', 'GL ATT'],
  receiving_production: ['TAR', 'REC', 'YDS', 'TD', 'EPA'],
  receiving_efficiency: [
    'RTG',
    'CTCH%',
    'xCTCH%',
    'CROE',
    'Y/REC',
    'Y/RTE',
    'EPA/TGT',
    'EPA/RTE',
    'YACOE'
  ],
  receiving_explosiveness: ['LNG', '15+'],
  receiving_opportunities: ['RTE', 'RTE%', 'TGT%', 'AY%', 'WOPR'],
  receiving_usage: ['AY', 'AY/TGT', 'DEP/RTE', 'DT%', 'TW%'],
  receiving_redzone: ['RZ TGT', 'EZ TGT'],
  defense: [
    'PA',
    'YA',
    'SK',
    'INT',
    'FF',
    'FR',
    '3NO',
    '4DS',
    'BLK',
    'SFT',
    '2PT',
    'TD',
    'PRTD',
    'KRTD'
  ],
  kicker: ['XPM', 'FGM', '0-19', '20-29', '30-39', '40-49', '50+']
}

const position_config = {
  DST: [
    { key: 'fantasy_stats', head: 'Fantasy' },
    { key: 'defense', head: null }
  ],
  K: [
    { key: 'fantasy_stats', head: 'Fantasy' },
    { key: 'kicker', head: null },
    { key: 'snaps', types: ['DEF', 'ST'] }
  ],
  QB: [
    { key: 'fantasy_stats', head: 'Fantasy' },
    { key: 'passing_production', head: 'Passing Production' },
    { key: 'passing_efficiency', head: 'Passing Efficiency' },
    { key: 'passing_usage', head: 'Passing Usage' },
    { key: 'rushing_production', head: 'Rushing Production' },
    { key: 'rushing_efficiency', head: 'Rushing Efficiency' },
    { key: 'rushing_explosiveness', head: 'Rushing Explosiveness' },
    { key: 'rushing_redzone', head: 'Redzone Rushing' },
    { key: 'snaps', types: ['OFF', 'PASS', 'RUSH'] }
  ],
  RB: [
    { key: 'fantasy_stats', head: 'Fantasy' },
    { key: 'rushing_production', head: 'Rushing Production' },
    { key: 'rushing_opportunities', head: 'Rushing Opportunities' },
    { key: 'rushing_efficiency', head: 'Rushing Efficiency' },
    { key: 'rushing_explosiveness', head: 'Rushing Explosiveness' },
    { key: 'rushing_redzone', head: 'Redzone Rushing' },
    { key: 'receiving_production', head: 'Receiving Production' },
    { key: 'receiving_opportunities', head: 'Receiving Opportunities' },
    { key: 'receiving_efficiency', head: 'Receiving Efficiency' },
    { key: 'receiving_explosiveness', head: 'Explosiveness' },
    { key: 'receiving_redzone', head: 'Redzone' },
    { key: 'snaps', types: ['OFF', 'PASS', 'RUSH', 'ST'] }
  ],
  WR: [
    { key: 'fantasy_stats', head: 'Fantasy' },
    { key: 'receiving_production', head: 'Receiving Production' },
    { key: 'receiving_opportunities', head: 'Receiving Opportunities' },
    { key: 'receiving_efficiency', head: 'Receiving Efficiency' },
    { key: 'receiving_explosiveness', head: 'Explosiveness' },
    { key: 'receiving_usage', head: 'Receiving Usage' },
    { key: 'receiving_redzone', head: 'Redzone' },
    { key: 'snaps', types: ['OFF', 'REC', 'RUSH', 'ST'] }
  ],
  TE: [
    { key: 'fantasy_stats', head: 'Fantasy' },
    { key: 'receiving_production', head: 'Receiving Production' },
    { key: 'receiving_opportunities', head: 'Receiving Opportunities' },
    { key: 'receiving_efficiency', head: 'Receiving Efficiency' },
    { key: 'receiving_explosiveness', head: 'Explosiveness' },
    { key: 'receiving_usage', head: 'Receiving Usage' },
    { key: 'receiving_redzone', head: 'Redzone' },
    { key: 'snaps', types: ['OFF', 'REC', 'RUSH', 'ST'] }
  ]
}

const create_position_group = (config, snaps, fantasy_stats_filter = null) => {
  return config
    .map((item, index) => {
      if (item.key === 'snaps') {
        return Boolean(snaps) && snaps_header(item.types)
      }
      if (item.key === 'fantasy_stats' && fantasy_stats_filter) {
        const headers = get_fantasy_stats_headers(fantasy_stats_filter)
        return create_row_group(index, item.head, headers)
      }
      return create_row_group(index, item.head, categories[item.key])
    })
    .filter(Boolean)
}

export default function PlayerSelectedRowHeader({
  pos,
  snaps,
  fantasy_stats_filter
}) {
  const config = position_config[pos]
  return config
    ? create_position_group(config, snaps, fantasy_stats_filter)
    : null
}

PlayerSelectedRowHeader.propTypes = {
  pos: PropTypes.string,
  snaps: PropTypes.bool,
  fantasy_stats_filter: PropTypes.array
}
