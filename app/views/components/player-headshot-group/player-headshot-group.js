import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import AvatarGroup from '@material-ui/lab/AvatarGroup'
import Tooltip from '@material-ui/core/Tooltip'
import Avatar from '@material-ui/core/Avatar'

export default class PlayerHeadshotGroup extends React.Component {
  render() {
    const { players, width = 48 } = this.props
    const height = Math.round((width * 70) / 96)
    const items = []
    players.forEach((player, index) => {
      const src = player.espn_id
        ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${
            player.espn_id
          }.png&w=${width * 2}&h=${height * 2}&cb=1`
        : null

      items.push(
        <Tooltip key={index} title={player.name}>
          <Avatar src={src} className='player__headshot'>
            {(player.fname || '').charAt(0)}
            {(player.lname || '').charAt(0)}
          </Avatar>
        </Tooltip>
      )
    })
    return <AvatarGroup max={4}>{items}</AvatarGroup>
  }
}

PlayerHeadshotGroup.propTypes = {
  players: ImmutablePropTypes.list,
  width: PropTypes.number
}
