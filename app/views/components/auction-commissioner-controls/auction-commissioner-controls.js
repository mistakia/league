import React from 'react'
import PropTypes from 'prop-types'

import './auction-commissioner-controls.styl'

/**
 * Pause, resume, and auto-pause, for the commissioner of a live auction.
 *
 * NO MATERIAL, AND NOT MERELY NO MATERIAL PAINT. This was a MUI SpeedDial with a
 * MUI Backdrop and two SpeedDialActions -- a blue circular FAB with a three-layer
 * elevation shadow and floating tooltip labels, none of which appears anywhere
 * else on this site. Restyling it was possible and was the wrong shape of fix:
 * the geometry that had to go (a 56px circle, a 40px action circle, a tooltip
 * that is really a label) is structural in those components, so overriding it
 * meant fighting three stylesheets to arrive at a rectangle. Three plain buttons
 * express it directly, and the package drops three imports off a repo that
 * ratchets @mui/material per package.
 *
 * IT IS THE SAME OBJECT AS THE NAV MENU BUTTON, sitting directly above it --
 * same paint, same 38px, same 3px radius, from prose_floating_action(). Two
 * floating controls a gap apart in one corner have to agree or they read as two
 * unrelated widgets that happened to land together, which is what a blue circle
 * over a graphite rectangle read as.
 */
export default class AuctionCommissionerControls extends React.Component {
  constructor(props) {
    super(props)

    this.state = { open: false }
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handle_key_down)
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handle_key_down)
  }

  // The SpeedDial closed on Escape and nothing else here would. It is a document
  // listener rather than a handler on the wrapper because the backdrop takes the
  // click but never the focus, so a keystroke after opening the stack does not
  // necessarily land inside it.
  handle_key_down = (event) => {
    if (event.key === 'Escape' && this.state.open) {
      this.setState({ open: false })
    }
  }

  handle_toggle = () => {
    this.setState(({ open }) => ({ open: !open }))
  }

  handle_close = () => {
    this.setState({ open: false })
  }

  // Every action closes the stack behind it, which is what SpeedDialAction did.
  // A commissioner who has just paused the auction wants to see the auction.
  handle_action = (action) => () => {
    action()
    this.handle_close()
  }

  render = () => {
    const { open } = this.state
    const {
      isPaused,
      auction_mode,
      pause_on_team_disconnect,
      pause,
      resume,
      toggle_pause_on_team_disconnect
    } = this.props

    // BOTH CONTROLS HERE DRIVE ONE SERVER METHOD, and that method refuses in
    // election mode -- there is no clock to stop, so pausing would only hide the
    // board from whoever is connected while elections kept settling over REST.
    // The refusal is the correct behavior and it belongs on the server, but a
    // button that silently does nothing is its own defect: a commissioner taps
    // Pause, the label does not flip, and the reasonable next move is to tap it
    // again. Naming the reason is what turns a dead control into an answer.
    const is_election_mode = auction_mode === 'election'

    return (
      <div className='auction__commissioner-controls'>
        {open && (
          <div
            className='commissioner-controls__backdrop'
            onClick={this.handle_close}
          />
        )}
        <div className='commissioner-controls__stack'>
          {open && (
            <div className='commissioner-controls__actions'>
              {is_election_mode ? (
                <div className='commissioner-controls__note'>
                  Election mode has no clock to pause. Pause the league to stop
                  it.
                </div>
              ) : (
                <>
                  <button
                    type='button'
                    className='commissioner-controls__action'
                    onClick={this.handle_action(isPaused ? resume : pause)}
                  >
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  {/* The label names the state this will PUT the auction in, not
                      the state it is in. The SpeedDial's tooltip said the same
                      thing; the difference is that a label under a thumb is read
                      before the tap rather than after it. */}
                  <button
                    type='button'
                    className='commissioner-controls__action'
                    onClick={this.handle_action(
                      toggle_pause_on_team_disconnect
                    )}
                  >
                    {pause_on_team_disconnect
                      ? 'Disable auto-pause'
                      : 'Enable auto-pause'}
                  </button>
                </>
              )}
            </div>
          )}
          <button
            type='button'
            className='commissioner-controls__toggle'
            aria-expanded={open}
            onClick={this.handle_toggle}
          >
            Commish
          </button>
        </div>
      </div>
    )
  }
}

AuctionCommissionerControls.propTypes = {
  pause: PropTypes.func,
  resume: PropTypes.func,
  isPaused: PropTypes.bool,
  auction_mode: PropTypes.string,
  toggle_pause_on_team_disconnect: PropTypes.func,
  pause_on_team_disconnect: PropTypes.bool
}
