import React, { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

import Button from '@components/button'
import {
  MINIMUM_CHECK_INTERVAL_MS,
  RECHECK_DELAYS_MS,
  dismiss_build,
  fetch_deployed_build,
  get_running_build,
  note_running_build,
  read_dismissed_build,
  should_invite_reload
} from '@core/stale-build'

import './stale-build-notice.styl'

/**
 * Invites a tab running a superseded bundle to reload. It never reloads one.
 *
 * THE PROBLEM THIS EXISTS FOR IS THAT RECONNECT WORKS TOO WELL. A deploy does a
 * pm2 reload, which drops every socket; the client reconnects on its own about
 * four seconds later and carries on executing the JavaScript it loaded hours
 * ago. Nothing in that sequence is a page load, so a manager can sit through
 * several deploys and never receive a fix that shipped for them specifically --
 * which is what happened during the League 1 free agency auction on 2026-09-03.
 *
 * NEVER AUTO-RELOADS, and that is the first requirement rather than a courtesy.
 * Managers are bidding real money against a clock on phones; a page that
 * reloads itself mid-bid is strictly worse than a stale bundle. The reload is
 * on a button, and the button is theirs to ignore.
 *
 * The surface is a small fixed chip in the top-right corner, chosen against the
 * two obvious alternatives:
 *
 *  - NOT a top banner in flow, like LeaguePauseNotice. That one is sticky and
 *    publishes --app-banner-height so every top-anchored surface moves down for
 *    it, which is right for a pause (every write in the league is blocked and
 *    the member must keep seeing why) and wrong here. Taking vertical space
 *    away from a board being read on a phone, to say something optional, is the
 *    definition of not subtle -- and it would fight the pause banner for the
 *    same slot and the same CSS property.
 *  - NOT a bottom toast. `.auction__main` is `position: fixed; bottom: 0` and
 *    page.styl reserves a band from --auction-controls-height for it. The bid
 *    bar owns the bottom of the screen during exactly the event this feature is
 *    for, and covering the bid bar to mention a bundle is indefensible.
 *
 * So: out of flow (moves nothing), top-right (the bid bar is bottom, the nav
 * drawer is left), and on its own z-index layer sitting ABOVE sticky table
 * headers so it is not buried and BELOW every dialog, popper and drawer so it
 * can never cover a control. `role='status'` with `aria-live='polite'`
 * announces it without taking focus, and nothing here is focused on mount.
 */
export default function StaleBuildNotice({ is_connected }) {
  const [deployed_build, set_deployed_build] = useState(null)
  const [dismissed_sha, set_dismissed_sha] = useState(() =>
    read_dismissed_build()
  )
  const last_check_at = useRef(0)
  const was_connected = useRef(is_connected)
  const is_mounted = useRef(true)

  useEffect(() => {
    is_mounted.current = true
    return () => {
      is_mounted.current = false
    }
  }, [])

  const check = useCallback(async ({ force = false } = {}) => {
    const now = Date.now()
    if (!force && now - last_check_at.current < MINIMUM_CHECK_INTERVAL_MS) {
      return
    }
    last_check_at.current = now

    const build = await fetch_deployed_build()
    if (!build || !is_mounted.current) return

    // The first usable read establishes the baseline and is therefore never
    // itself newer than the baseline. Every read is fed to both: which one it
    // turns out to be is `note_running_build`'s decision, not this one's.
    note_running_build(build)
    set_deployed_build(build)
  }, [])

  // Boot. Establishes the build this tab started on.
  useEffect(() => {
    check({ force: true })
  }, [check])

  // THE DEPLOY SIGNAL. `is_connected` going false -> true means the socket
  // actually dropped and came back, which is what a pm2 reload does to every
  // client in the league.
  //
  // Preferred over the WEBSOCKET_RECONNECTED action, which is very nearly the
  // same thing and not quite: `connect_auth` puts it on a deliberate sign-in
  // socket swap that dispatches no WEBSOCKET_CLOSE (app/core/ws/sagas.js). A
  // sign-in is not a deploy. The reducer transition is the narrower signal and
  // needs no new redux wiring to read.
  //
  // Armed as a bounded SCHEDULE rather than one immediate read, because the
  // reload precedes the new bundle by a full webpack build -- see
  // RECHECK_DELAYS_MS.
  useEffect(() => {
    const previously_connected = was_connected.current
    was_connected.current = is_connected
    if (!is_connected || previously_connected) return undefined

    const timer_ids = RECHECK_DELAYS_MS.map((delay) =>
      setTimeout(() => check({ force: true }), delay)
    )
    return () => timer_ids.forEach((id) => clearTimeout(id))
  }, [is_connected, check])

  // A manager coming back to a backgrounded tab. Throttled rather than forced:
  // this fires on every tab switch, and the answer cannot change faster than a
  // deploy.
  useEffect(() => {
    const on_visibility_change = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', on_visibility_change)
    return () =>
      document.removeEventListener('visibilitychange', on_visibility_change)
  }, [check])

  const on_dismiss = useCallback(() => {
    if (!deployed_build || !deployed_build.sha) return
    dismiss_build(deployed_build.sha)
    set_dismissed_sha(deployed_build.sha)
  }, [deployed_build])

  const on_reload = useCallback(() => {
    window.location.reload()
  }, [])

  const invite = should_invite_reload({
    running: get_running_build(),
    deployed: deployed_build,
    dismissed_sha
  })

  if (!invite) return null

  return (
    <div className='stale-build-notice' role='status' aria-live='polite'>
      <span className='stale-build-notice__message'>
        A newer version of this site is available.
      </span>
      <Button small className='stale-build-notice__reload' onClick={on_reload}>
        Reload
      </Button>
      <Button
        small
        text
        className='stale-build-notice__dismiss'
        label='Dismiss the update notice'
        onClick={on_dismiss}
      >
        Not now
      </Button>
    </div>
  )
}

StaleBuildNotice.propTypes = {
  is_connected: PropTypes.bool
}
