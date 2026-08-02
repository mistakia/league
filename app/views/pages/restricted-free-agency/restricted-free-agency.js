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
import { current_season } from '@constants'

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
  const { lid } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    load_restricted_free_agency_auctions({ leagueId: lid, year })
  }, [lid, year, load_restricted_free_agency_auctions, navigate])

  const years = []
  for (
    let season = current_season.year;
    season >= FIRST_RESTRICTED_FREE_AGENCY_YEAR;
    season--
  ) {
    years.push(season)
  }

  const handle_year_change = (event) =>
    select_restricted_free_agency_year(event.target.value)

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
