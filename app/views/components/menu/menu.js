import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { NavLink } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import MenuIcon from '@mui/icons-material/Menu'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import List from '@mui/material/List'
import Divider from '@mui/material/Divider'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import Avatar from '@mui/material/Avatar'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import Collapse from '@mui/material/Collapse'
import Fab from '@mui/material/Fab'

import LeagueSchedule from '@components/league-schedule'
import LeagueScheduleList from '@components/league-schedule-list'
import { constants } from '@common'
import { history } from '@core/store'

import './menu.styl'

export default class Menu extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      open: false,
      scheduleOpen: false
    }
  }

  handleClick = (path) => () => {
    this.handleClose()
    history.push(path)
  }

  handleClose = () => {
    this.setState({ open: false })
  }

  handleOpen = () => {
    this.setState({ open: true })
  }

  toggleSchedule = () => {
    this.setState({ scheduleOpen: !this.state.scheduleOpen })
  }

  render = () => {
    const { isLoggedIn, team } = this.props
    let header
    if (isLoggedIn) {
      header = (
        <>
          <ListItem alignItems='flex-start'>
            <ListItemAvatar>
              <Avatar alt={team.image} />
            </ListItemAvatar>
            <ListItemText primary={team.name} secondary='0-0' />
          </ListItem>
          <Divider />
          <ListItem button onClick={this.toggleSchedule}>
            <ListItemText primary='League Schedule' />
            {this.state.scheduleOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItem>
          <Collapse in={this.state.scheduleOpen} timeout='auto' unmountOnExit>
            <LeagueScheduleList />
          </Collapse>
        </>
      )
    } else {
      header = (
        <ListItem button onClick={this.handleClick('/login')}>
          <ListItemAvatar>
            <Avatar alt='' />
          </ListItemAvatar>
          <ListItemText primary='Login/Register' />
        </ListItem>
      )
    }

    return (
      <>
        <Fab
          color='primary'
          variant='extended'
          className='main__menu-button'
          onClick={this.handleOpen}
        >
          <MenuIcon sx={{ mr: 1 }} />
          Menu
        </Fab>
        <div className='main__menu'>
          <AppBar color='transparent' elevation={0}>
            <Toolbar variant='dense'>
              {isLoggedIn && <LeagueSchedule />}
              {isLoggedIn && <NavLink to='/dashboard'>Roster</NavLink>}
              {isLoggedIn && constants.season.isRegularSeason && (
                <NavLink to='/lineups'>Lineup</NavLink>
              )}
              <NavLink to='/players'>Players</NavLink>
              {isLoggedIn && Boolean(constants.week) && (
                <NavLink to='/scoreboard'>Scoreboard</NavLink>
              )}
              {isLoggedIn && <NavLink to='/league'>League</NavLink>}
              {isLoggedIn && <NavLink to='/trade'>Trade</NavLink>}
              {/* {isLoggedIn && constants.week > 0 && (
                  <NavLink to='/props'>Props</NavLink>
                  )} */}
              {isLoggedIn && !constants.week && (
                <NavLink to='/draft'>Draft</NavLink>
              )}
              {isLoggedIn && !constants.week && (
                <NavLink to='/auction'>Auction</NavLink>
              )}
              <NavLink to='/settings'>Settings</NavLink>
              <NavLink to='/resources'>Resources</NavLink>
              <NavLink to='/glossary'>Glossary</NavLink>
              {!isLoggedIn && <NavLink to='/login'>Login/Register</NavLink>}
            </Toolbar>
          </AppBar>
          <SwipeableDrawer
            anchor='left'
            open={this.state.open}
            onOpen={this.handleOpen}
            onClose={this.handleClose}
            classes={{
              paper: 'main__menu-paper'
            }}
          >
            <List>{header}</List>
            <Divider />
            <List>
              {isLoggedIn && (
                <ListItem button onClick={this.handleClick('/dashboard')}>
                  <ListItemText primary='Roster' />
                </ListItem>
              )}
              {isLoggedIn && (
                <ListItem button onClick={this.handleClick('/lineups')}>
                  <ListItemText primary='Lineups' />
                </ListItem>
              )}
              <ListItem button onClick={this.handleClick('/players')}>
                <ListItemText primary='Players' />
              </ListItem>
              {isLoggedIn && (
                <ListItem button onClick={this.handleClick('/scoreboard')}>
                  <ListItemText primary='Scoreboard' />
                </ListItem>
              )}
              {isLoggedIn && (
                <ListItem button onClick={this.handleClick('/trade')}>
                  <ListItemText primary='Trade' />
                </ListItem>
              )}
              {isLoggedIn && !constants.week && (
                <ListItem button onClick={this.handleClick('/auction')}>
                  <ListItemText primary='Auction' />
                </ListItem>
              )}
              {isLoggedIn && !constants.week && (
                <ListItem button onClick={this.handleClick('/draft')}>
                  <ListItemText primary='Draft' />
                </ListItem>
              )}
            </List>
            {isLoggedIn && <Divider />}
            {isLoggedIn && (
              <List>
                <ListItem
                  button
                  onClick={this.handleClick('/league/transactions')}
                >
                  <ListItemText primary='Transactions' />
                </ListItem>
                <ListItem button onClick={this.handleClick('/league/waivers')}>
                  <ListItemText primary='Waivers' />
                </ListItem>
                <ListItem button onClick={this.handleClick('/league/rosters')}>
                  <ListItemText primary='Rosters' />
                </ListItem>
                <ListItem
                  button
                  onClick={this.handleClick('/league/standings')}
                >
                  <ListItemText primary='Standings' />
                </ListItem>
                <ListItem button onClick={this.handleClick('/league/stats')}>
                  <ListItemText primary='Stats' />
                </ListItem>
                <ListItem button onClick={this.handleClick('/league/schedule')}>
                  <ListItemText primary='Schedule' />
                </ListItem>
              </List>
            )}
            <Divider />
            <List>
              <ListItem button onClick={this.handleClick('/settings')}>
                <ListItemText primary='Settings' />
              </ListItem>
              <ListItem button onClick={this.handleClick('/resources')}>
                <ListItemText primary='Resources' />
              </ListItem>
              <ListItem button onClick={this.handleClick('/glossary')}>
                <ListItemText primary='Glossary' />
              </ListItem>
            </List>
            <Divider />
            <List>
              <ListItem button onClick={this.props.logout}>
                <ListItemText primary='Logout' />
              </ListItem>
            </List>
          </SwipeableDrawer>
        </div>
      </>
    )
  }
}

Menu.propTypes = {
  isLoggedIn: PropTypes.bool,
  team: ImmutablePropTypes.record,
  logout: PropTypes.func
}
