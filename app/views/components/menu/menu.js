import React from 'react'
import { NavLink } from 'react-router-dom'
import AppBar from '@material-ui/core/AppBar'
import Toolbar from '@material-ui/core/Toolbar'
import IconButton from '@material-ui/core/IconButton'
import MenuIcon from '@material-ui/icons/Menu'
import SwipeableDrawer from '@material-ui/core/SwipeableDrawer'
import List from '@material-ui/core/List'
import Divider from '@material-ui/core/Divider'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import ListItemAvatar from '@material-ui/core/ListItemAvatar'
import Avatar from '@material-ui/core/Avatar'

import LeagueSchedule from '@components/league-schedule'
import { constants } from '@common'

import './menu.styl'

const week = constants.season.week

export default class Menu extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      open: false
    }
  }

  handleClick = (path) => () => {
    this.handleClose()
    this.props.history.push(path)
  }

  handleClose = () => {
    this.setState({ open: false })
  }

  handleOpen = () => {
    this.setState({ open: true })
  }

  render = () => {
    const { isLoggedIn, team } = this.props
    let header
    if (isLoggedIn) {
      header = (
        <ListItem alignItems='flex-start'>
          <ListItemAvatar>
            <Avatar alt={team.image} />
          </ListItemAvatar>
          <ListItemText primary={team.name} secondary='0-0' />
        </ListItem>
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
      <div className='main__menu'>
        <AppBar color='transparent' elevation={0}>
          <Toolbar variant='dense'>
            <IconButton
              edge='start'
              className='main__menu-button'
              color='inherit'
              aria-label='menu'
              onClick={this.handleOpen}>
              <MenuIcon />
            </IconButton>
            <LeagueSchedule />
            {isLoggedIn && <NavLink to='/dashboard'>Roster</NavLink>}
            {isLoggedIn &&
              constants.season.week < constants.season.finalWeek && (
                <NavLink to='/lineups'>Lineup</NavLink>
              )}
            <NavLink to='/players'>Players</NavLink>
            {isLoggedIn && <NavLink to='/scoreboard'>Scoreboard</NavLink>}
            {isLoggedIn && <NavLink to='/league'>League</NavLink>}
            {isLoggedIn && <NavLink to='/trade'>Trade</NavLink>}
            {isLoggedIn && constants.season.week > 0 && (
              <NavLink to='/props'>Props</NavLink>
            )}
            {isLoggedIn && !week && <NavLink to='/draft'>Draft</NavLink>}
            {isLoggedIn && !week && <NavLink to='/auction'>Auction</NavLink>}
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
          onClose={this.handleClose}>
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
            {isLoggedIn && !week && (
              <ListItem button onClick={this.handleClick('/auction')}>
                <ListItemText primary='Auction' />
              </ListItem>
            )}
            {isLoggedIn && !week && (
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
                onClick={this.handleClick('/league/transactions')}>
                <ListItemText primary='Transactions' />
              </ListItem>
              <ListItem button onClick={this.handleClick('/league/waivers')}>
                <ListItemText primary='Waivers' />
              </ListItem>
              <ListItem button onClick={this.handleClick('/league/rosters')}>
                <ListItemText primary='Rosters' />
              </ListItem>
              <ListItem button onClick={this.handleClick('/league/standings')}>
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
        </SwipeableDrawer>
      </div>
    )
  }
}
