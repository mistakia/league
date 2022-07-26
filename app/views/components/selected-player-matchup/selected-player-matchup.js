import React from 'react'
import PropTypes from 'prop-types'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

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
    const { team, games } = this.props
    const { value } = this.state

    if (!games.length) {
      return null
    }

    const labels = []
    games.forEach((game, index) => {
      const opp = team === game.h ? game.v : game.h
      const isHome = opp === game.v
      const label = (
        <>
          <div>{`W${game.wk}`}</div>
          <div>{`${isHome ? '' : '@'}${opp}`}</div>
        </>
      )
      labels.push(<Tab key={index} label={label} value={game.wk} />)
    })

    return (
      <div className='selected__player-matchup'>
        <Tabs
          value={value}
          onChange={this.handleChange}
          variant='scrollable'
          className='selected__player-matchup-tabs'
          orientation='horizontal'
          indicatorColor='primary'
          textColor='inherit'
        >
          {labels}
        </Tabs>
        <SelectedPlayerMatchupTable week={value} />
      </div>
    )
  }
}

SelectedPlayerMatchup.propTypes = {
  team: PropTypes.string,
  games: PropTypes.array
}
