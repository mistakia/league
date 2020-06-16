import React from 'react'
import { AutoSizer, List, InfiniteLoader } from 'react-virtualized'

import PageLayout from '@layouts/page'
import TransactionRow from '@components/transaction-row'
import TransactionTypeFilter from '@components/transaction-type-filter'
import TransactionTeamFilter from '@components/transaction-team-filter'

import './transactions.styl'

const ROW_HEIGHT = 45

export default class TransactionsPage extends React.Component {
  componentDidMount = () => {
    this.props.load()
  }

  render = () => {
    const { transactions, isPending, hasMore, loadNext } = this.props

    const Row = ({ index, ...params }) => {
      const transaction = transactions.get(index)
      return <TransactionRow transaction={transaction} {...params} />
    }

    const isRowLoaded = ({ index }) => !hasMore || index < transactions.size
    const loadMoreRows = isPending ? () => {} : () => { loadNext() }
    const rowCount = hasMore ? transactions.size + 1 : transactions.size

    const body = (
      <div className='transactions'>
        <div className='transactions__filter'>
          <TransactionTypeFilter />
          <TransactionTeamFilter />
        </div>
        <div className='transactions__body'>
          <InfiniteLoader
            isRowLoaded={isRowLoaded}
            loadMoreRows={loadMoreRows}
            rowCount={rowCount}>
            {({onRowsRendered, registerChild}) => (
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    ref={registerChild}
                    width={width}
                    height={height}
                    rowHeight={ROW_HEIGHT}
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

    return (
      <PageLayout body={body} />
    )
  }
}
