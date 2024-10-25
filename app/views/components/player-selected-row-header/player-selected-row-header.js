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

const categories = {
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
  DST: [{ key: 'defense', head: null }],
  K: [
    { key: 'kicker', head: null },
    { key: 'snaps', types: ['DEF', 'ST'] }
  ],
  QB: [
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
    { key: 'receiving_production', head: 'Receiving Production' },
    { key: 'receiving_opportunities', head: 'Receiving Opportunities' },
    { key: 'receiving_efficiency', head: 'Receiving Efficiency' },
    { key: 'receiving_explosiveness', head: 'Explosiveness' },
    { key: 'receiving_usage', head: 'Receiving Usage' },
    { key: 'receiving_redzone', head: 'Redzone' },
    { key: 'snaps', types: ['OFF', 'REC', 'RUSH', 'ST'] }
  ],
  TE: [
    { key: 'receiving_production', head: 'Receiving Production' },
    { key: 'receiving_opportunities', head: 'Receiving Opportunities' },
    { key: 'receiving_efficiency', head: 'Receiving Efficiency' },
    { key: 'receiving_explosiveness', head: 'Explosiveness' },
    { key: 'receiving_usage', head: 'Receiving Usage' },
    { key: 'receiving_redzone', head: 'Redzone' },
    { key: 'snaps', types: ['OFF', 'REC', 'RUSH', 'ST'] }
  ]
}

const create_position_group = (config, snaps) => {
  return config
    .map((item, index) => {
      if (item.key === 'snaps') {
        return Boolean(snaps) && snaps_header(item.types)
      }
      return create_row_group(index, item.head, categories[item.key])
    })
    .filter(Boolean)
}

export default function PlayerSelectedRowHeader({ pos, snaps }) {
  const config = position_config[pos]
  return config ? create_position_group(config, snaps) : null
}

PlayerSelectedRowHeader.propTypes = {
  pos: PropTypes.string,
  snaps: PropTypes.bool
}
