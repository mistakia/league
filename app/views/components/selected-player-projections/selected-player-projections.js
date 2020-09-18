import React from 'react'

import SelectedPlayerProjection from '@components/selected-player-projection'
import { groupBy } from '@common'

export default class SelectedPlayerSeasonProjections extends React.Component {
  render = () => {
    const { player } = this.props

    const tables = []
    const weeks = groupBy(player.projections, 'week')
    for (const wk in weeks) {
      const week = parseInt(wk, 0)
      tables.push(
        <SelectedPlayerProjection
          key={wk}
          week={week}
          projections={weeks[wk]}
          playerId={player.player}
          projection={player.getIn(['projection', wk])}
        />
      )
    }

    return (
      <div className='selected__player-projections'>
        {tables}
      </div>
    )
  }
}
