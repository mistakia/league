import React from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import AutoSizer from 'react-virtualized/dist/es/AutoSizer'
import List from 'react-virtualized/dist/es/List'

import Button from '@components/button'
import PageLayout from '@layouts/page'
import DraftPlayer from '@components/draft-player'
import PlayerAge from '@components/player-age'
import DraftPick from '@components/draft-pick'
// import DraftSchedule from '@components/draft-schedule'
import Position from '@components/position'
import { constants, isDraftWindowOpen, getDraftWindow } from '@common'

import './draft.styl'

dayjs.extend(relativeTime)

export default function DraftPage() {
  const {
    players,
    nextPick,
    picks,
    league,
    selectedPlayer,
    drafted,
    vbaseline
  } = this.props
  const { positions } = constants

  const draftActive =
    league.ddate && dayjs().isAfter(dayjs.unix(league.ddate).startOf('day'))
  const prevPick = picks.find((p) => p.pick === nextPick.pick - 1)
  const isPreviousSelectionMade =
    Boolean(nextPick && nextPick.pick === 1) || Boolean(prevPick && prevPick.player)
  const onTheClock =
    league.ddate &&
    nextPick &&
    (isDraftWindowOpen({ start: league.ddate, pickNum: nextPick.pick }) ||
      isPreviousSelectionMade)

  let draftInfo
  if (league.ddate) {
    const start = dayjs.unix(league.ddate).startOf('day')
    if (dayjs().isBefore(start)) {
      draftInfo = (
        <div className='draft__side-top-pick'>
          Draft begins {dayjs().to(start)}
        </div>
      )
    } else if (nextPick) {
      const draftWindow = getDraftWindow({
        start: league.ddate,
        pickNum: nextPick.pick
      })
      if (dayjs().isBefore(draftWindow) && !isPreviousSelectionMade) {
        draftInfo = (
          <div className='draft__side-top-pick'>
            Your next pick is {dayjs().to(draftWindow)}
          </div>
        )
      } else {
        const pickNum = nextPick.pick % league.nteams || league.nteams
        const end = getDraftWindow({
          start: league.ddate,
          pickNum: nextPick.pick + 1
        })
        const now = dayjs()
        const isWindowClosed = now.isAfter(end)
        const hours = end.diff(now, 'hours')
        const mins = end.diff(now, 'minutes') % 60
        draftInfo = (
          <div className='draft__side-top-pick'>
            <div className='draft__side-top-pick-title'>
              Pick #{nextPick.pick} ({nextPick.round}.
              {('0' + pickNum).slice(-2)})
            </div>
            {!isWindowClosed && (
              <div>
                Time Remaining: {hours}h {mins}m
              </div>
            )}
          </div>
        )
      }
    } else {
      draftInfo = (
        <div className='draft__side-top-pick'>You have no picks left.</div>
      )
    }
  } else {
    draftInfo = <div className='draft__side-top-pick'>Draft not scheduled</div>
  }

  const sorted = players.sort(
    (a, b) => b.vorp.getIn(['0', vbaseline]) - a.vorp.getIn(['0', vbaseline])
  )
  const allRow = ({ index, key, ...params }) => {
    const player = sorted.get(index)
    return <DraftPlayer key={key} index={index} player={player} {...params} />
  }

  const groups = {}
  for (const position of positions) {
    if (!groups[position]) groups[position] = []
    groups[position] = sorted.filter((p) => p.pos === position)
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
    return <DraftPlayer key={key} index={index} player={player} {...params} />
  }

  const pickItems = []
  const picksSorted = picks.sort((a, b) => a.round - b.round || a.pick - b.pick)
  for (const pick of picksSorted) {
    const prevPick = picks.find((p) => p.pick === pick.pick - 1)
    const isPreviousSelectionMade =
      pick.pick === 1 || (prevPick && prevPick.player)
    const isActive =
      draftActive &&
      !pick.player &&
      pick.pick &&
      (isDraftWindowOpen({ start: league.ddate, pickNum: pick.pick }) ||
        isPreviousSelectionMade)
    pickItems.push(
      <DraftPick
        key={pick.uid}
        pick={pick}
        playerId={pick.player}
        tid={pick.tid}
        isActive={isActive}
      />
    )
  }

  const p = selectedPlayer
  const isDrafted = drafted.includes(p.player)
  const selected = (
    <div className='draft__selected'>
      <div className='draft__selected-head'>
        <div className='draft__selected-title'>
          {p.fname} {p.lname}
        </div>
        <div className='draft__selected-alt'>
          <div>
            <Position pos={p.pos} />
          </div>
          <div>{p.team}</div>
          {!!p.jersey && <div>#{p.jersey}</div>}
        </div>
        {draftActive && onTheClock && !isDrafted && (
          <div className='draft__selected-action'>
            <Button onClick={this.handleDraft}>Draft</Button>
          </div>
        )}
      </div>
      <div className='draft__selected-body'>
        <div>
          <label>Drafted</label>
          {p.dpos ? `#${p.dpos}` : '-'}
        </div>
        <div>
          <label>Proj.</label>
          {Math.round(p.points.getIn(['0', 'total'], 0))}
        </div>
        <div>
          <label>Age</label>
          {p.dob ? <PlayerAge date={p.dob} /> : '-'}
        </div>
        <div>
          <label>Height</label>
          {Math.floor(p.height / 12)}-{p.height % 12}
        </div>
        <div>
          <label>Weight</label>
          {p.weight || '-'}
        </div>
        <div>
          <label>Forty</label>
          {p.forty || '-'}
        </div>
        <div>
          <label>Bench</label>
          {p.bench || '-'}
        </div>
        <div>
          <label>Vertical</label>
          {p.vertical || '-'}
        </div>
        <div>
          <label>Broad</label>
          {p.broad || '-'}
        </div>
        <div>
          <label>Shuttle</label>
          {p.shuttle || '-'}
        </div>
        <div>
          <label>Cone</label>
          {p.cone || '-'}
        </div>
        <div>
          <label>Arm</label>
          {p.arm || '-'}
        </div>
        <div>
          <label>Hand</label>
          {p.hand || '-'}
        </div>
        <div>
          <label>College</label>
          {p.college || '-'}
        </div>
        <div>
          <label>Division</label>
          {p.college_division}
        </div>
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
        <div className='draft__side-top'>{draftInfo}</div>
        <div className='draft__side-main'>{pickItems}</div>
      </div>
    </div>
  )

  return <PageLayout body={body} />
}
