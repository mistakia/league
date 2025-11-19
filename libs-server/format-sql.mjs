import prettier from 'prettier'
import debug from 'debug'

const log = debug('format-sql')

/**
 * Format SQL query using prettier with SQL plugin
 * @param {string} sql - The SQL query to format
 * @param {Object} options - Formatting options
 * @param {string} options.parser - Parser to use (default: 'sql', alternatives: 'babel')
 * @param {string} options.language - SQL dialect/language (e.g., 'postgresql', 'mysql', 'sqlite')
 * @param {string} options.keywordCase - Case for SQL keywords (default: 'upper')
 * @param {number} options.printWidth - Line width before wrapping (default: 80)
 * @param {number} options.expressionWidth - Width for expressions (default: 50)
 * @param {number} options.linesBetweenQueries - Lines between multiple queries (default: 2)
 * @param {boolean} options.wrapInTemplate - Wrap in template literal for babel parser (default: false)
 * @returns {Promise<string>} - Formatted SQL query, or original SQL if formatting fails
 */
export const format_sql = async (sql, options = {}) => {
  const {
    parser = 'sql',
    language,
    keywordCase = 'upper',
    printWidth = 80,
    expressionWidth = 50,
    linesBetweenQueries = 2,
    wrapInTemplate = false
  } = options

  try {
    const input = wrapInTemplate ? `sql\`${sql}\`` : sql

    const prettier_options = {
      parser,
      plugins:
        parser === 'babel'
          ? ['prettier-plugin-embed', 'prettier-plugin-sql']
          : ['prettier-plugin-sql'],
      printWidth,
      keywordCase,
      expressionWidth,
      linesBetweenQueries
    }

    if (parser === 'sql' && language) {
      prettier_options.language = language
    }

    if (parser === 'babel') {
      prettier_options.embeddedSqlTags = ['sql']
      prettier_options.language = language || 'postgresql'
      prettier_options.tabWidth = 2
      prettier_options.semi = false
    }

    return await prettier.format(input, prettier_options)
  } catch (error) {
    log('Failed to format SQL:', error.message)
    return sql
  }
}

/**
 * Normalize SQL query for comparison by replacing table hashes
 * @param {string} query - The SQL query to normalize
 * @returns {string} - Normalized query with table hashes replaced
 */
export const normalize_sql_for_comparison = (query) => {
  // Extract unique table hashes from the query
  const table_hashes = [
    ...new Set(
      (query.match(/t([A-Za-z0-9]{32})/g) || []).map((match) => match.slice(1))
    )
  ]

  // Replace each hash with a generic placeholder
  return table_hashes.reduce(
    (q, hash, index) =>
      q.replaceAll(new RegExp(`${hash}`, 'g'), `table_${index}`),
    query
  )
}
