import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'
import format_trade_asset_label from '@libs-shared/format-trade-asset-label.mjs'
import format_lineage_event, {
  terminated_by_labels,
  lineage_state_labels,
  lineage_state_descriptions
} from '@libs-shared/format-lineage-event.mjs'

import './trade-review-trade.styl'

const UNPRICED_EXPLANATION =
  'At least one asset in this trade has no market price on the trade date. KeepTradeCut deletes a draft class once its draft has passed, so pick prices before September 2023 are permanently unrecoverable. A figure computed from one side only would read as an even trade.'

const AT_TRADE_EXPLANATION =
  'KeepTradeCut value of everything this team received, priced on the day of the trade.'

// Deliberately phrased as the lineage rather than as this team's holdings. The
// engine sums every still-open holding descended from the traded asset, and it
// does not filter those to the receiving team -- an asset later traded onward
// still has an open holding somewhere. Saying "what this team still holds"
// would claim more than the number supports.
const TODAY_EXPLANATION =
  "Today's KeepTradeCut value of every still-open asset descended from what this team received. An asset whose whole line has been released, expired or converted is worth nothing."

const format_value = (value) => Math.round(value).toLocaleString()

const format_date = (value) => dayjs(value).format('MMM D, YYYY')

// A side's at-trade total is withheld whole when any one of its assets is
// unpriced -- the same rule the engine applies to the net figures, for the same
// reason: a partial sum reads as a real price.
const side_totals = (assets) => {
  const has_unpriced = assets.some(
    (asset) => asset.get('keeptradecut_value_at_trade') == null
  )
  return {
    at_trade: has_unpriced
      ? null
      : assets.reduce(
          (total, asset) => total + asset.get('keeptradecut_value_at_trade'),
          0
        ),
    today: assets.reduce(
      (total, asset) => total + asset.get('current_keeptradecut_value'),
      0
    )
  }
}

function AssetLabel({ asset }) {
  const player_id = asset.get('player_id')
  if (player_id) {
    return (
      // The player name opens the selected-player view, and the collapsed card
      // it sits in navigates to the trade on click. The stop keeps the two from
      // firing together, so selecting a player never also leaves the page. A
      // pick has no player view, so it is left to the card.
      <span onClick={(event) => event.stopPropagation()}>
        <PlayerName pid={player_id} hidePosition />
      </span>
    )
  }
  return (
    <span className='trade-review-trade__pick'>
      {format_trade_asset_label({
        player_id: null,
        pick_year: asset.get('pick_year'),
        pick_round: asset.get('pick_round'),
        pick_draft_overall_position: asset.get('pick_draft_overall_position')
      })}
    </span>
  )
}

AssetLabel.propTypes = {
  asset: ImmutablePropTypes.map.isRequired
}

// One holding the asset passed through. Depth 0 is the asset as it landed in
// this trade; every later row is what it turned into. A hop that was itself a
// trade links to that trade's own review, which is the whole reason a lineage
// is worth rendering as a chain rather than as an endpoint.
function ChainRow({ chain_row, is_origin, league_id, trade_uid }) {
  const period_end = chain_row.get('period_end')
  const terminated_by = chain_row.get('terminated_by')
  const weeks_started = chain_row.get('weeks_started')
  const weeks_active = chain_row.get('weeks_active')
  const weeks_practice_squad = chain_row.get('weeks_practice_squad')
  const salary_paid = chain_row.get('salary_paid')
  const realized = chain_row.get('realized_pts_added_net_through_termination')
  const projected_at_acquisition = chain_row.get(
    'projected_pts_added_at_acquisition'
  )
  const hop_trade_uid = chain_row.get('transformation_trade_uid')

  const event_label = is_origin
    ? 'Acquired in this trade'
    : format_lineage_event(chain_row.get('transformation_type'))

  return (
    <div className='trade-review-trade__chain-row'>
      <div className='trade-review-trade__chain-when'>
        {format_date(chain_row.get('period_start'))}
      </div>
      <div className='trade-review-trade__chain-body'>
        <div className='trade-review-trade__chain-headline'>
          <span className='trade-review-trade__chain-event'>
            {hop_trade_uid && hop_trade_uid !== trade_uid ? (
              <Link
                to={`/leagues/${league_id}/trade-review/${hop_trade_uid}`}
                onClick={(event) => event.stopPropagation()}
              >
                {event_label}
              </Link>
            ) : (
              event_label
            )}
          </span>
          <span className='trade-review-trade__chain-asset'>
            <AssetLabel asset={chain_row} />
          </span>
          <span className='trade-review-trade__chain-team'>
            <TeamName
              tid={chain_row.get('tid')}
              year={dayjs(chain_row.get('period_start')).year()}
              abbrv
            />
          </span>
          <span className='trade-review-trade__chain-outcome'>
            {period_end
              ? `${terminated_by_labels[terminated_by] || 'Ended'} — ${format_date(period_end)}`
              : 'Still held'}
          </span>
        </div>
        <div className='trade-review-trade__chain-stats'>
          {realized != null && (
            <span title='Points added over replacement while this team held the asset'>
              {Number(realized).toFixed(1)} pts added
            </span>
          )}
          {projected_at_acquisition != null && (
            <span title='Points added this asset was projected for at the moment it was acquired'>
              {Number(projected_at_acquisition).toFixed(1)} projected
            </span>
          )}
          {weeks_started != null && (
            <span title='Weeks started / weeks on the active roster / weeks stashed on the practice squad'>
              {weeks_started}/{weeks_active}/{weeks_practice_squad} wks
            </span>
          )}
          {salary_paid != null && (
            <span title='Salary this team paid over the holding'>
              ${Number(salary_paid).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

ChainRow.propTypes = {
  chain_row: ImmutablePropTypes.map.isRequired,
  is_origin: PropTypes.bool,
  league_id: PropTypes.string,
  trade_uid: PropTypes.number
}

function Asset({ asset, has_chains, league_id, trade_uid }) {
  const lineage_state = asset.get('lineage_state')
  const chain = asset.get('chain')
  const resulting_assets = asset.get('resulting_assets')
  const keeptradecut_value_at_trade = asset.get('keeptradecut_value_at_trade')

  return (
    <div className='trade-review-trade__asset'>
      <div className='trade-review-trade__asset-header'>
        <div className='trade-review-trade__asset-name'>
          <AssetLabel asset={asset} />
        </div>
        <div className='trade-review-trade__asset-values'>
          <span title={AT_TRADE_EXPLANATION}>
            {keeptradecut_value_at_trade == null ? (
              <span
                className='trade-review-trade__unpriced'
                title={UNPRICED_EXPLANATION}
              >
                Not priced
              </span>
            ) : (
              format_value(keeptradecut_value_at_trade)
            )}
          </span>
          <span className='trade-review-trade__asset-arrow'>→</span>
          <span title={TODAY_EXPLANATION}>
            {format_value(asset.get('current_keeptradecut_value'))}
          </span>
          <span
            className={`trade-review-trade__lineage-state ${lineage_state}`}
            title={lineage_state_descriptions[lineage_state]}
          >
            {lineage_state_labels[lineage_state] || lineage_state}
          </span>
        </div>
      </div>
      {Boolean(resulting_assets && resulting_assets.size) && (
        <div className='trade-review-trade__resulting'>
          <span className='trade-review-trade__micro-label'>Still open</span>
          {resulting_assets.map((resulting_asset, index) => (
            <span key={index} className='trade-review-trade__resulting-asset'>
              <AssetLabel asset={resulting_asset} />
            </span>
          ))}
        </div>
      )}
      {has_chains &&
        (chain && chain.size ? (
          <div className='trade-review-trade__chain'>
            {chain.map((chain_row, index) => (
              <ChainRow
                key={index}
                chain_row={chain_row}
                is_origin={index === 0}
                league_id={league_id}
                trade_uid={trade_uid}
              />
            ))}
          </div>
        ) : (
          // Every leg has a chain of at least its own row, so reaching here
          // means the response did not match the contract. Naming that beats an
          // empty panel, which a reader takes for "nothing happened".
          <div className='trade-review-trade__chain-absent'>
            No lineage recorded for this asset.
          </div>
        ))}
    </div>
  )
}

Asset.propTypes = {
  asset: ImmutablePropTypes.map.isRequired,
  has_chains: PropTypes.bool,
  league_id: PropTypes.string,
  trade_uid: PropTypes.number
}

// What one side got out of the trade while it held it. The chain follows an
// asset past this team -- a player traded onward keeps accruing rows under his
// new team -- so the rows are filtered to this team before they are summed, and
// the label says "while held" rather than implying the whole line.
const production_while_held = ({ assets, tid }) => {
  let points_added = 0
  let salary_paid = 0
  let has_any = false
  for (const asset of assets) {
    const chain = asset.get('chain')
    if (!chain) continue
    for (const chain_row of chain) {
      if (chain_row.get('tid') !== tid) continue
      const realized = chain_row.get(
        'realized_pts_added_net_through_termination'
      )
      const salary = chain_row.get('salary_paid')
      if (realized != null) {
        points_added += Number(realized)
        has_any = true
      }
      if (salary != null) {
        salary_paid += Number(salary)
        has_any = true
      }
    }
  }
  return has_any ? { points_added, salary_paid } : null
}

// One side of the trade in the expanded detail: what this team received, and
// what each of those assets became. The two perspectives together cover every
// leg exactly once, so nothing is listed twice.
function Perspective({ perspective, season_year, has_chains, league_id }) {
  const acquired_assets = perspective.get('acquired_assets')
  const tid = perspective.get('tid')
  const production = has_chains
    ? production_while_held({ assets: acquired_assets, tid })
    : null

  return (
    <div className='trade-review-trade__perspective'>
      <div className='trade-review-trade__perspective-header'>
        <div className='trade-review-trade__perspective-team'>
          <TeamName tid={tid} year={season_year} image />
        </div>
        <span className='trade-review-trade__micro-label'>received</span>
      </div>
      {Boolean(production) && (
        <div
          className='trade-review-trade__production'
          title='Production and salary accrued by this team on these assets and on everything they became, counted only for the stretches this team held them.'
        >
          <span>{production.points_added.toFixed(1)} pts added</span>
          <span>
            ${Math.round(production.salary_paid).toLocaleString()} paid
          </span>
          <span className='trade-review-trade__production-caption'>
            while held
          </span>
        </div>
      )}
      {acquired_assets.map((asset, index) => (
        <Asset
          key={index}
          asset={asset}
          has_chains={has_chains}
          league_id={league_id}
          trade_uid={perspective.get('trade_uid')}
        />
      ))}
    </div>
  )
}

Perspective.propTypes = {
  perspective: ImmutablePropTypes.map.isRequired,
  season_year: PropTypes.number,
  has_chains: PropTypes.bool,
  league_id: PropTypes.string
}

// One side of a trade as it reads at the top of the card: the team, what it
// received, and what that has come to. Both columns render from the lead
// record -- the counterparty's received assets are this record's sent_assets --
// so the two sides are always drawn from one consistent snapshot.
//
// Showing both sides' totals is what removes the need for a caption naming
// whose numbers these are: a single net figure is meaningless until the reader
// knows its perspective, and a pair of side totals states it structurally.
function SideSummary({ tid, season_year, assets, show_assets }) {
  const { at_trade, today } = side_totals(assets)
  const direction =
    at_trade == null
      ? ''
      : today > at_trade
        ? 'up'
        : today < at_trade
          ? 'down'
          : ''

  return (
    <div className='trade-review-trade__side'>
      <div className='trade-review-trade__side-team'>
        <TeamName tid={tid} year={season_year} abbrv image />
        <span className='trade-review-trade__micro-label'>received</span>
      </div>
      {show_assets && (
        <div className='trade-review-trade__side-assets'>
          {assets.map((asset, index) => (
            <div key={index} className='trade-review-trade__side-asset'>
              <AssetLabel asset={asset} />
              <span className='trade-review-trade__side-value'>
                {asset.get('keeptradecut_value_at_trade') == null
                  ? '—'
                  : format_value(asset.get('keeptradecut_value_at_trade'))}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className='trade-review-trade__side-totals'>
        <div className='trade-review-trade__total'>
          <span className='trade-review-trade__micro-label'>At trade</span>
          {at_trade == null ? (
            <span
              className='trade-review-trade__unpriced'
              title={UNPRICED_EXPLANATION}
            >
              Not priced
            </span>
          ) : (
            <span
              className='trade-review-trade__total-value'
              title={AT_TRADE_EXPLANATION}
            >
              {format_value(at_trade)}
            </span>
          )}
        </div>
        <div className='trade-review-trade__total'>
          <span className='trade-review-trade__micro-label'>Today</span>
          <span
            className={`trade-review-trade__total-value ${direction}`}
            title={TODAY_EXPLANATION}
          >
            {format_value(today)}
          </span>
        </div>
      </div>
    </div>
  )
}

SideSummary.propTypes = {
  tid: PropTypes.number,
  season_year: PropTypes.number,
  assets: ImmutablePropTypes.list,
  show_assets: PropTypes.bool
}

// The one thing the two side columns above cannot show: which way the trade has
// moved since the day it was made. net_value_change is written from the lead
// team's view, so its sign picks the team the value moved toward and the
// sentence names that team outright.
function TradeSwing({
  lead_tid,
  counterparty_tid,
  net_value_change,
  season_year
}) {
  if (net_value_change == null) {
    return (
      <div
        className='trade-review-trade__swing trade-review-trade__swing--unpriced'
        title={UNPRICED_EXPLANATION}
      >
        No swing figure — at least one asset had no market price on the trade
        date.
      </div>
    )
  }

  if (!net_value_change) {
    return (
      <div className='trade-review-trade__swing'>
        The two sides are worth exactly what they were on the day of the trade.
      </div>
    )
  }

  return (
    <div className='trade-review-trade__swing'>
      <span>Since the trade,</span>
      <span className='trade-review-trade__swing-value'>
        {Math.abs(net_value_change).toLocaleString()}
      </span>
      <span>in value has swung toward</span>
      <span className='trade-review-trade__swing-team'>
        <TeamName
          tid={net_value_change > 0 ? lead_tid : counterparty_tid}
          year={season_year}
          abbrv
        />
      </span>
    </div>
  )
}

TradeSwing.propTypes = {
  lead_tid: PropTypes.number,
  counterparty_tid: PropTypes.number,
  net_value_change: PropTypes.number,
  season_year: PropTypes.number
}

export default function TradeReviewTrade({
  trade,
  is_expanded,
  is_failed,
  on_open,
  trade_uid,
  league_id
}) {
  const perspectives = trade.get('perspectives')
  const has_chains = trade.get('has_chains')

  const lead = perspectives.first()
  const occurred_at = lead.get('occurred_at')
  const season_year = dayjs(occurred_at).year()
  const acquired_assets = lead.get('acquired_assets')
  const sent_assets = lead.get('sent_assets')

  // The collapsed card in the list opens the trade's own page; the expanded
  // card on that page is not a control at all, because the page already carries
  // a back link and a card that navigated away from itself on any stray click
  // would be a trap rather than an affordance.
  const is_interactive = Boolean(on_open)
  const interactive_props = is_interactive
    ? {
        onClick: () => on_open(trade_uid),
        role: 'button',
        tabIndex: 0,
        'aria-label': `Trade of ${format_date(occurred_at)} — open lineage`,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            on_open(trade_uid)
          }
        }
      }
    : {}

  return (
    <div
      className={`trade-review-trade${is_interactive ? ' interactive' : ''}`}
    >
      <div className='trade-review-trade__summary' {...interactive_props}>
        <div className='trade-review-trade__summary-top'>
          <div className='trade-review-trade__date'>
            {format_date(occurred_at)}
          </div>
          <div className='trade-review-trade__shape'>
            {acquired_assets.size} for {sent_assets.size}
          </div>
          {is_interactive && (
            <div className='trade-review-trade__open'>
              <span>Lineage</span>
              <ChevronRightIcon />
            </div>
          )}
        </div>
        <div className='trade-review-trade__sides'>
          <SideSummary
            tid={lead.get('tid')}
            season_year={season_year}
            assets={acquired_assets}
            show_assets={!is_expanded}
          />
          <SideSummary
            tid={lead.get('counterparty_tid')}
            season_year={season_year}
            assets={sent_assets}
            show_assets={!is_expanded}
          />
        </div>
        <TradeSwing
          lead_tid={lead.get('tid')}
          counterparty_tid={lead.get('counterparty_tid')}
          net_value_change={lead.get('net_value_change')}
          season_year={season_year}
        />
      </div>
      {is_expanded && (
        <div className='trade-review-trade__detail'>
          {perspectives.map((perspective, index) => (
            <Perspective
              key={index}
              perspective={perspective}
              season_year={season_year}
              has_chains={has_chains}
              league_id={league_id}
            />
          ))}
          {!has_chains && (
            <div className='trade-review-trade__chains-loading'>
              {is_failed ? (
                <span>Lineage could not be loaded.</span>
              ) : (
                <>
                  <span className='trade-review-trade__chains-loading-spinner' />
                  Loading each asset&apos;s lineage...
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

TradeReviewTrade.propTypes = {
  trade: ImmutablePropTypes.map.isRequired,
  trade_uid: PropTypes.number.isRequired,
  league_id: PropTypes.string,
  is_expanded: PropTypes.bool,
  is_failed: PropTypes.bool,
  on_open: PropTypes.func
}
