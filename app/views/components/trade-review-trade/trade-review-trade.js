import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'

import Icon from '@components/icon'
import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'
import format_lineage_event, {
  terminated_by_labels,
  team_asset_state_labels,
  team_asset_state_descriptions
} from '#libs-shared/format-lineage-event.mjs'

import './trade-review-trade.styl'

const UNPRICED_EXPLANATION =
  'At least one asset in this trade has no market price on the trade date, so a figure computed from one side only would read as an even trade. Some of these are unrecoverable — KeepTradeCut deletes a draft class once its draft has passed — and some are assets it has never published a price for at all.'

const WITHHELD_PROCEEDS_EXPLANATION =
  'This team traded the asset onward and what it received cannot be attributed: an asset it sent in that trade has no price on the day, so this asset share of the outgoing bundle is undefined. A zero here would read as "got nothing", which is a different claim.'

const AT_TRADE_EXPLANATION =
  'KeepTradeCut value of everything this team received, priced on the day of the trade.'

// Says what this team holds, plainly. The wording used to hedge because the
// number behind it was the asset LINE's value and included holdings this team
// had traded away; it is now filtered to the receiving team, so the plain
// statement is the true one.
const STILL_HELD_EXPLANATION =
  "Today's KeepTradeCut value of what this team STILL HOLDS off what it received. An asset it traded onward counts nothing here — see Turned into."

const PROCEEDS_EXPLANATION =
  'What this team side of the trade turned into FOR IT: what it still holds, plus what it received in exchange when it traded these assets onward, weighted by each asset share of the outgoing bundle. Right for this trade and never to be added up across a team trades — the same value appears on every card along a conversion chain.'

const CHANGE_EXPLANATION =
  'What this side of the trade has gained or lost in market value since the day it was made, measured against what it turned into. Both sides can gain, and both sides can lose — this is not a comparison against the other team.'

const PRODUCTION_EXPLANATION =
  'Points above replacement actually scored from what this team received, and from everything those assets became, counted only for the stretches this team held them and including weeks spent on the bench. A week below replacement subtracts. Market value says what an asset is worth; this says what it did.'

const COMBINED_EXPLANATION =
  'A trade is not zero-sum. This is what both sides hold together now against what they held on the day, plus the production the two rosters have taken out of it.'

const format_value = (value) => Math.round(value).toLocaleString()

const format_signed = (value) =>
  `${value > 0 ? '+' : ''}${Math.round(value).toLocaleString()}`

const format_date = (value) => dayjs(value).format('MMM D, YYYY')

const direction_of = (value) =>
  value == null || !value ? '' : value > 0 ? 'up' : 'down'

// The card reads the post-rename vocabulary directly. The compatibility read
// across the field rename -- new key first, fall back to the retired one --
// was shipped one release ahead and removed once the rename was deployed and
// confirmed; there is no second vocabulary left to serve.
const asset_still_held = (asset) => asset.get('keeptradecut_value_still_held')

const asset_proceeds = (asset) => asset.get('keeptradecut_value_proceeds')

const asset_state = (asset) => asset.get('team_asset_state')

const state_label = (state) => team_asset_state_labels[state] || state

const state_description = (state) => team_asset_state_descriptions[state]

// One side's market value, on the day and now. The at-trade total is withheld
// whole when any one of its assets is unpriced -- the same rule the engine
// applies to its own figures, for the same reason: a partial sum reads as a
// real price.
//
// The assets responsible come back with it. A withheld total states an effect,
// and on its own the reader has to guess the cause -- which one did: a side
// holding a marquee player beside a round-6 pick reads as though the PLAYER had
// no price, because he is the thing the eye lands on.
//
// `proceeds` is withheld on its own terms and for a different reason: an
// unpriced OUTGOING bundle makes the weight a division by an unknown, which is
// not the same condition as this side carrying an unpriced leg.
const side_totals = (assets) => {
  const unpriced_assets = assets.filter(
    (asset) => asset.get('keeptradecut_value_at_trade') == null
  )
  const at_trade = unpriced_assets.size
    ? null
    : assets.reduce(
        (total, asset) => total + asset.get('keeptradecut_value_at_trade'),
        0
      )
  const still_held = assets.reduce(
    (total, asset) => total + asset_still_held(asset),
    0
  )
  const proceeds = assets.some((asset) => asset_proceeds(asset) == null)
    ? null
    : assets.reduce((total, asset) => total + asset_proceeds(asset), 0)
  // The headline figure, and what Change is measured against.
  const headline = proceeds
  return {
    at_trade,
    still_held,
    proceeds,
    headline,
    change: at_trade == null || headline == null ? null : headline - at_trade,
    unpriced_assets
  }
}

// What an asset IS, for deciding whether a lineage step is still carrying the
// same thing. A pick and the player it became are different identities; the
// same player under a new contract is not.
const asset_identity_key = (asset) =>
  asset.get('player_id') ||
  `${asset.get('pick_year')}-${asset.get('pick_round')}-${asset.get('pick_draft_overall_position')}`

// A labelled figure. Every number on this card is one of these, so a reader
// never has to work out what a bare value is measuring.
function ValueStat({ label, value, signed, title }) {
  if (value == null) {
    return (
      <div className='trade-review-trade__stat'>
        <span className='trade-review-trade__micro-label'>{label}</span>
        <span
          className='trade-review-trade__unpriced'
          title={UNPRICED_EXPLANATION}
        >
          Not priced
        </span>
      </div>
    )
  }
  return (
    <div className='trade-review-trade__stat'>
      <span className='trade-review-trade__micro-label'>{label}</span>
      <span
        className={`trade-review-trade__stat-value ${signed ? direction_of(value) : ''}`}
        title={title}
      >
        {signed ? format_signed(value) : format_value(value)}
      </span>
    </div>
  )
}

ValueStat.propTypes = {
  label: PropTypes.string,
  value: PropTypes.number,
  signed: PropTypes.bool,
  title: PropTypes.string
}

// A pick renders over two tiers rather than as the one-line spelling
// format_trade_asset_label produces for the grade-trades CLI. The year and
// round are what an owner recognises the pick by; the overall slot qualifies it
// and must not compete with it for the same weight.
function PickLabel({ asset }) {
  const pick_year = asset.get('pick_year')
  if (!pick_year) {
    return <span className='trade-review-trade__pick'>Unknown asset</span>
  }
  const pick_draft_overall_position = asset.get('pick_draft_overall_position')
  return (
    <span className='trade-review-trade__pick'>
      <span className='trade-review-trade__pick-main'>
        {pick_year} Round {asset.get('pick_round')}
      </span>
      {Boolean(pick_draft_overall_position) && (
        <span className='trade-review-trade__pick-meta'>
          #{pick_draft_overall_position} overall
        </span>
      )}
    </span>
  )
}

PickLabel.propTypes = {
  asset: ImmutablePropTypes.map.isRequired
}

function AssetLabel({ asset, headshot_width }) {
  const player_id = asset.get('player_id')
  if (player_id) {
    return (
      // PlayerName renders a fragment of two siblings, so it needs a flex
      // wrapper of its own or its status chips wrap away from the name.
      //
      // The stop is what keeps the two click targets apart: the name opens the
      // selected-player view, and the collapsed card it sits in navigates to
      // the trade. A pick has no player view, so it is left to the card.
      <span
        className='trade-review-trade__player'
        onClick={(event) => event.stopPropagation()}
      >
        <PlayerName
          pid={player_id}
          hidePosition
          headshot_width={headshot_width}
        />
      </span>
    )
  }
  return <PickLabel asset={asset} />
}

AssetLabel.propTypes = {
  asset: ImmutablePropTypes.map.isRequired,
  headshot_width: PropTypes.number
}

// A number and the noun it is counting, in that order, so the figure never has
// to be decoded against a legend somewhere else. The tooltip carries the
// precision; the visible text has to be right on its own.
function StatChip({ value, label, title }) {
  return (
    <span className='trade-review-trade__stat-chip' title={title}>
      <span className='trade-review-trade__stat-chip-value'>{value}</span>
      <span className='trade-review-trade__stat-chip-label'>{label}</span>
    </span>
  )
}

StatChip.propTypes = {
  value: PropTypes.node,
  label: PropTypes.string,
  title: PropTypes.string
}

// What one holding produced and cost, as a row of aligned cells rather than a
// run of labelled phrases.
//
// The nouns are identical on every step of a chain, so repeating them per row
// spends most of the line restating what the reader already knows. Stating them
// ONCE in a header buys two things: the rows get short, and the values line up
// vertically — which is what makes "which holder actually got something out of
// him" answerable by looking rather than by reading.
//
// This is not the "0/5/0 wks" triple it replaced. That was a coded label whose
// meaning lived in a tooltip; a column under a header is labelled in place.
//
// The column semantics, since none is self-evident from its name:
//   realized_points_added_net_through_termination  summed over every week the team
//     held the player, BENCH WEEKS INCLUDED, and a week below replacement
//     subtracts, so the figure can be negative.
//   weeks_active   weeks in an active-roster slot, which in this league's slot
//     sets INCLUDES the bench and excludes the practice squad and reserve.
//   weeks_started  weeks in a starting slot. Starting slots are a subset of
//     active ones and the counter is a separate `if`, so every start is also a
//     rostered week — the two do not sum to anything meaningful.
const HOLDING_COLUMNS = [
  {
    key: 'points',
    label: 'Pts added',
    title:
      'Points above replacement this team scored from the asset over the weeks it held him, bench weeks included. A week below replacement subtracts, so this can be negative.',
    read: (chain_row) => {
      const value = chain_row.get(
        'realized_points_added_net_through_termination'
      )
      return value == null ? null : Number(value).toFixed(1)
    }
  },
  {
    key: 'rostered',
    label: 'Rostered',
    title:
      'Weeks on the active roster — starting lineup and bench both, but not the practice squad or reserve.',
    read: (chain_row) => chain_row.get('weeks_active')
  },
  {
    key: 'starts',
    label: 'Starts',
    title:
      'Weeks in a starting lineup slot. Every start is also a rostered week, so the two are not additive.',
    read: (chain_row) => chain_row.get('weeks_started')
  },
  {
    key: 'practice_squad',
    label: 'Practice squad',
    title: 'Weeks stashed on the practice squad.',
    read: (chain_row) => chain_row.get('weeks_practice_squad'),
    // Most holdings never see the practice squad, and a column of zeros is
    // width spent on nothing. It appears for a chain that used one.
    only_when_used: true
  },
  {
    key: 'salary',
    label: 'Salary',
    title: 'Salary this team paid against the cap over this holding.',
    read: (chain_row) => {
      const value = chain_row.get('salary_paid')
      return value == null ? null : `$${Number(value).toLocaleString()}`
    }
  }
]

// Which columns a given chain earns. A chain of picks has nothing to report on
// any of them and gets no table at all.
const holding_columns_for = (chain) =>
  HOLDING_COLUMNS.filter((column) =>
    chain.some((chain_row) => {
      const value = column.read(chain_row)
      if (value == null) return false
      return column.only_when_used ? Number(value) > 0 : true
    })
  )

function HoldingStats({ chain_row, columns }) {
  if (!columns.length) return null

  // A player the team held but never dressed reads as a row of zeros, which is
  // a finding rather than an absence — but a row of em-dashes is not, so it is
  // named. A pick has no roster life at all and its columns simply do not exist.
  const has_any_value = columns.some((column) => column.read(chain_row) != null)
  if (!has_any_value && chain_row.get('player_id')) {
    return (
      <div className='trade-review-trade__step-stats'>
        <span className='trade-review-trade__step-idle'>
          Never on a game-week roster
        </span>
      </div>
    )
  }

  return (
    <div className='trade-review-trade__step-stats'>
      {columns.map((column) => {
        const value = column.read(chain_row)
        return (
          <span
            key={column.key}
            className={`trade-review-trade__stat-cell${value == null ? ' absent' : ''}`}
            title={column.title}
          >
            <span className='trade-review-trade__stat-cell-value'>
              {value == null ? '—' : value}
            </span>
            <span className='trade-review-trade__stat-cell-label'>
              {column.label}
            </span>
          </span>
        )
      })}
    </div>
  )
}

HoldingStats.propTypes = {
  chain_row: ImmutablePropTypes.map.isRequired,
  columns: PropTypes.array.isRequired
}

// One holding on the asset's way to whatever it is today, as a step on a dated
// timeline. Three things keep a chain readable that a flat row of columns did
// not: the date leads every step, the asset is named only where it CHANGES, and
// a holding's termination is printed only where nothing follows from it --
// otherwise "Traded away" and the next step's "Traded" say the same thing twice.
function ChainStep({
  chain_row,
  is_origin,
  is_continued,
  shows_asset,
  columns,
  league_id,
  trade_id
}) {
  const period_end = chain_row.get('period_end')
  const terminated_by = chain_row.get('terminated_by')
  const hop_trade_id = chain_row.get('transformation_trade_id')
  const is_open = period_end == null

  const event_label = is_origin
    ? 'Acquired in this trade'
    : format_lineage_event(chain_row.get('transformation_type'))

  return (
    <div
      className={`trade-review-trade__step${is_open ? ' open' : ''}${is_continued ? '' : ' last'}`}
    >
      <div className='trade-review-trade__step-marker' />
      <div className='trade-review-trade__step-content'>
        <div className='trade-review-trade__step-headline'>
          <span className='trade-review-trade__step-date'>
            {format_date(chain_row.get('period_start'))}
          </span>
          <span className='trade-review-trade__step-team'>
            <TeamName
              tid={chain_row.get('tid')}
              year={dayjs(chain_row.get('period_start')).year()}
              abbrv
            />
          </span>
          <span className='trade-review-trade__step-event'>
            {hop_trade_id && hop_trade_id !== trade_id ? (
              <Link to={`/leagues/${league_id}/trades/${hop_trade_id}`}>
                {event_label}
              </Link>
            ) : (
              event_label
            )}
          </span>
        </div>
        {shows_asset && (
          <div className='trade-review-trade__step-asset'>
            <AssetLabel asset={chain_row} />
          </div>
        )}
        {!is_continued && (
          <div className='trade-review-trade__step-end'>
            {is_open
              ? 'Still held today'
              : `${terminated_by_labels[terminated_by] || 'Ended'} — ${format_date(period_end)}`}
          </div>
        )}
      </div>
      <HoldingStats chain_row={chain_row} columns={columns} />
    </div>
  )
}

ChainStep.propTypes = {
  chain_row: ImmutablePropTypes.map.isRequired,
  is_origin: PropTypes.bool,
  is_continued: PropTypes.bool,
  shows_asset: PropTypes.bool,
  columns: PropTypes.array.isRequired,
  league_id: PropTypes.string,
  trade_id: PropTypes.number
}

function Chain({ chain, league_id, trade_id }) {
  // A holding is continued when some later holding in the chain was built out
  // of it. That is a property of the graph rather than of the ordering, so it
  // stays correct when a chain branches -- a pick that became a player who was
  // then extended has two rows off one parent, and only the leaves end.
  const continued_holding_ids = new Set()
  for (const chain_row of chain) {
    const source_holding_id = chain_row.get('source_holding_id')
    if (source_holding_id) continued_holding_ids.add(source_holding_id)
  }

  // The header is what pays for the short rows below it, so it is only earned
  // when there is a column to head.
  const columns = holding_columns_for(chain)

  let previous_identity = null
  return (
    <div className='trade-review-trade__chain'>
      {Boolean(columns.length) && (
        <div className='trade-review-trade__chain-header'>
          <div className='trade-review-trade__chain-header-lead' />
          <div className='trade-review-trade__step-stats'>
            {columns.map((column) => (
              <span
                key={column.key}
                className='trade-review-trade__stat-cell trade-review-trade__micro-label'
                title={column.title}
              >
                {column.label}
              </span>
            ))}
          </div>
        </div>
      )}
      {chain.map((chain_row, index) => {
        const identity = asset_identity_key(chain_row)
        const shows_asset = index !== 0 && identity !== previous_identity
        previous_identity = identity
        return (
          <ChainStep
            key={index}
            chain_row={chain_row}
            is_origin={index === 0}
            is_continued={continued_holding_ids.has(
              chain_row.get('holding_id')
            )}
            shows_asset={shows_asset}
            columns={columns}
            league_id={league_id}
            trade_id={trade_id}
          />
        )
      })}
    </div>
  )
}

Chain.propTypes = {
  chain: ImmutablePropTypes.list.isRequired,
  league_id: PropTypes.string,
  trade_id: PropTypes.number
}

function Asset({ asset, has_chains, league_id, trade_id }) {
  const team_asset_state = asset_state(asset)
  const chain = asset.get('chain')
  const keeptradecut_value_at_trade = asset.get('keeptradecut_value_at_trade')
  const still_held = asset_still_held(asset)
  const proceeds = asset_proceeds(asset)

  return (
    <div className='trade-review-trade__asset'>
      <div className='trade-review-trade__asset-header'>
        <div className='trade-review-trade__asset-name'>
          <AssetLabel asset={asset} headshot_width={40} />
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
          {/* The headline is what the asset turned into for this team. What it
              still holds off the line sits beside it as secondary detail --
              they are different quantities and a card that showed only one of
              them is what conflated them in the first place. */}
          <span title={PROCEEDS_EXPLANATION}>
            {proceeds == null ? (
              <span
                className='trade-review-trade__unpriced'
                title={WITHHELD_PROCEEDS_EXPLANATION}
              >
                Not attributable
              </span>
            ) : (
              format_value(proceeds)
            )}
          </span>
          <span
            className='trade-review-trade__asset-still-held'
            title={STILL_HELD_EXPLANATION}
          >
            {format_value(still_held)} held
          </span>
          <span
            className={`trade-review-trade__team-asset-state ${team_asset_state}`}
            title={state_description(team_asset_state)}
          >
            {state_label(team_asset_state)}
          </span>
        </div>
      </div>
      {has_chains &&
        (chain && chain.size ? (
          <Chain chain={chain} league_id={league_id} trade_id={trade_id} />
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
  trade_id: PropTypes.number
}

// Production and cost for a whole side, in the same chips the timeline uses so
// a reader learns the vocabulary once. It sits under the market figures rather
// than beside them because it answers a different question: not what an asset
// was worth, but what it did.
function ProductionLine({ realized_points_added, salary_paid }) {
  if (realized_points_added == null) return null
  return (
    <div className='trade-review-trade__production'>
      <StatChip
        value={realized_points_added.toFixed(1)}
        label='pts above replacement'
        title={PRODUCTION_EXPLANATION}
      />
      {salary_paid != null && (
        <StatChip
          value={`$${salary_paid.toLocaleString()}`}
          label='salary paid'
          title='Salary this team paid against the cap over those same holdings.'
        />
      )}
    </div>
  )
}

ProductionLine.propTypes = {
  realized_points_added: PropTypes.number,
  salary_paid: PropTypes.number
}

// One side of the trade in the expanded detail: what this team received, and
// what each of those assets became. The two perspectives together cover every
// leg exactly once, so nothing is listed twice.
function Perspective({ perspective, season_year, has_chains, league_id }) {
  const acquired_assets = perspective.get('acquired_assets')

  return (
    <div className='trade-review-trade__perspective'>
      <div className='trade-review-trade__perspective-header'>
        <div className='trade-review-trade__perspective-team'>
          <TeamName tid={perspective.get('tid')} year={season_year} image />
        </div>
        <span className='trade-review-trade__micro-label'>received</span>
      </div>
      {acquired_assets.map((asset, index) => (
        <Asset
          key={index}
          asset={asset}
          has_chains={has_chains}
          league_id={league_id}
          trade_id={perspective.get('trade_id')}
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

// One side of a trade: the team, what it received, what that has come to, and
// what it produced. Every figure here belongs to this side alone — a side is
// up or down against its own starting point, not against the other team, so
// both sides can be up and both can be down.
function SideSummary({
  tid,
  season_year,
  assets,
  show_assets,
  realized_points_added,
  salary_paid
}) {
  const { at_trade, still_held, proceeds, change, unpriced_assets } =
    side_totals(assets)

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
              <AssetLabel asset={asset} headshot_width={40} />
              {/* One state, one spelling. This read as an em-dash while the
                  side total beside it said "Not priced" and the detail card
                  said "Not priced" again -- three renderings of one fact, which
                  is what let a reader attach the absence to the wrong asset. */}
              {asset.get('keeptradecut_value_at_trade') == null ? (
                <span
                  className='trade-review-trade__unpriced'
                  title={UNPRICED_EXPLANATION}
                >
                  Not priced
                </span>
              ) : (
                <span className='trade-review-trade__side-value'>
                  {format_value(asset.get('keeptradecut_value_at_trade'))}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <div className='trade-review-trade__side-totals'>
        <ValueStat
          label='At trade'
          value={at_trade}
          title={AT_TRADE_EXPLANATION}
        />
        <ValueStat
          label='Turned into'
          value={proceeds}
          title={PROCEEDS_EXPLANATION}
        />
        <ValueStat
          label='Still held'
          value={still_held}
          title={STILL_HELD_EXPLANATION}
        />
        <ValueStat
          label='Change'
          value={change}
          signed
          title={CHANGE_EXPLANATION}
        />
      </div>
      {/* Named beneath the totals rather than left to the reader to work out.
          On the detail page the asset rows above are suppressed entirely, so
          without this the withheld total has no visible cause anywhere on the
          card and attaches itself to whichever asset the eye landed on. */}
      {Boolean(unpriced_assets.size) && (
        <div
          className='trade-review-trade__unpriced-cause'
          title={UNPRICED_EXPLANATION}
        >
          <span className='trade-review-trade__unpriced'>
            No price on the day
          </span>
          <span className='trade-review-trade__unpriced-assets'>
            {unpriced_assets.map((asset, index) => (
              <span key={index} className='trade-review-trade__unpriced-asset'>
                <AssetLabel asset={asset} />
              </span>
            ))}
          </span>
        </div>
      )}
      <ProductionLine
        realized_points_added={realized_points_added}
        salary_paid={salary_paid}
      />
    </div>
  )
}

SideSummary.propTypes = {
  tid: PropTypes.number,
  season_year: PropTypes.number,
  assets: ImmutablePropTypes.list,
  show_assets: PropTypes.bool,
  realized_points_added: PropTypes.number,
  salary_paid: PropTypes.number
}

// The trade as a whole. Two teams can both come out ahead of a trade and both
// come out behind it, so the question the card has to answer past the two side
// columns is not who won — it is whether the deal grew or shrank the value the
// two rosters hold together, and what they scored with it.
function CombinedOutcome({ sides, realized_points_added }) {
  const at_trade = sides.some((side) => side.at_trade == null)
    ? null
    : sides.reduce((total, side) => total + side.at_trade, 0)
  const has_headline = sides.every((side) => side.headline != null)
  const today = has_headline
    ? sides.reduce((total, side) => total + side.headline, 0)
    : null
  const change = at_trade == null || today == null ? null : today - at_trade

  return (
    <div className='trade-review-trade__combined' title={COMBINED_EXPLANATION}>
      <span className='trade-review-trade__micro-label'>Both teams</span>
      <span className='trade-review-trade__combined-flow'>
        {at_trade == null || today == null ? (
          <span className='trade-review-trade__unpriced'>Not priced</span>
        ) : (
          <>
            {format_value(at_trade)}
            <span className='trade-review-trade__asset-arrow'>→</span>
            {format_value(today)}
          </>
        )}
      </span>
      {change != null && (
        <span
          className={`trade-review-trade__combined-change ${direction_of(change)}`}
        >
          {format_signed(change)}
        </span>
      )}
      {realized_points_added != null && (
        <span className='trade-review-trade__combined-production'>
          <StatChip
            value={realized_points_added.toFixed(1)}
            label='pts above replacement, both rosters'
            title={PRODUCTION_EXPLANATION}
          />
        </span>
      )}
    </div>
  )
}

CombinedOutcome.propTypes = {
  sides: PropTypes.array.isRequired,
  realized_points_added: PropTypes.number
}

export default function TradeReviewTrade({
  trade,
  is_expanded,
  is_failed,
  on_open,
  trade_id,
  league_id
}) {
  const perspectives = trade.get('perspectives')
  const has_chains = trade.get('has_chains')

  // Both columns render from the lead record — the counterparty's received
  // assets are this record's sent_assets — so the two sides are always drawn
  // from one consistent snapshot. Production is the exception: it is computed
  // per record server-side, so the counterparty's own record supplies its half.
  const lead = perspectives.first()
  const counterparty = perspectives.get(1)
  const occurred_at = lead.get('occurred_at')
  const season_year = dayjs(occurred_at).year()
  const acquired_assets = lead.get('acquired_assets')
  const sent_assets = lead.get('sent_assets')

  const lead_points_added = lead.get('realized_points_added_while_held')
  const counterparty_points_added = counterparty
    ? counterparty.get('realized_points_added_while_held')
    : null
  const combined_points_added =
    lead_points_added != null && counterparty_points_added != null
      ? lead_points_added + counterparty_points_added
      : null

  // The collapsed card in the list opens the trade's own page; the expanded
  // card on that page is not a control at all, because the page already carries
  // a back link and a card that navigated away from itself on any stray click
  // would be a trap rather than an affordance.
  const is_interactive = Boolean(on_open)
  const interactive_props = is_interactive
    ? {
        onClick: () => on_open(trade_id),
        role: 'button',
        tabIndex: 0,
        'aria-label': `Trade of ${format_date(occurred_at)} — open lineage`,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            on_open(trade_id)
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
              <Icon name='chevron-right' />
            </div>
          )}
        </div>
        <div className='trade-review-trade__sides'>
          <SideSummary
            tid={lead.get('tid')}
            season_year={season_year}
            assets={acquired_assets}
            show_assets={!is_expanded}
            realized_points_added={lead_points_added}
            salary_paid={lead.get('salary_paid_while_held')}
          />
          <SideSummary
            tid={lead.get('counterparty_tid')}
            season_year={season_year}
            assets={sent_assets}
            show_assets={!is_expanded}
            realized_points_added={counterparty_points_added}
            salary_paid={
              counterparty ? counterparty.get('salary_paid_while_held') : null
            }
          />
        </div>
        <CombinedOutcome
          sides={[side_totals(acquired_assets), side_totals(sent_assets)]}
          realized_points_added={combined_points_added}
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
  trade_id: PropTypes.number.isRequired,
  league_id: PropTypes.string,
  is_expanded: PropTypes.bool,
  is_failed: PropTypes.bool,
  on_open: PropTypes.func
}
