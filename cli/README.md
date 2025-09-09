# CLI Tools

This directory contains command-line interface tools for XO.football development and debugging.

## debug-data-view.mjs

A CLI tool that converts XO.football short data view URLs to SQL queries for debugging purposes.

### Purpose

XO.football data views generate complex SQL queries from user table configurations. When debugging data view issues, it's helpful to:

1. Extract the actual SQL query being generated
2. Analyze the query structure and joins
3. Execute the query directly in the database
4. Identify performance bottlenecks or logical errors

This tool bridges the gap between the short URLs used for sharing data views and the underlying SQL for debugging.

### Usage

**Important**: This tool must be run from the XO.football league repository directory, not from the user-base root. The tool automatically connects to the production database to access actual short URL data.

```bash
# Navigate to league repository from user-base root
cd repository/active/league

# Basic usage - convert short URL to SQL (uses production database)
yarn debug:data-view /u/4d5fbae871fd62842a6180d123988d95

# Alternative using node directly (explicitly set production environment)
NODE_ENV=production node cli/debug-data-view.mjs /u/4d5fbae871fd62842a6180d123988d95

# Beautify SQL output using prettier
yarn debug:data-view /u/4d5fbae871fd62842a6180d123988d95 --beautify

# Enable debug logging to see conversion process
yarn debug:data-view /u/4d5fbae871fd62842a6180d123988d95 --debug

# Write SQL to file instead of console
yarn debug:data-view /u/4d5fbae871fd62842a6180d123988d95 --output-file query.sql

# Combine options
yarn debug:data-view /u/abc123 --beautify --debug --output-file formatted.sql
```

### Options

- `--beautify, -b`: Format SQL using prettier-plugin-sql for better readability
- `--debug, -d`: Enable debug logging to see the conversion process step-by-step
- `--output-file, -o <file>`: Write SQL to specified file instead of console output
- `--help, -h`: Show help information

### Input Format

The tool expects short URLs in the format:
```
/u/{32-character-hexadecimal-hash}
```

Examples:
- `/u/4d5fbae871fd62842a6180d123988d95`
- `/u/a1b2c3d4e5f6789012345678901234ab`

### Process Flow

1. **Hash Extraction**: Extracts the 32-character hash from the short URL
2. **Database Lookup**: Queries the `urls` table to find the full URL
3. **Parameter Parsing**: Parses URL query parameters to reconstruct table state:
   - `columns`: Column definitions and parameters
   - `prefix_columns`: Fixed prefix columns
   - `where`: Filter conditions and clauses
   - `sort`: Sorting configuration
   - `splits`: Year/week split dimensions
   - `offset`/`limit`: Pagination parameters
4. **SQL Generation**: Calls `get_data_view_results_query` to generate SQL
5. **Output**: Displays or saves the generated SQL query

### Example Output

```sql
WITH base_years AS (
  SELECT unnest(ARRAY[2020,2021,2022,2023]) as year
),
player_years AS (
  SELECT DISTINCT player.pid, base_years.year 
  FROM player CROSS JOIN base_years 
  WHERE player.pos IN ('QB', 'RB', 'WR', 'TE')
)
SELECT 
  player.pid,
  player.fname,
  player.lname,
  player.pos,
  player_years.year,
  fantasy_points.total_points
FROM player
INNER JOIN player_years ON player_years.pid = player.pid  
LEFT JOIN fantasy_points ON fantasy_points.pid = player.pid 
  AND fantasy_points.year = player_years.year
WHERE player.pos IN ('QB', 'RB', 'WR', 'TE')
GROUP BY player.pid, player.fname, player.lname, player.pos, player_years.year
ORDER BY fantasy_points.total_points DESC NULLS LAST, player.pid ASC
LIMIT 500;
```

### Error Handling

The tool provides clear error messages for common issues:

- **Invalid URL format**: "Invalid short URL format. Expected: /u/{hash}"
- **Hash not found**: "Short URL hash not found in database: {hash}"
- **Malformed parameters**: "Failed to parse {parameter} parameter: {details}"
- **SQL generation errors**: Column definition or query construction issues

### Integration with Debugging Workflow

This tool is designed to work with the data view debugging workflow:

1. **Extract SQL** using this CLI tool
2. **Analyze structure** - review CTEs, joins, and filters
3. **Execute queries** using postgres MCP tools
4. **Check performance** with EXPLAIN ANALYZE
5. **Identify issues** in column definitions or parameters

### Development and Testing

The tool includes comprehensive test coverage in `test/cli.debug-data-view.mjs`:

- URL parsing and validation
- Database lookup functionality  
- Parameter parsing (including malformed JSON)
- SQL generation verification
- Output options (beautify, file output)
- Error handling scenarios

Run tests with:
```bash
yarn test --reporter min test/cli.debug-data-view.mjs
```

### Dependencies

- **yargs**: Command-line argument parsing
- **debug**: Debug logging functionality
- **prettier** (optional): SQL beautification
- **prettier-plugin-sql** (optional): SQL formatting plugin

### Troubleshooting

**"Column definition not found" errors**:
- The data view uses column definitions from `data_views_column_definitions`
- Missing definitions will cause SQL generation to fail
- This indicates the data view configuration references non-existent columns

**Database connection issues**:
- The tool uses NODE_ENV=production to connect to the production database
- Ensure the production database configuration in `config.js` is correct
- Check that the `urls` table exists and is accessible in the production database
- Verify database credentials and connection settings for production environment
- Short URLs are only stored in the production database, not in test/development databases

**Prettier formatting failures**:
- If prettier-plugin-sql is not installed, beautification falls back to raw SQL
- Install the plugin: `yarn add -D prettier-plugin-sql`
- Ensure prettier configuration allows SQL parsing

### Related Tools

- **data-view-test-cli.mjs**: Test data view configurations against expected results
- **postgres MCP tools**: Execute and analyze generated SQL queries
- **debug workflow**: Systematic approach to data view debugging

For more information on data view debugging, see:
- Debugging workflow: `/Users/trashman/user-base/workflow/debug-data-view.md` (absolute path)
- Or from user-base root: `workflow/debug-data-view.md`
- Task implementation: `/Users/trashman/user-base/task/league/create-data-view-debugging-workflow-and-cli.md`