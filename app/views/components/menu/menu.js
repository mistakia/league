import React, { useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { NavLink, useLocation } from 'react-router-dom'
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

export default function Menu({ logout, isLoggedIn, team, leagueId }) {
  const location = useLocation()
  const [open, set_open] = useState(false)
  const [schedule_open, set_schedule_open] = useState(false)

  const isAuction = location.pathname === '/auction'
  const handleClose = () => set_open(false)
  const handleOpen = () => set_open(true)
  const toggleSchedule = () => set_schedule_open(!schedule_open)
  const handleClick = (path) => () => {
    handleClose()
    history.push(path)
  }

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
        <ListItem button onClick={toggleSchedule}>
          <ListItemText primary='League Schedule' />
          {schedule_open ? <ExpandLess /> : <ExpandMore />}
        </ListItem>
        <Collapse in={schedule_open} timeout='auto' unmountOnExit>
          <LeagueScheduleList />
        </Collapse>
      </>
    )
  } else {
    header = (
      <ListItem button onClick={handleClick('/login')}>
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
        sx={{ position: 'fixed', right: 16, bottom: isAuction ? 204 : 16 }}
        color='primary'
        variant='extended'
        className='main__menu-button'
        onClick={handleOpen}
      >
        <MenuIcon sx={{ mr: 1 }} />
        Menu
      </Fab>
      <div className='main__menu'>
        <AppBar color='transparent' elevation={0}>
          <Toolbar variant='dense'>
            {isLoggedIn && <LeagueSchedule />}
            {isLoggedIn && <NavLink to='/dashboard'>Roster</NavLink>}
            {isLoggedIn && constants.isRegularSeason && (
              <NavLink to='/lineups'>Lineup</NavLink>
            )}
            <NavLink to='/players'>Players</NavLink>
            {isLoggedIn && Boolean(constants.week) && (
              <NavLink to='/scoreboard'>Scoreboard</NavLink>
            )}
            {isLoggedIn && (
              <NavLink to={`/leagues/${leagueId}`}>League</NavLink>
            )}
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
          open={open}
          onOpen={handleOpen}
          onClose={handleClose}
          classes={{
            paper: 'main__menu-paper'
          }}
        >
          <List>{header}</List>
          <Divider />
          <List>
            {isLoggedIn && (
              <ListItem button onClick={handleClick('/dashboard')}>
                <ListItemText primary='Roster' />
              </ListItem>
            )}
            {isLoggedIn && (
              <ListItem button onClick={handleClick('/lineups')}>
                <ListItemText primary='Lineups' />
              </ListItem>
            )}
            <ListItem button onClick={handleClick('/players')}>
              <ListItemText primary='Players' />
            </ListItem>
            {isLoggedIn && (
              <ListItem button onClick={handleClick('/scoreboard')}>
                <ListItemText primary='Scoreboard' />
              </ListItem>
            )}
            {isLoggedIn && (
              <ListItem button onClick={handleClick('/trade')}>
                <ListItemText primary='Trade' />
              </ListItem>
            )}
            {isLoggedIn && !constants.week && (
              <ListItem button onClick={handleClick('/auction')}>
                <ListItemText primary='Auction' />
              </ListItem>
            )}
            {isLoggedIn && !constants.week && (
              <ListItem button onClick={handleClick('/draft')}>
                <ListItemText primary='Draft' />
              </ListItem>
            )}
          </List>
          {isLoggedIn && <Divider />}
          {isLoggedIn && (
            <List>
              <ListItem
                button
                onClick={handleClick(`/leagues/${leagueId}/teams`)}
              >
                <ListItemText primary='Team' />
              </ListItem>
              <ListItem
                button
                onClick={handleClick(`/leagues/${leagueId}/transactions`)}
              >
                <ListItemText primary='Transactions' />
              </ListItem>
              <ListItem
                button
                onClick={handleClick(`/leagues/${leagueId}/waivers`)}
              >
                <ListItemText primary='Waivers' />
              </ListItem>
              <ListItem
                button
                onClick={handleClick(`/leagues/${leagueId}/rosters`)}
              >
                <ListItemText primary='Rosters' />
              </ListItem>
              <ListItem
                button
                onClick={handleClick(`/leagues/${leagueId}/standings`)}
              >
                <ListItemText primary='Standings' />
              </ListItem>
              <ListItem
                button
                onClick={handleClick(`/leagues/${leagueId}/stats`)}
              >
                <ListItemText primary='Stats' />
              </ListItem>
              <ListItem
                button
                onClick={handleClick(`/leagues/${leagueId}/schedule`)}
              >
                <ListItemText primary='Schedule' />
              </ListItem>
            </List>
          )}
          <Divider />
          <List>
            <ListItem button onClick={handleClick('/settings')}>
              <ListItemText primary='Settings' />
            </ListItem>
            <ListItem button onClick={handleClick('/resources')}>
              <ListItemText primary='Resources' />
            </ListItem>
            <ListItem button onClick={handleClick('/glossary')}>
              <ListItemText primary='Glossary' />
            </ListItem>
          </List>
          <Divider />
          <List>
            <ListItem button onClick={logout}>
              <ListItemText primary='Logout' />
            </ListItem>
          </List>
        </SwipeableDrawer>
      </div>
    </>
  )
}

Menu.propTypes = {
  isLoggedIn: PropTypes.bool,
  leagueId: PropTypes.number,
  team: ImmutablePropTypes.record,
  logout: PropTypes.func
}
