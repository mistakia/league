import React from 'react'
import PropTypes from 'prop-types'
import PlayerLabel from '@components/player-label'

import { constants } from '@libs-shared'

export default class PlayerTag extends React.Component {
  render() {
    const { tag } = this.props

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
  tag: PropTypes.number
}
