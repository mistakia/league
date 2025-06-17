# Named Scoring and League Formats

_Generated at: 2025-06-17T15:46:20.756Z_

This document shows the configuration for each named format in the system.

## League Format Summary

| Name                                        | Description                                                                                                   | Details                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `draftkings_classic`                        | DraftKings classic DFS lineup - 1QB/2RB/3WR/1TE/1FLEX/1DST with $50k salary cap                               | [View Details](#draftkings-classic)                        |
| `genesis_10_team`                           | Genesis League 10-team superflex format with no kicker - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                         | [View Details](#genesis-10-team)                           |
| `half_ppr_10_team`                          | 10-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  | [View Details](#half-ppr-10-team)                          |
| `half_ppr_10_team_superflex`                | 10-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 | [View Details](#half-ppr-10-team-superflex)                |
| `half_ppr_12_team`                          | 12-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  | [View Details](#half-ppr-12-team)                          |
| `half_ppr_12_team_superflex`                | 12-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 | [View Details](#half-ppr-12-team-superflex)                |
| `half_ppr_lower_turnover_10_team`           | 10-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  | [View Details](#half-ppr-lower-turnover-10-team)           |
| `half_ppr_lower_turnover_10_team_superflex` | 10-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX | [View Details](#half-ppr-lower-turnover-10-team-superflex) |
| `half_ppr_lower_turnover_12_team`           | 12-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  | [View Details](#half-ppr-lower-turnover-12-team)           |
| `half_ppr_lower_turnover_12_team_superflex` | 12-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX | [View Details](#half-ppr-lower-turnover-12-team-superflex) |
| `ppr_10_team`                               | 10-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  | [View Details](#ppr-10-team)                               |
| `ppr_10_team_superflex`                     | 10-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 | [View Details](#ppr-10-team-superflex)                     |
| `ppr_12_team`                               | 12-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX                                                  | [View Details](#ppr-12-team)                               |
| `ppr_12_team_superflex`                     | 12-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX                                 | [View Details](#ppr-12-team-superflex)                     |
| `ppr_lower_turnover_10_team`                | 10-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  | [View Details](#ppr-lower-turnover-10-team)                |
| `ppr_lower_turnover_10_team_superflex`      | 10-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX | [View Details](#ppr-lower-turnover-10-team-superflex)      |
| `ppr_lower_turnover_12_team`                | 12-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX                  | [View Details](#ppr-lower-turnover-12-team)                |
| `ppr_lower_turnover_12_team_superflex`      | 12-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX | [View Details](#ppr-lower-turnover-12-team-superflex)      |
| `sfb15_mfl`                                 | Scott Fish Bowl 15 MFL format with 2 superflex and 9 flex positions                                           | [View Details](#sfb15-mfl)                                 |
| `sfb15_sleeper`                             | Scott Fish Bowl 15 Sleeper format with 2 superflex and 9 flex positions                                       | [View Details](#sfb15-sleeper)                             |
| `standard_10_team`                          | 10-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX                                         | [View Details](#standard-10-team)                          |
| `standard_12_team`                          | 12-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX                                         | [View Details](#standard-12-team)                          |

## Scoring Format Summary

| Name                      | Description                                                                                                            | Details                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `draftkings`              | DraftKings DFS scoring with full PPR, 4-point passing TDs, and milestone bonuses - bonus/kicker/defense support needed | [View Details](#draftkings-1)              |
| `fanduel`                 | FanDuel DFS scoring with half PPR, 4-point passing TDs, and yardage bonuses - bonus/kicker/defense support needed      | [View Details](#fanduel-1)                 |
| `genesis`                 | Genesis League scoring with half PPR, 4-point passing TDs, 0.05 passing yards, and -1 turnovers                        | [View Details](#genesis-1)                 |
| `half_ppr`                | Half point per reception scoring with 6-point passing touchdowns                                                       | [View Details](#half-ppr-1)                |
| `half_ppr_lower_turnover` | Half PPR with lower turnover penalties: -1 INT, -1 fumble lost                                                         | [View Details](#half-ppr-lower-turnover-1) |
| `ppr`                     | Full point per reception scoring with 6-point passing touchdowns                                                       | [View Details](#ppr-1)                     |
| `ppr_lower_turnover`      | Full PPR with lower turnover penalties: -1 INT, -1 fumble lost                                                         | [View Details](#ppr-lower-turnover-1)      |
| `sfb15_mfl`               | Scott Fish Bowl 15 MFL scoring (PPR + 0.5 per carry + 1 per target) - no turnover penalties                            | [View Details](#sfb15-mfl-1)               |
| `sfb15_sleeper`           | Scott Fish Bowl 15 Sleeper scoring (2.5 PPR + 0.5 per carry) - no turnover penalties                                   | [View Details](#sfb15-sleeper-1)           |
| `standard`                | Standard scoring with no PPR and 6-point passing touchdowns                                                            | [View Details](#standard-1)                |

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

**Scoring Format:** [`draftkings`](#draftkings-1)

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

**Scoring Format:** [`genesis`](#genesis-1)

### half_ppr_10_team

**Label:** Half PPR 10 Team  
**Description:** 10-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `54ada7372303d92d6101a695bc6960385525cb36f52aa1ceed5e56f3921d2c1f`

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

**Scoring Format:** [`half_ppr`](#half-ppr-1)

### half_ppr_10_team_superflex

**Label:** Half PPR 10 Team Superflex  
**Description:** 10-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `26188bdbfed990fd907934850777e1001a83dc2291c09ca38ac3b209704be514`

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

**Scoring Format:** [`half_ppr`](#half-ppr-1)

### half_ppr_12_team

**Label:** Half PPR 12 Team  
**Description:** 12-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `0ca34a52a960d11c896e57a31aa9c1177c576282188b98ce7e756a07478d923e`

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

**Scoring Format:** [`half_ppr`](#half-ppr-1)

### half_ppr_12_team_superflex

**Label:** Half PPR 12 Team Superflex  
**Description:** 12-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `ec5a79248e24911d0cd099a447b9f26ea72c0f999228354d47c85b61b6db91c3`

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

**Scoring Format:** [`half_ppr`](#half-ppr-1)

### half_ppr_lower_turnover_10_team

**Label:** Half PPR Lower Turnover 10 Team  
**Description:** 10-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `eccbba076b886b25e9a49dd06a0e2ff20b3edce9eff8a061d8cee7a9841c7de6`

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

**Scoring Format:** [`half_ppr_lower_turnover`](#half-ppr-lower-turnover-1)

### half_ppr_lower_turnover_10_team_superflex

**Label:** Half PPR Lower Turnover 10 Team Superflex  
**Description:** 10-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `b7c23f84aee1ad20ba7984b8af73427c529d1548496d81f9bd3481abbe71d570`

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

**Scoring Format:** [`half_ppr_lower_turnover`](#half-ppr-lower-turnover-1)

### half_ppr_lower_turnover_12_team

**Label:** Half PPR Lower Turnover 12 Team  
**Description:** 12-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `b68d6e71bf522cc02092d9e335567fb9dac2a89d2750b63376bada8cc991782f`

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

**Scoring Format:** [`half_ppr_lower_turnover`](#half-ppr-lower-turnover-1)

### half_ppr_lower_turnover_12_team_superflex

**Label:** Half PPR Lower Turnover 12 Team Superflex  
**Description:** 12-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `77dd3218bf036e2207361bc32b799992cf3e1ddcd8423f0f3d99b7fbb5075353`

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

**Scoring Format:** [`half_ppr_lower_turnover`](#half-ppr-lower-turnover-1)

### ppr_10_team

**Label:** PPR 10 Team  
**Description:** 10-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `68020d1f302b7c13392d038d987c8cd2a4bad72f521df4553e4055f23a4be82e`

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

**Scoring Format:** [`ppr`](#ppr-1)

### ppr_10_team_superflex

**Label:** PPR 10 Team Superflex  
**Description:** 10-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `cd0b0f97f88a22827e72672acc3af59e05432c660f6b8fae4857d83cc51bb12b`

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

**Scoring Format:** [`ppr`](#ppr-1)

### ppr_12_team

**Label:** PPR 12 Team  
**Description:** 12-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `eae52d9963e72597b78e24d27a4a5c14dc446b212cc4962f384bc5bc4b68f459`

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

**Scoring Format:** [`ppr`](#ppr-1)

### ppr_12_team_superflex

**Label:** PPR 12 Team Superflex  
**Description:** 12-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `72ac30c0df7d1a2d4cd04c28b5a4bc4adb5b41b26a34cffff72025edcb37e86e`

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

**Scoring Format:** [`ppr`](#ppr-1)

### ppr_lower_turnover_10_team

**Label:** PPR Lower Turnover 10 Team  
**Description:** 10-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `2774bbf98729aeb7177f9f800c1661427f0171dddce246830f9a77e5f8295093`

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

**Scoring Format:** [`ppr_lower_turnover`](#ppr-lower-turnover-1)

### ppr_lower_turnover_10_team_superflex

**Label:** PPR Lower Turnover 10 Team Superflex  
**Description:** 10-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `2914099379c3ccd16d88a3a88da162d1010968dfd2e186a5c04656957b843aea`

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

**Scoring Format:** [`ppr_lower_turnover`](#ppr-lower-turnover-1)

### ppr_lower_turnover_12_team

**Label:** PPR Lower Turnover 12 Team  
**Description:** 12-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `b6628134d0db1d2b5b8e0aa055eac3c3778e5faa55f2e18305e447baffd77772`

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

**Scoring Format:** [`ppr_lower_turnover`](#ppr-lower-turnover-1)

### ppr_lower_turnover_12_team_superflex

**Label:** PPR Lower Turnover 12 Team Superflex  
**Description:** 12-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX  
**Hash:** `92b023a804d534b6567468ba5593517bd76171be2e7f0b16209ef2aeb06f7576`

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

**Scoring Format:** [`ppr_lower_turnover`](#ppr-lower-turnover-1)

### sfb15_mfl

**Label:** Scott Fish Bowl 15 (MFL)  
**Description:** Scott Fish Bowl 15 MFL format with 2 superflex and 9 flex positions  
**Hash:** `59bfafdb50793debdc5b47183c261aa8109c460520cf498d5d64ae44597f140b`

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

**Scoring Format:** [`sfb15_mfl`](#sfb15-mfl-1)

### sfb15_sleeper

**Label:** Scott Fish Bowl 15 (Sleeper)  
**Description:** Scott Fish Bowl 15 Sleeper format with 2 superflex and 9 flex positions  
**Hash:** `a6c3cabc6704ac7219a2494b0c187a93decb0f017904e2e2bf4b5c8519cafc57`

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

**Scoring Format:** [`sfb15_sleeper`](#sfb15-sleeper-1)

### standard_10_team

**Label:** Standard 10 Team (No PPR)  
**Description:** 10-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `95c4211c7a02a9004a2714aa38bfc8c7eaa8d1b048a4e23e0ed4200fa33d2da2`

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

**Scoring Format:** [`standard`](#standard-1)

### standard_12_team

**Label:** Standard 12 Team (No PPR)  
**Description:** 12-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX  
**Hash:** `9f6c03ef81876c2f14422302cd678320b5556000220e8a59111fcd0d757f7c8a`

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

**Scoring Format:** [`standard`](#standard-1)

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
| `rbrec` | 1 | Bonus points per RB reception |
| `wrrec` | 1 | Bonus points per WR reception |
| `terec` | 1 | Bonus points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -1 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |

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
| `rbrec` | 0.5 | Bonus points per RB reception |
| `wrrec` | 0.5 | Bonus points per WR reception |
| `terec` | 0.5 | Bonus points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -2 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |

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
| `rbrec` | 0.5 | Bonus points per RB reception |
| `wrrec` | 0.5 | Bonus points per WR reception |
| `terec` | 0.5 | Bonus points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -1 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |

### half_ppr

**Label:** Half PPR  
**Description:** Half point per reception scoring with 6-point passing touchdowns  
**Hash:** `196a4e9151ed50bf4c407f6580a21d885c806402d6676cbd37375991279a138f`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -2 | Points per interception thrown |
| `tdp` | 6 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 0.5 | Points per reception |
| `rbrec` | 0.5 | Bonus points per RB reception |
| `wrrec` | 0.5 | Bonus points per WR reception |
| `terec` | 0.5 | Bonus points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -2 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |

### half_ppr_lower_turnover

**Label:** Half PPR (Lower Turnover)  
**Description:** Half PPR with lower turnover penalties: -1 INT, -1 fumble lost  
**Hash:** `df413f3f77684ba130ce79df7cc372f1cb097ca56e0b612c11845eec8b796263`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -1 | Points per interception thrown |
| `tdp` | 6 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 0.5 | Points per reception |
| `rbrec` | 0.5 | Bonus points per RB reception |
| `wrrec` | 0.5 | Bonus points per WR reception |
| `terec` | 0.5 | Bonus points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -1 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |

### ppr

**Label:** PPR (Full)  
**Description:** Full point per reception scoring with 6-point passing touchdowns  
**Hash:** `a29c5c91c762cc114abd6911cd59293a5727cb99f44dcde8d5462485d7915559`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -2 | Points per interception thrown |
| `tdp` | 6 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 1 | Points per reception |
| `rbrec` | 1 | Bonus points per RB reception |
| `wrrec` | 1 | Bonus points per WR reception |
| `terec` | 1 | Bonus points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -2 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |

### ppr_lower_turnover

**Label:** PPR (Lower Turnover)  
**Description:** Full PPR with lower turnover penalties: -1 INT, -1 fumble lost  
**Hash:** `23bedcd3224f626b9e280b4589e35ce8897b88232febda7bf3a612638cd2c9ae`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -1 | Points per interception thrown |
| `tdp` | 6 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 1 | Points per reception |
| `rbrec` | 1 | Bonus points per RB reception |
| `wrrec` | 1 | Bonus points per WR reception |
| `terec` | 1 | Bonus points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -1 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |

### sfb15_mfl

**Label:** Scott Fish Bowl 15 (MFL)  
**Description:** Scott Fish Bowl 15 MFL scoring (PPR + 0.5 per carry + 1 per target) - no turnover penalties  
**Hash:** `95714ea0d1ed6a920fc5cb9ab34f725e6bc3e36a636f4cb6f7dd0224c5c41e66`

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
| `rbrec` | 1 | Bonus points per RB reception |
| `wrrec` | 1 | Bonus points per WR reception |
| `terec` | 2 | Bonus points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | 0 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |

### sfb15_sleeper

**Label:** Scott Fish Bowl 15 (Sleeper)  
**Description:** Scott Fish Bowl 15 Sleeper scoring (2.5 PPR + 0.5 per carry) - no turnover penalties  
**Hash:** `2fc6320827e961ed3403045090980349c30dd9578917a05f43b73e130876ebce`

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
| `rbrec` | 2.5 | Bonus points per RB reception |
| `wrrec` | 2.5 | Bonus points per WR reception |
| `terec` | 3.5 | Bonus points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | 0 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |

### standard

**Label:** Standard (No PPR)  
**Description:** Standard scoring with no PPR and 6-point passing touchdowns  
**Hash:** `a30d67ba4a329c4de2fea544cb89869d2d1e8406dc2a85be6393ec1cfe88818e`

**Configuration:**
| Property | Value | Description |
|----------|-------|-------------|
| `pa` | 0 | Points per passing attempt |
| `pc` | 0 | Points per passing completion |
| `py` | 0.04 | Points per passing yard |
| `ints` | -2 | Points per interception thrown |
| `tdp` | 6 | Points per passing touchdown |
| `ra` | 0 | Points per rushing attempt |
| `ry` | 0.1 | Points per rushing yard |
| `tdr` | 6 | Points per rushing touchdown |
| `rec` | 0 | Points per reception |
| `rbrec` | 0 | Bonus points per RB reception |
| `wrrec` | 0 | Bonus points per WR reception |
| `terec` | 0 | Bonus points per TE reception |
| `recy` | 0.1 | Points per receiving yard |
| `tdrec` | 6 | Points per receiving touchdown |
| `twoptc` | 2 | Points per two-point conversion |
| `fuml` | -2 | Points per fumble lost |
| `prtd` | 6 | Points per punt return touchdown |
| `krtd` | 6 | Points per kick return touchdown |
