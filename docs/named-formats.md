# Named Scoring and League Formats

_Generated at: 2026-08-05T20:21:54.370Z_

This document shows the configuration for each named format in the system. Identities are stable opaque IDs; multiple source keys may share an ID when their configs are byte-identical (the alphabetical-first slug wins).

## League Format Summary

| Source Key                                  | ID                                          | Description                                                                                                   |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `draftkings_classic`                        | `draftkings_classic`                        | DraftKings classic DFS lineup - 1QB/2RB/3WR/1TE/1FLEX/1DST with $50k salary cap                               |
| `genesis_10_team`                           | `genesis_10_team`                           | Genesis League 10-team superflex format with no kicker - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                         |
| `half_ppr_10_team`                          | `half_ppr_10_team`                          | 10-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  |
| `half_ppr_10_team_superflex`                | `half_ppr_10_team_superflex`                | 10-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 |
| `half_ppr_12_team`                          | `half_ppr_12_team`                          | 12-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  |
| `half_ppr_12_team_superflex`                | `half_ppr_12_team_superflex`                | 12-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 |
| `half_ppr_lower_turnover_10_team`           | `half_ppr_lower_turnover_10_team`           | 10-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  |
| `half_ppr_lower_turnover_10_team_superflex` | `half_ppr_lower_turnover_10_team_superflex` | 10-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `half_ppr_lower_turnover_12_team`           | `half_ppr_lower_turnover_12_team`           | 12-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  |
| `half_ppr_lower_turnover_12_team_superflex` | `half_ppr_lower_turnover_12_team_superflex` | 12-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `ppr_10_team`                               | `ppr_10_team`                               | 10-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  |
| `ppr_10_team_superflex`                     | `ppr_10_team_superflex`                     | 10-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 |
| `ppr_12_team`                               | `ppr_12_team`                               | 12-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  |
| `ppr_12_team_superflex`                     | `ppr_12_team_superflex`                     | 12-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 |
| `ppr_lower_turnover_10_team`                | `ppr_lower_turnover_10_team`                | 10-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  |
| `ppr_lower_turnover_10_team_superflex`      | `ppr_lower_turnover_10_team_superflex`      | 10-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `ppr_lower_turnover_12_team`                | `ppr_lower_turnover_12_team`                | 12-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  |
| `ppr_lower_turnover_12_team_superflex`      | `ppr_lower_turnover_12_team_superflex`      | 12-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX |
| `sfb15_mfl`                                 | `sfb15_mfl`                                 | Scott Fish Bowl 15 MFL format with 2 superflex and 9 flex positions                                           |
| `sfb15_sleeper`                             | `sfb15_sleeper`                             | Scott Fish Bowl 15 Sleeper format with 2 superflex and 9 flex positions                                       |
| `sfb16_mfl`                                 | `sfb16_mfl`                                 | Scott Fish Bowl 16 MFL format with 2 superflex and 8 flex positions                                           |
| `sfb16_sleeper`                             | `sfb16_sleeper`                             | Scott Fish Bowl 16 Sleeper format with 2 superflex and 8 flex positions                                       |
| `standard_10_team`                          | `standard_10_team`                          | 10-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX                                         |
| `standard_12_team`                          | `standard_12_team`                          | 12-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX                                         |

## Scoring Format Summary

| Source Key                | ID                        | Description                                                                                                                                  |
| ------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `draftkings`              | `draftkings`              | DraftKings DFS scoring with full PPR, 4-point passing TDs, and milestone bonuses - bonus/kicker/defense support needed                       |
| `fanduel`                 | `fanduel`                 | FanDuel DFS scoring with half PPR, 4-point passing TDs, and yardage bonuses - bonus/kicker/defense support needed                            |
| `genesis`                 | `genesis`                 | Genesis League scoring with half PPR, 4-point passing TDs, 0.05 passing yards, and -1 turnovers                                              |
| `half_ppr`                | `half_ppr`                | Half point per reception scoring with 4-point passing touchdowns                                                                             |
| `half_ppr_lower_turnover` | `half_ppr_lower_turnover` | Half PPR with lower turnover penalties: -1 INT, -1 fumble lost                                                                               |
| `ppr`                     | `ppr`                     | Full point per reception scoring with 4-point passing touchdowns                                                                             |
| `ppr_lower_turnover`      | `draftkings`              | Full PPR with lower turnover penalties: -1 INT, -1 fumble lost                                                                               |
| `sfb15_mfl`               | `sfb15_mfl`               | Scott Fish Bowl 15 MFL scoring (PPR + 0.5 per carry + 1 per target) - no turnover penalties                                                  |
| `sfb15_sleeper`           | `sfb15_sleeper`           | Scott Fish Bowl 15 Sleeper scoring (2.5 PPR + 0.5 per carry) - no turnover penalties                                                         |
| `sfb16_mfl`               | `sfb16_mfl`               | Scott Fish Bowl 16 MFL scoring (0.5 PPR, 0.5 per first down, TE premium on both) with big-play and milestone bonuses - no turnover penalties |
| `sfb16_sleeper`           | `sfb16_sleeper`           | Scott Fish Bowl 16 Sleeper scoring - identical to the MFL variant except a touchdown does not also count as a first down                     |
| `standard`                | `standard`                | Standard scoring with no PPR and 4-point passing touchdowns                                                                                  |

## League Format Details

### draftkings_classic

**Source Key:** `draftkings_classic`
**Label:** DraftKings Classic DFS
**Description:** DraftKings classic DFS lineup - 1QB/2RB/3WR/1TE/1FLEX/1DST with $50k salary cap
**Scoring Format:** `draftkings`
**Pricing Model:** `dfs_fixed`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 1     |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 3     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 0     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 0     |
| `bench_slot_count`                              | 0     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 0     |
| `cap`                                           | 50000 |
| `min_bid`                                       | 0     |

### genesis_10_team

**Source Key:** `genesis_10_team`
**Label:** Genesis League 10 Team
**Description:** Genesis League 10-team superflex format with no kicker - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `genesis`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 10    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 1     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 0     |
| `bench_slot_count`                              | 7     |
| `practice_squad_slot_count`                     | 4     |
| `reserve_short_term_limit`                      | 99    |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### half_ppr_10_team

**Source Key:** `half_ppr_10_team`
**Label:** Half PPR 10 Team
**Description:** 10-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `half_ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 10    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 0     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### half_ppr_10_team_superflex

**Source Key:** `half_ppr_10_team_superflex`
**Label:** Half PPR 10 Team Superflex
**Description:** 10-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `half_ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 10    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 1     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### half_ppr_12_team

**Source Key:** `half_ppr_12_team`
**Label:** Half PPR 12 Team
**Description:** 12-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `half_ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 0     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### half_ppr_12_team_superflex

**Source Key:** `half_ppr_12_team_superflex`
**Label:** Half PPR 12 Team Superflex
**Description:** 12-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `half_ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 1     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### half_ppr_lower_turnover_10_team

**Source Key:** `half_ppr_lower_turnover_10_team`
**Label:** Half PPR Lower Turnover 10 Team
**Description:** 10-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `half_ppr_lower_turnover`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 10    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 0     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### half_ppr_lower_turnover_10_team_superflex

**Source Key:** `half_ppr_lower_turnover_10_team_superflex`
**Label:** Half PPR Lower Turnover 10 Team Superflex
**Description:** 10-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `half_ppr_lower_turnover`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 10    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 1     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### half_ppr_lower_turnover_12_team

**Source Key:** `half_ppr_lower_turnover_12_team`
**Label:** Half PPR Lower Turnover 12 Team
**Description:** 12-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `half_ppr_lower_turnover`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 0     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### half_ppr_lower_turnover_12_team_superflex

**Source Key:** `half_ppr_lower_turnover_12_team_superflex`
**Label:** Half PPR Lower Turnover 12 Team Superflex
**Description:** 12-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `half_ppr_lower_turnover`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 1     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### ppr_10_team

**Source Key:** `ppr_10_team`
**Label:** PPR 10 Team
**Description:** 10-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 10    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 0     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### ppr_10_team_superflex

**Source Key:** `ppr_10_team_superflex`
**Label:** PPR 10 Team Superflex
**Description:** 10-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 10    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 1     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### ppr_12_team

**Source Key:** `ppr_12_team`
**Label:** PPR 12 Team
**Description:** 12-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 0     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### ppr_12_team_superflex

**Source Key:** `ppr_12_team_superflex`
**Label:** PPR 12 Team Superflex
**Description:** 12-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `ppr`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 1     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### ppr_lower_turnover_10_team

**Source Key:** `ppr_lower_turnover_10_team`
**Label:** PPR Lower Turnover 10 Team
**Description:** 10-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `draftkings`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 10    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 0     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### ppr_lower_turnover_10_team_superflex

**Source Key:** `ppr_lower_turnover_10_team_superflex`
**Label:** PPR Lower Turnover 10 Team Superflex
**Description:** 10-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `draftkings`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 10    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 1     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### ppr_lower_turnover_12_team

**Source Key:** `ppr_lower_turnover_12_team`
**Label:** PPR Lower Turnover 12 Team
**Description:** 12-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `draftkings`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 0     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### ppr_lower_turnover_12_team_superflex

**Source Key:** `ppr_lower_turnover_12_team_superflex`
**Label:** PPR Lower Turnover 12 Team Superflex
**Description:** 12-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX
**Scoring Format:** `draftkings`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 1     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### sfb15_mfl

**Source Key:** `sfb15_mfl`
**Label:** Scott Fish Bowl 15 (MFL)
**Description:** Scott Fish Bowl 15 MFL format with 2 superflex and 9 flex positions
**Scoring Format:** `sfb15_mfl`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 0     |
| `starter_slots_wide_receiver`                   | 0     |
| `starter_slots_tight_end`                       | 0     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 9     |
| `sqbrbwrte`                                     | 2     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 0     |
| `starter_slots_kicker`                          | 0     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### sfb15_sleeper

**Source Key:** `sfb15_sleeper`
**Label:** Scott Fish Bowl 15 (Sleeper)
**Description:** Scott Fish Bowl 15 Sleeper format with 2 superflex and 9 flex positions
**Scoring Format:** `sfb15_sleeper`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 0     |
| `starter_slots_wide_receiver`                   | 0     |
| `starter_slots_tight_end`                       | 0     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 9     |
| `sqbrbwrte`                                     | 2     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 0     |
| `starter_slots_kicker`                          | 0     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### sfb16_mfl

**Source Key:** `sfb16_mfl`
**Label:** Scott Fish Bowl 16 (MFL)
**Description:** Scott Fish Bowl 16 MFL format with 2 superflex and 8 flex positions
**Scoring Format:** `sfb16_mfl`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 0     |
| `starter_slots_running_back`                    | 0     |
| `starter_slots_wide_receiver`                   | 0     |
| `starter_slots_tight_end`                       | 0     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 8     |
| `sqbrbwrte`                                     | 2     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 0     |
| `starter_slots_kicker`                          | 0     |
| `bench_slot_count`                              | 10    |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 0     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### sfb16_sleeper

**Source Key:** `sfb16_sleeper`
**Label:** Scott Fish Bowl 16 (Sleeper)
**Description:** Scott Fish Bowl 16 Sleeper format with 2 superflex and 8 flex positions
**Scoring Format:** `sfb16_sleeper`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 0     |
| `starter_slots_running_back`                    | 0     |
| `starter_slots_wide_receiver`                   | 0     |
| `starter_slots_tight_end`                       | 0     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 8     |
| `sqbrbwrte`                                     | 2     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 0     |
| `starter_slots_kicker`                          | 0     |
| `bench_slot_count`                              | 10    |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 0     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### standard_10_team

**Source Key:** `standard_10_team`
**Label:** Standard 10 Team (No PPR)
**Description:** 10-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `standard`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 10    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 0     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

### standard_12_team

**Source Key:** `standard_12_team`
**Label:** Standard 12 Team (No PPR)
**Description:** 12-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX
**Scoring Format:** `standard`
**Pricing Model:** `auction`

**Configuration:**

| Property                                        | Value |
| ----------------------------------------------- | ----- |
| `number_teams`                                  | 12    |
| `starter_slots_quarterback`                     | 1     |
| `starter_slots_running_back`                    | 2     |
| `starter_slots_wide_receiver`                   | 2     |
| `starter_slots_tight_end`                       | 1     |
| `starter_slots_running_back_wide_receiver_flex` | 0     |
| `srbwrte`                                       | 1     |
| `sqbrbwrte`                                     | 0     |
| `starter_slots_wide_receiver_tight_end_flex`    | 0     |
| `starter_slots_defense_special_teams`           | 1     |
| `starter_slots_kicker`                          | 1     |
| `bench_slot_count`                              | 6     |
| `practice_squad_slot_count`                     | 0     |
| `reserve_short_term_limit`                      | 3     |
| `cap`                                           | 200   |
| `min_bid`                                       | 0     |

## Scoring Format Details

### draftkings

**Source Keys:** `draftkings`, `ppr_lower_turnover` (collapsed to canonical `draftkings`)
**Label:** DraftKings DFS
**Description:** DraftKings DFS scoring with full PPR, 4-point passing TDs, and milestone bonuses - bonus/kicker/defense support needed

**Configuration:**

| Property                          | Value |
| --------------------------------- | ----- |
| `passing_attempts`                | 0     |
| `passing_completions`             | 0     |
| `passing_yards`                   | 0.04  |
| `passing_interceptions`           | -1    |
| `passing_touchdowns`              | 4     |
| `rushing_attempts`                | 0     |
| `rushing_yards`                   | 0.1   |
| `rushing_touchdowns`              | 6     |
| `receptions`                      | 1     |
| `running_back_reception`          | 1     |
| `wide_receiver_reception`         | 1     |
| `tight_end_reception`             | 1     |
| `receiving_yards`                 | 0.1   |
| `receiving_touchdowns`            | 6     |
| `two_point_conversions`           | 2     |
| `fumbles_lost`                    | -1    |
| `punt_return_touchdowns`          | 6     |
| `kickoff_return_touchdowns`       | 6     |
| `fumble_return_touchdowns`        | 6     |
| `targets`                         | 0     |
| `rushing_first_downs`             | 0     |
| `receiving_first_downs`           | 0     |
| `is_excluding_quarterback_kneels` | false |

### fanduel

**Source Key:** `fanduel`
**Label:** FanDuel DFS
**Description:** FanDuel DFS scoring with half PPR, 4-point passing TDs, and yardage bonuses - bonus/kicker/defense support needed

**Configuration:**

| Property                          | Value |
| --------------------------------- | ----- |
| `passing_attempts`                | 0     |
| `passing_completions`             | 0     |
| `passing_yards`                   | 0.04  |
| `passing_interceptions`           | -1    |
| `passing_touchdowns`              | 4     |
| `rushing_attempts`                | 0     |
| `rushing_yards`                   | 0.1   |
| `rushing_touchdowns`              | 6     |
| `receptions`                      | 0.5   |
| `running_back_reception`          | 0.5   |
| `wide_receiver_reception`         | 0.5   |
| `tight_end_reception`             | 0.5   |
| `receiving_yards`                 | 0.1   |
| `receiving_touchdowns`            | 6     |
| `two_point_conversions`           | 2     |
| `fumbles_lost`                    | -2    |
| `punt_return_touchdowns`          | 6     |
| `kickoff_return_touchdowns`       | 6     |
| `fumble_return_touchdowns`        | 6     |
| `targets`                         | 0     |
| `rushing_first_downs`             | 0     |
| `receiving_first_downs`           | 0     |
| `is_excluding_quarterback_kneels` | false |

### genesis

**Source Key:** `genesis`
**Label:** Genesis League
**Description:** Genesis League scoring with half PPR, 4-point passing TDs, 0.05 passing yards, and -1 turnovers

**Configuration:**

| Property                          | Value |
| --------------------------------- | ----- |
| `passing_attempts`                | 0     |
| `passing_completions`             | 0     |
| `passing_yards`                   | 0.05  |
| `passing_interceptions`           | -1    |
| `passing_touchdowns`              | 4     |
| `rushing_attempts`                | 0     |
| `rushing_yards`                   | 0.1   |
| `rushing_touchdowns`              | 6     |
| `receptions`                      | 0.5   |
| `running_back_reception`          | 0.5   |
| `wide_receiver_reception`         | 0.5   |
| `tight_end_reception`             | 0.5   |
| `receiving_yards`                 | 0.1   |
| `receiving_touchdowns`            | 6     |
| `two_point_conversions`           | 2     |
| `fumbles_lost`                    | -1    |
| `punt_return_touchdowns`          | 6     |
| `kickoff_return_touchdowns`       | 6     |
| `fumble_return_touchdowns`        | 6     |
| `targets`                         | 0     |
| `rushing_first_downs`             | 0     |
| `receiving_first_downs`           | 0     |
| `is_excluding_quarterback_kneels` | true  |

### half_ppr

**Source Key:** `half_ppr`
**Label:** Half PPR
**Description:** Half point per reception scoring with 4-point passing touchdowns

**Configuration:**

| Property                          | Value |
| --------------------------------- | ----- |
| `passing_attempts`                | 0     |
| `passing_completions`             | 0     |
| `passing_yards`                   | 0.04  |
| `passing_interceptions`           | -2    |
| `passing_touchdowns`              | 4     |
| `rushing_attempts`                | 0     |
| `rushing_yards`                   | 0.1   |
| `rushing_touchdowns`              | 6     |
| `receptions`                      | 0.5   |
| `running_back_reception`          | 0.5   |
| `wide_receiver_reception`         | 0.5   |
| `tight_end_reception`             | 0.5   |
| `receiving_yards`                 | 0.1   |
| `receiving_touchdowns`            | 6     |
| `two_point_conversions`           | 2     |
| `fumbles_lost`                    | -2    |
| `punt_return_touchdowns`          | 6     |
| `kickoff_return_touchdowns`       | 6     |
| `fumble_return_touchdowns`        | 6     |
| `targets`                         | 0     |
| `rushing_first_downs`             | 0     |
| `receiving_first_downs`           | 0     |
| `is_excluding_quarterback_kneels` | false |

### half_ppr_lower_turnover

**Source Key:** `half_ppr_lower_turnover`
**Label:** Half PPR (Lower Turnover)
**Description:** Half PPR with lower turnover penalties: -1 INT, -1 fumble lost

**Configuration:**

| Property                          | Value |
| --------------------------------- | ----- |
| `passing_attempts`                | 0     |
| `passing_completions`             | 0     |
| `passing_yards`                   | 0.04  |
| `passing_interceptions`           | -1    |
| `passing_touchdowns`              | 4     |
| `rushing_attempts`                | 0     |
| `rushing_yards`                   | 0.1   |
| `rushing_touchdowns`              | 6     |
| `receptions`                      | 0.5   |
| `running_back_reception`          | 0.5   |
| `wide_receiver_reception`         | 0.5   |
| `tight_end_reception`             | 0.5   |
| `receiving_yards`                 | 0.1   |
| `receiving_touchdowns`            | 6     |
| `two_point_conversions`           | 2     |
| `fumbles_lost`                    | -1    |
| `punt_return_touchdowns`          | 6     |
| `kickoff_return_touchdowns`       | 6     |
| `fumble_return_touchdowns`        | 6     |
| `targets`                         | 0     |
| `rushing_first_downs`             | 0     |
| `receiving_first_downs`           | 0     |
| `is_excluding_quarterback_kneels` | false |

### ppr

**Source Key:** `ppr`
**Label:** PPR (Full)
**Description:** Full point per reception scoring with 4-point passing touchdowns

**Configuration:**

| Property                          | Value |
| --------------------------------- | ----- |
| `passing_attempts`                | 0     |
| `passing_completions`             | 0     |
| `passing_yards`                   | 0.04  |
| `passing_interceptions`           | -2    |
| `passing_touchdowns`              | 4     |
| `rushing_attempts`                | 0     |
| `rushing_yards`                   | 0.1   |
| `rushing_touchdowns`              | 6     |
| `receptions`                      | 1     |
| `running_back_reception`          | 1     |
| `wide_receiver_reception`         | 1     |
| `tight_end_reception`             | 1     |
| `receiving_yards`                 | 0.1   |
| `receiving_touchdowns`            | 6     |
| `two_point_conversions`           | 2     |
| `fumbles_lost`                    | -2    |
| `punt_return_touchdowns`          | 6     |
| `kickoff_return_touchdowns`       | 6     |
| `fumble_return_touchdowns`        | 6     |
| `targets`                         | 0     |
| `rushing_first_downs`             | 0     |
| `receiving_first_downs`           | 0     |
| `is_excluding_quarterback_kneels` | false |

### sfb15_mfl

**Source Key:** `sfb15_mfl`
**Label:** Scott Fish Bowl 15 (MFL)
**Description:** Scott Fish Bowl 15 MFL scoring (PPR + 0.5 per carry + 1 per target) - no turnover penalties

**Configuration:**

| Property                          | Value |
| --------------------------------- | ----- |
| `passing_attempts`                | 0     |
| `passing_completions`             | 0     |
| `passing_yards`                   | 0.04  |
| `passing_interceptions`           | 0     |
| `passing_touchdowns`              | 6     |
| `rushing_attempts`                | 0.5   |
| `rushing_yards`                   | 0.1   |
| `rushing_touchdowns`              | 6     |
| `receptions`                      | 1     |
| `running_back_reception`          | 1     |
| `wide_receiver_reception`         | 1     |
| `tight_end_reception`             | 2     |
| `receiving_yards`                 | 0.1   |
| `receiving_touchdowns`            | 6     |
| `two_point_conversions`           | 2     |
| `fumbles_lost`                    | 0     |
| `punt_return_touchdowns`          | 6     |
| `kickoff_return_touchdowns`       | 6     |
| `fumble_return_touchdowns`        | 6     |
| `targets`                         | 1     |
| `rushing_first_downs`             | 1     |
| `receiving_first_downs`           | 1     |
| `is_excluding_quarterback_kneels` | false |

### sfb15_sleeper

**Source Key:** `sfb15_sleeper`
**Label:** Scott Fish Bowl 15 (Sleeper)
**Description:** Scott Fish Bowl 15 Sleeper scoring (2.5 PPR + 0.5 per carry) - no turnover penalties

**Configuration:**

| Property                          | Value |
| --------------------------------- | ----- |
| `passing_attempts`                | 0     |
| `passing_completions`             | 0     |
| `passing_yards`                   | 0.04  |
| `passing_interceptions`           | 0     |
| `passing_touchdowns`              | 6     |
| `rushing_attempts`                | 0.5   |
| `rushing_yards`                   | 0.1   |
| `rushing_touchdowns`              | 6     |
| `receptions`                      | 2.5   |
| `running_back_reception`          | 2.5   |
| `wide_receiver_reception`         | 2.5   |
| `tight_end_reception`             | 3.5   |
| `receiving_yards`                 | 0.1   |
| `receiving_touchdowns`            | 6     |
| `two_point_conversions`           | 2     |
| `fumbles_lost`                    | 0     |
| `punt_return_touchdowns`          | 6     |
| `kickoff_return_touchdowns`       | 6     |
| `fumble_return_touchdowns`        | 6     |
| `targets`                         | 0     |
| `rushing_first_downs`             | 1     |
| `receiving_first_downs`           | 1     |
| `is_excluding_quarterback_kneels` | false |

### sfb16_mfl

**Source Key:** `sfb16_mfl`
**Label:** Scott Fish Bowl 16 (MFL)
**Description:** Scott Fish Bowl 16 MFL scoring (0.5 PPR, 0.5 per first down, TE premium on both) with big-play and milestone bonuses - no turnover penalties

**Configuration:**

| Property                          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `passing_attempts`                | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `passing_completions`             | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `passing_yards`                   | 0.04                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `passing_interceptions`           | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `passing_touchdowns`              | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `rushing_attempts`                | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `rushing_yards`                   | 0.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `rushing_touchdowns`              | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `receptions`                      | 0.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `running_back_reception`          | 0.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `wide_receiver_reception`         | 0.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tight_end_reception`             | 1.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `receiving_yards`                 | 0.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `receiving_touchdowns`            | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `two_point_conversions`           | 2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `fumbles_lost`                    | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `punt_return_touchdowns`          | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `kickoff_return_touchdowns`       | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `fumble_return_touchdowns`        | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `targets`                         | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `rushing_first_downs`             | 0.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `receiving_first_downs`           | 0.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tight_end_receiving_first_downs` | 1.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `is_excluding_quarterback_kneels` | false                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `touchdown_is_first_down`         | true                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `bonuses`                         | `[{"type":"big_play","stat":"passing_yards","threshold":40,"points":10},{"type":"big_play","stat":"rushing_yards","threshold":40,"points":10},{"type":"big_play","stat":"receiving_yards","threshold":40,"points":10},{"type":"milestone","stat":"passing_yards","threshold":300,"points":10},{"type":"milestone","stat":"passing_yards","threshold":400,"points":10},{"type":"milestone","stat":"rush_rec_yd","threshold":100,"points":10},{"type":"milestone","stat":"rush_rec_yd","threshold":200,"points":10}]` |

### sfb16_sleeper

**Source Key:** `sfb16_sleeper`
**Label:** Scott Fish Bowl 16 (Sleeper)
**Description:** Scott Fish Bowl 16 Sleeper scoring - identical to the MFL variant except a touchdown does not also count as a first down

**Configuration:**

| Property                          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `passing_attempts`                | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `passing_completions`             | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `passing_yards`                   | 0.04                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `passing_interceptions`           | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `passing_touchdowns`              | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `rushing_attempts`                | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `rushing_yards`                   | 0.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `rushing_touchdowns`              | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `receptions`                      | 0.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `running_back_reception`          | 0.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `wide_receiver_reception`         | 0.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tight_end_reception`             | 1.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `receiving_yards`                 | 0.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `receiving_touchdowns`            | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `two_point_conversions`           | 2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `fumbles_lost`                    | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `punt_return_touchdowns`          | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `kickoff_return_touchdowns`       | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `fumble_return_touchdowns`        | 6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `targets`                         | 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `rushing_first_downs`             | 0.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `receiving_first_downs`           | 0.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tight_end_receiving_first_downs` | 1.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `is_excluding_quarterback_kneels` | false                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `touchdown_is_first_down`         | false                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `bonuses`                         | `[{"type":"big_play","stat":"passing_yards","threshold":40,"points":10},{"type":"big_play","stat":"rushing_yards","threshold":40,"points":10},{"type":"big_play","stat":"receiving_yards","threshold":40,"points":10},{"type":"milestone","stat":"passing_yards","threshold":300,"points":10},{"type":"milestone","stat":"passing_yards","threshold":400,"points":10},{"type":"milestone","stat":"rush_rec_yd","threshold":100,"points":10},{"type":"milestone","stat":"rush_rec_yd","threshold":200,"points":10}]` |

### standard

**Source Key:** `standard`
**Label:** Standard (No PPR)
**Description:** Standard scoring with no PPR and 4-point passing touchdowns

**Configuration:**

| Property                          | Value |
| --------------------------------- | ----- |
| `passing_attempts`                | 0     |
| `passing_completions`             | 0     |
| `passing_yards`                   | 0.04  |
| `passing_interceptions`           | -2    |
| `passing_touchdowns`              | 4     |
| `rushing_attempts`                | 0     |
| `rushing_yards`                   | 0.1   |
| `rushing_touchdowns`              | 6     |
| `receptions`                      | 0     |
| `running_back_reception`          | 0     |
| `wide_receiver_reception`         | 0     |
| `tight_end_reception`             | 0     |
| `receiving_yards`                 | 0.1   |
| `receiving_touchdowns`            | 6     |
| `two_point_conversions`           | 2     |
| `fumbles_lost`                    | -2    |
| `punt_return_touchdowns`          | 6     |
| `kickoff_return_touchdowns`       | 6     |
| `fumble_return_touchdowns`        | 6     |
| `targets`                         | 0     |
| `rushing_first_downs`             | 0     |
| `receiving_first_downs`           | 0     |
| `is_excluding_quarterback_kneels` | false |
