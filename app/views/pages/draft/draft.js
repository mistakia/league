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
import { constants } from '@common'

import './draft.styl'

dayjs.extend(relativeTime)

export default function DraftPage() {
  const {
    windowEnd,
    players,
    nextPick,
    picks,
    league,
    selectedPlayerMap,
    drafted,
    isDraftWindowOpen,
    teamId
  } = this.props
  const { positions } = constants

  const draftActive =
    league.draft_start &&
    dayjs().isAfter(dayjs.unix(league.draft_start).startOf('day'))
  const prevPick = picks.find(
    (p) => p.pick === (nextPick ? nextPick.pick - 1 : null)
  )
  const isPreviousSelectionMade =
    Boolean(nextPick && nextPick.pick === 1) ||
    Boolean(prevPick && prevPick.pid)
  const onTheClock =
    league.draft_start &&
    nextPick &&
    (isDraftWindowOpen || isPreviousSelectionMade)

  let draftInfo
  if (league.draft_start) {
    const start = dayjs.unix(league.draft_start).startOf('day')
    if (dayjs().isBefore(start)) {
      draftInfo = (
        <div className='draft__side-top-pick'>
          Draft begins {dayjs().to(start)}
        </div>
      )
    } else if (nextPick) {
      if (dayjs().isBefore(nextPick.draftWindow) && !isPreviousSelectionMade) {
        const pickNum = nextPick.pick % league.nteams || league.nteams
        draftInfo = (
          <div className='draft__side-top-pick'>
            <div className='draft__side-top-pick-title'>
              Next: Pick #{nextPick.pick} ({nextPick.round}.
              {('0' + pickNum).slice(-2)})
            </div>
            <div>Selection window opens {dayjs().to(nextPick.draftWindow)}</div>
          </div>
        )
      } else {
        const pickNum = nextPick.pick % league.nteams || league.nteams
        const now = dayjs()
        const isWindowClosed = now.isAfter(windowEnd)
        const hours = windowEnd.diff(now, 'hours')
        const mins = windowEnd.diff(now, 'minutes') % 60
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
    (a, b) => b.getIn(['vorp', '0'], -9999) - a.getIn(['vorp', '0'], -9999)
  )
  const allRow = ({ index, key, ...params }) => {
    const playerMap = sorted.get(index)
    return (
      <DraftPlayer key={key} index={index} playerMap={playerMap} {...params} />
    )
  }

  const groups = {}
  for (const position of positions) {
    if (!groups[position]) groups[position] = []
    groups[position] = sorted.filter((pMap) => pMap.get('pos') === position)
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
    const playerMap = items[pos][index]
    return (
      <DraftPlayer key={key} index={index} playerMap={playerMap} {...params} />
    )
  }

  const pickItems = []
  const picksSorted = picks.sort((a, b) => a.round - b.round || a.pick - b.pick)
  for (const pick of picksSorted) {
    const prevPick = picks.find((p) => p.pick === pick.pick - 1)
    const isPreviousSelectionMade =
      pick.pick === 1 || Boolean(prevPick && prevPick.pid)
    const isUser = pick.tid === teamId
    const isActive =
      draftActive &&
      !pick.pid &&
      Boolean(pick.pick) &&
      (constants.season.now.isAfter(pick.draftWindow) ||
        isPreviousSelectionMade)
    pickItems.push(
      <DraftPick
        key={pick.uid}
        pick={pick}
        pid={pick.pid}
        tid={pick.tid}
        isUser={isUser}
        isActive={isActive}
      />
    )
  }

  const p = selectedPlayerMap
  const playerHeight = p.get('height')
  const formattedPlayerHeight = playerHeight
    ? `${Math.floor(playerHeight / 12)}-${playerHeight % 12}`
    : '-'
  const isDrafted = drafted.includes(p.get('pid'))
  const selected = (
    <div className='draft__selected'>
      <div className='draft__selected-head'>
        <div className='draft__selected-title'>
          {p.get('fname')} {p.get('lname')}
        </div>
        <div className='draft__selected-alt'>
          <div>
            <Position pos={p.get('pos')} />
          </div>
          <div>{p.get('team')}</div>
          {Boolean(p.get('jnum')) && <div>#{p.get('jnum')}</div>}
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
          {p.get('dpos') ? `#${p.get('dpos')}` : '-'}
        </div>
        <div>
          <label>Proj.</label>
          {Math.round(p.getIn(['points', '0', 'total'], 0))}
        </div>
        <div>
          <label>Age</label>
          {p.get('dob') ? <PlayerAge date={p.get('dob')} /> : '-'}
        </div>
        <div>
          <label>Height</label>
          {formattedPlayerHeight}
        </div>
        <div>
          <label>Weight</label>
          {p.get('weight', '-')}
        </div>
        <div>
          <label>Forty</label>
          {p.get('forty', '-')}
        </div>
        <div>
          <label>Bench</label>
          {p.get('bench', '-')}
        </div>
        <div>
          <label>Vertical</label>
          {p.get('vertical', '-')}
        </div>
        <div>
          <label>Broad</label>
          {p.get('broad', '-')}
        </div>
        <div>
          <label>Shuttle</label>
          {p.get('shuttle', '-')}
        </div>
        <div>
          <label>Cone</label>
          {p.get('cone', '-')}
        </div>
        <div>
          <label>Arm</label>
          {p.get('arm', '-')}
        </div>
        <div>
          <label>Hand</label>
          {p.get('hand', '-')}
        </div>
        <div>
          <label>College</label>
          {p.get('col', '-')}
        </div>
        <div>
          <label>Division</label>
          {p.get('dv', '-')}
        </div>
      </div>
    </div>
  )

  const body = (
    <div className='draft'>
      <div className='draft__main'>
        {p.get('pid') && selected}
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
