import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import MenuItem from '@material-ui/core/MenuItem'
import Menu from '@material-ui/core/Menu'

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
    const { teams, teamId, trade } = this.props
    const { anchorEl } = this.state

    const menuItems = teams
      .filter((t) => t.uid !== teamId)
      .map((team, index) => (
        <MenuItem
          key={team.uid}
          selected={team.uid === trade.tid}
          onClick={() => this.handleSelect(team.uid)}
        >
          {team.name}
        </MenuItem>
      ))

    return (
      <div>
        <List component='nav'>
          <ListItem
            button
            disabled={Boolean(trade.uid)}
            onClick={this.handleOpen}
          >
            <TeamName tid={trade.tid} /> Sends
          </ListItem>
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
  teams: ImmutablePropTypes.list,
  teamId: PropTypes.number,
  trade: ImmutablePropTypes.record
}
