import React from 'react'

import PlayerRosterRow from '@components/player-roster-row'
import { Roster as RosterBuilder } from '@common'
import TeamName from '@components/team-name'

import './roster.styl'

export default class Roster extends React.Component {
  render = () => {
    const { roster, league } = this.props

    if (!roster) {
      return null
    }

    const r = new RosterBuilder({ roster: roster.toJS(), league })
    console.log(r)
    console.log(r.players)
    console.log(r.players.entries())

    const rows = []
    for (const [index, value] of r.players.entries()) {
      const { slot, player } = value
      rows.push(
        <PlayerRosterRow key={index} {...{ playerId: player, slot, roster }} />
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
