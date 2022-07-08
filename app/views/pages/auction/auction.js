import React from 'react'
import PropTypes from 'prop-types'
import AutoSizer from 'react-virtualized/dist/es/AutoSizer'
import List from 'react-virtualized/dist/es/List'

import Switch from '@mui/material/Switch'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'

import PageLayout from '@layouts/page'
import SearchFilter from '@components/search-filter'
import AuctionTransaction from '@components/auction-transaction'
import AuctionPlayer from '@components/auction-player'
import AuctionTeam from '@components/auction-team'
import AuctionMainBid from '@components/auction-main-bid'
import AuctionTargets from '@components/auction-targets'
import AuctionTeamRosters from '@components/auction-team-rosters'
import AuctionPositionFilter from '@components/auction-position-filter'
import AuctionCommissionerControls from '@components/auction-commissioner-controls'

import './auction.styl'

const ROW_HEIGHT = 30

export default function AuctionPageRender() {
  const { players, transactions, tids, nominated_pid, isCommish, isHosted } =
    this.props

  const TransactionRow = ({ index, key, ...params }) => {
    const transaction = transactions.get(index)
    return (
      <AuctionTransaction key={key} transaction={transaction} {...params} />
    )
  }

  TransactionRow.propTypes = {
    index: PropTypes.number,
    key: PropTypes.number
  }

  const playerRow = ({ index, key, ...params }) => {
    const playerMap = players.get(index)
    return (
      <AuctionPlayer
        key={key}
        playerMap={playerMap}
        {...params}
        index={index}
      />
    )
  }

  const teamItems = []
  tids.forEach((tid, index) => {
    teamItems.push(<AuctionTeam key={index} tid={tid} />)
  })

  const body = (
    <div className='auction'>
      <div className='auction__players'>
        <div className='auction__players-header'>
          <SearchFilter
            search={this.props.search}
            value={this.props.searchValue}
          />
          <AuctionPositionFilter />
        </div>
        <div className='auction__players-body'>
          <AutoSizer>
            {({ height, width }) => (
              <List
                width={width}
                height={height}
                rowHeight={25}
                rowCount={players.size}
                rowRenderer={playerRow}
              />
            )}
          </AutoSizer>
        </div>
        <div className='auction__players-footer'>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  size='small'
                  checked={this.props.hideRostered}
                  onChange={this.props.toggleHideRostered}
                />
              }
              labelPlacement='start'
              label='Hide Rostered'
            />
          </FormGroup>
        </div>
      </div>
      <div className='auction__main'>
        <AuctionMainBid nominated_pid={nominated_pid} />
        <div className='auction__teams'>{teamItems}</div>
        <div className='auction__main-board'>
          <AuctionTargets />
        </div>
      </div>
      <div className='auction__side'>
        <AuctionTeamRosters />
        <div className='auction__log'>
          <AutoSizer>
            {({ height, width }) => (
              <List
                width={width}
                height={height}
                rowHeight={ROW_HEIGHT}
                rowCount={transactions.size}
                rowRenderer={TransactionRow}
              />
            )}
          </AutoSizer>
        </div>
      </div>
      {isCommish && isHosted ? <AuctionCommissionerControls /> : null}
    </div>
  )

  return <PageLayout body={body} />
}
