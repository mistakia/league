import React from 'react'

import PlayerFilter from '@components/player-filter'

class PositionFilter extends React.Component {
  render () {
    const state = {
      type: 'positions',
      label: 'POSITIONS',
      values: [
        {
          label: 'QB',
          value: 'QB',
          selected: this.props.positions.includes('QB')
        },
        {
          label: 'RB',
          value: 'RB',
          selected: this.props.positions.includes('RB')
        },
        {
          label: 'WR',
          value: 'WR',
          selected: this.props.positions.includes('WR')
        },
        {
          label: 'TE',
          value: 'TE',
          selected: this.props.positions.includes('TE')
        },
        {
          label: 'K',
          value: 'K',
          selected: this.props.positions.includes('K')
        },
        {
          label: 'DST',
          value: 'DST',
          selected: this.props.positions.includes('DST')
        }
      ]
    }

    return (
      <PlayerFilter {...state} />
    )
  }
}

export default PositionFilter
