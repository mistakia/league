import React from 'react'

import PlayerFilter from '@components/player-filter'

class ExperienceFilter extends React.Component {
  render () {
    const state = {
      type: 'experience',
      label: 'EXPERIENCE',
      values: [
        {
          label: 'Rookie',
          value: 0,
          selected: this.props.experience.includes(0)
        },
        {
          label: '2nd-year',
          value: 1,
          selected: this.props.experience.includes(1)
        },
        {
          label: 'Veterans',
          value: -1,
          selected: this.props.experience.includes(-1)
        }
      ]
    }

    return (
      <PlayerFilter {...state} />
    )
  }
}

export default ExperienceFilter
