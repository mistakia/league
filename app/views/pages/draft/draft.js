import React from 'react'
import moment from 'moment'

import Button from '@components/button'
import PageLayout from '@layouts/page'
import DraftPlayer from '@components/draft-player'
import DraftPick from '@components/draft-pick'
import Position from '@components/position'
import { constants } from '@common'

import './draft.styl'

export default function () {
  const { players, currentPick, picks, league, selectedPlayer, isDrafting, draftPlayer, drafted } = this.props
  const { positions } = constants

  let draftInfo
  if (league.ddate) {
    const start = moment(league.ddate, 'X').startOf('day')
    if (moment().isBefore(start)) {
      draftInfo = (<p>Draft begins {moment().to(start)}</p>)
    } else if (currentPick) {
      const pickNum = (currentPick.pick % league.nteams) || league.nteams
      const end = start.add(currentPick.pick, 'd')
      const now = moment()
      const hours = end.diff(now, 'hours')
      const mins = end.diff(now, 'minutes') % 60
      draftInfo = (
        <div>
          <div className='draft__side-top-pick'>
            Pick #{currentPick.pick} ({currentPick.round}.{('0' + pickNum).slice(-2)})
          </div>
          <div>Time Remaining: {hours}h {mins}m</div>
        </div>
      )
    }
  } else {
    draftInfo = (<p>Draft not scheduled</p>)
  }

  const sorted = players.sort((a, b) => b.vorp.get('available') - a.vorp.get('available'))
  const all = sorted.map((p, index) => <DraftPlayer key={p.player} index={index} player={p} />)

  const groups = {}
  for (const position of positions) {
    if (!groups[position]) groups[position] = []
    groups[position] = sorted.filter(p => p.pos1 === position)
  }

  const items = {}
  for (const position in groups) {
    if (!items[position]) items[position] = []
    const players = groups[position]
    for (const [index, player] of players.entries()) {
      items[position].push(<DraftPlayer key={player.player} player={player} index={index} />)
    }
  }

  const pickItems = []
  for (const pick of picks) {
    const isActive = currentPick && pick.pick === currentPick.pick
    pickItems.push(<DraftPick key={pick.pick} pick={pick} playerId={pick.player} tid={pick.tid} isActive={isActive} />)
  }

  const p = selectedPlayer
  const isDrafted = drafted.includes(p.player)
  const selected = (
    <div className='draft__selected'>
      <div className='draft__selected-head'>
        <div className='draft__selected-title'>{p.fname} {p.lname}</div>
        <div className='draft__selected-alt'>
          <div><Position pos={p.pos1} /></div>
          <div>{p.team}</div>
          {!!p.jersey && <div>#{p.jersey}</div>}
        </div>
        {(isDrafting && !isDrafted) &&
          <div className='draft__selected-action'>
            <Button onClick={draftPlayer}>Draft</Button>
          </div>}
      </div>
      <div className='draft__selected-body'>
        <div><label>Drafted</label>{p.dpos ? `${Math.ceil(p.dpos / 12)}.${('0' + (p.dpos % 32)).slice(-2)}` : 'undrafted'}</div>
        <div><label>Proj.</label>{Math.round(p.points.get('total'))}</div>
        <div><label>Age</label>{moment().diff(moment(p.dob), 'years')}</div>
        <div><label>Height</label>{Math.floor(p.height / 12)}-{p.height % 12}</div>
        <div><label>Weight</label>{p.weight}</div>
        <div><label>Forty</label>{p.forty || 'n/a'}</div>
        <div><label>Bench</label>{p.bench || 'n/a'}</div>
        <div><label>Vertical</label>{p.vertical || 'n/a'}</div>
        <div><label>Broad</label>{p.broad || 'n/a'}</div>
        <div><label>Shuttle</label>{p.shuttle || 'n/a'}</div>
        <div><label>Cone</label>{p.cone || 'n/a'}</div>
        <div><label>Arm</label>{p.arm}</div>
        <div><label>Hand</label>{p.hand}</div>
        <div><label>College</label>{p.college}</div>
        <div><label>Division</label>{p.college_division}</div>
      </div>
    </div>
  )

  const body = (
    <div className='draft'>
      <div className='draft__main'>
        {p.player && selected}
        <div className='draft__main-board'>
          <div className='draft__main-board-pos'>
            <div className='draft__main-board-pos-head'>Overall</div>
            <div className='draft__main-board-pos-body'>{all}</div>
            {/* TODO show player position */}
          </div>
          <div className='draft__main-board-pos'>
            <div className='draft__main-board-pos-head'>Quarterbacks</div>
            <div className='draft__main-board-pos-body'>{items.QB}</div>
          </div>
          <div className='draft__main-board-pos'>
            <div className='draft__main-board-pos-head'>Running Backs</div>
            <div className='draft__main-board-pos-body'>{items.RB}</div>
          </div>
          <div className='draft__main-board-pos'>
            <div className='draft__main-board-pos-head'>Wide Receivers</div>
            <div className='draft__main-board-pos-body'>{items.WR}</div>
          </div>
          <div className='draft__main-board-pos'>
            <div className='draft__main-board-pos-head'>Tight ends</div>
            <div className='draft__main-board-pos-body'>{items.TE}</div>
          </div>
        </div>
      </div>
      <div className='draft__side'>
        <div className='draft__side-top'>
          {draftInfo}
        </div>
        <div className='draft__side-main'>
          {pickItems}
        </div>
      </div>
    </div>
  )

  return (
    <PageLayout body={body} />
  )
}
