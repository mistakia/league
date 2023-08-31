import React from 'react'
import { Map } from 'immutable'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Switch from '@mui/material/Switch'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import AutoSizer from 'react-virtualized/dist/es/AutoSizer'
import List from 'react-virtualized/dist/es/List'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'

import NFLTeamBye from '@components/nfl-team-bye'
import PlayerWatchlistAction from '@components/player-watchlist-action'
import AuctionTargetHeader from '@components/auction-target-header'
import PlayerName from '@components/player-name'
import SearchFilter from '@components/search-filter'

import './auction-targets.styl'

export default function AuctionTargets({
  playersByPosition,
  lineupPlayerIds,
  rosteredPlayerIds,
  team,
  search,
  searchValue,
  watchlist,
  select,
  isNominating,
  players,
  muted,
  toggleMuted,
  nominated_pid,
  show_qb,
  show_rb,
  show_wr,
  show_te,
  show_k,
  show_dst
}) {
  const AuctionPlayerRow = ({ index, key, pos, style }) => {
    const playerMap = pos
      ? playersByPosition[pos].get(index, new Map())
      : players.get(index, new Map())
    const classNames = ['auction__targets-player']
    const pid = playerMap.get('pid')
    const rosterSlot = team.roster.get(pid)

    let isNominatable = false
    if (rosterSlot) classNames.push('signed')
    else if (rosteredPlayerIds.includes(pid)) {
      classNames.push('rostered')
    } else {
      isNominatable = true
    }

    if (nominated_pid === pid) classNames.push('nominated')

    if (watchlist.has(pid)) {
      classNames.push('watchlist')
    }

    if (lineupPlayerIds.includes(pid)) classNames.push('optimal')
    const salary = rosterSlot
      ? rosterSlot.value
      : playerMap.getIn(['market_salary', '0'], 0)

    return (
      <div {...{ key, style }}>
        <div className={classNames.join(' ')}>
          {isNominating && isNominatable && (
            <div className='auction__player-nominate'>
              <Tooltip title='Nominate'>
                <IconButton size='small' onClick={() => select(pid)}>
                  <AddIcon fontSize='small' />
                </IconButton>
              </Tooltip>
            </div>
          )}
          <PlayerName pid={pid} hidePosition />
          <PlayerWatchlistAction pid={pid} />
          <div className='auction__targets-player-bye'>
            <NFLTeamBye nfl_team={playerMap.get('team')} />
          </div>
          <div className='auction__targets-player-salary metric'>
            {salary ? `$${salary}` : ''}
          </div>
        </div>
      </div>
    )
  }

  AuctionPlayerRow.propTypes = {
    index: PropTypes.number,
    key: PropTypes.number,
    pos: PropTypes.string,
    style: PropTypes.object
  }

  return (
    <div className='auction__targets'>
      <div className='auction__targets-head'>
        <SearchFilter search={search} value={searchValue} />
        <FormGroup>
          <FormControlLabel
            control={
              <Switch size='small' checked={muted} onChange={toggleMuted} />
            }
            labelPlacement='top'
            label='Muted'
          />
        </FormGroup>
      </div>
      <div className='auction__targets-body'>
        <div className='auction__targets-column'>
          <AuctionTargetHeader />
          <div className='auction__targets-column-body'>
            <AutoSizer>
              {({ height, width }) => (
                <List
                  width={width}
                  height={height}
                  rowHeight={30}
                  rowCount={players.size}
                  rowRenderer={AuctionPlayerRow}
                />
              )}
            </AutoSizer>
          </div>
        </div>
        {show_qb && (
          <div className='auction__targets-column'>
            <AuctionTargetHeader pos='QB' />
            <div className='auction__targets-column-body'>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    width={width}
                    height={height}
                    rowHeight={30}
                    rowCount={playersByPosition.QB.size}
                    rowRenderer={(args) =>
                      AuctionPlayerRow({ pos: 'QB', ...args })
                    }
                  />
                )}
              </AutoSizer>
            </div>
          </div>
        )}
        {show_rb && (
          <div className='auction__targets-column'>
            <AuctionTargetHeader pos='RB' />
            <div className='auction__targets-column-body'>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    width={width}
                    height={height}
                    rowHeight={30}
                    rowCount={playersByPosition.RB.size}
                    rowRenderer={(args) =>
                      AuctionPlayerRow({ pos: 'RB', ...args })
                    }
                  />
                )}
              </AutoSizer>
            </div>
          </div>
        )}
        {show_wr && (
          <div className='auction__targets-column'>
            <AuctionTargetHeader pos='WR' />
            <div className='auction__targets-column-body'>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    width={width}
                    height={height}
                    rowHeight={30}
                    rowCount={playersByPosition.WR.size}
                    rowRenderer={(args) =>
                      AuctionPlayerRow({ pos: 'WR', ...args })
                    }
                  />
                )}
              </AutoSizer>
            </div>
          </div>
        )}
        {show_te && (
          <div className='auction__targets-column'>
            <AuctionTargetHeader pos='TE' />
            <div className='auction__targets-column-body'>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    width={width}
                    height={height}
                    rowHeight={30}
                    rowCount={playersByPosition.TE.size}
                    rowRenderer={(args) =>
                      AuctionPlayerRow({ pos: 'TE', ...args })
                    }
                  />
                )}
              </AutoSizer>
            </div>
          </div>
        )}
        {show_k && (
          <div className='auction__targets-column'>
            <AuctionTargetHeader pos='K' />
            <div className='auction__targets-column-body'>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    width={width}
                    height={height}
                    rowHeight={30}
                    rowCount={playersByPosition.K.size}
                    rowRenderer={(args) =>
                      AuctionPlayerRow({ pos: 'K', ...args })
                    }
                  />
                )}
              </AutoSizer>
            </div>
          </div>
        )}
        {show_dst && (
          <div className='auction__targets-column'>
            <AuctionTargetHeader pos='DST' />
            <div className='auction__targets-column-body'>
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    width={width}
                    height={height}
                    rowHeight={30}
                    rowCount={playersByPosition.DST.size}
                    rowRenderer={(args) =>
                      AuctionPlayerRow({ pos: 'DST', ...args })
                    }
                  />
                )}
              </AutoSizer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

AuctionTargets.propTypes = {
  toggleMuted: PropTypes.func,
  playersByPosition: PropTypes.object,
  lineupPlayerIds: ImmutablePropTypes.list,
  rosteredPlayerIds: ImmutablePropTypes.list,
  team: PropTypes.object,
  muted: PropTypes.bool,
  search: PropTypes.func,
  searchValue: PropTypes.string,
  watchlist: ImmutablePropTypes.set,
  select: PropTypes.func,
  isNominating: PropTypes.bool,
  players: ImmutablePropTypes.list,
  nominated_pid: PropTypes.string,
  show_qb: PropTypes.bool,
  show_rb: PropTypes.bool,
  show_wr: PropTypes.bool,
  show_te: PropTypes.bool,
  show_k: PropTypes.bool,
  show_dst: PropTypes.bool
}
