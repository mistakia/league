import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import Loading from '@components/loading'
import TradeReviewTrade from '@components/trade-review-trade'
import PageLayout from '@layouts/page'

import './trade-review.styl'

export default function TradeReviewPage({
  load_trade_review,
  load_trade_review_trade,
  trades,
  is_pending,
  is_failed,
  is_logged_in
}) {
  const { lid, trade_uid: trade_uid_param } = useParams()
  const navigate = useNavigate()
  const [expanded_trade_uid, set_expanded_trade_uid] = useState(
    trade_uid_param ? Number(trade_uid_param) : null
  )

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    load_trade_review({ leagueId: lid })
  }, [lid, load_trade_review, navigate])

  // The URL owns which trade is open, so a row can be linked to directly. A
  // deep link fetches its trade without waiting for the list, which is why the
  // chain fetch is keyed on the trade rather than on the list arriving.
  useEffect(() => {
    set_expanded_trade_uid(trade_uid_param ? Number(trade_uid_param) : null)
  }, [trade_uid_param])

  const expanded_trade = expanded_trade_uid
    ? trades.get(expanded_trade_uid)
    : null
  const expanded_has_chains = Boolean(
    expanded_trade && expanded_trade.get('has_chains')
  )
  const expanded_is_pending = Boolean(
    expanded_trade && expanded_trade.get('is_pending')
  )

  // has_chains is a dependency, not just a guard: the list response replaces
  // every trade entry, so a chain fetched before the list landed is dropped and
  // has to be asked for again.
  useEffect(() => {
    if (!expanded_trade_uid || isNaN(lid)) return
    if (expanded_has_chains || expanded_is_pending) return

    load_trade_review_trade({ leagueId: lid, trade_uid: expanded_trade_uid })
  }, [
    lid,
    expanded_trade_uid,
    expanded_has_chains,
    expanded_is_pending,
    load_trade_review_trade
  ])

  const handle_toggle = (trade_uid) => {
    if (trade_uid === expanded_trade_uid) {
      return navigate(`/leagues/${lid}/trade-review`)
    }
    navigate(`/leagues/${lid}/trade-review/${trade_uid}`)
  }

  let trade_body
  if (is_pending) {
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
    // Newest first: the list arrives oldest first, and the trade a reader came
    // to look at is almost always a recent one.
    trade_body = trades
      .reverse()
      .toArray()
      .map(([trade_uid, trade]) => (
        <TradeReviewTrade
          key={trade_uid}
          trade_uid={trade_uid}
          trade={trade}
          is_expanded={trade_uid === expanded_trade_uid}
          on_toggle={handle_toggle}
        />
      ))
  }

  const body = (
    <div className='league-container trade-review-container'>
      <div className='trade-review__intro'>
        Every accepted trade in league history. Figures are market value from
        the first team's view — positive means that team came out ahead, and the
        other side is the exact mirror. Expand a trade to follow every asset
        through later trades, pick conversions, extensions and releases.
      </div>
      <div className='trade-review__body'>{trade_body}</div>
    </div>
  )

  return <PageLayout body={body} scroll />
}

TradeReviewPage.propTypes = {
  load_trade_review: PropTypes.func,
  load_trade_review_trade: PropTypes.func,
  trades: ImmutablePropTypes.orderedMap,
  is_pending: PropTypes.bool,
  is_failed: PropTypes.bool,
  is_logged_in: PropTypes.bool
}
