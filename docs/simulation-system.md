# Player Correlation Simulation System

Monte Carlo simulation with correlated player sampling for fantasy football matchups.

## Architecture Overview

The simulation system is split across two module directories:

- **libs-shared/simulation/** - Pure functions with no database access (math operations only)
- **libs-server/simulation/** - Database loaders and orchestration

Total: ~8,800 lines across 30 files.

### libs-shared/simulation/ (2,719 lines)

Pure math functions that can run in any JavaScript environment.

| Module                                   | Lines | Purpose                                           |
| ---------------------------------------- | ----- | ------------------------------------------------- |
| `run-simulation.mjs`                     | 475   | Core Monte Carlo engine                           |
| `correlation-constants.mjs`              | 519   | Default correlations, CV bounds, archetype config |
| `build-correlation-matrix.mjs`           | 284   | Correlation matrix construction                   |
| `build-extended-correlation-matrix.mjs`  | 249   | Extended matrix with game outcome correlations    |
| `fit-player-distribution.mjs`            | 232   | Distribution parameter fitting (Gamma/LogNormal)  |
| `generate-correlated-samples.mjs`        | 198   | Cholesky-based correlated sampling                |
| `ensure-positive-definite.mjs`           | 186   | Matrix regularization for Cholesky                |
| `simulation-utils.mjs`                   | 160   | Win calculation, distribution stats               |
| `apply-game-environment-adjustments.mjs` | 156   | Vegas total/spread adjustments                    |
| `get-player-relationship.mjs`            | 155   | Player relationship detection and game grouping   |
| `index.mjs`                              | 105   | Module exports                                    |

### libs-server/simulation/ (6,102 lines)

Database-backed loaders and simulation orchestrators.

#### Orchestrators

| Module                          | Lines | Purpose                                    |
| ------------------------------- | ----- | ------------------------------------------ |
| `simulate-playoff-forecast.mjs` | 685   | Wildcard and championship round forecasts  |
| `simulate-matchup.mjs`          | 616   | Single matchup and multi-week championship |
| `simulate-season-forecast.mjs`  | 399   | Season-long Monte Carlo forecasting        |
| `simulate-league-week.mjs`      | 357   | League-wide simulation (all matchups)      |
| `simulate-nfl-game.mjs`         | 296   | Per-game simulation with correlations      |

#### Data Loaders

| Module                                      | Lines | Purpose                                      |
| ------------------------------------------- | ----- | -------------------------------------------- |
| `load-simulation-data.mjs`                  | 741   | Projections, variance, player info           |
| `load-market-projections.mjs`               | 502   | Prop market lines to fantasy projections     |
| `load-correlations.mjs`                     | 273   | Player pair correlations                     |
| `load-data-with-fallback.mjs`               | 275   | Roster/projection loading with week fallback |
| `calculate-position-ranks.mjs`              | 237   | WR1/WR2/WR3, RB1/RB2 ranking                 |
| `calculate-optimal-lineup.mjs`              | 191   | Optimal lineup calculation                   |
| `load-game-environment.mjs`                 | 190   | Vegas totals, spreads, weather               |
| `load-nfl-schedule.mjs`                     | 151   | NFL schedule and bye weeks                   |
| `load-position-game-outcome-defaults.mjs`   | 84    | Position-level game outcome defaults         |
| `load-player-game-outcome-correlations.mjs` | 76    | Player game outcome correlations             |

#### Analysis and Helpers

| Module                         | Lines | Purpose                             |
| ------------------------------ | ----- | ----------------------------------- |
| `analyze-lineup-decisions.mjs` | 486   | Start/sit analysis                  |
| `simulation-helpers.mjs`       | 367   | Shared utilities for orchestrators  |
| `merge-player-projections.mjs` | 69    | Market/traditional projection merge |
| `index.mjs`                    | 107   | Module exports                      |

## Simulation Modes

### League-Wide Simulation

Simulates all fantasy matchups in a league for a given week by simulating each NFL game separately, preserving player correlations within games.

```
1. Load all matchups and rosters for league/week
2. Group players by NFL game (esbid)
3. For each NFL game:
   - Build correlation matrix for game players
   - Generate correlated samples via Cholesky
   - Return per-player raw scores
4. Aggregate player scores to fantasy team totals
5. Calculate win probabilities for each matchup
```

**Advantages**:

- Preserves correlations (teammates/opponents)
- More efficient than league-wide correlation matrix
- Typical: 14-16 NFL games with ~20x20 matrices vs one ~200x200 matrix

### Single Matchup Simulation

Simulates a specific matchup between 2+ teams. Uses the full correlation matrix for all players involved.

### Championship Simulation

Multi-week simulation that aggregates scores across weeks to determine championship odds.

### Season Forecast

Monte Carlo simulation of remaining regular season weeks to calculate playoff odds, division odds, and championship odds.

### Playoff Forecast

Wildcard and championship round forecasting with player-level correlations and actual score incorporation for completed weeks.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR                                │
│  (simulate_matchup, simulate_league_week, simulate_*_forecast)      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA LOADING (parallel)                        │
├──────────────────┬──────────────────┬───────────────────────────────┤
│ load_player_     │ load_player_     │ load_correlations_for_players │
│ projections      │ variance         │                               │
├──────────────────┼──────────────────┼───────────────────────────────┤
│ load_market_     │ load_player_     │ load_game_environment         │
│ projections      │ archetypes       │ (Vegas lines)                 │
├──────────────────┼──────────────────┼───────────────────────────────┤
│ load_nfl_        │ load_position_   │ load_player_game_outcome_     │
│ schedule         │ ranks            │ correlations                  │
└──────────────────┴──────────────────┴───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PROJECTION MERGING                               │
│  merge_player_projections() - market stats override traditional     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 PURE SIMULATION (libs-shared)                       │
├─────────────────────────────────────────────────────────────────────┤
│  1. fit_player_distribution() - Gamma/LogNormal/Constant            │
│  2. build_correlation_matrix() - player pair correlations           │
│  3. build_extended_correlation_matrix() - add game outcome factors  │
│  4. apply_game_environment_adjustments() - Vegas line adjustments   │
│  5. ensure_positive_definite() - matrix regularization              │
│  6. generate_correlated_samples() - Cholesky decomposition          │
│  7. run_simulation() - Monte Carlo iterations                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RESULTS                                        │
│  - Win probabilities                                                │
│  - Score distributions (mean, std, percentiles)                     │
│  - Raw per-simulation scores (for multi-week aggregation)           │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Tables

```sql
-- Player correlations (pre-calculated annually)
player_pair_correlations (
  pid_a, pid_b, year, correlation,
  relationship_type, team_a, team_b, games_together
)

-- Player variance by scoring format
player_variance (
  pid, year, scoring_format_hash,
  mean_points, standard_deviation, coefficient_of_variation
)

-- Player archetypes (rushing QB, target hog, etc.)
player_archetypes (
  pid, year, archetype,
  rushing_rate, target_share, opportunity_share
)

-- Game outcome correlations per player
player_game_outcome_correlations (
  pid, year, position,
  home_win_correlation, home_loss_correlation,
  away_win_correlation, away_loss_correlation
)

-- Position-level game outcome defaults
position_game_outcome_defaults (
  position, year,
  home_win_correlation, home_loss_correlation,
  away_win_correlation, away_loss_correlation
)

-- Matchup simulation results
matchups (
  ... existing columns ...,
  home_win_probability DECIMAL(5,4),
  away_win_probability DECIMAL(5,4),
  simulation_timestamp TIMESTAMP
)
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

### Game Outcome Correlations

Players correlate with their team's game outcome (win/loss). The extended correlation matrix adds factors for:

- Home team win correlation
- Home team loss correlation
- Away team win correlation
- Away team loss correlation

These are derived from historical performance data and applied via the game spread.

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

## Market Projection Integration

The system integrates betting market prop lines to improve projection accuracy:

1. **Stat-level props** (passing yards, receptions, etc.) override traditional projections
2. **Anytime TD** converted to expected TDs using: `E[TD] = P(1+) + P(2+)`
3. **Alt passing TDs** for QBs: `E[TD] = P(1+) + P(2+) + P(3+) + P(4+)`
4. Source preference: FanDuel > DraftKings
5. `CLOSE` time type used for final pre-game lines

## Vegas Environment Adjustments

Game environment factors (from `load_game_environment`):

- **Total**: Implied combined score adjusts projections up/down
- **Spread**: Game outcome correlations weighted by spread probability
- **Weather**: (Future) Wind, precipitation effects on passing

## Scripts

```bash
# Data preparation (run annually/weekly)
node scripts/calculate-player-correlations.mjs --year 2024
node scripts/calculate-player-variance.mjs --year 2024 --scoring_format_hash <hash>
node scripts/calculate-player-archetypes.mjs --year 2024 --week 15

# League-wide simulation (all matchups)
node scripts/simulate-league-matchups.mjs --lid 1 --week 15 --year 2024
node scripts/simulate-league-matchups.mjs --lid 1 --week 15 --year 2024 --save  # Save to DB
node scripts/simulate-league-matchups.mjs --lid 1 --week 15 --year 2024 --json  # JSON output

# Single matchup simulation
node scripts/simulate-matchup.mjs --lid 1 --team_ids 1,2 --week 15 --year 2024

# Championship analysis
node scripts/analyze-championship-lineups.mjs --lid 1 --team_id 1 --opponent_team_ids 2,3,4 --weeks 16,17 --year 2024
```

## API Usage

```javascript
import { simulation } from '#libs-server'

// League-wide simulation (recommended for batch processing)
const league_results = await simulation.simulate_league_week({
  league_id: 1,
  week: 15,
  year: 2024,
  n_simulations: 10000
})

// Save results to matchups table
await simulation.save_matchup_probabilities(league_results.matchups)

// Single matchup (for specific team analysis)
const matchup = await simulation.simulate_matchup({
  league_id: 1,
  team_ids: [1, 2],
  week: 15,
  year: 2024,
  n_simulations: 10000
})

// Championship (multi-week aggregation)
const championship = await simulation.simulate_championship({
  league_id: 1,
  team_ids: [1, 2, 3, 4],
  weeks: [16, 17],
  year: 2024
})

// Season forecast (playoff/division/bye odds)
const forecast = await simulation.simulate_season_forecast({
  league_id: 1,
  year: 2024,
  n_simulations: 10000
})

// Playoff forecasts
const wildcard = await simulation.simulate_wildcard_forecast({
  league_id: 1,
  year: 2024
})

const championship_forecast = await simulation.simulate_championship_forecast({
  league_id: 1,
  year: 2024
})

// Lineup analysis (start/sit decisions)
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
# Pure function tests
yarn test --reporter min test/simulation.pure-functions.spec.mjs

# Integration tests
yarn test --reporter min test/simulation.integration.spec.mjs

# Data loader tests
yarn test --reporter min test/simulation.data-loaders.spec.mjs

# League-wide simulation tests
yarn test --reporter min test/simulation.league-wide.spec.mjs

# All simulation tests
yarn test --reporter min test/simulation*.spec.mjs
```

## Design Decisions

**Scoring format specificity**: Variance keyed by `scoring_format_hash`. Same performance yields different point distributions under different scoring rules.

**Prior year correlations**: Simulations use previous year data. Mid-season correlations are incomplete. Week 15 of 2024 uses 2023 correlation data.

**DST identification**: DST players use team abbreviation as PID (e.g., "ARI", "KC").

**Bye week handling**: Players on bye contribute zero points. No error raised.

**Projection source**: Uses `scoring_format_player_projection_points` aggregated from multiple sources, overridden by market projections where available.

**Matrix regularization**: Diagonal shrinkage plus eigenvalue clipping ensures positive-definiteness for Cholesky decomposition. Falls back to identity matrix if regularization fails.

**Completed games**: When `use_actual_results=true` (default), players in completed NFL games use actual scores instead of simulated distributions.

**Game-scoped simulation**: League-wide simulation groups players by NFL game to preserve correlations naturally. Players in different NFL games are independent.

**Game outcome correlation loaders**: Use current year (not year - 1) because they have built-in fallback logic that queries both current and prior year, preferring current year data when available.
