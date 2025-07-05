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
CREATE INDEX idx_nfl_plays_year_esbid ON nfl_plays (year, esbid);
CREATE INDEX idx_player_gamelogs_esbid_tm_pid ON player_gamelogs (esbid, tm, pid);
```

**Covering Indexes**

```sql
CREATE INDEX idx_player_pid_incl_pos_fname_lname ON player (pid) INCLUDE (pos, fname, lname);
```

**Purpose-Specific**

```sql
CREATE INDEX idx_nfl_plays_fantasy ON nfl_plays (year, seas_type, week, play_type) WHERE bc_pid IS NOT NULL;
```

## Rationale

This convention provides:

- Consistent namespace (`idx_` prefix)
- Clear table identification
- Logical column ordering
- Predictable naming for maintenance scripts
- Distinction from system-generated indexes
