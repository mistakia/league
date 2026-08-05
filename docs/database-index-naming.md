# Database Index Naming Convention

## Standard Format

All indexes must follow the pattern: `idx_table_column_purpose`

## Examples

**Single Column**

```sql
CREATE INDEX idx_player_pid ON player (pid);
CREATE INDEX idx_draft_lid ON draft (lid);
```

**Multiple Columns**

```sql
CREATE INDEX idx_nfl_plays_season_year_esbid ON nfl_plays (season_year, esbid);
CREATE INDEX idx_player_gamelogs_esbid_nfl_team_pid ON player_gamelogs (esbid, nfl_team, pid);
```

**Covering Indexes**

```sql
CREATE INDEX idx_player_pid_incl_primary_position_first_name_last_name ON player (pid) INCLUDE (primary_position, first_name, last_name);
```

**Purpose-Specific**

```sql
CREATE INDEX idx_nfl_plays_fantasy ON nfl_plays (season_year, season_type, week, play_type) WHERE ball_carrier_pid IS NOT NULL;
```

## Rationale

This convention provides:

- Consistent namespace (`idx_` prefix)
- Clear table identification
- Logical column ordering
- Predictable naming for maintenance scripts
- Distinction from system-generated indexes
