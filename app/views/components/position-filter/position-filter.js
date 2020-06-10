import React from 'react'

import Filter from '@components/filter'

class PositionFilter extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      checkboxes: [
        {
          label: 'QB',
          value: 'QB',
          checked: this.props.positions.includes('QB')
        },
        {
          label: 'RB',
          value: 'RB',
          checked: this.props.positions.includes('RB')
        },
        {
          label: 'WR',
          value: 'WR',
          checked: this.props.positions.includes('WR')
        },
        {
          label: 'TE',
          value: 'TE',
          checked: this.props.positions.includes('TE')
        },
        {
          label: 'K',
          value: 'K',
          checked: this.props.positions.includes('K')
        },
        {
          label: 'DST',
          value: 'DST',
          checked: this.props.positions.includes('DST')
        }
      ]
    }

    this.handleCheckboxgroupChange = this.handleCheckboxgroupChange.bind(this)
  }

  handleCheckboxgroupChange (updatedState) {
    this.setState({
      checkboxes: updatedState
    })

    const positions = updatedState.filter(i => i.checked).map(i => i.value)
    this.props.filter(positions)
  }

  render () {
    const { checkboxes } = this.state
    return (
      <Filter
        checkboxes={checkboxes}
        onChange={this.handleCheckboxgroupChange}
      />
    )
  }
}

export default PositionFilter
