import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

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

// What each of the three net figures measures. The labels are terse to stay
// scannable; the meaning lives in the tooltip, alongside the caption naming
// whose side the numbers are written from.
const METRIC_EXPLANATIONS = {
  at_trade: 'Net market value gained or lost, priced on the day of the trade.',
  realized:
    "The same trade priced at today's value of everything each side still holds.",
  change:
    'Realized minus at-trade — whether the trade came out better or worse over time.'
}

const format_signed = (value) =>
  `${value > 0 ? '+' : ''}${Math.round(value).toLocaleString()}`

// A missing figure is rendered as a named absence, never as 0 and never as a
// blank cell -- both read as "this trade came out even", which is the one thing
// the data does not say.
function NetValue({ value, label, title }) {
  return (
    <div className='trade-review-trade__net'>
      <span className='trade-review-trade__net-label' title={title}>
        {label}
      </span>
      {value == null ? (
        <span
          className='trade-review-trade__net-unpriced'
          title={UNPRICED_EXPLANATION}
        >
          Not priced
        </span>
      ) : (
        <span
          className={`trade-review-trade__net-value ${
            value > 0 ? 'positive' : value < 0 ? 'negative' : ''
          }`}
          title={title}
        >
          {format_signed(value)}
        </span>
      )}
    </div>
  )
}

NetValue.propTypes = {
  value: PropTypes.number,
  label: PropTypes.string,
  title: PropTypes.string
}

function AssetLabel({ asset }) {
  const player_id = asset.get('player_id')
  if (player_id) return <PlayerName pid={player_id} hidePosition />
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
// this trade; every later row is what it turned into.
function ChainRow({ chain_row, is_origin }) {
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

  return (
    <div className='trade-review-trade__chain-row'>
      <div className='trade-review-trade__chain-event'>
        {is_origin
          ? 'Acquired in this trade'
          : format_lineage_event(chain_row.get('transformation_type'))}
      </div>
      <div className='trade-review-trade__chain-asset'>
        <AssetLabel asset={chain_row} />
      </div>
      <div className='trade-review-trade__chain-team'>
        <TeamName
          tid={chain_row.get('tid')}
          year={dayjs(chain_row.get('period_start')).year()}
          abbrv
        />
      </div>
      <div className='trade-review-trade__chain-outcome'>
        {period_end
          ? terminated_by_labels[terminated_by] || 'Ended'
          : 'Still held'}
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
  )
}

ChainRow.propTypes = {
  chain_row: ImmutablePropTypes.map.isRequired,
  is_origin: PropTypes.bool
}

function Asset({ asset, has_chains }) {
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
          <span title='KeepTradeCut value on the day of the trade'>
            {keeptradecut_value_at_trade == null ? (
              <span
                className='trade-review-trade__net-unpriced'
                title={UNPRICED_EXPLANATION}
              >
                Not priced
              </span>
            ) : (
              Math.round(keeptradecut_value_at_trade).toLocaleString()
            )}
          </span>
          <span title='KeepTradeCut value today of everything this asset became and this team still holds'>
            {Math.round(
              asset.get('current_keeptradecut_value')
            ).toLocaleString()}{' '}
            now
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
          <span className='trade-review-trade__resulting-label'>Became</span>
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
  has_chains: PropTypes.bool
}

// One side of the trade: what this team received, and what each of those
// assets became. The two perspectives together cover every leg exactly once,
// so nothing is listed twice.
function Perspective({ perspective, season_year, has_chains }) {
  const acquired_assets = perspective.get('acquired_assets')

  return (
    <div className='trade-review-trade__perspective'>
      <div className='trade-review-trade__perspective-header'>
        <TeamName tid={perspective.get('tid')} year={season_year} image />
        <span className='trade-review-trade__perspective-label'>received</span>
      </div>
      {acquired_assets.map((asset, index) => (
        <Asset key={index} asset={asset} has_chains={has_chains} />
      ))}
    </div>
  )
}

Perspective.propTypes = {
  perspective: ImmutablePropTypes.map.isRequired,
  season_year: PropTypes.number,
  has_chains: PropTypes.bool
}

// One side of a trade as it reads in the collapsed card: the team and, in its
// own column, everything it received. The counterparty's received assets are
// this record's sent_assets, so both columns render from the lead record.
function SideSummary({ tid, season_year, assets }) {
  return (
    <div className='trade-review-trade__side'>
      <div className='trade-review-trade__side-team'>
        <TeamName tid={tid} year={season_year} abbrv image />
      </div>
      <div className='trade-review-trade__side-label'>received</div>
      <div className='trade-review-trade__side-assets'>
        {assets.map((asset, index) => (
          <div key={index} className='trade-review-trade__side-asset'>
            <AssetLabel asset={asset} />
            {asset.get('keeptradecut_value_at_trade') != null && (
              <span className='trade-review-trade__side-value'>
                {Math.round(
                  asset.get('keeptradecut_value_at_trade')
                ).toLocaleString()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

SideSummary.propTypes = {
  tid: PropTypes.number,
  season_year: PropTypes.number,
  assets: ImmutablePropTypes.list
}

export default function TradeReviewTrade({
  trade,
  is_expanded,
  on_toggle,
  trade_uid
}) {
  const perspectives = trade.get('perspectives')
  const has_chains = trade.get('has_chains')

  const lead = perspectives.first()
  const occurred_at = lead.get('occurred_at')
  const season_year = dayjs(occurred_at).year()

  return (
    <div className='trade-review-trade'>
      <div
        className='trade-review-trade__summary'
        onClick={() => on_toggle(trade_uid)}
        role='button'
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') on_toggle(trade_uid)
        }}
      >
        <div className='trade-review-trade__summary-top'>
          <div className='trade-review-trade__date'>
            {dayjs(occurred_at).format('MMM D, YYYY')}
          </div>
          <div className='trade-review-trade__expand'>
            {is_expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </div>
        </div>
        <div className='trade-review-trade__sides'>
          <SideSummary
            tid={lead.get('tid')}
            season_year={season_year}
            assets={lead.get('acquired_assets')}
          />
          <span className='trade-review-trade__versus'>vs</span>
          <SideSummary
            tid={lead.get('counterparty_tid')}
            season_year={season_year}
            assets={lead.get('sent_assets')}
          />
        </div>
        {/* Every figure below is written from the lead team's view. The other
            perspective is its exact sign inversion, so printing both would say
            the same thing twice -- but the reader has to know which side the
            numbers belong to, which is what the caption states. */}
        <div className='trade-review-trade__nets'>
          <NetValue
            value={lead.get('net_value_at_trade')}
            label='At trade'
            title={METRIC_EXPLANATIONS.at_trade}
          />
          <NetValue
            value={lead.get('net_value_realized')}
            label='Realized'
            title={METRIC_EXPLANATIONS.realized}
          />
          <NetValue
            value={lead.get('net_value_change')}
            label='Change'
            title={METRIC_EXPLANATIONS.change}
          />
        </div>
        <div className='trade-review-trade__net-perspective'>
          <span>Net figures are from the</span>
          <TeamName tid={lead.get('tid')} year={season_year} abbrv />
          <span>side — the other side is the exact mirror.</span>
        </div>
      </div>
      {is_expanded && (
        <div className='trade-review-trade__detail'>
          {perspectives.map((perspective, index) => (
            <Perspective
              key={index}
              perspective={perspective}
              season_year={season_year}
              has_chains={has_chains}
            />
          ))}
          {!has_chains && (
            <div className='trade-review-trade__chains-loading'>
              Loading each asset's lineage...
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
  is_expanded: PropTypes.bool,
  on_toggle: PropTypes.func.isRequired
}
