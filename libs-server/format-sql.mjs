import prettier from 'prettier'
import debug from 'debug'

const log = debug('format-sql')

/**
 * Format SQL query using prettier with SQL plugin
 * @param {string} sql - The SQL query to format
 * @param {Object} options - Formatting options
 * @param {string} options.parser - Parser to use (default: 'sql', alternatives: 'postgresql', 'babel')
 * @param {string} options.keywordCase - Case for SQL keywords (default: 'upper')
 * @param {number} options.printWidth - Line width before wrapping (default: 80)
 * @param {number} options.expressionWidth - Width for expressions (default: 50)
 * @param {number} options.linesBetweenQueries - Lines between multiple queries (default: 2)
 * @param {boolean} options.wrapInTemplate - Wrap in template literal for babel parser (default: false)
 * @returns {Promise<string>} - Formatted SQL query
 */
export const format_sql = async (sql, options = {}) => {
  const {
    parser = 'sql',
    keywordCase = 'upper',
    printWidth = 80,
    expressionWidth = 50,
    linesBetweenQueries = 2,
    wrapInTemplate = false
  } = options

  try {
    // For babel parser, wrap in template literal
    const input = wrapInTemplate ? `sql\`${sql}\`` : sql

    const formatted = await prettier.format(input, {
      parser,
      plugins:
        parser === 'babel'
          ? ['prettier-plugin-embed', 'prettier-plugin-sql']
          : ['prettier-plugin-sql'],
      printWidth,
      keywordCase,
      expressionWidth,
      linesBetweenQueries,
      // Additional options for babel parser
      ...(parser === 'babel' && {
        embeddedSqlTags: ['sql'],
        language: 'postgresql',
        tabWidth: 2,
        semi: false
      })
    })

    return formatted
  } catch (error) {
    log('Failed to format SQL:', error.message)
    // Return original SQL if formatting fails
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
