# Create Data View Link Workflow

<task>
Generate a valid data view link for the league system that can be shared for analysis and collaboration.
</task>

<context>
Data view links encode query parameters for customized data views on xo.football.

Base URL: `https://xo.football/data-views`
Shortened: `https://xo.football/u/{hash}`

The data view system supports complex queries with:

- Column selections (main data and prefix columns)
- Filtering conditions (where clauses)
- Sorting specifications
- Time-based splits (year/week groupings)
- Rate type normalizations (per-game, per-play, etc.)
- League/scoring format configurations
  </context>

<instructions>
1. **Define Query Requirements**
   - Identify the primary data columns needed for analysis
   - Determine any prefix columns (player identification, team info)
   - Specify filtering criteria (position, year range, team, etc.)
   - Define sorting preferences
   - Choose appropriate time splits if needed

2. **Validate Column Definitions**

   - Verify all column IDs exist in the data view specifications (docs/data-view-specs/)
   - Check that column parameters are valid for the selected columns using parameter schemas
   - Ensure rate types are supported by the chosen columns per column family definitions
   - Validate year ranges and format hashes against specification requirements

3. **Structure Query Parameters**

   - `columns`: Array of main data column configurations
   - `prefix_columns`: Array of identifying column configurations
   - `where`: Array of filter conditions
   - `sort`: Array of sorting specifications
   - `splits`: Array of time grouping dimensions
   - `view_name`: Descriptive name for the view
   - `view_description`: Detailed description of analysis purpose

4. **Generate Column Configurations**
   Simple: `'player_position'`
   Parameterized: `{"column_id": "name", "params": {"year": [2024]}}`

5. **Create Filter Conditions**

   ```javascript
   {
     "column_id": "player_position",
     "operator": "IN",
     "value": ["QB", "RB", "WR"],
     "params": {"year": [2024]}
   }
   ```

6. **Build Request Object**

   ```javascript
   {
     "columns": [...],
     "prefix_columns": [...],
     "where": [...],
     "sort": [...],
     "splits": [...],
     "view_name": "View Name",
     "view_description": "Detailed description"
   }
   ```

7. **Generate URL Options**

   - URL encode the JSON parameters
   - Construct: `https://xo.football/data-views?columns={encoded}&prefix_columns={encoded}&sort={encoded}&where={encoded}&splits={encoded}&view_name={encoded}&view_description={encoded}`
   - POST the full URL to `/u`
   - Use returned hash: `https://xo.football/u/{hash}`

8. **Validate Generated Link**

   - Test the link opens correctly
   - Verify data loads as expected
   - Check that all filters and sorts are applied
   - Confirm view name and description display properly

**Bash Command for URL Creation:**

```bash
# Using jq for proper JSON handling (recommended)
VIEW_URL="https://xo.football/data-views?view_name=Test%20View&columns=%5B%7B%22column_id%22%3A%22player_name%22%7D%5D"
echo '{"url": "'$VIEW_URL'"}' | curl -X POST https://xo.football/u \
  -H "Content-Type: application/json" \
  -d @-
```

**Error Handling:** Refer to guideline for validation requirements and troubleshooting.
</instructions>

<output_format>

1. **Link**: `https://xo.football/u/{hash}`
2. **Name**: View name for easy identification
3. **Description**: Brief explanation of what the data view shows
   </output_format>
