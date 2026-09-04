import React from 'react'
import PropTypes from 'prop-types'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'

import LeagueTeamsValueOverTime from '@components/league-teams-value-over-time'

import './league-header.styl'
import { roster_slot_types, starter_slot_league_columns } from '#constants'

export default function LeagueHeader({ league }) {
  const is_ppr_equal =
    league.tight_end_reception === league.running_back_reception &&
    league.tight_end_reception === league.wide_receiver_reception
  const isTEP =
    league.tight_end_reception !== league.running_back_reception ||
    league.tight_end_reception !== league.wide_receiver_reception
  const isHalfPPR = is_ppr_equal && league.receptions === 0.5
  const isFullPPR = is_ppr_equal && league.receptions === 1

  // TODO isSalaryCap
  // TODO is_hosted
  // TODO espn/sleeper/mfl
  // TODO isDynasty
  // TODO isRedraft

  const scoring_chips = []
  const starting_labels = [
    'qb',
    'rb',
    'wr',
    'te',
    'k',
    'dst',
    'rb/wr',
    'rb/wr/te',
    'qb/rb/wr/te'
  ]

  starting_labels.forEach((starting_label, index) => {
    const clean_label = starting_label.replaceAll('/', '')
    const slot_id = roster_slot_types[clean_label.toUpperCase()]
    const value = league[starter_slot_league_columns[slot_id]]
    if (!value) return
    scoring_chips.push(
      <Chip
        key={index}
        className={`starters ${clean_label}`}
        size='small'
        label={
          starting_label === 'qb/rb/wr/te'
            ? `SUPERFLEX`
            : `${value}${starting_label.toUpperCase()}`
        }
      />
    )
  })
  return (
    <div className='league__header'>
      <h1>{league.name}</h1>
      {/* The format is the league's identity, so it renders for members and
          strangers alike rather than only for the people who are not in it */}
      <Stack direction='row' spacing={1} className='league__chips'>
        {Boolean(league.number_teams) && (
          <Chip
            variant='outlined'
            size='small'
            label={`${league.number_teams} Teams`}
          />
        )}
        {isHalfPPR && <Chip size='small' label='Half PPR' />}
        {isFullPPR && <Chip size='small' label='Full PPR' />}
        {isTEP && <Chip size='small' label='TEP' />}
        {scoring_chips}
      </Stack>
      <div className='heading__section-title'>Team Market Value</div>
      <div className='league__gloss'>
        Each line follows one team&apos;s roster value in league dollars over
        time. The figure beside each team name is its value today.
      </div>
      <LeagueTeamsValueOverTime />
    </div>
  )
}

LeagueHeader.propTypes = {
  league: PropTypes.object
}
