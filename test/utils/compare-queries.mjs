import chai from 'chai'
const { expect } = chai

export default function compare_queries(actual_query, expected_query) {
  const actual_table_hashes = [
    ...new Set(
      actual_query.match(/t([A-Za-z0-9]{32})/g).map((match) => match.slice(1))
    )
  ]
  const expected_table_hashes = [
    ...new Set(
      expected_query.match(/t([A-Za-z0-9]{32})/g).map((match) => match.slice(1))
    )
  ]

  const actual_query_with_replaced_hashes = actual_table_hashes.reduce(
    (query, hash, index) =>
      query.replaceAll(new RegExp(`${hash}`, 'g'), `table_${index}`),
    actual_query
  )
  const expected_query_with_replaced_hashes = expected_table_hashes.reduce(
    (query, hash, index) =>
      query.replaceAll(new RegExp(`${hash}`, 'g'), `table_${index}`),
    expected_query
  )

  expect(actual_query_with_replaced_hashes).to.equal(
    expected_query_with_replaced_hashes
  )
}
