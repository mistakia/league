import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'

import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'
import {
  restricted_free_agency_bid_outcome_display_names,
  restricted_free_agency_bid_outcome_descriptions
} from '@constants'

import './restricted-free-agency-auction.styl'

// Every label the reader sees is resolved here from the shared vocabulary. The
// database stores only codes -- the retired `reason` column stored English, and
// six seasons of it said 'player no longer a restricted free agent' about
// outbid, matched and tiebreak losses alike.
function BidOutcome({ outcome, outcome_detail }) {
  if (!outcome) return null

  const label =
    restricted_free_agency_bid_outcome_display_names[outcome] || outcome
  const description =
    outcome_detail || restricted_free_agency_bid_outcome_descriptions[outcome]

  return (
    <div
      className={`restricted-free-agency-auction__outcome ${outcome}`}
      title={description}
    >
      {label}
    </div>
  )
}

BidOutcome.propTypes = {
  outcome: PropTypes.string,
  outcome_detail: PropTypes.string
}

export default function RestrictedFreeAgencyAuction({ auction }) {
  const bids = auction.get('bids')
  const original_team_id = auction.get('original_team_id')
  const winning_bid_id = auction.get('winning_bid_id')
  const processed_at = auction.get('processed_at')
  // Teams are resolved for the auction's OWN season: a team renamed or
  // decommissioned since would otherwise render under its current identity.
  const season_year = auction.get('season_year')

  const winning_bid = bids.find((bid) => bid.get('uid') === winning_bid_id)

  const bid_rows = bids.map((bid, index) => {
    const releases = bid.get('releases')
    const is_winner = bid.get('uid') === winning_bid_id

    return (
      <div
        key={index}
        className={`restricted-free-agency-auction__bid ${
          is_winner ? 'winner' : ''
        }`}
      >
        <div className='restricted-free-agency-auction__bid-team'>
          <TeamName tid={bid.get('tid')} year={season_year} />
          {bid.get('tid') === original_team_id && (
            <span className='restricted-free-agency-auction__original-team'>
              Original Team
            </span>
          )}
        </div>
        <div className='restricted-free-agency-auction__bid-amount'>
          ${bid.get('bid')}
        </div>
        <BidOutcome
          outcome={bid.get('outcome')}
          outcome_detail={bid.get('outcome_detail')}
        />
        {Boolean(releases && releases.size) && (
          <div className='restricted-free-agency-auction__releases'>
            Conditional release:{' '}
            {releases.map((pid, release_index) => (
              <PlayerName key={release_index} pid={pid} />
            ))}
          </div>
        )}
      </div>
    )
  })

  return (
    <div className='restricted-free-agency-auction'>
      <div className='restricted-free-agency-auction__header'>
        <div className='restricted-free-agency-auction__player'>
          <PlayerName pid={auction.get('pid')} />
        </div>
        <div className='restricted-free-agency-auction__meta'>
          <div>
            Original team:{' '}
            <TeamName tid={original_team_id} year={season_year} />
          </div>
          {winning_bid ? (
            <div>
              Signed by{' '}
              <TeamName tid={winning_bid.get('tid')} year={season_year} /> for $
              {winning_bid.get('bid')}
            </div>
          ) : (
            // A resolved auction with no winning bid is a real outcome, not a
            // rendering gap: every bid failed and the player went unsigned.
            <div>No winning bid</div>
          )}
          {Boolean(processed_at) && (
            <div className='restricted-free-agency-auction__date'>
              {dayjs(processed_at).format('MMM D, YYYY')}
            </div>
          )}
        </div>
      </div>
      <div className='restricted-free-agency-auction__bids'>{bid_rows}</div>
    </div>
  )
}

RestrictedFreeAgencyAuction.propTypes = {
  auction: ImmutablePropTypes.map.isRequired
}
