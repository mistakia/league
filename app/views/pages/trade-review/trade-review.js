import React, { useEffect, useLayoutEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'

import Loading from '@components/loading'
import TradeReviewTrade from '@components/trade-review-trade'
import PageLayout from '@layouts/page'

import './trade-review.styl'

// The page scrolls its layout container, not the window, so a scroll position
// is read and written there rather than through window.scrollTo.
const get_scroll_container = () => document.querySelector('.page__body.scroll')

// Module-scoped on purpose: the page unmounts between the list and a single
// trade, so a ref or a piece of component state cannot carry the reader's place
// across the navigation. The list is long enough that returning to its top
// after reading one trade loses where they were, which is the whole point.
const list_scroll_position = { lid: null, top: 0 }

export default function TradeReviewPage({
  load_trade_review,
  load_trade_review_trade,
  trades,
  list_lid,
  is_pending,
  is_failed,
  is_logged_in
}) {
  const { lid, trade_uid: trade_uid_param } = useParams()
  const navigate = useNavigate()
  const trade_uid = trade_uid_param != null ? Number(trade_uid_param) : null
  const is_single_trade = trade_uid_param != null

  const trade = trade_uid != null ? trades.get(trade_uid) : null
  const trade_has_chains = Boolean(trade && trade.get('has_chains'))
  const trade_is_pending = Boolean(trade && trade.get('is_pending'))
  const trade_is_failed = Boolean(trade && trade.get('is_failed'))

  // navigate changes identity on every route match -- its own deps include the
  // matched path -- so an effect that listed it would re-run on every
  // navigation, so the redirect lives here alone and the loads below do not
  // depend on it.
  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }
    if (is_single_trade && isNaN(trade_uid)) {
      return navigate(`/leagues/${lid}/trades`, { replace: true })
    }
  }, [lid, is_single_trade, trade_uid, navigate])

  // The list page fetches the whole review, once per league. A single-trade
  // page fetches only its own trade and never the list, so a deep link does not
  // recompute the whole review just to show one trade.
  useEffect(() => {
    if (isNaN(lid)) return
    if (trade_uid_param != null) return
    if (list_lid === Number(lid)) return

    load_trade_review({ leagueId: lid })
  }, [lid, trade_uid_param, list_lid, load_trade_review])

  // The single trade comes with its lineage chains, so a full page load on a
  // trade URL needs just this. Navigating from the list re-fetches it to upgrade
  // the chainless list entry; has_chains and the pending/failed flags are what
  // stop that from repeating.
  useEffect(() => {
    if (isNaN(lid) || trade_uid == null) return
    if (trade_has_chains || trade_is_pending || trade_is_failed) return

    load_trade_review_trade({ leagueId: lid, trade_uid })
  }, [
    lid,
    trade_uid,
    trade_has_chains,
    trade_is_pending,
    trade_is_failed,
    load_trade_review_trade
  ])

  // The scroll container is shared by both views, so a trade opened from
  // halfway down the list would otherwise start halfway down its own page.
  useLayoutEffect(() => {
    if (!is_single_trade) return
    const container = get_scroll_container()
    if (container) container.scrollTop = 0
  }, [is_single_trade, trade_uid])

  // ...and coming back puts the reader where they left off. Keyed on the list
  // having rendered its trades, since a scroll offset cannot be applied to a
  // container that is still one spinner tall.
  useLayoutEffect(() => {
    if (is_single_trade) return
    if (list_scroll_position.lid !== Number(lid)) return
    if (!trades.size) return
    const container = get_scroll_container()
    if (container) container.scrollTop = list_scroll_position.top
  }, [is_single_trade, lid, trades.size])

  const go_to_trade = (uid) => {
    const container = get_scroll_container()
    list_scroll_position.lid = Number(lid)
    list_scroll_position.top = container ? container.scrollTop : 0
    navigate(`/leagues/${lid}/trades/${uid}`)
  }
  const go_to_list = () => navigate(`/leagues/${lid}/trades`)

  let trade_body
  if (is_single_trade) {
    if (trade == null) {
      trade_body = <Loading loading />
    } else if (trade_is_failed && !trade.get('perspectives').size) {
      trade_body = (
        <div className='trade-review__empty'>
          This trade could not be loaded.
        </div>
      )
    } else {
      trade_body = (
        // No on_open on the detail page: the card there is a document, not a
        // control, and the back link above it is the way out. A card that
        // navigated away from itself on a stray click would be a trap.
        <TradeReviewTrade
          trade={trade}
          trade_uid={trade_uid}
          league_id={lid}
          is_expanded
          is_failed={trade_is_failed}
        />
      )
    }
  } else if (is_pending) {
    trade_body = <Loading loading />
  } else if (is_failed) {
    // The route is member-only, so a refusal is the ordinary outcome for a
    // visitor who is not signed in. Reporting it as an empty league would tell
    // them something false about the league's history.
    trade_body = (
      <div className='trade-review__empty'>
        {is_logged_in
          ? 'Trade history could not be loaded.'
          : 'Trade history is only visible to league members. Sign in to view it.'}
      </div>
    )
  } else if (!trades.size) {
    trade_body = (
      <div className='trade-review__empty'>
        No accepted trades in this league.
      </div>
    )
  } else {
    // The map can hold a deep-linked trade that failed to load (an empty
    // perspective-less entry); a list page must not render that as a trade.
    // Newest first: the list arrives oldest first, and the trade a reader came
    // to look at is almost always a recent one.
    trade_body = trades
      .filter((trade_entry) => Boolean(trade_entry.get('perspectives').size))
      .reverse()
      .toArray()
      .map(([uid, trade_entry]) => (
        <TradeReviewTrade
          key={uid}
          trade_uid={uid}
          trade={trade_entry}
          league_id={lid}
          on_open={go_to_trade}
        />
      ))
  }

  const body = (
    <div className='league-container trade-review-container'>
      {is_single_trade && (
        <button
          type='button'
          className='trade-review__back'
          onClick={go_to_list}
        >
          <ChevronLeftIcon />
          Back to all trades
        </button>
      )}
      <div className='trade-review__body'>{trade_body}</div>
    </div>
  )

  return <PageLayout body={body} scroll />
}

TradeReviewPage.propTypes = {
  load_trade_review: PropTypes.func,
  load_trade_review_trade: PropTypes.func,
  trades: ImmutablePropTypes.orderedMap,
  list_lid: PropTypes.number,
  is_pending: PropTypes.bool,
  is_failed: PropTypes.bool,
  is_logged_in: PropTypes.bool
}
