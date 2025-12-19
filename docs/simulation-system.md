# Player Correlation Simulation System

Monte Carlo simulation with correlated player sampling for fantasy football matchups.

## Architecture

**libs-shared/simulation/**: Pure functions. No database access.

| Module                            | Purpose                                                |
| --------------------------------- | ------------------------------------------------------ |
| `correlation-constants.mjs`       | Default correlations, CV bounds, archetype adjustments |
| `fit-player-distribution.mjs`     | Distribution parameter fitting                         |
| `generate-correlated-samples.mjs` | Cholesky-based correlated sampling                     |
| `build-correlation-matrix.mjs`    | Correlation matrix construction                        |
| `run-simulation.mjs`              | Monte Carlo engine                                     |

**libs-server/simulation/**: Database queries and orchestration.

| Module                         | Purpose                                  |
| ------------------------------ | ---------------------------------------- |
| `load-simulation-data.mjs`     | Load projections, variance, correlations |
| `load-nfl-schedule.mjs`        | NFL schedule and bye weeks               |
| `calculate-position-ranks.mjs` | WR1/WR2/WR3, RB1/RB2 ranking             |
| `simulate-matchup.mjs`         | Single and multi-week simulation         |
| `analyze-lineup-decisions.mjs` | Start/sit analysis                       |

## Database Tables

```sql
player_pair_correlations (pid_a, pid_b, year, correlation, relationship_type, team_a, team_b, games_together)
player_variance (pid, year, scoring_format_hash, mean_points, standard_deviation, coefficient_of_variation)
player_archetypes (pid, year, archetype, rushing_rate, target_share, opportunity_share)
```

## Correlation Model

### Same-Team Correlations

| Pair    | Correlation |
| ------- | ----------- |
| QB-WR1  | 0.42        |
| QB-WR2  | 0.35        |
| QB-WR3  | 0.28        |
| QB-TE1  | 0.32        |
| QB-RB1  | 0.15        |
| QB-K    | 0.12        |
| WR1-WR2 | 0.26        |
| RB1-RB2 | 0.06        |

### Cross-Team Correlations (Same NFL Game)

| Pair       | Correlation |
| ---------- | ----------- |
| QB-QB      | 0.30        |
| QB-opp DST | -0.48       |
| DST-DST    | 0.20        |

### Lookup Hierarchy

1. **Player-specific** (12+ games together): Use calculated correlation
2. **Blended** (6-11 games): Weighted interpolation, `weight = (games - 6) / 6`
3. **Archetype-adjusted**: Position default with archetype modifiers
4. **Position default**: Raw position-pair correlation

### Archetypes

| Archetype          | Threshold           | Adjustment    |
| ------------------ | ------------------- | ------------- |
| `rushing_qb`       | >= 7 rush att/game  | own RB: -0.20 |
| `mobile_qb`        | 4-7 rush att/game   | own RB: -0.10 |
| `pocket_passer`    | < 4 rush att/game   | own RB: +0.05 |
| `target_hog_wr`    | >= 28% target share | own QB: +0.10 |
| `pass_catching_rb` | >= 35% target ratio | own QB: +0.08 |

## Distribution Fitting

### Selection

| Condition           | Distribution     |
| ------------------- | ---------------- |
| std = 0             | Constant         |
| mean <= 0           | Truncated Normal |
| mean < 3 and CV > 1 | Log-Normal       |
| Otherwise           | Gamma            |

### CV Bounds

| Position | Min  | Max  |
| -------- | ---- | ---- |
| QB       | 0.45 | 2.70 |
| RB       | 0.55 | 2.50 |
| WR       | 0.60 | 2.50 |
| TE       | 0.65 | 2.85 |
| K        | 0.45 | 1.70 |
| DST      | 0.75 | 1.55 |

### Rookie Defaults

Players without history use higher CV: QB 1.05, RB 1.00, WR 1.05, TE 0.95, K 0.95, DST 1.10.

## Scripts

```bash
# Data preparation
node scripts/calculate-player-correlations.mjs --year 2024
node scripts/calculate-player-variance.mjs --year 2024 --scoring_format_hash <hash>
node scripts/calculate-player-archetypes.mjs --year 2024 --week 15

# Simulation
node scripts/simulate-matchup.mjs --lid 1 --team_ids 1,2 --week 15 --year 2024
node scripts/analyze-championship-lineups.mjs --lid 1 --team_id 1 --opponent_team_ids 2,3,4 --weeks 16,17 --year 2024
```

## API Usage

```javascript
import { simulation } from '#libs-server'

// Single matchup
const results = await simulation.simulate_matchup({
  league_id: 1,
  team_ids: [1, 2],
  week: 15,
  year: 2024,
  n_simulations: 10000
})

// Championship (multi-week)
const championship = await simulation.simulate_championship({
  league_id: 1,
  team_ids: [1, 2, 3, 4],
  weeks: [16, 17],
  year: 2024
})

// Lineup analysis
const analysis = await simulation.analyze_lineup_decisions({
  league_id: 1,
  team_id: 1,
  opponent_team_ids: [2, 3, 4],
  week: 16,
  year: 2024
})
```

## Testing

```bash
yarn test --reporter min test/simulation.pure-functions.spec.mjs
yarn test --reporter min test/simulation.integration.spec.mjs
```

## Design Decisions

**Scoring format specificity**: Variance keyed by `scoring_format_hash`. Same performance yields different point distributions under different scoring rules.

**Prior year correlations**: Simulations use previous year data. Mid-season correlations are incomplete. Week 15 of 2024 uses 2023 correlation data.

**DST identification**: DST players use team abbreviation as PID (e.g., "ARI", "KC").

**Bye week handling**: Players on bye contribute zero points. No error raised.

**Projection source**: Uses `projections_index` with `sourceid = 18` (Average).

**Matrix regularization**: Diagonal shrinkage plus eigenvalue clipping ensures positive-definiteness for Cholesky decomposition. Falls back to identity matrix if regularization fails.
