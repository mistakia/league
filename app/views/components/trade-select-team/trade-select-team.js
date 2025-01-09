import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import MenuItem from '@mui/material/MenuItem'
import Menu from '@mui/material/Menu'

import TeamName from '@components/team-name'

import './trade-select-team.styl'

export default class TradeSelectTeam extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      anchorEl: null
    }
  }

  handleOpen = (event) => {
    this.setState({ anchorEl: event.currentTarget })
  }

  handleClose = () => {
    this.setState({ anchorEl: null })
  }

  handleSelect = (value) => {
    this.props.select(value)
    this.setState({ anchorEl: null })
  }

  render = () => {
    const { teams, trade } = this.props
    const { anchorEl } = this.state

    const menuItems = teams.map((team, index) => (
      <MenuItem
        key={team.uid}
        selected={team.uid === trade.accept_tid}
        onClick={() => this.handleSelect(team.uid)}
      >
        {team.name}
      </MenuItem>
    ))

    return (
      <div>
        <List component='nav'>
          <ListItemButton
            button
            disabled={Boolean(trade.uid)}
            onClick={this.handleOpen}
          >
            <TeamName tid={trade.accept_tid} /> Sends
          </ListItemButton>
        </List>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={this.handleClose}
        >
          {menuItems}
        </Menu>
      </div>
    )
  }
}

TradeSelectTeam.propTypes = {
  select: PropTypes.func,
  teams: PropTypes.array,
  trade: ImmutablePropTypes.record
}
