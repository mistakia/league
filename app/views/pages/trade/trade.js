import React, { useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Grid from '@mui/material/Grid'

import TeamName from '@components/team-name'
import PageLayout from '@layouts/page'
import TradePlayer from '@components/trade-player'
import TradePick from '@components/trade-pick'
import TradeMenu from '@components/trade-menu'
import TradeSelectTeam from '@components/trade-select-team'
import TradeAction from '@components/trade-action'
import TradeSelectItems from '@components/trade-select-items'
import TradeTeamSummary from '@components/trade-team-summary'
import TradeSlotSelector from '@components/trade-slot-selector'

import {
  current_season,
  roster_slot_types,
  starting_lineup_slots
} from '@constants'
import {
  get_app,
  get_current_trade,
  get_current_trade_players,
  get_trade_is_valid,
  get_trade_validation_details,
  get_current_trade_analysis,
  get_proposing_team_players,
  get_accepting_team_players,
  get_accepting_team,
  get_proposing_team,
  get_proposing_team_roster
} from '@core/selectors'
import { trade_actions } from '@core/trade'
import { player_actions } from '@core/players'

import {
  extract_trade_item_ids,
  filter_available_release_players,
  get_roster_limit_message
} from './utils'

import './trade.styl'

function should_show_slot_selector(player_slot) {
  // Only show slot selector for non-active roster players
  if (
    player_slot === roster_slot_types.BENCH ||
    starting_lineup_slots.includes(player_slot)
  ) {
    return false
  }
  // Show for practice squad, reserve, etc.
  return true
}

function build_trade_items({
  player_ids,
  picks,
  slot_team_type,
  slot_is_editable,
  slot_read_only_note,
  players_map
}) {
  const items = []

  player_ids.forEach((pid) => {
    items.push(<TradePlayer key={pid} pid={pid} />)

    // Only render slot selector container if player has slot options
    const player_map = players_map?.get(pid)
    const player_slot = player_map?.get('slot')

    if (player_slot && should_show_slot_selector(player_slot)) {
      items.push(
        <div key={`slot-${pid}`} className='trade__slot-selector-inline'>
          <TradeSlotSelector
            pid={pid}
            team_type={slot_team_type}
            is_editable={slot_is_editable}
            read_only_note={slot_read_only_note}
          />
        </div>
      )
    }
  })

  picks.forEach((pick) => {
    if (pick && pick.uid) {
      items.push(<TradePick key={pick.uid} pick={pick} />)
    }
  })

  return items
}

function build_release_players_list(release_player_ids) {
  return release_player_ids.map((pid, index) => (
    <TradePlayer key={index} pid={pid} />
  ))
}

function build_release_section({
  team_name_tid,
  team_name_label,
  is_proposed,
  is_open,
  show_select_items,
  handle_release_change,
  selected_release_players,
  available_release_players,
  release_players_list
}) {
  return (
    <div className='trade__box'>
      <div className='trade__box-head'>
        <List component='nav'>
          <ListItem>
            <TeamName tid={team_name_tid} /> {team_name_label}
          </ListItem>
        </List>
      </div>
      <div className='trade__box-body'>
        {show_select_items && (
          <TradeSelectItems
            title='Select players to release'
            onChange={handle_release_change}
            selectedPlayers={selected_release_players}
            players={available_release_players}
          />
        )}
        {release_players_list}
      </div>
    </div>
  )
}

function build_trade_box({
  box_title_component,
  is_proposed,
  show_select_items,
  handle_change,
  selected_players,
  selected_picks,
  available_players,
  available_picks,
  trade_items
}) {
  return (
    <div className='trade__box'>
      <div className='trade__box-head'>{box_title_component}</div>
      <div className='trade__box-body'>
        {show_select_items && (
          <TradeSelectItems
            onChange={handle_change}
            selectedPlayers={selected_players}
            selectedPicks={selected_picks}
            players={available_players}
            picks={available_picks}
          />
        )}
        {trade_items}
      </div>
    </div>
  )
}

export default function TradePage() {
  const dispatch = useDispatch()

  const app = useSelector(get_app)
  const trade = useSelector(get_current_trade)
  const trade_players = useSelector(get_current_trade_players)
  const is_valid = useSelector(get_trade_is_valid)
  const validation_details = useSelector(get_trade_validation_details)
  const proposing_team = useSelector(get_proposing_team)
  const proposing_team_players = useSelector(get_proposing_team_players)
  const proposing_team_roster = useSelector(get_proposing_team_roster)
  const accepting_team = useSelector(get_accepting_team)
  const accepting_team_players = useSelector(get_accepting_team_players)
  const analysis = useSelector(get_current_trade_analysis)
  const players_map = useSelector((state) => state.get('players').get('items'))

  const is_proposer = trade.propose_tid === app.teamId
  const is_proposed = Boolean(trade.uid)
  const is_open =
    !trade.cancelled && !trade.rejected && !trade.accepted && !trade.vetoed

  useEffect(() => {
    dispatch(trade_actions.load())
    dispatch(player_actions.load_league_players())
  }, [dispatch])

  const handle_release_change = useCallback(
    (event, value) => {
      const player_ids = value.map((p) => p.id)
      dispatch(trade_actions.set_release_players(player_ids))
    },
    [dispatch]
  )

  const handle_propose_change = useCallback(
    (event, selected_items) => {
      const { player_ids, pick_ids } = extract_trade_item_ids(selected_items)
      dispatch(trade_actions.set_proposing_team_players(player_ids))
      dispatch(trade_actions.set_proposing_team_picks(pick_ids))
    },
    [dispatch]
  )

  const handle_accept_change = useCallback(
    (event, selected_items) => {
      const { player_ids, pick_ids } = extract_trade_item_ids(selected_items)
      dispatch(trade_actions.set_accepting_team_players(player_ids))
      dispatch(trade_actions.set_accepting_team_picks(pick_ids))
    },
    [dispatch]
  )

  const proposing_team_sends_items = build_trade_items({
    player_ids: trade.proposingTeamPlayers,
    picks: trade.proposingTeamPicks,
    slot_team_type: 'accepting',
    slot_is_editable: !is_proposed && is_open && !is_proposer,
    slot_read_only_note:
      is_proposed || !is_open || is_proposer
        ? 'Set by proposing team'
        : undefined,
    players_map
  })

  const accepting_team_sends_items = build_trade_items({
    player_ids: trade.acceptingTeamPlayers,
    picks: trade.acceptingTeamPicks,
    slot_team_type: 'proposing',
    slot_is_editable: !is_proposed,
    slot_read_only_note: is_proposed ? 'Trade already submitted' : undefined,
    players_map
  })

  const invalid_notice = (
    <Alert severity='warning'>
      <AlertTitle>Exceeds Roster Limits</AlertTitle>
      {get_roster_limit_message(validation_details)}
    </Alert>
  )

  const action_section = (
    <Grid item xs={12}>
      <div className='trade__action'>
        {is_valid && current_season.week < current_season.finalWeek && (
          <TradeAction />
        )}
        {is_open && !is_valid && invalid_notice}
      </div>
    </Grid>
  )

  const proposing_team_release_players_list = build_release_players_list(
    trade.proposingTeamReleasePlayers
  )

  const accepting_team_release_players_list = build_release_players_list(
    trade.acceptingTeamReleasePlayers
  )

  const all_available_players = is_proposer
    ? proposing_team_players.filter(
        (p) => !trade.proposingTeamPlayers.includes(p.pid)
      )
    : accepting_team_players.filter(
        (p) => !trade.acceptingTeamPlayers.includes(p.pid)
      )

  const available_release_players = filter_available_release_players({
    all_available_players,
    is_trade_valid: is_valid,
    validation_details
  })

  const show_proposing_team_release_section = Boolean(
    (is_proposer && !is_valid) || trade.proposingTeamReleasePlayers.size
  )

  const proposing_team_release_section = build_release_section({
    team_name_tid: trade.propose_tid || proposing_team_roster.tid,
    team_name_label: 'Releases',
    is_proposed,
    is_open,
    show_select_items: !is_proposed,
    handle_release_change,
    selected_release_players: trade_players.proposingTeamReleasePlayers,
    available_release_players,
    release_players_list: proposing_team_release_players_list
  })

  const show_accepting_team_release_section = Boolean(
    (!is_proposer && !is_valid) || trade.acceptingTeamReleasePlayers.size
  )

  const accepting_team_release_section = build_release_section({
    team_name_tid: trade.accept_tid || accepting_team.uid,
    team_name_label: 'Releases',
    is_proposed,
    is_open,
    show_select_items: is_open,
    handle_release_change,
    selected_release_players: trade_players.acceptingTeamReleasePlayers,
    available_release_players,
    release_players_list: accepting_team_release_players_list
  })

  const proposing_team_sends_box = build_trade_box({
    box_title_component: (
      <List component='nav'>
        <ListItem>
          <TeamName tid={trade.propose_tid || proposing_team_roster.tid} />{' '}
          Sends
        </ListItem>
      </List>
    ),
    is_proposed,
    show_select_items: !is_proposed,
    handle_change: handle_propose_change,
    selected_players: trade_players.proposingTeamPlayers,
    selected_picks: trade.proposingTeamPicks.toJS(),
    available_players: proposing_team_players,
    available_picks: proposing_team.picks,
    trade_items: proposing_team_sends_items
  })

  const accepting_team_sends_box = build_trade_box({
    box_title_component: <TradeSelectTeam />,
    is_proposed,
    show_select_items: !is_proposed,
    handle_change: handle_accept_change,
    selected_players: trade_players.acceptingTeamPlayers,
    selected_picks: trade.acceptingTeamPicks.toJS(),
    available_players: accepting_team_players,
    available_picks: accepting_team.picks,
    trade_items: accepting_team_sends_items
  })

  const body = (
    <div className='trade'>
      <TradeMenu />
      <div className='trade__main'>
        <Grid container>
          <Grid container item xs={12}>
            <Grid item xs={12} md={6} classes={{ root: 'trade__team-summary' }}>
              <TradeTeamSummary analysis={analysis.proposingTeam} />
            </Grid>
            <Grid item xs={12} md={6} classes={{ root: 'trade__team-summary' }}>
              <TradeTeamSummary analysis={analysis.acceptingTeam} />
            </Grid>
          </Grid>
          <Grid item xs={12} md={6}>
            {proposing_team_sends_box}
            {show_proposing_team_release_section &&
              proposing_team_release_section}
          </Grid>
          <Grid item xs={12} md={6}>
            {accepting_team_sends_box}
            {show_accepting_team_release_section &&
              accepting_team_release_section}
          </Grid>
          {action_section}
        </Grid>
      </div>
    </div>
  )

  return <PageLayout body={body} scroll />
}
