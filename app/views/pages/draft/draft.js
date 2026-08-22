import React, { useEffect, useState } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import AutoSizer from 'react-virtualized-compat/dist/es/AutoSizer'
import List from 'react-virtualized-compat/dist/es/List'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'

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
} from '#constants'
import get_draft_window_config from '#libs-shared/get-draft-window-config.mjs'
import { get_next_publication_boundary } from '#libs-shared'

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
  const [player_filter, set_player_filter] = useState('')
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
  const position_boards = [
    { pos: 'QB', title: 'Quarterbacks' },
    { pos: 'RB', title: 'Running Backs' },
    { pos: 'WR', title: 'Wide Receivers' },
    { pos: 'TE', title: 'Tight ends' }
  ]
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
        // Three states, and the null one is new. A resume voids the standing
        // publication, so between a resume and the next boundary EVERY pick's
        // window is null and nobody can be passed -- which is a real fact
        // about the board, not a missing value, so it gets its own sentence
        // naming when the next slate publishes.
        const next_slate_at = get_next_publication_boundary({
          until: draft_clock_now,
          ...get_draft_window_config(league)
        })
        draftInfo = (
          <div className='draft__side-top-pick'>
            <div className='draft__side-top-pick-title'>
              Next: Pick #{nextPick.pick} ({nextPick.pick_string})
            </div>
            <div>
              {is_paused
                ? 'Selection windows resume when the league resumes'
                : nextPick.draftWindow
                  ? `Can be passed ${draft_clock_now.to(nextPick.draftWindow)}`
                  : `No published schedule — the next slate publishes ${draft_clock_now.to(next_slate_at)}`}
            </div>
          </div>
        )
      } else {
        // `windowEnd` is when the SECOND outstanding pick's slot opens, which
        // is the first moment anybody else may pass this one. Null while no
        // slate is published, and on a board with one pick left, since nobody
        // can pass the last pick.
        const isWindowClosed = windowEnd && draft_clock_now.isAfter(windowEnd)
        const hours = windowEnd ? windowEnd.diff(draft_clock_now, 'hours') : 0
        const mins = windowEnd
          ? windowEnd.diff(draft_clock_now, 'minutes') % 60
          : 0
        draftInfo = (
          <div className='draft__side-top-pick'>
            <div className='draft__side-top-pick-title'>
              Pick #{nextPick.pick} ({nextPick.pick_string})
            </div>
            {!windowEnd && <div>Cannot be passed yet</div>}
            {windowEnd && !isWindowClosed && (
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

  // Every token has to land somewhere, so "hunter col" narrows rather than
  // widens. Substring rather than the app's `fuzzy_search`, which is a
  // subsequence test and on a 400-player board matches almost everything a
  // short query could be.
  const filter_tokens = player_filter
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const is_filtered = filter_tokens.length > 0
  const matches_filter = (player_map) => {
    if (!is_filtered) return true
    const haystack = [
      player_map.get('name') || '',
      player_map.get('short_name') || '',
      player_map.get('team') || '',
      player_map.get('primary_position') || '',
      player_map.get('college') || ''
    ]
      .join(' ')
      .toLowerCase()
    return filter_tokens.every((token) => haystack.includes(token))
  }

  // Rank comes from the unfiltered board, so the number beside a name means
  // the same thing whether or not a filter is applied.
  const to_ranked_rows = (player_maps) =>
    player_maps
      .map((player_map, rank) => ({ player_map, rank }))
      .filter(({ player_map }) => matches_filter(player_map))

  const overall_rows = to_ranked_rows(sorted).toArray()
  const allRow = ({ index, key, ...params }) => {
    const { player_map, rank } = overall_rows[index]
    return (
      <DraftPlayer key={key} index={rank} player_map={player_map} {...params} />
    )
  }

  const items = {}
  for (const position of positions) {
    items[position] = to_ranked_rows(
      sorted.filter((pMap) => pMap.get('primary_position') === position)
    ).toArray()
  }

  const positionRow = ({ index, key, pos, ...params }) => {
    const { player_map, rank } = items[pos][index]
    return (
      <DraftPlayer key={key} index={rank} player_map={player_map} {...params} />
    )
  }

  const player_filter_field = (
    <div className='draft__side-top-filter'>
      <TextField
        fullWidth
        size='small'
        variant='outlined'
        value={player_filter}
        onChange={(event) => set_player_filter(event.target.value)}
        placeholder='Filter by name, team, position or college'
        inputProps={{
          autoCapitalize: 'none',
          autoCorrect: 'off',
          autoComplete: 'off',
          spellCheck: 'false',
          'aria-label': 'Filter players'
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position='start'>
              <SearchIcon fontSize='small' />
            </InputAdornment>
          ),
          endAdornment: player_filter ? (
            <InputAdornment position='end'>
              <IconButton
                size='small'
                aria-label='Clear player filter'
                onClick={() => set_player_filter('')}
              >
                <ClearIcon fontSize='small' />
              </IconButton>
            </InputAdornment>
          ) : null
        }}
      />
    </div>
  )

  // A position group can be empty with no filter applied — a rookie class with
  // no tight ends is not a failed search.
  const empty_board_message = (
    <div className='draft__main-board-pos-empty'>
      {is_filtered ? 'No players match' : 'No players'}
    </div>
  )

  const pickItems = []

  let pick_index = 0
  let next_up_found = false
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
      // Every pick whose numeric predecessor is made is on the clock, not just
      // one -- on a board with a gap several are at once. Past those, a pick
      // is reachable only by jumping the stalled team ahead of it, which needs
      // its published slot to have passed. A null window is after nothing.
      (isPreviousSelectionMade || draft_clock_now.isAfter(pick.draftWindow))

    // The next pick to be on the clock is the first unmade pick past the ones
    // on the clock now; the rail labels that one with its scheduled window.
    const is_next_up =
      !is_active && !pick.pid && Boolean(pick.pick) && !next_up_found
    if (is_next_up) next_up_found = true

    const trade_count = pick.trade_count || 0

    pickItems.push(
      <DraftPick
        key={pick.draft_pick_id}
        pick={pick}
        pid={pick.pid}
        tid={pick.tid}
        is_user={is_user}
        is_active={is_active}
        is_next_up={is_next_up}
        trade_count={trade_count}
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
        <div className='draft__side-top'>
          {draftInfo}
          {player_filter_field}
        </div>
      </div>
      <div className='draft__main'>
        {p.get('pid') && selected}
        <div className='draft__main-board'>
          <div className='draft__main-board-pos overall'>
            <div className='draft__main-board-pos-head'>
              Overall
              {is_filtered && (
                <span className='draft__main-board-pos-count'>
                  {overall_rows.length}
                </span>
              )}
            </div>
            <div className='draft__main-board-pos-body'>
              {overall_rows.length === 0 ? (
                empty_board_message
              ) : (
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      width={width}
                      height={height}
                      rowHeight={25}
                      rowCount={overall_rows.length}
                      rowRenderer={allRow}
                    />
                  )}
                </AutoSizer>
              )}
            </div>
          </div>
          {position_boards.map(({ pos, title }) => (
            <div key={pos} className='draft__main-board-pos'>
              <div className='draft__main-board-pos-head'>
                {title}
                {is_filtered && (
                  <span className='draft__main-board-pos-count'>
                    {items[pos].length}
                  </span>
                )}
              </div>
              <div className='draft__main-board-pos-body'>
                {items[pos].length === 0 ? (
                  empty_board_message
                ) : (
                  <AutoSizer>
                    {({ height, width }) => (
                      <List
                        width={width}
                        height={height}
                        rowHeight={25}
                        rowCount={items[pos].length}
                        rowRenderer={(args) => positionRow({ pos, ...args })}
                      />
                    )}
                  </AutoSizer>
                )}
              </div>
            </div>
          ))}
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
