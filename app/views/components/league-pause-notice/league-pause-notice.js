import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import Alert from '@mui/material/Alert'

import './league-pause-notice.styl'

// Registered here rather than assumed: plugin registration is global but the
// module that happens to have done it is an accident of the import graph, and
// a lazily-loaded route that never mounts leaves `fromNow` undefined.
dayjs.extend(relativeTime)

/**
 * The every-route banner shown while a league is paused.
 *
 * Renders on every route rather than inside the league routes, because a pause
 * blocks every write in the league and a member who navigates away should not
 * lose the explanation for why nothing they do lands.
 *
 * `paused_at` is the only pause field on the wire. The commissioner's free-text
 * reason is deliberately NOT here: `GET /leagues/:leagueId` mounts above the
 * blanket 401, so anything attached to the league record is readable by an
 * anonymous caller. The reason is served from the authenticated pause route,
 * which is where a member-only surface can fetch it.
 */
export default function LeaguePauseNotice({ paused_at }) {
  if (!paused_at) return null

  const paused_since = dayjs(paused_at)

  return (
    <div className='league-pause-notice'>
      <Alert severity='warning'>
        This league is paused. No roster moves, trades, waivers or draft picks
        can be made until a commissioner resumes it. Paused{' '}
        {paused_since.fromNow()} on{' '}
        {paused_since.format('dddd, MMMM D, h:mm a')}.
      </Alert>
    </div>
  )
}

LeaguePauseNotice.propTypes = {
  paused_at: PropTypes.oneOfType([PropTypes.string, PropTypes.object])
}
