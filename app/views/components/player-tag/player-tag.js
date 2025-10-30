import React from 'react'
import PropTypes from 'prop-types'
import PlayerLabel from '@components/player-label'

import { constants } from '@libs-shared'

export default class PlayerTag extends React.Component {
  render() {
    const { tag, reserve_eligible } = this.props

    // show reserve eligibility tag alongside any other tag
    if (reserve_eligible) {
      return (
        <PlayerLabel label='IR' type='tag' description='Reserve Eligible' />
      )
    }

    switch (tag) {
      case constants.tags.FRANCHISE:
        return <PlayerLabel label='F' type='tag' description='Franchise Tag' />

      case constants.tags.ROOKIE:
        return <PlayerLabel label='R' type='tag' description='Rookie Tag' />

      case constants.tags.RESTRICTED_FREE_AGENCY:
        return (
          <PlayerLabel
            label='RFA'
            type='tag'
            description='Restricted Free Agent'
          />
        )

      default:
        return null
    }
  }
}

PlayerTag.propTypes = {
  tag: PropTypes.number,
  reserve_eligible: PropTypes.bool
}
