import React, { useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'

function SelectedPlayerSeasonStats({
  player_map,
  player_seasonlogs,
  pos,
  load,
  load_seasonlogs
}) {
  useEffect(() => {
    const pid = player_map.get('pid')
    const position = player_map.get('pos')
    load({ pid, position })
    load_seasonlogs({ pid })
  }, [player_map, load, load_seasonlogs])

  const seasonlogs = player_seasonlogs.toJS()
  const items = seasonlogs.map((seasonlog, index) => (
    <PlayerSelectedRow
      key={index}
      games={seasonlog.games}
      title={seasonlog.year}
      stats={seasonlog}
      pos={pos}
    />
  ))

  return (
    <div className='selected__section'>
      <div className='selected__table-header sticky__column'>
        <div className='row__group-head'>Regular Seasons</div>
      </div>
      <div className='selected__table-header'>
        <div className='table__cell text'>Year</div>
        <div className='table__cell metric'>G</div>
        <PlayerSelectedRowHeader pos={pos} />
      </div>
      {items}
    </div>
  )
}

SelectedPlayerSeasonStats.propTypes = {
  pos: PropTypes.string,
  player_map: ImmutablePropTypes.map,
  player_seasonlogs: ImmutablePropTypes.list,
  load: PropTypes.func,
  load_seasonlogs: PropTypes.func
}

export default SelectedPlayerSeasonStats
