# Named Scoring and League Formats

_Generated at: 2025-09-24T18:51:09.226Z_

This document shows the configuration for each named format in the system.

## League Format Summary

| Name                                        | Description                                                                                                   | Details                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `draftkings_classic`                        | DraftKings classic DFS lineup - 1QB/2RB/3WR/1TE/1FLEX/1DST with $50k salary cap                               | [View Details](#draftkings_classic)                        |
| `genesis_10_team`                           | Genesis League 10-team superflex format with no kicker - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                         | [View Details](#genesis_10_team)                           |
| `half_ppr_10_team`                          | 10-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  | [View Details](#half_ppr_10_team)                          |
| `half_ppr_10_team_superflex`                | 10-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 | [View Details](#half_ppr_10_team_superflex)                |
| `half_ppr_12_team`                          | 12-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  | [View Details](#half_ppr_12_team)                          |
| `half_ppr_12_team_superflex`                | 12-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 | [View Details](#half_ppr_12_team_superflex)                |
| `half_ppr_lower_turnover_10_team`           | 10-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  | [View Details](#half_ppr_lower_turnover_10_team)           |
| `half_ppr_lower_turnover_10_team_superflex` | 10-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX | [View Details](#half_ppr_lower_turnover_10_team_superflex) |
| `half_ppr_lower_turnover_12_team`           | 12-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  | [View Details](#half_ppr_lower_turnover_12_team)           |
| `half_ppr_lower_turnover_12_team_superflex` | 12-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX | [View Details](#half_ppr_lower_turnover_12_team_superflex) |
| `ppr_10_team`                               | 10-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  | [View Details](#ppr_10_team)                               |
| `ppr_10_team_superflex`                     | 10-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 | [View Details](#ppr_10_team_superflex)                     |
| `ppr_12_team`                               | 12-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  | [View Details](#ppr_12_team)                               |
| `ppr_12_team_superflex`                     | 12-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 | [View Details](#ppr_12_team_superflex)                     |
| `ppr_lower_turnover_10_team`                | 10-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  | [View Details](#ppr_lower_turnover_10_team)                |
| `ppr_lower_turnover_10_team_superflex`      | 10-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX | [View Details](#ppr_lower_turnover_10_team_superflex)      |
| `ppr_lower_turnover_12_team`                | 12-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  | [View Details](#ppr_lower_turnover_12_team)                |
| `ppr_lower_turnover_12_team_superflex`      | 12-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX | [View Details](#ppr_lower_turnover_12_team_superflex)      |
| `sfb15_mfl`                                 | Scott Fish Bowl 15 MFL format with 2 superflex and 9 flex positions                                           | [View Details](#sfb15_mfl)                                 |
| `sfb15_sleeper`                             | Scott Fish Bowl 15 Sleeper format with 2 superflex and 9 flex positions                                       | [View Details](#sfb15_sleeper)                             |
| `standard_10_team`                          | 10-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX                                         | [View Details](#standard_10_team)                          |
| `standard_12_team`                          | 12-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX                                         | [View Details](#standard_12_team)                          |

## Scoring Format Summary

| Name                      | Description                                                                                                            | Details                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `draftkings`              | DraftKings DFS scoring with full PPR, 4-point passing TDs, and milestone bonuses - bonus/kicker/defense support needed | [View Details](#draftkings)              |
| `fanduel`                 | FanDuel DFS scoring with half PPR, 4-point passing TDs, and yardage bonuses - bonus/kicker/defense support needed      | [View Details](#fanduel)                 |
| `genesis`                 | Genesis League scoring with half PPR, 4-point passing TDs, 0.05 passing yards, and -1 turnovers                        | [View Details](#genesis)                 |
| `half_ppr`                | Half point per reception scoring with 4-point passing touchdowns                                                       | [View Details](#half_ppr)                |
| `half_ppr_lower_turnover` | Half PPR with lower turnover penalties: -1 INT, -1 fumble lost                                                         | [View Details](#half_ppr_lower_turnover) |
| `ppr`                     | Full point per reception scoring with 4-point passing touchdowns                                                       | [View Details](#ppr)                     |
| `ppr_lower_turnover`      | Full PPR with lower turnover penalties: -1 INT, -1 fumble lost                                                         | [View Details](#ppr_lower_turnover)      |
| `sfb15_mfl`               | Scott Fish Bowl 15 MFL scoring (PPR + 0.5 per carry + 1 per target) - no turnover penalties                            | [View Details](#sfb15_mfl)               |
| `sfb15_sleeper`           | Scott Fish Bowl 15 Sleeper scoring (2.5 PPR + 0.5 per carry) - no turnover penalties                                   | [View Details](#sfb15_sleeper)           |
| `standard`                | Standard scoring with no PPR and 4-point passing touchdowns                                                            | [View Details](#standard)                |

## League Format Details

### draftkings_classic

**Label:** DraftKings Classic DFS  
**Description:** DraftKings classic DFS lineup - 1QB/2RB/3WR/1TE/1FLEX/1DST with $50k salary cap  
**Hash:** `52dff178c05048af9f38e4f4b5c2372623619476333b0cb20b6783f6d9513e34`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 1 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 3 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 0 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 0 | Starting K positions |
| `bench` | 0 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 0 | Short term reserve limit |
| `cap` | 50000 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`draftkings`](#draftkings)

### genesis_10_team

**Label:** Genesis League 10 Team  
**Description:** Genesis League 10-team superflex format with no kicker - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `1985e1968b75707ebcab9da620176a0b218c5c1bd28d00cbbc4d1744a1631d0b`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 10 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 1 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 0 | Starting K positions |
| `bench` | 7 | Bench positions |
| `ps` | 4 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`genesis`](#genesis)

### half_ppr_10_team

**Label:** Half PPR 10 Team  
**Description:** 10-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `4589ff38eb918e2eebe4857a3cbacf5d6ce462519489712314fdba6751ac7fad`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 10 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 0 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr`](#half_ppr)

### half_ppr_10_team_superflex

**Label:** Half PPR 10 Team Superflex  
**Description:** 10-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `9bc7e990b650116fbb99a31868651072bde52fb1f124ca54e6dbc27af4df9a5c`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 10 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 1 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr`](#half_ppr)

### half_ppr_12_team

**Label:** Half PPR 12 Team  
**Description:** 12-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `05e1ca2b3be59d771a2faf07429f6ed08ee746e93f86078bf8970dc34ce73cc0`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 12 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 0 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr`](#half_ppr)

### half_ppr_12_team_superflex

**Label:** Half PPR 12 Team Superflex  
**Description:** 12-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `d7b368c3da7d431b59f87ef1b34b6792ca71e586a2303e0a8d508b77327b85ff`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 12 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 1 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr`](#half_ppr)

### half_ppr_lower_turnover_10_team

**Label:** Half PPR Lower Turnover 10 Team  
**Description:** 10-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `aac3deee2f4350ad9dd1c641bd0e8abb16a511c1e8e5bf8dfbc050a7e78381fe`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 10 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 0 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr_lower_turnover`](#half_ppr_lower_turnover)

### half_ppr_lower_turnover_10_team_superflex

**Label:** Half PPR Lower Turnover 10 Team Superflex  
**Description:** 10-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `06c0a9c8f5ed702c119119bd29bd65e85e41bfdd9f2cdc2f2bc3e8662f484ff3`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 10 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 1 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr_lower_turnover`](#half_ppr_lower_turnover)

### half_ppr_lower_turnover_12_team

**Label:** Half PPR Lower Turnover 12 Team  
**Description:** 12-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `00d919efb84e55e7a06a9e7adbe6fc3bcbe464ab57f3d5a03097f740d66812e9`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 12 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 0 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr_lower_turnover`](#half_ppr_lower_turnover)

### half_ppr_lower_turnover_12_team_superflex

**Label:** Half PPR Lower Turnover 12 Team Superflex  
**Description:** 12-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `9826b6010f7c678b002e16e856f87df2fb584918a63875482a86b7c765fa0fdf`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 12 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 1 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr_lower_turnover`](#half_ppr_lower_turnover)

### ppr_10_team

**Label:** PPR 10 Team  
**Description:** 10-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `8b57e86cda433bfb910f82628d84371f10d0ea604e5de0d9636d5418f86f78b9`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 10 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 0 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr`](#ppr)

### ppr_10_team_superflex

**Label:** PPR 10 Team Superflex  
**Description:** 10-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `125a362993074cb696f8f2254e11da33b6366b65f1f957dfd3a60f4bfe8b6140`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 10 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 1 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr`](#ppr)

### ppr_12_team

**Label:** PPR 12 Team  
**Description:** 12-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `d8178f372cc25c7b38577d849bfde25b66833ac351fca0eb9ea2b07de03c2ccd`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 12 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 0 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr`](#ppr)

### ppr_12_team_superflex

**Label:** PPR 12 Team Superflex  
**Description:** 12-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `7c94c1aa1d7addd37a9b4f0825e06af1a147276f74a2e76c995d2a5d3c84ca83`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 12 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 1 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr`](#ppr)

### ppr_lower_turnover_10_team

**Label:** PPR Lower Turnover 10 Team  
**Description:** 10-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `77ac5bb9b36b35ff77aaf308ace390a13ca5493706131f94ffc4374995d61a1d`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 10 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 0 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr_lower_turnover`](#ppr_lower_turnover)

### ppr_lower_turnover_10_team_superflex

**Label:** PPR Lower Turnover 10 Team Superflex  
**Description:** 10-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `8f73f29d9bdd2174995a287de7b297a29c3f86f063f09fca63f598f5c2a2f78a`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 10 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 1 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr_lower_turnover`](#ppr_lower_turnover)

### ppr_lower_turnover_12_team

**Label:** PPR Lower Turnover 12 Team  
**Description:** 12-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `51624cbf8f71b7a3f4c542c591e57f40e92a52809973498f0dea3eb8400f6806`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 12 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 0 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr_lower_turnover`](#ppr_lower_turnover)

### ppr_lower_turnover_12_team_superflex

**Label:** PPR Lower Turnover 12 Team Superflex  
**Description:** 12-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `560dba8a15d7af913b13fb390b3302414ba4efe63822e6258e88c9b1f6eb272a`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 12 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 1 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr_lower_turnover`](#ppr_lower_turnover)

### sfb15_mfl

**Label:** Scott Fish Bowl 15 (MFL)  
**Description:** Scott Fish Bowl 15 MFL format with 2 superflex and 9 flex positions  
**Hash:** `5cbab5e165751c56e52f51b8360e95580e744842ce8080d268a4a8441340bcb9`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 12 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 0 | Starting RB positions |
| `swr` | 0 | Starting WR positions |
| `ste` | 0 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 9 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 2 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 0 | Starting D/ST positions |
| `sk` | 0 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`sfb15_mfl`](#sfb15_mfl)

### sfb15_sleeper

**Label:** Scott Fish Bowl 15 (Sleeper)  
**Description:** Scott Fish Bowl 15 Sleeper format with 2 superflex and 9 flex positions  
**Hash:** `ea8e0f39a320a6fdf5cf4dda3d1cd139bc4427defd9178c6a75341b255e5e2cd`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 12 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 0 | Starting RB positions |
| `swr` | 0 | Starting WR positions |
| `ste` | 0 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 9 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 2 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 0 | Starting D/ST positions |
| `sk` | 0 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`sfb15_sleeper`](#sfb15_sleeper)

### standard_10_team

**Label:** Standard 10 Team (No PPR)  
**Description:** 10-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `ac4bd2c40b5b69c071935850c433997ca9cb144337f0aa73e84f10322a5d68fb`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 10 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 0 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`standard`](#standard)

### standard_12_team

**Label:** Standard 12 Team (No PPR)  
**Description:** 12-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `5e54d0dce15b5377d934ce3324f8a754854e77237120f17bfb89aba8b5dc5e09`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `num_teams` | 12 | Number of teams in the league |
| `sqb` | 1 | Starting QB positions |
| `srb` | 2 | Starting RB positions |
| `swr` | 2 | Starting WR positions |
| `ste` | 1 | Starting TE positions |
| `srbwr` | 0 | Starting RB/WR flex positions |
| `srbwrte` | 1 | Starting RB/WR/TE flex positions |
| `sqbrbwrte` | 0 | Starting superflex (QB/RB/WR/TE) positions |
| `swrte` | 0 | Starting WR/TE flex positions |
| `sdst` | 1 | Starting D/ST positions |
| `sk` | 1 | Starting K positions |
| `bench` | 6 | Bench positions |
| `ps` | 0 | Practice squad positions |
| `reserve_short_term_limit` | 3 | Short term reserve limit |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`standard`](#standard)

## Scoring Format Details

### draftkings

**Label:** DraftKings DFS  
**Description:** DraftKings DFS scoring with full PPR, 4-point passing TDs, and milestone bonuses - bonus/kicker/defense support needed  
**Hash:** `ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -1 | Points per interception thrown |
| `tdp` | 4 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 1 | Points per reception |
| `rbrec` | 1 | Points per RB reception |
| `wrrec` | 1 | Points per WR reception |
| `terec` | 1 | Points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -1 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |
| `trg` | 0 | trg |
| `rush_first_down` | 0 | rush_first_down |
| `rec_first_down` | 0 | rec_first_down |

### fanduel

**Label:** FanDuel DFS  
**Description:** FanDuel DFS scoring with half PPR, 4-point passing TDs, and yardage bonuses - bonus/kicker/defense support needed  
**Hash:** `04fe44246221c6ee47cba713ac4aad95f4b1f28e50078e7f12ecfb0fed257933`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -1 | Points per interception thrown |
| `tdp` | 4 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 0.5 | Points per reception |
| `rbrec` | 0.5 | Points per RB reception |
| `wrrec` | 0.5 | Points per WR reception |
| `terec` | 0.5 | Points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -2 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |
| `trg` | 0 | trg |
| `rush_first_down` | 0 | rush_first_down |
| `rec_first_down` | 0 | rec_first_down |

### genesis

**Label:** Genesis League  
**Description:** Genesis League scoring with half PPR, 4-point passing TDs, 0.05 passing yards, and -1 turnovers  
**Hash:** `0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.05 | Points per passing yard |
| `ints` | -1 | Points per interception thrown |
| `tdp` | 4 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 0.5 | Points per reception |
| `rbrec` | 0.5 | Points per RB reception |
| `wrrec` | 0.5 | Points per WR reception |
| `terec` | 0.5 | Points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -1 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |
| `trg` | 0 | trg |
| `rush_first_down` | 0 | rush_first_down |
| `rec_first_down` | 0 | rec_first_down |

### half_ppr

**Label:** Half PPR  
**Description:** Half point per reception scoring with 4-point passing touchdowns  
**Hash:** `2aeca584a5d1f3e48a68f9ba35ab5660c7ffce5e107a8025a346948840e74ff0`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -2 | Points per interception thrown |
| `tdp` | 4 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 0.5 | Points per reception |
| `rbrec` | 0.5 | Points per RB reception |
| `wrrec` | 0.5 | Points per WR reception |
| `terec` | 0.5 | Points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -2 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |
| `trg` | 0 | trg |
| `rush_first_down` | 0 | rush_first_down |
| `rec_first_down` | 0 | rec_first_down |

### half_ppr_lower_turnover

**Label:** Half PPR (Lower Turnover)  
**Description:** Half PPR with lower turnover penalties: -1 INT, -1 fumble lost  
**Hash:** `8d25e53c0df6b8b02fa02fa14309ae6b4250a5a92812e2bb376222dddec6554a`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -1 | Points per interception thrown |
| `tdp` | 4 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 0.5 | Points per reception |
| `rbrec` | 0.5 | Points per RB reception |
| `wrrec` | 0.5 | Points per WR reception |
| `terec` | 0.5 | Points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -1 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |
| `trg` | 0 | trg |
| `rush_first_down` | 0 | rush_first_down |
| `rec_first_down` | 0 | rec_first_down |

### ppr

**Label:** PPR (Full)  
**Description:** Full point per reception scoring with 4-point passing touchdowns  
**Hash:** `dcfbfc93fb203e7ea66b25927805f076a102e31d8830af03e7b9754a19be5e63`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -2 | Points per interception thrown |
| `tdp` | 4 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 1 | Points per reception |
| `rbrec` | 1 | Points per RB reception |
| `wrrec` | 1 | Points per WR reception |
| `terec` | 1 | Points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -2 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |
| `trg` | 0 | trg |
| `rush_first_down` | 0 | rush_first_down |
| `rec_first_down` | 0 | rec_first_down |

### ppr_lower_turnover

**Label:** PPR (Lower Turnover)  
**Description:** Full PPR with lower turnover penalties: -1 INT, -1 fumble lost  
**Hash:** `ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -1 | Points per interception thrown |
| `tdp` | 4 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 1 | Points per reception |
| `rbrec` | 1 | Points per RB reception |
| `wrrec` | 1 | Points per WR reception |
| `terec` | 1 | Points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -1 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |
| `trg` | 0 | trg |
| `rush_first_down` | 0 | rush_first_down |
| `rec_first_down` | 0 | rec_first_down |

### sfb15_mfl

**Label:** Scott Fish Bowl 15 (MFL)  
**Description:** Scott Fish Bowl 15 MFL scoring (PPR + 0.5 per carry + 1 per target) - no turnover penalties  
**Hash:** `88b18fa96c0033c7811fc7163d8ad4556fdd51d53c44a2b71dace326312f1719`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | 0 | Points per interception thrown |
| `tdp` | 6 | Points per passing touchdown |
| `ra` | 0.5 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 1 | Points per reception |
| `rbrec` | 1 | Points per RB reception |
| `wrrec` | 1 | Points per WR reception |
| `terec` | 2 | Points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | 0 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |
| `trg` | 1 | trg |
| `rush_first_down` | 1 | rush_first_down |
| `rec_first_down` | 1 | rec_first_down |

### sfb15_sleeper

**Label:** Scott Fish Bowl 15 (Sleeper)  
**Description:** Scott Fish Bowl 15 Sleeper scoring (2.5 PPR + 0.5 per carry) - no turnover penalties  
**Hash:** `ed9c2daa0f00d9389f450b577c16fb0864fa22c6e261c0161db5f2da54457286`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | 0 | Points per interception thrown |
| `tdp` | 6 | Points per passing touchdown |
| `ra` | 0.5 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 2.5 | Points per reception |
| `rbrec` | 2.5 | Points per RB reception |
| `wrrec` | 2.5 | Points per WR reception |
| `terec` | 3.5 | Points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | 0 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |
| `trg` | 0 | trg |
| `rush_first_down` | 1 | rush_first_down |
| `rec_first_down` | 1 | rec_first_down |

### standard

**Label:** Standard (No PPR)  
**Description:** Standard scoring with no PPR and 4-point passing touchdowns  
**Hash:** `b45d8818039422afa250f09bc4dd373edda837f8ed9f63386988b40294e010f3`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -2 | Points per interception thrown |
| `tdp` | 4 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 0 | Points per reception |
| `rbrec` | 0 | Points per RB reception |
| `wrrec` | 0 | Points per WR reception |
| `terec` | 0 | Points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -2 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |
| `trg` | 0 | trg |
| `rush_first_down` | 0 | rush_first_down |
| `rec_first_down` | 0 | rec_first_down |
