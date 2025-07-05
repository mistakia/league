# Named Scoring and League Formats

_Generated at: 2025-07-05T08:37:32.390Z_

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
| `ir` | 0 | IR positions |
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
| `ir` | 3 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`genesis`](#genesis)

### half_ppr_10_team

**Label:** Half PPR 10 Team  
**Description:** 10-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `64cb7ce1421f243dd780af29304133d5054d439dfc39ffb64bd77e945cea99a8`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr`](#half_ppr)

### half_ppr_10_team_superflex

**Label:** Half PPR 10 Team Superflex  
**Description:** 10-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `7827a68c0ba142deb72b7437fdac900216befeef0bed38989288a6ef4f5e88f5`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr`](#half_ppr)

### half_ppr_12_team

**Label:** Half PPR 12 Team  
**Description:** 12-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `679b4ce98e575e6ed0d8c5153cd1c92a2701baf98dff68665780d5a640d4165c`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr`](#half_ppr)

### half_ppr_12_team_superflex

**Label:** Half PPR 12 Team Superflex  
**Description:** 12-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `99d663cbcf25ffe79f37031fc8771cf88c9adfe20f006c0cd4fb57d059dd6446`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr`](#half_ppr)

### half_ppr_lower_turnover_10_team

**Label:** Half PPR Lower Turnover 10 Team  
**Description:** 10-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `ce41dc5669e598870cce14a016798dca3a6a252bccde39bcfaf8388e8d19a832`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr_lower_turnover`](#half_ppr_lower_turnover)

### half_ppr_lower_turnover_10_team_superflex

**Label:** Half PPR Lower Turnover 10 Team Superflex  
**Description:** 10-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `8afaa971b4b5fc67f9f34f9d91a03619221f7fdff0be17c16ae9f830ad912731`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr_lower_turnover`](#half_ppr_lower_turnover)

### half_ppr_lower_turnover_12_team

**Label:** Half PPR Lower Turnover 12 Team  
**Description:** 12-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `9abe8c6d4d77ecc4927175a149d1e2bccf415bbdbbaceb5afaa6876916e00e94`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr_lower_turnover`](#half_ppr_lower_turnover)

### half_ppr_lower_turnover_12_team_superflex

**Label:** Half PPR Lower Turnover 12 Team Superflex  
**Description:** 12-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `87d3d5fb64a9f318ee541af7eb180f35d2a516d7ae46aa9d9f4af80e964463f9`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`half_ppr_lower_turnover`](#half_ppr_lower_turnover)

### ppr_10_team

**Label:** PPR 10 Team  
**Description:** 10-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `b3af242bbd78987446e23dbf4e5ab9d729cafcd24597318d94c8ef183ac76188`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr`](#ppr)

### ppr_10_team_superflex

**Label:** PPR 10 Team Superflex  
**Description:** 10-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `fa66b63a9deb4e82eb752e18507cd6910814d67a2046cfc3705634cdaf058075`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr`](#ppr)

### ppr_12_team

**Label:** PPR 12 Team  
**Description:** 12-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `674c3710dc806f99c20b20bfc04f56f7c23490643a1a1c3b2d43241fe21ae9a2`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr`](#ppr)

### ppr_12_team_superflex

**Label:** PPR 12 Team Superflex  
**Description:** 12-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `d85636e8c2233b3587eca24d615f6fe4767595f446a65dc033bf085b1c25f5e9`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr`](#ppr)

### ppr_lower_turnover_10_team

**Label:** PPR Lower Turnover 10 Team  
**Description:** 10-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `3a6b37972cab5b3d5b317701558e58cd363b8e63ce3008fc38a0bb136b86d067`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr_lower_turnover`](#ppr_lower_turnover)

### ppr_lower_turnover_10_team_superflex

**Label:** PPR Lower Turnover 10 Team Superflex  
**Description:** 10-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `ca21453cabe4db2abbee23868669ce31a7062d0f7c3c42db07a14735a4b81322`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr_lower_turnover`](#ppr_lower_turnover)

### ppr_lower_turnover_12_team

**Label:** PPR Lower Turnover 12 Team  
**Description:** 12-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `b69d6ae29bab63779e2e23d9194c82a137497d7051d7c1e1bd25a2962f7b7121`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr_lower_turnover`](#ppr_lower_turnover)

### ppr_lower_turnover_12_team_superflex

**Label:** PPR Lower Turnover 12 Team Superflex  
**Description:** 12-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `7b921f6971ea0c095ed0fc3c86d2d3856a78e903c252931b0357c394f23bc216`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`ppr_lower_turnover`](#ppr_lower_turnover)

### sfb15_mfl

**Label:** Scott Fish Bowl 15 (MFL)  
**Description:** Scott Fish Bowl 15 MFL format with 2 superflex and 9 flex positions  
**Hash:** `11b9eac5de1ef77124396e17fc02e941fda1f3f851da5b49848b6bb9fd89bb52`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`sfb15_mfl`](#sfb15_mfl)

### sfb15_sleeper

**Label:** Scott Fish Bowl 15 (Sleeper)  
**Description:** Scott Fish Bowl 15 Sleeper format with 2 superflex and 9 flex positions  
**Hash:** `dd84e8d0283ee78448669ee426e48502a18b496f234d50798170cacd36a3b156`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`sfb15_sleeper`](#sfb15_sleeper)

### standard_10_team

**Label:** Standard 10 Team (No PPR)  
**Description:** 10-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `857cfdd9a277cdec6b617968581186c407cab6008e0754921952d41361c0ac1b`

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
| `ir` | 2 | IR positions |
| `cap` | 200 | Salary cap |
| `min_bid` | 0 | Minimum bid amount |

**Scoring Format:** [`standard`](#standard)

### standard_12_team

**Label:** Standard 12 Team (No PPR)  
**Description:** 12-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `5dfdbf5ad81c7650dba75860197aa9243df08fe1a441e7ecc480928d87d330af`

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
| `ir` | 2 | IR positions |
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
