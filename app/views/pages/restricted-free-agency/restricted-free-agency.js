import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'

import Loading from '@components/loading'
import RestrictedFreeAgencyAuction from '@components/restricted-free-agency-auction'
import PageLayout from '@layouts/page'
import { current_season } from '#constants'

import './restricted-free-agency.styl'

// Restricted free agency bidding began in 2021, so there is nothing earlier to
// offer and an empty year in the picker reads as a data gap.
const FIRST_RESTRICTED_FREE_AGENCY_YEAR = 2021

export default function RestrictedFreeAgencyPage({
  load_restricted_free_agency_auctions,
  select_restricted_free_agency_year,
  auctions,
  year,
  is_pending
}) {
  const { lid, season_year } = useParams()
  const navigate = useNavigate()

  // The URL owns the season, so a link to one is shareable and the back button
  // steps through the selections rather than leaving the page. A bare path is
  // left alone rather than rewritten to the current year, which keeps such a
  // link evergreen.
  useEffect(() => {
    if (!season_year) return

    const requested_year = Number(season_year)
    if (
      isNaN(requested_year) ||
      requested_year > current_season.year ||
      requested_year < FIRST_RESTRICTED_FREE_AGENCY_YEAR
    ) {
      return navigate(`/leagues/${lid}/restricted-free-agency`, {
        replace: true
      })
    }

    if (requested_year !== year) {
      select_restricted_free_agency_year(requested_year)
    }
  }, [lid, season_year, year, select_restricted_free_agency_year, navigate])

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    // Hold until the store has caught up to the URL, or a linked season fetches
    // the current one first and its own a moment later.
    if (season_year && Number(season_year) !== year) return

    load_restricted_free_agency_auctions({ leagueId: lid, year })
  }, [lid, year, season_year, load_restricted_free_agency_auctions, navigate])

  const years = []
  for (
    let season = current_season.year;
    season >= FIRST_RESTRICTED_FREE_AGENCY_YEAR;
    season--
  ) {
    years.push(season)
  }

  const handle_year_change = (event) =>
    navigate(`/leagues/${lid}/restricted-free-agency/${event.target.value}`)

  const auction_items = auctions.map((auction, index) => (
    <RestrictedFreeAgencyAuction key={index} auction={auction} />
  ))

  let auction_body
  if (is_pending) {
    auction_body = <Loading loading />
  } else if (!auctions.size) {
    auction_body = (
      <div className='restricted-free-agency__empty'>
        No completed restricted free agency auctions in {year}.
      </div>
    )
  } else {
    auction_body = auction_items
  }

  const body = (
    <div className='league-container restricted-free-agency-container'>
      <div className='restricted-free-agency__filter'>
        <FormControl size='small' variant='outlined'>
          <InputLabel id='restricted-free-agency-year-label'>Season</InputLabel>
          <Select
            labelId='restricted-free-agency-year-label'
            value={year}
            label='Season'
            onChange={handle_year_change}
          >
            {years.map((season) => (
              <MenuItem key={season} value={season}>
                {season}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>
      <div className='restricted-free-agency__body'>{auction_body}</div>
    </div>
  )

  return <PageLayout body={body} scroll />
}

RestrictedFreeAgencyPage.propTypes = {
  load_restricted_free_agency_auctions: PropTypes.func,
  select_restricted_free_agency_year: PropTypes.func,
  auctions: ImmutablePropTypes.list,
  year: PropTypes.number,
  is_pending: PropTypes.bool
}
