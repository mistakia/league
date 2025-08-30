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

   **Required Verification Steps:**
   - **Check column existence**: Verify ALL column IDs exist in data-view-specs/index.json
   - **Parameter validation**: Check data-view-specs/parameters/schemas/ for valid parameters  
   - **Rate type compatibility**: Confirm rate_type values exist in data-view-specs/parameters/values/rate-types.json
   - **Split compatibility**: Verify columns support requested splits (year/week) per column family definitions
   - **Required parameters**: Ensure columns requiring scoring_format_hash, year, etc. have them specified

   **Common Column ID Patterns:**
   - Play stats: `player_[stat]_from_plays` (e.g., `player_rush_attempts_from_plays`)
   - Basic info: `player_[attribute]` (e.g., `player_name`, `player_position`) 
   - Betting: `betting_[metric]` per betting-markets.json family

3. **Structure Query Parameters**

   - `columns`: Array of main data column configurations
   - `prefix_columns`: Array of identifying column configurations
   - `where`: Array of filter conditions
   - `sort`: Array of sorting specifications
   - `splits`: Array of time grouping dimensions
   - `view_name`: Descriptive name for the view
   - `view_description`: Detailed description of analysis purpose

4. **Generate Column Configurations**
   
   **Simple (no parameters):**
   ```javascript
   'player_position'
   'player_name'  
   ```
   
   **Parameterized (with required parameters):**
   ```javascript
   {
     "column_id": "player_rush_attempts_from_plays",
     "params": {
       "year": [2024, 2023, 2022, 2021, 2020, 2019], // Multi-year array
       "seas_type": ["REG"], // Regular season only
       "week": [1], // Week 1 only
       "career_game": [1, 1] // First career game range
     }
   }
   ```
   
   **Key Parameter Patterns:**
   - **Multiple years**: Always use arrays even for single values: `"year": [2024]`
   - **Career filtering**: Use `career_game: [1, 1]` for first career game
   - **Week filtering**: Use `week: [1]` for specific weeks  
   - **Season type**: Use `seas_type: ["REG"]` for regular season

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
     "columns": [
       {
         "column_id": "player_rush_attempts_from_plays", 
         "params": {
           "year": [2024, 2023, 2022, 2021, 2020, 2019],
           "seas_type": ["REG"],
           "week": [1],
           "career_game": [1, 1]
         }
       }
     ],
     "prefix_columns": [
       "player_name",
       "player_position" 
     ],
     "where": [],
     "sort": [
       {
         "column_id": "player_rush_attempts_from_plays",
         "desc": true  // ALWAYS include desc: true/false
       }
     ],
     "splits": ["year", "week"], // Enable time-series splits
     "view_name": "Week 1 Rookie RB Rush Attempts 2019-2024",
     "view_description": "First career game rushing attempts for rookie RBs"
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
