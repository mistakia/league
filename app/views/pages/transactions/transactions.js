import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import AutoSizer from 'react-virtualized/dist/es/AutoSizer'
import List from 'react-virtualized/dist/es/List'
import InfiniteLoader from 'react-virtualized/dist/es/InfiniteLoader'
import Container from '@material-ui/core/Container'

import PageLayout from '@layouts/page'
import TransactionRow from '@components/transaction-row'
import TransactionTypeFilter from '@components/transaction-type-filter'
import TransactionTeamFilter from '@components/transaction-team-filter'

import './transactions.styl'

const ROW_HEIGHT = window.innerWidth < 800 ? 75 : 45

export default class TransactionsPage extends React.Component {
  componentDidMount = () => {
    this.props.load()
  }

  render = () => {
    const { transactions, isPending, hasMore, loadNext } = this.props

    const Row = ({ index, ...params }) => {
      const transaction = transactions.get(index)
      return <TransactionRow transaction={transaction} showPlayer {...params} />
    }

    const isRowLoaded = ({ index }) => !hasMore || index < transactions.size
    const loadMoreRows = isPending
      ? () => {}
      : () => {
          loadNext()
        }
    const rowCount = hasMore ? transactions.size + 1 : transactions.size

    const body = (
      <Container maxWidth='md' classes={{ root: 'transactions' }}>
        <div className='transactions__filter'>
          <TransactionTypeFilter />
          <TransactionTeamFilter />
        </div>
        <div className='transactions__body'>
          <InfiniteLoader
            isRowLoaded={isRowLoaded}
            loadMoreRows={loadMoreRows}
            rowCount={rowCount}>
            {({ onRowsRendered, registerChild }) => (
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
      </Container>
    )

    return <PageLayout body={body} />
  }
}

TransactionsPage.propTypes = {
  load: PropTypes.func,
  transactions: ImmutablePropTypes.list,
  isPending: PropTypes.bool,
  hasMore: PropTypes.bool,
  loadNext: PropTypes.func
}
