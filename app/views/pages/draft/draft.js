import React from 'react'
import moment from 'moment'
import { AutoSizer, List } from 'react-virtualized'

import Button from '@components/button'
import PageLayout from '@layouts/page'
import DraftPlayer from '@components/draft-player'
import DraftPick from '@components/draft-pick'
import DraftSchedule from '@components/draft-schedule'
import Position from '@components/position'
import { constants } from '@common'

import './draft.styl'

export default function () {
  const {
    players, nextPick, picks, league, selectedPlayer,
    draftPlayer, drafted, vbaseline
  } = this.props
  const { positions } = constants

  const draftActive = league.ddate &&
    moment().isAfter(moment(league.ddate, 'X').startOf('day'))
  const onTheClock = league.ddate && nextPick && moment().isAfter(moment(league.ddate, 'X').add((nextPick.pick - 1), 'days'))

  let draftInfo
  if (league.ddate) {
    const start = moment(league.ddate, 'X').startOf('day')
    if (moment().isBefore(start)) {
      draftInfo = (<div className='draft__side-top-pick'>Draft begins {moment().to(start)}</div>)
    } else if (nextPick) {
      const pickStart = moment(league.ddate, 'X').add((nextPick.pick - 1), 'days')
      if (moment().isBefore(pickStart)) {
        draftInfo = (<div className='draft__side-top-pick'>Next pick in {moment().to(pickStart)}</div>)
      } else {
        const pickNum = (nextPick.pick % league.nteams) || league.nteams
        const end = pickStart.add(1, 'd')
        const now = moment()
        const hours = end.diff(now, 'hours')
        const mins = end.diff(now, 'minutes') % 60
        draftInfo = (
          <div className='draft__side-top-pick'>
            <div className='draft__side-top-pick-title'>
              Pick #{nextPick.pick} ({nextPick.round}.{('0' + pickNum).slice(-2)})
            </div>
            <div>Time Remaining: {hours}h {mins}m</div>
          </div>
        )
      }
    }
  } else {
    draftInfo = (<div className='draft__side-top-pick'>Draft not scheduled</div>)
  }

  const sorted = players.sort((a, b) => b.vorp.get(vbaseline) - a.vorp.get(vbaseline))
  const allRow = ({ index, key, ...params }) => {
    const player = sorted.get(index)
    return (
      <DraftPlayer key={key} index={index} player={player} {...params} />
    )
  }

  const groups = {}
  for (const position of positions) {
    if (!groups[position]) groups[position] = []
    groups[position] = sorted.filter(p => p.pos1 === position)
  }

  const items = {}
  for (const position in groups) {
    if (!items[position]) items[position] = []
    const players = groups[position]
    for (const player of players.values()) {
      items[position].push(player)
    }
  }

  const positionRow = ({ index, key, pos, ...params }) => {
    const player = items[pos][index]
    return (
      <DraftPlayer key={key} index={index} player={player} {...params} />
    )
  }

  const pickItems = []
  for (const pick of picks) {
    const isActive = draftActive && !pick.player && moment().isAfter(moment(league.ddate, 'X').add((pick.pick - 1), 'days'))
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
        {(draftActive && onTheClock && !isDrafted) &&
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
            <div className='draft__main-board-pos-body'>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    width={width}
                    height={height}
                    rowHeight={25}
                    rowCount={sorted.size}
                    rowRenderer={allRow}
                  />
                )}
              </AutoSizer>
            </div>
          </div>
          <div className='draft__main-board-pos'>
            <div className='draft__main-board-pos-head'>Quarterbacks</div>
            <div className='draft__main-board-pos-body'>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    width={width}
                    height={height}
                    rowHeight={25}
                    rowCount={items.QB.length}
                    rowRenderer={(args) => positionRow({ pos: 'QB', ...args })}
                  />
                )}
              </AutoSizer>
            </div>
          </div>
          <div className='draft__main-board-pos'>
            <div className='draft__main-board-pos-head'>Running Backs</div>
            <div className='draft__main-board-pos-body'>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    width={width}
                    height={height}
                    rowHeight={25}
                    rowCount={items.RB.length}
                    rowRenderer={(args) => positionRow({ pos: 'RB', ...args })}
                  />
                )}
              </AutoSizer>
            </div>
          </div>
          <div className='draft__main-board-pos'>
            <div className='draft__main-board-pos-head'>Wide Receivers</div>
            <div className='draft__main-board-pos-body'>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    width={width}
                    height={height}
                    rowHeight={25}
                    rowCount={items.WR.length}
                    rowRenderer={(args) => positionRow({ pos: 'WR', ...args })}
                  />
                )}
              </AutoSizer>
            </div>
          </div>
          <div className='draft__main-board-pos'>
            <div className='draft__main-board-pos-head'>Tight ends</div>
            <div className='draft__main-board-pos-body'>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    width={width}
                    height={height}
                    rowHeight={25}
                    rowCount={items.TE.length}
                    rowRenderer={(args) => positionRow({ pos: 'TE', ...args })}
                  />
                )}
              </AutoSizer>
            </div>
          </div>
        </div>
      </div>
      <div className='draft__side'>
        <div className='draft__side-top'>
          {league.ddate && <DraftSchedule />}
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
