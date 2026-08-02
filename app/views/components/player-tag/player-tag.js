import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PlayerLabel from '@components/player-label'

import { player_tag_types } from '@constants'

export default class PlayerTag extends React.Component {
  render() {
    const { player_map, reserve_eligible, my_team_id } = this.props

    // show reserve eligibility tag alongside any other tag
    if (reserve_eligible) {
      return (
        <PlayerLabel label='IR' type='tag' description='Reserve Eligible' />
      )
    }

    const tag = player_map ? player_map.get('tag') : null

    switch (tag) {
      case player_tag_types.FRANCHISE:
        return <PlayerLabel label='F' type='tag' description='Franchise Tag' />

      case player_tag_types.ROOKIE:
        return <PlayerLabel label='R' type='tag' description='Rookie Tag' />

      case player_tag_types.RESTRICTED_FREE_AGENCY: {
        // A restricted free agent tag is private until the nomination is
        // announced, which is also the moment it locks — the API refuses to
        // remove the tag or cancel the nomination once `announced_at` is set.
        // Before that, only the tagging team can see its own designation.
        const is_own_player =
          Boolean(my_team_id) && player_map.get('tid') === my_team_id
        const is_announced = Boolean(
          player_map.get('restricted_free_agency_tag_announced')
        )

        if (!is_own_player && !is_announced) {
          return null
        }

        return (
          <PlayerLabel
            label='RFA'
            type='tag'
            description='Restricted Free Agent'
          />
        )
      }

      default:
        return null
    }
  }
}

PlayerTag.propTypes = {
  player_map: ImmutablePropTypes.map,
  reserve_eligible: PropTypes.bool,
  my_team_id: PropTypes.number
}
