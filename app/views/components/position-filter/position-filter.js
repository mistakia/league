import React from 'react'

import PlayerFilter from '@components/player-filter'

class PositionFilter extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
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

    this.onChange = this.onChange.bind(this)
  }

  onChange (values) {
    this.setState({ values })
    const positions = values.filter(i => i.selected).map(i => i.value)
    this.props.filter(positions)
  }

  render () {
    return (
      <PlayerFilter {...this.state} onChange={this.onChange} />
    )
  }
}

export default PositionFilter
