import React from 'react'
import PropTypes from 'prop-types'

import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'
import Timestamp from '@components/timestamp'

import './transaction-row.styl'
import { transaction_types } from '@constants'

export default function TransactionRow({
  transaction,
  style,
  showPlayer,
  layout
}) {
  const is_draft_transaction = transaction.type === transaction_types.DRAFT

  // Determine layout version
  let use_wide_layout = false
  if (layout === 'wide') {
    use_wide_layout = true
  } else if (layout === 'narrow') {
    use_wide_layout = false
  }

  const transaction_type_content = (
    <>
      {transaction_types.transactionsDetail[transaction.type]}
      {is_draft_transaction && (
        <>
          {transaction.pick && (
            <span className='transaction__draft-pick'>#{transaction.pick}</span>
          )}
          {transaction.pick_str && (
            <span className='transaction__draft-pick'>
              {transaction.pick_str}
            </span>
          )}
        </>
      )}
    </>
  )

  if (use_wide_layout) {
    // WIDE LAYOUT: team | transaction type | player | position | time | salary
    return (
      <div className='transaction transaction--wide' style={style}>
        <div className='transaction__team'>
          <TeamName abbrv color image tid={transaction.tid} />
        </div>
        <div className='transaction__type'>{transaction_type_content}</div>
        {Boolean(showPlayer) && (
          <div className='transaction__player'>
            <PlayerName
              pid={transaction.pid}
              headshot_width={60}
              headshot_square
            />
          </div>
        )}
        <div className='transaction__timestamp'>
          <Timestamp timestamp={transaction.timestamp} />
        </div>
        <div className='transaction__value'>${transaction.value}</div>
      </div>
    )
  } else {
    // NARROW LAYOUT: Card with two rows
    return (
      <div className='transaction-row-wrapper--narrow' style={style}>
        <div className='transaction transaction--narrow'>
          <div className='transaction__header'>
            <div className='transaction__type'>{transaction_type_content}</div>
            <div className='transaction__timestamp'>
              <Timestamp timestamp={transaction.timestamp} />
            </div>
          </div>
          <div className='transaction__content'>
            <div className='transaction__team'>
              <TeamName abbrv color image tid={transaction.tid} />
            </div>
            {Boolean(showPlayer) && (
              <div className='transaction__player'>
                <PlayerName
                  pid={transaction.pid}
                  headshot_width={60}
                  headshot_square
                  hidePosition
                />
              </div>
            )}
            <div className='transaction__value'>${transaction.value}</div>
          </div>
        </div>
      </div>
    )
  }
}

TransactionRow.propTypes = {
  transaction: PropTypes.object,
  style: PropTypes.object,
  showPlayer: PropTypes.bool,
  layout: PropTypes.oneOf(['wide', 'narrow'])
}
