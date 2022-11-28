import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import AutoSizer from 'react-virtualized/dist/es/AutoSizer'
import List from 'react-virtualized/dist/es/List'

import { constants } from '@common'
import PlayerName from '@components/player-name'
import PageLayout from '@layouts/page'

const ROW_HEIGHT = 30

export default function PropsPage({ load, player_props }) {
  const listEl = useRef(null)
  useEffect(() => {
    load()
  }, [])

  const Row = ({ index, key, style }) => {
    const prop = player_props[index]
    return (
      <div className='item' {...{ style, key }}>
        <div className='item__col lead'>
          <PlayerName pid={prop.pid} />
        </div>
        <div className='item__col-group'>
          <div className='item__col'>
            {constants.player_prop_type_desc[prop.prop_type]}
          </div>
          <div className='item__col'>
            {constants.sourcesTitle[prop.sourceid]}
          </div>
          <div className='item__col metric'>{prop.ln}</div>
          <div className='item__col metric'>{(prop.proj || 0).toFixed(1)}</div>
          <div className='item__col metric'>{(prop.diff || 0).toFixed(1)}</div>
          <div className='item__col metric'>{prop.o_am}</div>
          <div className='item__col metric'>{prop.u_am}</div>
        </div>
        {/* <div className='item__col-group'>
            <div className='item__col metric'>Avg</div>
            <div className='item__col metric'>Opp Avg</div>
            <div className='item__col metric'>Opp Diff</div>
            </div> */}
      </div>
    )
  }

  Row.propTypes = {
    index: PropTypes.number,
    key: PropTypes.number,
    style: PropTypes.object
  }

  const head = (
    <div className='list__head'>
      <div className='list__filters' />
      <div className='list__headers'>
        <div className='item__col lead'>Name</div>
        <div className='item__col-group'>
          <div className='item__col'>Type</div>
          <div className='item__col'>Source</div>
          <div className='item__col'>Line</div>
          <div className='item__col'>Proj</div>
          <div className='item__col'>Diff</div>
          <div className='item__col'>Over</div>
          <div className='item__col'>Under</div>
        </div>
        {/* <div className='item__col-group'>
            <div className='item__col'>Avg</div>
            <div className='item__col'>Opp Avg</div>
            <div className='item__col'>Opp Diff</div>
            </div> */}
      </div>
    </div>
  )

  const body = (
    <AutoSizer>
      {({ height, width }) => (
        <List
          ref={listEl}
          width={width}
          height={height}
          columnWidth={60}
          rowHeight={ROW_HEIGHT}
          rowCount={player_props.length}
          columnCount={50}
          rowRenderer={Row}
        />
      )}
    </AutoSizer>
  )

  return <PageLayout {...{ body, head }} />
}

PropsPage.propTypes = {
  load: PropTypes.func,
  player_props: PropTypes.array
}
