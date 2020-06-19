import React from 'react'

import PlayerRosterRow from '@components/player-roster-row'
import { getEligibleSlots, constants } from '@common'
import TeamName from '@components/team-name'

import './roster.styl'

export default class Roster extends React.Component {
  render = () => {
    const { roster, league } = this.props

    if (!roster) {
      return null
    }

    const rows = []
    const eligible = getEligibleSlots({ pos: 'ALL', bench: true, league, ir: true, ps: true })
    for (const slot of eligible) {
      const slotId = constants.slots[slot]
      const playerId = roster[`s${slotId}`]
      rows.push(
        <PlayerRosterRow key={slot} {...{ slotId, playerId, slot, roster }} />
      )
    }

    return (
      <div className='roster'>
        <div className='roster__team'>
          <TeamName tid={roster.tid} />
        </div>
        <div className='roster__slots'>
          {rows}
        </div>
      </div>
    )
  }
}
