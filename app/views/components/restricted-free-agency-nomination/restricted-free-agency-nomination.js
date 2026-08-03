import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'

import { get_restricted_free_agency_nomination_info } from '@libs-shared'
import PlayerName from '@components/player-name'
import { useClockSeconds, format_countdown } from '@core/utils'

import './restricted-free-agency-nomination.styl'

function teams_to_array(teams) {
  if (!teams || typeof teams.toJS !== 'function') return []
  return Object.values(teams.toJS()).map((team) => ({
    uid: team.uid,
    draft_order: team.draft_order
  }))
}

const format_deadline = (timestamp) =>
  dayjs.unix(timestamp).format('ddd MMM D, h:mm A')

/**
 * Whether the team on view still owes a nomination, and by when.
 *
 * Designating a nominee is buried in a rostered player's context menu, so
 * nothing about the obligation is discoverable from the pages a manager
 * actually opens — the only prior surface was an alert inside the last 48
 * hours, by which point the window may already be unrecoverable. This states
 * the obligation, the deadline, and the two steps that satisfy it.
 */
export default function RestrictedFreeAgencyNomination({
  league,
  teams,
  team_id,
  tid,
  restricted_free_agency_players
}) {
  const now = useClockSeconds(1000)
  const now_minute = Math.floor(now / 60)
  const subject_tid = tid || team_id
  const is_own_team = subject_tid === team_id

  const info = useMemo(() => {
    if (!league?.restricted_free_agency_period_start || !teams || !teams.size) {
      return null
    }

    try {
      return get_restricted_free_agency_nomination_info({
        league,
        teams: teams_to_array(teams),
        current_timestamp: now_minute * 60
      })
    } catch (error) {
      console.error('Error building RFA nomination status:', error)
      return null
    }
  }, [league, teams, now_minute])

  // A team's own pending tags are private to it, so another team's nominee and
  // candidate count are simply not in the store — say only what is knowable
  const { nominee, candidate_count } = useMemo(() => {
    if (!is_own_team || !restricted_free_agency_players) {
      return { nominee: null, candidate_count: 0 }
    }

    const held = restricted_free_agency_players.filter(
      (player_map) =>
        player_map.get('tid') === subject_tid &&
        !player_map.get('restricted_free_agency_tag_processed') &&
        !player_map.get('restricted_free_agency_tag_announced')
    )

    return {
      nominee:
        held.find((player_map) =>
          player_map.get('restricted_free_agency_tag_nominated')
        ) || null,
      candidate_count: held.size
    }
  }, [is_own_team, restricted_free_agency_players, subject_tid])

  if (!info || !info.schedule.length) return null

  const next_window = info.schedule.find(
    (entry) =>
      entry.nominating_team?.uid === subject_tid && entry.announce_at > now
  )

  if (!next_window) return null

  const seconds_remaining = next_window.announce_at - now
  const is_satisfied = Boolean(nominee)
  const status = is_satisfied ? 'set' : 'due'

  return (
    <div
      className={`restricted-free-agency-nomination rfa-nomination--${status}`}
    >
      <div className='rfa-nomination__header'>
        <div className='rfa-nomination__heading'>
          <div className='rfa-nomination__label'>
            {is_own_team ? 'Your next nomination' : 'Next nomination'}
          </div>
          <div className='rfa-nomination__headline'>
            {is_own_team
              ? is_satisfied
                ? 'Nominee designated'
                : 'Nomination needed'
              : 'Window opens'}
          </div>
        </div>
        <div className='rfa-nomination__countdown'>
          <div className='rfa-nomination__countdown-value'>
            {format_countdown(seconds_remaining)}
          </div>
          <div className='rfa-nomination__countdown-label'>
            until the window opens
          </div>
        </div>
      </div>

      {is_satisfied && (
        <div className='rfa-nomination__nominee'>
          <PlayerName pid={nominee.get('pid')} />
        </div>
      )}

      <div className='rfa-nomination__times'>
        <div className='rfa-nomination__time-block'>
          <span className='rfa-nomination__time-label'>Window opens</span>
          <span className='rfa-nomination__time'>
            {format_deadline(next_window.announce_at)}
          </span>
        </div>
        <div className='rfa-nomination__time-block'>
          <span className='rfa-nomination__time-label'>Bids close</span>
          <span className='rfa-nomination__time'>
            {format_deadline(next_window.bids_close_at)}
          </span>
        </div>
      </div>

      {is_own_team && !is_satisfied && (
        <div className='rfa-nomination__instructions'>
          {candidate_count > 0 ? (
            <>
              Open the player menu on one of your {candidate_count} restricted
              free agent tagged player
              {candidate_count === 1 ? '' : 's'} and choose{' '}
              <strong>Designate as Next RFA Nominee</strong>. Miss the deadline
              and the nomination passes to the next team.
            </>
          ) : (
            <>
              You hold no restricted free agent tags. Apply one from a rostered
              player's menu, then choose{' '}
              <strong>Designate as Next RFA Nominee</strong> on that player.
              Miss the deadline and the nomination passes to the next team.
            </>
          )}
        </div>
      )}

      {is_own_team && is_satisfied && (
        <div className='rfa-nomination__instructions'>
          This player is announced to the league when your window opens, and
          bids on them are processed at the close above.
        </div>
      )}
    </div>
  )
}

RestrictedFreeAgencyNomination.propTypes = {
  league: PropTypes.object,
  teams: ImmutablePropTypes.map,
  team_id: PropTypes.number,
  tid: PropTypes.number,
  restricted_free_agency_players: ImmutablePropTypes.map
}
