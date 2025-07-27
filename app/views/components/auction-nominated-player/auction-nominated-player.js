import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import NFLTeamBye from '@components/nfl-team-bye'
import PlayerAge from '@components/player-age'
import PlayerName from '@components/player-name'

import './auction-nominated-player.styl'

const getHeadshotWidth = () => {
  if (window.innerWidth > 990) {
    return 180
  } else {
    return 150
  }
}

export default function AuctionNominatedPlayer({
  player_map,
  market_salary_adjusted
}) {
  const [headshot_width, set_headshot_width] = useState(getHeadshotWidth())
  const update = () => set_headshot_width(getHeadshotWidth())

  useEffect(() => {
    window.addEventListener('resize', update)
    return function cleanup() {
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div className='auction__nominated-player'>
      <div className='nominated__player'>
        <PlayerName
          large
          player_map={player_map}
          headshot_width={headshot_width}
        />
      </div>
      <div className='nominated__player-details'>
        <div className='selected__player-header-item'>
          <label>Market</label>${player_map.getIn(['market_salary', '0'], 0)}
        </div>
        <div className='selected__player-header-item'>
          <label>Adjusted</label>${market_salary_adjusted}
        </div>
        <div className='selected__player-header-item'>
          <label>Bye</label>
          <NFLTeamBye nfl_team={player_map.get('team')} />
        </div>
        <div className='selected__player-header-item'>
          <label>Age</label>
          <PlayerAge date={player_map.get('dob')} />
        </div>
      </div>
    </div>
  )
}

AuctionNominatedPlayer.propTypes = {
  player_map: ImmutablePropTypes.map,
  market_salary_adjusted: PropTypes.number
}
