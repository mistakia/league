import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { useDispatch, useSelector } from 'react-redux'
import { useMediaQuery, useTheme } from '@mui/material'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import RepeatIcon from '@mui/icons-material/Repeat'

import { draft_actions } from '@core/draft'
import TeamName from '@components/team-name'
import DraftPickItem from '@components/draft-pick-item'

import './draft-pick-sheet.styl'

export default function DraftPickSheet({ pick, isOpen, onClose }) {
  const dispatch = useDispatch()
  const theme = useTheme()
  const is_mobile = useMediaQuery(theme.breakpoints.down('md'))

  // Get data from Redux store
  const pick_details = useSelector((state) =>
    state.getIn(['draft', 'pick_details', pick?.uid])
  )
  const players_state = useSelector((state) => state.get('players'))
  const players_items = players_state.get('items')

  // Get the selected player for this pick
  const selected_player = pick?.pid ? players_items.get(pick.pid) : null

  // Load pick details when sheet opens
  useEffect(() => {
    if (isOpen && pick && (!pick_details || !pick_details.get('loaded'))) {
      dispatch(draft_actions.load_draft_pick_details(pick.uid))
    }
  }, [isOpen, pick, pick_details, dispatch])

  if (!pick) return null

  // Render trade history timeline
  const render_trade_history = () => {
    if (!pick_details || !pick_details.get('loaded')) {
      return <div className='draft-pick-sheet-empty'>Loading...</div>
    }

    const trade_history = pick_details.get('trade_history')
    if (!trade_history || trade_history.size === 0) {
      return (
        <div className='draft-pick-sheet-empty'>No trades for this pick</div>
      )
    }

    // Build the ownership timeline
    const ownership_timeline = []

    // Start with the original team (who the pick was initially issued to)
    let current_owner = pick.otid

    if (current_owner) {
      ownership_timeline.push({
        type: 'original',
        tid: current_owner,
        date: null
      })
    }

    // Process trades in chronological order to track ownership changes
    const sorted_trades = trade_history.sortBy((trade) => trade.get('accepted'))

    sorted_trades.forEach((trade) => {
      const pick_recipient_tid = trade.get('pick_recipient_tid')
      const propose_tid = trade.get('propose_tid')
      const accept_tid = trade.get('accept_tid')
      const date = trade.get('accepted')

      // Determine who receives the pick in this trade
      // In a trade, one team sends the pick to the other
      // We need to figure out which team gets the pick
      let recipient_tid

      if (pick_recipient_tid) {
        // If we have explicit recipient info, use it
        recipient_tid = pick_recipient_tid
      } else {
        // Determine based on who currently owns the pick
        // The team that doesn't currently own it will receive it
        if (current_owner === propose_tid) {
          recipient_tid = accept_tid
        } else if (current_owner === accept_tid) {
          recipient_tid = propose_tid
        } else {
          // If current owner is neither, assume proposing team receives it
          recipient_tid = propose_tid
        }
      }

      // Add the trade showing who receives the pick
      ownership_timeline.push({
        type: 'trade',
        tid: recipient_tid,
        date,
        trade_uid: trade.get('uid')
      })

      // Update current owner
      current_owner = recipient_tid
    })

    // Mark the final owner (who used the pick) in the timeline
    if (pick.tid && ownership_timeline.length > 0) {
      const last_item = ownership_timeline[ownership_timeline.length - 1]
      if (last_item.tid === pick.tid) {
        last_item.is_current = true
      }
    }

    return (
      <div className='trade-history-timeline'>
        {ownership_timeline.map((item, index) => {
          const is_current = item.is_current || item.type === 'current'
          const item_class = `timeline-item${item.type === 'original' ? ' timeline-item--original' : ''}${is_current ? ' timeline-item--current' : ''}`

          if (item.type === 'original') {
            return (
              <div key={`original-${index}`} className={item_class}>
                <div className='timeline-marker' />
                <div className='timeline-content'>
                  <div className='timeline-label'>
                    {is_current ? 'Original Team (Used Pick)' : 'Original Team'}
                  </div>
                  <div className='timeline-team'>
                    <TeamName tid={item.tid} />
                  </div>
                </div>
              </div>
            )
          } else if (item.type === 'trade') {
            return (
              <div key={item.trade_uid} className={item_class}>
                <div className='timeline-connector' />
                <div className='timeline-marker'>
                  <RepeatIcon className='timeline-marker-icon' />
                </div>
                <div className='timeline-content'>
                  <div className='timeline-date'>
                    {new Date(item.date * 1000).toLocaleDateString()}
                  </div>
                  <div className='timeline-team'>
                    <TeamName tid={item.tid} />
                  </div>
                </div>
              </div>
            )
          }
          return null
        })}
      </div>
    )
  }

  // Render all picks (current + historical) at this position
  const render_all_picks = () => {
    if (!pick_details || !pick_details.get('loaded')) {
      return <div className='draft-pick-sheet-empty'>Loading...</div>
    }

    // Create current pick data
    const current_pick_item = (
      <DraftPickItem
        key={`${pick.year}-${pick.uid}`}
        player={selected_player}
        pick={pick}
        year={pick.year}
      />
    )

    const historical_picks = pick_details.get('historical_picks')
    if (!historical_picks || historical_picks.size === 0) {
      return (
        <div className='draft-pick-items-container'>{current_pick_item}</div>
      )
    }

    // Combine current pick with historical picks
    const historical_items = historical_picks
      .slice(0, 5)
      .map((historical_pick) => {
        const player = players_items.get(historical_pick.get('pid'))
        const pick_data = {
          ...historical_pick.toJS(),
          pick: historical_pick.get('pick'),
          pick_str: historical_pick.get('pick_str'),
          tid: historical_pick.get('tid')
        }
        return (
          <DraftPickItem
            key={`${historical_pick.get('year')}-${historical_pick.get('uid')}`}
            player={player}
            pick={pick_data}
            year={historical_pick.get('year')}
          />
        )
      })

    return (
      <div className='draft-pick-items-container'>
        {current_pick_item}
        {historical_items}
      </div>
    )
  }

  const drawer_width = is_mobile ? '100%' : 400
  const drawer_anchor = is_mobile ? 'bottom' : 'right'

  return (
    <Drawer
      anchor={drawer_anchor}
      open={isOpen}
      onClose={onClose}
      className='draft-pick-sheet'
      PaperProps={{
        sx: {
          width: drawer_width,
          height: is_mobile ? '85vh' : '100vh',
          maxHeight: is_mobile ? '85vh' : '100vh'
        }
      }}
      variant='temporary'
    >
      <IconButton
        onClick={onClose}
        size='small'
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 1)'
          }
        }}
      >
        <CloseIcon />
      </IconButton>

      <div className='draft-pick-sheet-body'>
        <div className='draft-pick-sheet-section'>
          <div className='draft-pick-sheet-section-title'>
            Pick History at Position #{pick.pick}
          </div>
          {render_all_picks()}
        </div>

        <div className='draft-pick-sheet-section'>
          <div className='draft-pick-sheet-section-title'>Trade History</div>
          {render_trade_history()}
        </div>
      </div>
    </Drawer>
  )
}

DraftPickSheet.propTypes = {
  pick: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
}
