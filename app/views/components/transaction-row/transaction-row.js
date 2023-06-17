import React from 'react'
import PropTypes from 'prop-types'

import { constants } from '@libs-shared'
import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'
import Timestamp from '@components/timestamp'

import './transaction-row.styl'

const isSmall = () => window.innerWidth <= 600

export default class TransactionRow extends React.Component {
  constructor(props) {
    super(props)
    this.state = { small: isSmall() }
  }

  update = () => {
    this.setState({ small: isSmall() })
  }

  componentDidMount() {
    window.addEventListener('resize', this.update)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.update)
  }

  render = () => {
    const { transaction, style, showPlayer } = this.props

    if (this.state.small) {
      return (
        <div style={style}>
          <div className='transaction'>
            <div className='transaction__top'>
              <div className='transaction__type'>
                {constants.transactionsDetail[transaction.type]}
              </div>
              <div className='transaction__timestamp'>
                <Timestamp timestamp={transaction.timestamp} />
              </div>
            </div>
            <div className='transaction__body'>
              <div className='transaction__team'>
                <TeamName abbrv color image tid={transaction.tid} />
              </div>
              {Boolean(showPlayer) && (
                <div className='transaction__player'>
                  <PlayerName pid={transaction.pid} headshot_width={48} />
                </div>
              )}
              <div className='transaction__value'>${transaction.value}</div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={style}>
        <div className='transaction'>
          <div className='transaction__team'>
            <TeamName abbrv color image tid={transaction.tid} />
          </div>
          <div className='transaction__type'>
            {constants.transactionsDetail[transaction.type]}
          </div>
          {Boolean(showPlayer) && (
            <div className='transaction__player'>
              <PlayerName pid={transaction.pid} headshot_width={48} />
            </div>
          )}
          <div className='transaction__timestamp'>
            <Timestamp timestamp={transaction.timestamp} />
          </div>
          <div className='transaction__value'>${transaction.value}</div>
        </div>
      </div>
    )
  }
}

TransactionRow.propTypes = {
  style: PropTypes.object,
  transaction: PropTypes.object,
  showPlayer: PropTypes.bool
}
