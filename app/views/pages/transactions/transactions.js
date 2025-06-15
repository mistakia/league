import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import AutoSizer from 'react-virtualized-compat/dist/es/AutoSizer'
import List from 'react-virtualized-compat/dist/es/List'
import InfiniteLoader from 'react-virtualized-compat/dist/es/InfiniteLoader'

import PageLayout from '@layouts/page'
import TransactionRow from '@components/transaction-row'
import TransactionTypeFilter from '@components/transaction-type-filter'
import TransactionTeamFilter from '@components/transaction-team-filter'

import './transactions.styl'

const layout_breakpoint = 700
const getHeight = () => (window.innerWidth > layout_breakpoint ? 60 : 112)
const getLayout = () =>
  window.innerWidth > layout_breakpoint ? 'wide' : 'narrow'

export default function TransactionsPage({
  transactions,
  isPending,
  hasMore,
  loadNext,
  load
}) {
  const navigate = useNavigate()
  const [height, setHeight] = useState(getHeight())
  const [layout, setLayout] = useState(getLayout())

  const update = () => {
    setHeight(getHeight())
    setLayout(getLayout())
  }

  const { lid } = useParams()

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    load(lid)
  }, [lid, load, navigate])

  useEffect(() => {
    window.addEventListener('resize', update)
    return function () {
      window.removeEventListener('resize', update)
    }
  })

  const Row = ({ index, ...params }) => {
    const transaction = transactions.get(index)
    return (
      <TransactionRow
        transaction={transaction}
        showPlayer
        layout={layout}
        {...params}
      />
    )
  }

  Row.propTypes = {
    index: PropTypes.number
  }

  const isRowLoaded = ({ index }) => !hasMore || index < transactions.size
  const loadMoreRows = isPending
    ? () => {}
    : () => {
        loadNext(lid)
      }
  const rowCount = hasMore ? transactions.size + 1 : transactions.size

  const body = (
    <div className='league-container league-transactions'>
      <div className='transactions__filter'>
        <TransactionTypeFilter />
        <TransactionTeamFilter />
      </div>
      <div className='transactions__body'>
        <InfiniteLoader
          isRowLoaded={isRowLoaded}
          loadMoreRows={loadMoreRows}
          rowCount={rowCount}
        >
          {({ onRowsRendered, registerChild }) => (
            <AutoSizer>
              {({ height: h, width }) => (
                <List
                  ref={registerChild}
                  width={width}
                  height={h}
                  rowHeight={height}
                  rowCount={transactions.size}
                  onRowsRendered={onRowsRendered}
                  rowRenderer={Row}
                />
              )}
            </AutoSizer>
          )}
        </InfiniteLoader>
      </div>
    </div>
  )

  return <PageLayout body={body} />
}

TransactionsPage.propTypes = {
  load: PropTypes.func,
  transactions: ImmutablePropTypes.list,
  isPending: PropTypes.bool,
  hasMore: PropTypes.bool,
  loadNext: PropTypes.func
}
