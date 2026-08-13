import React, { useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import AutoSizer from 'react-virtualized-compat/dist/es/AutoSizer'
import List from 'react-virtualized-compat/dist/es/List'

import Button from '@components/button'
import PageLayout from '@layouts/page'
import DraftPlayer from '@components/draft-player'
import PlayerAge from '@components/player-age'
import DraftPick from '@components/draft-pick'
import Position from '@components/position'

import 'react-virtualized-compat/styles.css'
import './draft.styl'
import {
  current_season,
  default_points_added,
  fantasy_positions
} from '@constants'
import get_draft_window_config from '@libs-shared/get-draft-window-config.mjs'
import {
  is_within_daily_window,
  get_next_daily_window_entry
} from '@libs-shared'

dayjs.extend(relativeTime)

export default function DraftPage({
  windowEnd,
  players,
  nextPick,
  picks,
  league,
  selectedPlayerMap,
  drafted,
  isDraftWindowOpen,
  teamId,
  showConfirmation,
  draft_player,
  load_draft,
  load_all_players,
  load_league,
  load_teams,
  is_draft_complete,
  is_paused,
  draft_clock_now
}) {
  const { lid } = useParams()
  const scroll_to_pick = () => {
    const element = document.querySelector(
      '.draft__side-main .draft__pick.active'
    )
    if (element)
      element.scrollIntoView({ behavior: 'smooth', inline: 'center' })
  }

  useEffect(() => {
    load_draft()
    load_all_players()
    load_league()
    load_teams(lid)
  }, [load_draft, load_all_players, load_league, load_teams, lid])

  useEffect(() => {
    scroll_to_pick()
  }, [nextPick])

  const handleDraft = () => {
    showConfirmation({
      title: 'Draft Selection',
      description: `Select ${selectedPlayerMap.get('first_name')} ${selectedPlayerMap.get('last_name')} (${selectedPlayerMap.get('primary_position')}) with the #${nextPick.pick} pick in the ${current_season.year} draft.`,
      on_confirm_func: draft_player
    })
  }
  const positions = fantasy_positions

  const draftActive =
    league.draft_start &&
    draft_clock_now.isAfter(dayjs(league.draft_start).startOf('day'))

  const picksSorted = picks.sort((a, b) => a.round - b.round || a.pick - b.pick)
  // previous pick might not be pick - 1 if it belonged to a commissioned team
  const next_pick_index = nextPick
    ? picksSorted.findIndex((p) => p.pick === nextPick.pick)
    : null
  const prev_pick = nextPick ? picksSorted.get(next_pick_index - 1) : null
  const isPreviousSelectionMade =
    Boolean(nextPick && nextPick.pick === 1) ||
    Boolean(prev_pick && prev_pick.pid)
  // Both arms are refused by the server's 423 while paused — the jump arm
  // (`isDraftWindowOpen`) and the in-sequence arm, which is time-independent
  // and so would otherwise stay live for the whole pause.
  const onTheClock =
    league.draft_start &&
    nextPick &&
    !is_paused &&
    (isDraftWindowOpen || isPreviousSelectionMade)

  let draftInfo
  if (league.draft_start) {
    const start = dayjs(league.draft_start).startOf('day')
    if (draft_clock_now.isBefore(start)) {
      draftInfo = (
        <div className='draft__side-top-pick'>
          Draft begins {draft_clock_now.to(start)}
        </div>
      )
    } else if (nextPick) {
      // Mirrors the gate rather than the window moment alone. A pick whose
      // window moment has passed while the clock sits outside the daily band
      // is NOT on the clock, and reading `isBefore(draftWindow)` here put the
      // countdown beside a hidden draft button in exactly that state.
      if (!isPreviousSelectionMade && !isDraftWindowOpen) {
        // `draftWindow` is already in the past in the outside-the-band case,
        // so the honest target is the next time the band opens.
        const window_opens_at = draft_clock_now.isBefore(nextPick.draftWindow)
          ? nextPick.draftWindow
          : get_next_daily_window_entry(
              draft_clock_now,
              get_draft_window_config(league)
            )
        draftInfo = (
          <div className='draft__side-top-pick'>
            <div className='draft__side-top-pick-title'>
              Next: Pick #{nextPick.pick} ({nextPick.pick_str})
            </div>
            <div>
              {is_paused
                ? 'Selection window opens when the league resumes'
                : `Selection window opens ${draft_clock_now.to(window_opens_at)}`}
            </div>
          </div>
        )
      } else {
        const isWindowClosed = draft_clock_now.isAfter(windowEnd)
        const hours = windowEnd.diff(draft_clock_now, 'hours')
        const mins = windowEnd.diff(draft_clock_now, 'minutes') % 60
        draftInfo = (
          <div className='draft__side-top-pick'>
            <div className='draft__side-top-pick-title'>
              Pick #{nextPick.pick} ({nextPick.pick_str})
            </div>
            {!isWindowClosed && (
              <div>
                Time Remaining: {hours}h {mins}m{is_paused ? ' (paused)' : ''}
              </div>
            )}
          </div>
        )
      }
    }
  } else {
    draftInfo = <div className='draft__side-top-pick'>Draft not scheduled</div>
  }

  const sorted = players.sort(
    (a, b) =>
      b.getIn(['pts_added', '0'], default_points_added) -
      a.getIn(['pts_added', '0'], default_points_added)
  )
  const allRow = ({ index, key, ...params }) => {
    const player_map = sorted.get(index)
    return (
      <DraftPlayer
        key={key}
        index={index}
        player_map={player_map}
        {...params}
      />
    )
  }

  const groups = {}
  for (const position of positions) {
    if (!groups[position]) groups[position] = []
    groups[position] = sorted.filter(
      (pMap) => pMap.get('primary_position') === position
    )
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
    const player_map = items[pos][index]
    return (
      <DraftPlayer
        key={key}
        index={index}
        player_map={player_map}
        {...params}
      />
    )
  }

  const pickItems = []

  let pick_index = 0
  for (const pick of picksSorted) {
    // previous pick might not be pick - 1 if it belonged to a commissioned team
    const prev_pick = picksSorted.get(pick_index - 1)
    const isPreviousSelectionMade =
      pick.pick === 1 || Boolean(prev_pick && prev_pick.pid)
    const is_user = pick.tid === teamId
    const is_active =
      draftActive &&
      !is_draft_complete &&
      !pick.pid &&
      Boolean(pick.pick) &&
      (isPreviousSelectionMade ||
        (draft_clock_now.isAfter(pick.draftWindow) &&
          is_within_daily_window(
            draft_clock_now,
            get_draft_window_config(league)
          )))

    const trade_count = pick.trade_count || 0

    pickItems.push(
      <DraftPick
        key={pick.uid}
        pick={pick}
        pid={pick.pid}
        tid={pick.tid}
        is_user={is_user}
        is_active={is_active}
        trade_count={trade_count}
        draft_clock_now={draft_clock_now}
      />
    )

    pick_index += 1
  }

  const p = selectedPlayerMap
  const playerHeight = p.get('height_inches')
  const formattedPlayerHeight = playerHeight
    ? `${Math.floor(playerHeight / 12)}-${playerHeight % 12}`
    : '-'
  const is_player_drafted = drafted.includes(p.get('pid'))
  const selected = (
    <div className='draft__selected'>
      <div className='draft__selected-head'>
        <div className='draft__selected-title'>
          {p.get('first_name')} {p.get('last_name')}
        </div>
        <div className='draft__selected-alt'>
          <div>
            <Position pos={p.get('primary_position')} />
          </div>
          <div>{p.get('team')}</div>
          {Boolean(p.get('jersey_number')) && (
            <div>#{p.get('jersey_number')}</div>
          )}
        </div>
        {draftActive && onTheClock && !is_player_drafted && (
          <div className='draft__selected-action'>
            <Button onClick={handleDraft}>Draft</Button>
          </div>
        )}
      </div>
      <div className='draft__selected-body'>
        <div>
          <label>Drafted</label>
          {p.get('draft_overall_pick')
            ? `#${p.get('draft_overall_pick')}`
            : '-'}
        </div>
        <div>
          <label>Proj.</label>
          {Math.round(p.getIn(['points', '0', 'total'], 0))}
        </div>
        <div>
          <label>Age</label>
          {p.get('date_of_birth') ? (
            <PlayerAge date={p.get('date_of_birth')} />
          ) : (
            '-'
          )}
        </div>
        <div>
          <label>Height</label>
          {formattedPlayerHeight}
        </div>
        <div>
          <label>Weight</label>
          {p.get('weight_pounds', '-')}
        </div>
        <div>
          <label>Forty</label>
          {p.get('forty_yard_dash_seconds', '-')}
        </div>
        <div>
          <label>Bench</label>
          {p.get('bench_press_reps', '-')}
        </div>
        <div>
          <label>Vertical</label>
          {p.get('vertical_jump_inches', '-')}
        </div>
        <div>
          <label>Broad</label>
          {p.get('broad_jump_inches', '-')}
        </div>
        <div>
          <label>Shuttle</label>
          {p.get('shuttle_run_seconds', '-')}
        </div>
        <div>
          <label>Cone</label>
          {p.get('three_cone_drill_seconds', '-')}
        </div>
        <div>
          <label>Arm</label>
          {p.get('arm_length_inches', '-')}
        </div>
        <div>
          <label>Hand</label>
          {p.get('hand_size_inches', '-')}
        </div>
        <div>
          <label>College</label>
          {p.get('college', '-')}
        </div>
        <div>
          <label>Division</label>
          {p.get('college_division', '-')}
        </div>
      </div>
    </div>
  )

  const body = (
    <div className='draft'>
      <div className='draft__side'>
        <div className='draft__side-main'>{pickItems}</div>
        <div className='draft__side-top'>{draftInfo}</div>
      </div>
      <div className='draft__main'>
        {p.get('pid') && selected}
        <div className='draft__main-board'>
          <div className='draft__main-board-pos overall'>
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
    </div>
  )

  return <PageLayout body={body} />
}

DraftPage.propTypes = {
  windowEnd: PropTypes.object,
  load_draft: PropTypes.func,
  draft_player: PropTypes.func,
  showConfirmation: PropTypes.func,
  selectedPlayerMap: ImmutablePropTypes.map,
  nextPick: PropTypes.object,
  load_all_players: PropTypes.func,
  load_league: PropTypes.func,
  load_teams: PropTypes.func,
  players: ImmutablePropTypes.list,
  picks: ImmutablePropTypes.list,
  league: PropTypes.object,
  drafted: ImmutablePropTypes.list,
  isDraftWindowOpen: PropTypes.bool,
  teamId: PropTypes.number,
  is_draft_complete: PropTypes.bool,
  is_paused: PropTypes.bool,
  draft_clock_now: PropTypes.object
}
