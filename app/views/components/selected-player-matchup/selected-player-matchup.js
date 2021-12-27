import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'

import { constants } from '@common'
import SelectedPlayerMatchupTable from '@components/selected-player-matchup-table'

import './selected-player-matchup.styl'

export default class SelectedPlayerMatchup extends React.Component {
  constructor(props) {
    super(props)

    const currentWeek = Math.max(constants.season.week, 1)
    this.state = {
      value: currentWeek
    }
  }

  handleChange = (event, value) => {
    this.setState({ value })
  }

  render = () => {
    const { player, games } = this.props
    const { value } = this.state

    if (!games.length) {
      return null
    }

    const labels = []
    for (const game of games) {
      const opp = player.team === game.h ? game.v : game.h
      const isHome = opp === game.v
      const label = (
        <>
          <div>{`W${game.wk}`}</div>
          <div>{`${isHome ? '' : '@'}${opp}`}</div>
        </>
      )
      labels.push(<Tab label={label} value={game.wk} />)
    }

    return (
      <div className='selected__player-matchup'>
        <Tabs
          value={value}
          onChange={this.handleChange}
          variant='scrollable'
          className='selected__player-matchup-tabs'
          orientation='horizontal'>
          {labels}
        </Tabs>
        <SelectedPlayerMatchupTable week={value} />
      </div>
    )
  }
}

SelectedPlayerMatchup.propTypes = {
  player: ImmutablePropTypes.record,
  games: PropTypes.array
}
