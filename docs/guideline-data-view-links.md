# Data View Link Guidelines

## Purpose

This guideline establishes standards and best practices for creating, sharing, and maintaining data view links in the league system. These links enable agents and users to create consistent, performant, and meaningful data views for fantasy football analysis.

## Link Structure Standards

### Base URL Format

Data view links MUST use one of these formats:

- **Full URL**: `https://xo.football/data-views?{encoded_query_params}`
- **Shortened URL**: `https://xo.football/u/{hash}` (RECOMMENDED)

### Required Query Parameters

All data view links MUST include these core parameters:

- `columns`: Main data columns for analysis
- `prefix_columns`: Identification columns (player_name, team, position)
- `view_name`: Descriptive name for the view
- `view_description`: Purpose and context of the analysis

### Optional Query Parameters

- `where`: Filter conditions to limit results
- `sort`: Sorting specifications for result ordering
- `splits`: Time-based groupings (year, week)
- `view_id`: UUID for saved views
- `view_search_column_id`: Default search column

## Column Selection Standards

### Prefix Columns

Prefix columns SHOULD be limited to essential identification (player_name, position, team).

### Main Columns

Main columns MUST be relevant to the analysis purpose and include required parameters.

## Parameter Standards

### Key Requirements

- Use single year arrays for optimal performance: `{"year": [2024]}`
- Rate types must be compatible with splits (avoid per_game with week splits)
- Fantasy points columns require scoring_format_hash parameter
- Use common formats: half_ppr, ppr, standard

## Filter Condition Standards

Where clauses structure:

```javascript
{
  "column_id": "valid_column_identifier",
  "operator": "IN|=|>|<|>=|<=|LIKE|IS NULL|IS NOT NULL",
  "value": "string|number|array",
  "params": {} // if needed
}
```

### Common Filter Patterns

**Position Filtering:**

```javascript
{
  "column_id": "player_position",
  "operator": "IN",
  "value": ["QB", "RB", "WR", "TE"]
}
```

**Year-Specific Filtering:**

```javascript
{
  "column_id": "player_fantasy_points_from_plays",
  "operator": ">",
  "value": 100,
  "params": {"year": [2024], "scoring_format_hash": "half_ppr"}
}
```

**Team Filtering:**

```javascript
{
  "column_id": "player_nfl_teams",
  "operator": "IN",
  "value": ["SF", "KC", "BUF"]
}
```

## Sorting Standards

### Sort Configuration

Sort arrays MUST specify both column and direction:

```javascript
"sort": [
  {
    "column_id": "player_fantasy_points_from_plays",
    "desc": true
  }
]
```

Sort columns must exist in the selected column set.

## Naming Standards

### View Names

View names MUST be:

- Descriptive of the analysis purpose
- Concise (under 50 characters)
- Specific about time period and context

```javascript
// GOOD: Descriptive and specific
"view_name": "2024 Half-PPR RB Fantasy Points"

// AVOID: Vague or generic
"view_name": "Player Analysis"
```

### View Descriptions

View descriptions MUST include:

- Purpose of the analysis
- Key parameters and filters applied
- Expected use cases or insights

```javascript
// GOOD: Comprehensive description
"view_description": "Analyzes 2024 running back fantasy point production in half-PPR scoring format, sorted by total points to identify top performers for season-long leagues"

// AVOID: Minimal or unhelpful
"view_description": "RB stats"
```

## Performance Guidelines

- Use single-year parameters for partitioned table optimization
- Apply meaningful where clauses to reduce result sets
- Limit prefix columns to essentials
- Ensure rate type and split compatibility

## Error Prevention Standards

Validate before generating links:

1. Column existence in data view specs
2. Parameter compatibility with columns
3. Rate type support by column definitions
4. Split compatibility with rate types
5. Valid operators and value types

## Security Standards

- Shortened URLs only for xo.football domain
- Proper URL encoding of query parameters

## References

- **Data View Specs**: `docs/data-view-specs/` - Column definitions and parameter schemas
- **Workflow**: `workflow-create-data-view-link.md` - Step-by-step process implementation
