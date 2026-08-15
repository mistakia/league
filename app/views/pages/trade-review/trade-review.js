import React, { useEffect } from 'react'
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
      return navigate(`/leagues/${lid}/trade-review`, { replace: true })
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

  const go_to_trade = (uid) => navigate(`/leagues/${lid}/trade-review/${uid}`)
  const go_to_list = () => navigate(`/leagues/${lid}/trade-review`)

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
        <TradeReviewTrade
          trade={trade}
          trade_uid={trade_uid}
          is_expanded
          is_failed={trade_is_failed}
          on_toggle={go_to_list}
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
          on_toggle={go_to_trade}
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
