import React from 'react'
import PropTypes from 'prop-types'
import PlayerLabel from '@components/player-label'

import { player_tag_types } from '@constants'

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
      case player_tag_types.FRANCHISE:
        return <PlayerLabel label='F' type='tag' description='Franchise Tag' />

      case player_tag_types.ROOKIE:
        return <PlayerLabel label='R' type='tag' description='Rookie Tag' />

      case player_tag_types.RESTRICTED_FREE_AGENCY:
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
