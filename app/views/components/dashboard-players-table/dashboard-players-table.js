import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  restrictToVerticalAxis,
  restrictToParentElement
} from '@dnd-kit/modifiers'
import Toolbar from '@mui/material/Toolbar'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'

import { constants } from '@libs-shared'
import PlayerRoster from '@components/player-roster'
import PlayerRosterHeader from '@components/player-roster-header'
import PlayerRosterTotal from '@components/player-roster-total'

import './dashboard-players-table.styl'

const SortableHandle = () => (
  <div className='player__item-action reorder table__cell'>
    <DragIndicatorIcon />
  </div>
)

const SortablePlayerRoster = ({ waiver, percentiles, ...props }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: waiver.uid || waiver.pid
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <PlayerRoster
        pid={waiver.pid}
        waiverId={waiver.uid}
        claim={waiver}
        player_map={waiver.player_map}
        dragHandle={
          <div {...listeners}>
            <SortableHandle />
          </div>
        }
        {...{ percentiles }}
      />
    </div>
  )
}

SortablePlayerRoster.propTypes = {
  waiver: PropTypes.object,
  percentiles: PropTypes.object
}

export default function DashboardPlayersTable({
  is_before_extension_deadline,
  items = [],
  cutlist,
  title,
  poaches,
  claims,
  total,
  waiverType,
  reorderWaivers,
  reorder_cutlist,
  leadColumn = '',
  space,
  isRestrictedFreeAgency,
  percentiles,
  is_team_manager
}) {
  const ref = React.createRef()
  const { isOffseason, isRegularSeason } = constants
  const isWaiver = Boolean(waiverType)
  const isPoach = Boolean(poaches)
  const isClaim = isWaiver || isPoach
  const showReorder = Boolean(isWaiver || (cutlist && cutlist.size))

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  if (isPoach) {
    poaches.forEach((poach, index) => {
      items.push(
        <PlayerRoster
          key={index}
          claim={poach}
          poachId={poach.uid}
          pid={poach.pid}
          player_map={poach.player_map}
          {...{ percentiles }}
        />
      )
    })
  }

  let body
  if (isWaiver) {
    body = (
      <div className='table__body' ref={ref}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={({ active, over }) => {
            if (active.id !== over?.id) {
              const oldIndex = claims.findIndex((c) => c.uid === active.id)
              const newIndex = claims.findIndex((c) => c.uid === over.id)
              reorderWaivers({ oldIndex, newIndex, type: waiverType })
            }
          }}
        >
          <SortableContext
            items={claims.map((c) => c.uid)}
            strategy={verticalListSortingStrategy}
          >
            {claims.map((waiver) => (
              <SortablePlayerRoster
                key={waiver.uid}
                waiver={waiver}
                percentiles={percentiles}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    )
  } else if (cutlist) {
    body = (
      <div className='table__body' ref={ref}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={({ active, over }) => {
            if (active.id !== over?.id) {
              const oldIndex = cutlist.findIndex(
                (p) => p.get('pid') === active.id
              )
              const newIndex = cutlist.findIndex(
                (p) => p.get('pid') === over.id
              )
              reorder_cutlist({ oldIndex, newIndex })
            }
          }}
        >
          <SortableContext
            items={cutlist.map((p) => p.get('pid'))}
            strategy={verticalListSortingStrategy}
          >
            {cutlist.map((player_map) => (
              <SortablePlayerRoster
                key={player_map.get('pid')}
                waiver={{
                  pid: player_map.get('pid'),
                  player_map
                }}
                percentiles={percentiles}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    )
  } else {
    body = <div className='table__body empty'>{items}</div>
  }

  const classNames = ['dashboard__players-table']
  if (isClaim) classNames.push('waiver')
  if (cutlist) classNames.push('cutlist')

  const week = Math.max(constants.week, 1)

  let summary
  if (typeof space !== 'undefined') {
    summary = (
      <div className='section__summary'>
        <div className='section__summary-item'>Rostered: {items.length}</div>
        <div className='section__summary-item'>Space: {space}</div>
      </div>
    )
  }

  const baseYear = is_before_extension_deadline
    ? constants.year - 1
    : constants.year

  const header_classNames = ['table__row', 'table__head']
  if (isClaim) header_classNames.push('claim')
  if (isWaiver) header_classNames.push('waiver')

  return (
    <div className={classNames.join(' ')}>
      <Toolbar variant='dense'>
        <div className='section-header-title'>{title}</div>
        {Boolean(summary) && summary}
      </Toolbar>
      <div className='table__container'>
        <div className={header_classNames.join(' ')}>
          {showReorder && (
            <div className='player__item-action reorder table__cell' />
          )}
          <div className='table__cell sticky__column text lead-cell'>
            {leadColumn}
          </div>
          {isClaim && <div className='table__cell text lead-cell'>Release</div>}
          {Boolean(isRestrictedFreeAgency) && (
            <div className='table__cell player__item-team'>Team</div>
          )}
          {(isWaiver || isRestrictedFreeAgency) && (
            <div className='metric table__cell'>Bid</div>
          )}
          {!isWaiver && (
            <div className='row__group'>
              <div className='row__group-head'>Salary</div>
              <div className='row__group-body'>
                {!isRestrictedFreeAgency && (
                  <div className='table__cell'>{baseYear}</div>
                )}
                {!isPoach && isOffseason && is_before_extension_deadline && (
                  <div className='table__cell'>{baseYear + 1}</div>
                )}
                {/* {!isPoach && isOffseason && (
                <div className='table__cell'>
                  <PlayerRosterHeader
                    tooltip='Market Salary adjusted for player availability and salary space'
                    title='Market Adjusted'
                  />
                </div>
              )} */}
                {!isPoach && isOffseason && (
                  <div className='table__cell'>
                    <PlayerRosterHeader
                      tooltip='Salary based on projected relative to baseline player'
                      title='Market'
                    />
                  </div>
                )}
                {isOffseason && (
                  <div className='table__cell'>
                    <PlayerRosterHeader
                      tooltip='Difference between a players salary and the market salary'
                      title='Savings'
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          {!isOffseason && (
            <div className='row__group'>
              <div className='row__group-head'>Results</div>
              <div className='row__group-body'>
                <div className='table__cell'>
                  <PlayerRosterHeader
                    tooltip='Points produced above baseline starter'
                    title='Pts+'
                  />
                </div>
                <div className='table__cell'>
                  <PlayerRosterHeader
                    tooltip='Rank among all players in points produced above baseline starter'
                    title='Ovr Rank'
                  />
                </div>
                <div className='table__cell'>
                  <PlayerRosterHeader
                    tooltip='Rank among position players in points produced above baseline starter'
                    title='Pos Rank'
                  />
                </div>
              </div>
            </div>
          )}
          {is_before_extension_deadline && (
            <>
              <div className='table__cell'>
                <PlayerRosterHeader
                  tooltip='Player salary amount after extension'
                  title='Regular Extension'
                />
              </div>
              <div className='row__group'>
                <div className='row__group-head'>Tag savings</div>
                <div className='row__group-body'>
                  <div className='table__cell'>
                    <PlayerRosterHeader
                      tooltip='Savings from franchise tag compared to regular extension'
                      title='Franchise'
                    />
                  </div>
                  <div className='table__cell'>
                    <PlayerRosterHeader
                      tooltip='Savings from rookie tag compared to regular extension'
                      title='Rookie'
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          <div className='row__group'>
            <div className='row__group-head'>Projected</div>
            <div className='row__group-body'>
              <div className='table__cell'>
                <PlayerRosterHeader
                  tooltip='Projected points relative to baseline player'
                  title='Pts+'
                />
              </div>
              {isOffseason && (
                <div className='table__cell'>
                  <PlayerRosterHeader
                    tooltip='Salary adjusted value relative to baseline player'
                    title='Value'
                  />
                </div>
              )}
              <div className='table__cell'>
                <PlayerRosterHeader
                  tooltip='Projected games started'
                  title='Starts'
                />
              </div>
            </div>
          </div>
          {isRegularSeason && (
            <div className='table__cell metric'>Week {week}</div>
          )}
          <div className='table__cell metric'>
            <PlayerRosterHeader
              tooltip='Projected starter points you would lose without player'
              title='Start Points'
            />
          </div>
          <div className='table__cell metric'>
            <PlayerRosterHeader
              tooltip='Projected bench points you would lose without player'
              title='Bench Points'
            />
          </div>
        </div>
        {Boolean(total && total.size) && (
          <PlayerRosterTotal
            players={total}
            reorder={showReorder}
            is_before_extension_deadline={is_before_extension_deadline}
            {...{ percentiles, is_team_manager }}
          />
        )}
        {body}
      </div>
    </div>
  )
}

DashboardPlayersTable.propTypes = {
  is_before_extension_deadline: PropTypes.bool,
  items: PropTypes.array,
  title: PropTypes.node,
  poaches: ImmutablePropTypes.list,
  claims: ImmutablePropTypes.list,
  waiverType: PropTypes.string,
  reorderWaivers: PropTypes.func,
  leadColumn: PropTypes.string,
  space: PropTypes.number,
  total: ImmutablePropTypes.list,
  cutlist: ImmutablePropTypes.list,
  reorder_cutlist: PropTypes.func,
  isRestrictedFreeAgency: PropTypes.bool,
  percentiles: PropTypes.object,
  is_team_manager: PropTypes.bool
}
