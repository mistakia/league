# Named Scoring and League Formats

*Generated at: 2026-05-29T15:23:53.767Z*

This document shows the configuration for each named format in the system. Identities are stable opaque IDs; multiple source keys may share an ID when their configs are byte-identical (the alphabetical-first slug wins).

## League Format Summary

| Source Key | ID | Description |
|------------|----|-------------|
| `draftkings_classic` | `draftkings_classic` | DraftKings classic DFS lineup - 1QB/2RB/3WR/1TE/1FLEX/1DST with $50k salary cap |
| `genesis_10_team` | `genesis_10_team` | Genesis League 10-team superflex format with no kicker - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `half_ppr_10_team` | `half_ppr_10_team` | 10-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX |
| `half_ppr_10_team_superflex` | `half_ppr_10_team_superflex` | 10-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `half_ppr_12_team` | `half_ppr_12_team` | 12-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX |
| `half_ppr_12_team_superflex` | `half_ppr_12_team_superflex` | 12-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `half_ppr_lower_turnover_10_team` | `half_ppr_lower_turnover_10_team` | 10-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX |
| `half_ppr_lower_turnover_10_team_superflex` | `half_ppr_lower_turnover_10_team_superflex` | 10-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `half_ppr_lower_turnover_12_team` | `half_ppr_lower_turnover_12_team` | 12-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX |
| `half_ppr_lower_turnover_12_team_superflex` | `half_ppr_lower_turnover_12_team_superflex` | 12-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `ppr_10_team` | `ppr_10_team` | 10-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX |
| `ppr_10_team_superflex` | `ppr_10_team_superflex` | 10-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `ppr_12_team` | `ppr_12_team` | 12-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX |
| `ppr_12_team_superflex` | `ppr_12_team_superflex` | 12-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `ppr_lower_turnover_10_team` | `ppr_lower_turnover_10_team` | 10-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX |
| `ppr_lower_turnover_10_team_superflex` | `ppr_lower_turnover_10_team_superflex` | 10-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `ppr_lower_turnover_12_team` | `ppr_lower_turnover_12_team` | 12-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX |
| `ppr_lower_turnover_12_team_superflex` | `ppr_lower_turnover_12_team_superflex` | 12-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `sfb15_mfl` | `sfb15_mfl` | Scott Fish Bowl 15 MFL format with 2 superflex and 9 flex positions |
| `sfb15_sleeper` | `sfb15_sleeper` | Scott Fish Bowl 15 Sleeper format with 2 superflex and 9 flex positions |
| `standard_10_team` | `standard_10_team` | 10-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX |
| `standard_12_team` | `standard_12_team` | 12-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX |

## Scoring Format Summary

| Source Key | ID | Description |
|------------|----|-------------|
| `draftkings` | `draftkings` | DraftKings DFS scoring with full PPR, 4-point passing TDs, and milestone bonuses - bonus/kicker/defense support needed |
| `fanduel` | `fanduel` | FanDuel DFS scoring with half PPR, 4-point passing TDs, and yardage bonuses - bonus/kicker/defense support needed |
| `genesis` | `genesis` | Genesis League scoring with half PPR, 4-point passing TDs, 0.05 passing yards, and -1 turnovers |
| `half_ppr` | `half_ppr` | Half point per reception scoring with 4-point passing touchdowns |
| `half_ppr_lower_turnover` | `half_ppr_lower_turnover` | Half PPR with lower turnover penalties: -1 INT, -1 fumble lost |
| `ppr` | `ppr` | Full point per reception scoring with 4-point passing touchdowns |
| `ppr_lower_turnover` | `draftkings` | Full PPR with lower turnover penalties: -1 INT, -1 fumble lost |
| `sfb15_mfl` | `sfb15_mfl` | Scott Fish Bowl 15 MFL scoring (PPR + 0.5 per carry + 1 per target) - no turnover penalties |
| `sfb15_sleeper` | `sfb15_sleeper` | Scott Fish Bowl 15 Sleeper scoring (2.5 PPR + 0.5 per carry) - no turnover penalties |
| `standard` | `standard` | Standard scoring with no PPR and 4-point passing touchdowns |

## League Format Details

### draftkings_classic

**Source Key:** `draftkings_classic`
**Label:** DraftKings Classic DFS
**Description:** DraftKings classic DFS lineup - 1QB/2RB/3WR/1TE/1FLEX/1DST with $50k salary cap
**Scoring Format:** `draftkings`
**Pricing Model:** `dfs_fixed`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 1 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 3 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 0 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 0 |
| `bench` | 0 |
| `ps` | 0 |
| `reserve_short_term_limit` | 0 |
| `cap` | 50000 |
| `min_bid` | 0 |

### genesis_10_team

**Source Key:** `genesis_10_team`
**Label:** Genesis League 10 Team
**Description:** Genesis League 10-team superflex format with no kicker - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `genesis`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 10 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 1 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 0 |
| `bench` | 7 |
| `ps` | 4 |
| `reserve_short_term_limit` | 99 |
| `cap` | 200 |
| `min_bid` | 0 |

### half_ppr_10_team

**Source Key:** `half_ppr_10_team`
**Label:** Half PPR 10 Team
**Description:** 10-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `half_ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 10 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 0 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### half_ppr_10_team_superflex

**Source Key:** `half_ppr_10_team_superflex`
**Label:** Half PPR 10 Team Superflex
**Description:** 10-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `half_ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 10 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 1 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### half_ppr_12_team

**Source Key:** `half_ppr_12_team`
**Label:** Half PPR 12 Team
**Description:** 12-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `half_ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 12 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 0 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### half_ppr_12_team_superflex

**Source Key:** `half_ppr_12_team_superflex`
**Label:** Half PPR 12 Team Superflex
**Description:** 12-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `half_ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 12 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 1 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### half_ppr_lower_turnover_10_team

**Source Key:** `half_ppr_lower_turnover_10_team`
**Label:** Half PPR Lower Turnover 10 Team
**Description:** 10-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `half_ppr_lower_turnover`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 10 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 0 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### half_ppr_lower_turnover_10_team_superflex

**Source Key:** `half_ppr_lower_turnover_10_team_superflex`
**Label:** Half PPR Lower Turnover 10 Team Superflex
**Description:** 10-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `half_ppr_lower_turnover`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 10 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 1 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### half_ppr_lower_turnover_12_team

**Source Key:** `half_ppr_lower_turnover_12_team`
**Label:** Half PPR Lower Turnover 12 Team
**Description:** 12-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `half_ppr_lower_turnover`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 12 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 0 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### half_ppr_lower_turnover_12_team_superflex

**Source Key:** `half_ppr_lower_turnover_12_team_superflex`
**Label:** Half PPR Lower Turnover 12 Team Superflex
**Description:** 12-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `half_ppr_lower_turnover`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 12 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 1 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### ppr_10_team

**Source Key:** `ppr_10_team`
**Label:** PPR 10 Team
**Description:** 10-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 10 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 0 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### ppr_10_team_superflex

**Source Key:** `ppr_10_team_superflex`
**Label:** PPR 10 Team Superflex
**Description:** 10-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 10 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 1 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### ppr_12_team

**Source Key:** `ppr_12_team`
**Label:** PPR 12 Team
**Description:** 12-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 12 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 0 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### ppr_12_team_superflex

**Source Key:** `ppr_12_team_superflex`
**Label:** PPR 12 Team Superflex
**Description:** 12-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 12 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 1 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### ppr_lower_turnover_10_team

**Source Key:** `ppr_lower_turnover_10_team`
**Label:** PPR Lower Turnover 10 Team
**Description:** 10-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `draftkings`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 10 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 0 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### ppr_lower_turnover_10_team_superflex

**Source Key:** `ppr_lower_turnover_10_team_superflex`
**Label:** PPR Lower Turnover 10 Team Superflex
**Description:** 10-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `draftkings`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 10 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 1 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### ppr_lower_turnover_12_team

**Source Key:** `ppr_lower_turnover_12_team`
**Label:** PPR Lower Turnover 12 Team
**Description:** 12-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `draftkings`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 12 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 0 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### ppr_lower_turnover_12_team_superflex

**Source Key:** `ppr_lower_turnover_12_team_superflex`
**Label:** PPR Lower Turnover 12 Team Superflex
**Description:** 12-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `draftkings`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 12 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 1 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### sfb15_mfl

**Source Key:** `sfb15_mfl`
**Label:** Scott Fish Bowl 15 (MFL)
**Description:** Scott Fish Bowl 15 MFL format with 2 superflex and 9 flex positions
**Scoring Format:** `sfb15_mfl`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 12 |
| `sqb` | 1 |
| `srb` | 0 |
| `swr` | 0 |
| `ste` | 0 |
| `srbwr` | 0 |
| `srbwrte` | 9 |
| `sqbrbwrte` | 2 |
| `swrte` | 0 |
| `sdst` | 0 |
| `sk` | 0 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### sfb15_sleeper

**Source Key:** `sfb15_sleeper`
**Label:** Scott Fish Bowl 15 (Sleeper)
**Description:** Scott Fish Bowl 15 Sleeper format with 2 superflex and 9 flex positions
**Scoring Format:** `sfb15_sleeper`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 12 |
| `sqb` | 1 |
| `srb` | 0 |
| `swr` | 0 |
| `ste` | 0 |
| `srbwr` | 0 |
| `srbwrte` | 9 |
| `sqbrbwrte` | 2 |
| `swrte` | 0 |
| `sdst` | 0 |
| `sk` | 0 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### standard_10_team

**Source Key:** `standard_10_team`
**Label:** Standard 10 Team (No PPR)
**Description:** 10-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `standard`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 10 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 0 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

### standard_12_team

**Source Key:** `standard_12_team`
**Label:** Standard 12 Team (No PPR)
**Description:** 12-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `standard`
**Pricing Model:** `auction`

**Configuration:**

| Property | Value |
|----------|-------|
| `num_teams` | 12 |
| `sqb` | 1 |
| `srb` | 2 |
| `swr` | 2 |
| `ste` | 1 |
| `srbwr` | 0 |
| `srbwrte` | 1 |
| `sqbrbwrte` | 0 |
| `swrte` | 0 |
| `sdst` | 1 |
| `sk` | 1 |
| `bench` | 6 |
| `ps` | 0 |
| `reserve_short_term_limit` | 3 |
| `cap` | 200 |
| `min_bid` | 0 |

## Scoring Format Details

### draftkings

**Source Keys:** `draftkings`, `ppr_lower_turnover` (collapsed to canonical `draftkings`)
**Label:** DraftKings DFS
**Description:** DraftKings DFS scoring with full PPR, 4-point passing TDs, and milestone bonuses - bonus/kicker/defense support needed

**Configuration:**

| Property | Value |
|----------|-------|
| `pa` | 0 |
| `pc` | 0 |
| `py` | 0.04 |
| `ints` | -1 |
| `tdp` | 4 |
| `ra` | 0 |
| `ry` | 0.1 |
| `tdr` | 6 |
| `rec` | 1 |
| `rbrec` | 1 |
| `wrrec` | 1 |
| `terec` | 1 |
| `recy` | 0.1 |
| `tdrec` | 6 |
| `twoptc` | 2 |
| `fuml` | -1 |
| `prtd` | 6 |
| `krtd` | 6 |
| `fum_ret_td` | 6 |
| `trg` | 0 |
| `rush_first_down` | 0 |
| `rec_first_down` | 0 |

### fanduel

**Source Key:** `fanduel`
**Label:** FanDuel DFS
**Description:** FanDuel DFS scoring with half PPR, 4-point passing TDs, and yardage bonuses - bonus/kicker/defense support needed

**Configuration:**

| Property | Value |
|----------|-------|
| `pa` | 0 |
| `pc` | 0 |
| `py` | 0.04 |
| `ints` | -1 |
| `tdp` | 4 |
| `ra` | 0 |
| `ry` | 0.1 |
| `tdr` | 6 |
| `rec` | 0.5 |
| `rbrec` | 0.5 |
| `wrrec` | 0.5 |
| `terec` | 0.5 |
| `recy` | 0.1 |
| `tdrec` | 6 |
| `twoptc` | 2 |
| `fuml` | -2 |
| `prtd` | 6 |
| `krtd` | 6 |
| `fum_ret_td` | 6 |
| `trg` | 0 |
| `rush_first_down` | 0 |
| `rec_first_down` | 0 |

### genesis

**Source Key:** `genesis`
**Label:** Genesis League
**Description:** Genesis League scoring with half PPR, 4-point passing TDs, 0.05 passing yards, and -1 turnovers

**Configuration:**

| Property | Value |
|----------|-------|
| `pa` | 0 |
| `pc` | 0 |
| `py` | 0.05 |
| `ints` | -1 |
| `tdp` | 4 |
| `ra` | 0 |
| `ry` | 0.1 |
| `tdr` | 6 |
| `rec` | 0.5 |
| `rbrec` | 0.5 |
| `wrrec` | 0.5 |
| `terec` | 0.5 |
| `recy` | 0.1 |
| `tdrec` | 6 |
| `twoptc` | 2 |
| `fuml` | -1 |
| `prtd` | 6 |
| `krtd` | 6 |
| `fum_ret_td` | 6 |
| `trg` | 0 |
| `rush_first_down` | 0 |
| `rec_first_down` | 0 |
| `exclude_qb_kneels` | true |

### half_ppr

**Source Key:** `half_ppr`
**Label:** Half PPR
**Description:** Half point per reception scoring with 4-point passing touchdowns

**Configuration:**

| Property | Value |
|----------|-------|
| `pa` | 0 |
| `pc` | 0 |
| `py` | 0.04 |
| `ints` | -2 |
| `tdp` | 4 |
| `ra` | 0 |
| `ry` | 0.1 |
| `tdr` | 6 |
| `rec` | 0.5 |
| `rbrec` | 0.5 |
| `wrrec` | 0.5 |
| `terec` | 0.5 |
| `recy` | 0.1 |
| `tdrec` | 6 |
| `twoptc` | 2 |
| `fuml` | -2 |
| `prtd` | 6 |
| `krtd` | 6 |
| `fum_ret_td` | 6 |
| `trg` | 0 |
| `rush_first_down` | 0 |
| `rec_first_down` | 0 |

### half_ppr_lower_turnover

**Source Key:** `half_ppr_lower_turnover`
**Label:** Half PPR (Lower Turnover)
**Description:** Half PPR with lower turnover penalties: -1 INT, -1 fumble lost

**Configuration:**

| Property | Value |
|----------|-------|
| `pa` | 0 |
| `pc` | 0 |
| `py` | 0.04 |
| `ints` | -1 |
| `tdp` | 4 |
| `ra` | 0 |
| `ry` | 0.1 |
| `tdr` | 6 |
| `rec` | 0.5 |
| `rbrec` | 0.5 |
| `wrrec` | 0.5 |
| `terec` | 0.5 |
| `recy` | 0.1 |
| `tdrec` | 6 |
| `twoptc` | 2 |
| `fuml` | -1 |
| `prtd` | 6 |
| `krtd` | 6 |
| `fum_ret_td` | 6 |
| `trg` | 0 |
| `rush_first_down` | 0 |
| `rec_first_down` | 0 |

### ppr

**Source Key:** `ppr`
**Label:** PPR (Full)
**Description:** Full point per reception scoring with 4-point passing touchdowns

**Configuration:**

| Property | Value |
|----------|-------|
| `pa` | 0 |
| `pc` | 0 |
| `py` | 0.04 |
| `ints` | -2 |
| `tdp` | 4 |
| `ra` | 0 |
| `ry` | 0.1 |
| `tdr` | 6 |
| `rec` | 1 |
| `rbrec` | 1 |
| `wrrec` | 1 |
| `terec` | 1 |
| `recy` | 0.1 |
| `tdrec` | 6 |
| `twoptc` | 2 |
| `fuml` | -2 |
| `prtd` | 6 |
| `krtd` | 6 |
| `fum_ret_td` | 6 |
| `trg` | 0 |
| `rush_first_down` | 0 |
| `rec_first_down` | 0 |

### sfb15_mfl

**Source Key:** `sfb15_mfl`
**Label:** Scott Fish Bowl 15 (MFL)
**Description:** Scott Fish Bowl 15 MFL scoring (PPR + 0.5 per carry + 1 per target) - no turnover penalties

**Configuration:**

| Property | Value |
|----------|-------|
| `pa` | 0 |
| `pc` | 0 |
| `py` | 0.04 |
| `ints` | 0 |
| `tdp` | 6 |
| `ra` | 0.5 |
| `ry` | 0.1 |
| `tdr` | 6 |
| `rec` | 1 |
| `rbrec` | 1 |
| `wrrec` | 1 |
| `terec` | 2 |
| `recy` | 0.1 |
| `tdrec` | 6 |
| `twoptc` | 2 |
| `fuml` | 0 |
| `prtd` | 6 |
| `krtd` | 6 |
| `fum_ret_td` | 6 |
| `trg` | 1 |
| `rush_first_down` | 1 |
| `rec_first_down` | 1 |

### sfb15_sleeper

**Source Key:** `sfb15_sleeper`
**Label:** Scott Fish Bowl 15 (Sleeper)
**Description:** Scott Fish Bowl 15 Sleeper scoring (2.5 PPR + 0.5 per carry) - no turnover penalties

**Configuration:**

| Property | Value |
|----------|-------|
| `pa` | 0 |
| `pc` | 0 |
| `py` | 0.04 |
| `ints` | 0 |
| `tdp` | 6 |
| `ra` | 0.5 |
| `ry` | 0.1 |
| `tdr` | 6 |
| `rec` | 2.5 |
| `rbrec` | 2.5 |
| `wrrec` | 2.5 |
| `terec` | 3.5 |
| `recy` | 0.1 |
| `tdrec` | 6 |
| `twoptc` | 2 |
| `fuml` | 0 |
| `prtd` | 6 |
| `krtd` | 6 |
| `fum_ret_td` | 6 |
| `trg` | 0 |
| `rush_first_down` | 1 |
| `rec_first_down` | 1 |

### standard

**Source Key:** `standard`
**Label:** Standard (No PPR)
**Description:** Standard scoring with no PPR and 4-point passing touchdowns

**Configuration:**

| Property | Value |
|----------|-------|
| `pa` | 0 |
| `pc` | 0 |
| `py` | 0.04 |
| `ints` | -2 |
| `tdp` | 4 |
| `ra` | 0 |
| `ry` | 0.1 |
| `tdr` | 6 |
| `rec` | 0 |
| `rbrec` | 0 |
| `wrrec` | 0 |
| `terec` | 0 |
| `recy` | 0.1 |
| `tdrec` | 6 |
| `twoptc` | 2 |
| `fuml` | -2 |
| `prtd` | 6 |
| `krtd` | 6 |
| `fum_ret_td` | 6 |
| `trg` | 0 |
| `rush_first_down` | 0 |
| `rec_first_down` | 0 |

