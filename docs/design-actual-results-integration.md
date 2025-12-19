# Design: Actual Results Integration for Simulation

## Overview

Use actual fantasy points for completed games instead of simulating all players.

## Problem

**Current**: All players simulated with projections/variance regardless of game status.

**Desired**: Players with completed games use actual points; pending games are simulated.

**Example (Week 16, 2025)**:

- Thursday LA @ SEA is final (37-38 OT)
- Team 12 has Puka Nacua (12 rec, 225 yds, 2 TD) and Stafford (457 yds, 3 TD)
- These should use actual scores, not projections

## Simplified Design

### Core Concept

1. Enhance `load_nfl_schedule()` to include `is_final` flag
2. Add `load_actual_player_points()` to get points from `player_gamelogs`
3. Pass `locked_scores` Map to `run_simulation()` for completed players
4. Build correlation matrix only for pending players

### 1. Schedule Loader Changes (`load-nfl-schedule.mjs`)

Add `is_final` to existing schedule query:

```javascript
export async function load_nfl_schedule({ year, week, seas_type = 'REG' }) {
  const games = await db('nfl_games')
    .where({ year })
    .whereIn('week', [week])
    .whereIn('seas_type', seas_type === 'POST' ? ['POST'] : ['REG', 'POST'])
    .select('v', 'h', 'esbid', 'week', 'home_score', 'away_score')

  const schedule = {}
  for (const game of games) {
    const is_final = game.home_score > 0 || game.away_score > 0

    schedule[game.h] = {
      opponent: game.v,
      esbid: game.esbid,
      is_home: true,
      is_final
    }
    schedule[game.v] = {
      opponent: game.h,
      esbid: game.esbid,
      is_home: false,
      is_final
    }
  }
  return schedule
}
```

### 2. Actual Points Loader (`load-simulation-data.mjs`)

Single query to `scoring_format_player_gamelogs`:

```javascript
export async function load_actual_player_points({
  player_ids,
  esbids,
  scoring_format_hash
}) {
  if (!player_ids.length || !esbids.length) return new Map()

  const rows = await db('scoring_format_player_gamelogs')
    .whereIn('pid', player_ids)
    .whereIn('esbid', esbids)
    .where('scoring_format_hash', scoring_format_hash)
    .select('pid', 'points')

  return new Map(rows.map((r) => [r.pid, parseFloat(r.points)]))
}
```

**Prerequisite**: Run `scripts/generate-scoring-format-player-gamelogs.mjs` after gamelogs are imported.

### 3. Orchestrator Changes (`simulate-matchup.mjs`)

```javascript
export async function simulate_matchup({
  league_id,
  team_ids,
  week,
  year,
  n_simulations = 10000,
  seed,
  roster_overrides,
  use_actual_results = true
}) {
  // ... existing setup ...

  const schedule = await load_nfl_schedule({ year, week })

  // Get completed game esbids
  const completed_esbids = [
    ...new Set(
      Object.values(schedule)
        .filter((g) => g.is_final)
        .map((g) => g.esbid)
    )
  ]

  // Categorize players
  const locked_pids = []
  const pending_pids = []

  for (const pid of all_player_ids) {
    const info = player_info.get(pid)
    const game = schedule[info?.nfl_team]
    if (use_actual_results && game?.is_final) {
      locked_pids.push(pid)
    } else {
      pending_pids.push(pid)
    }
  }

  // Load data
  const [actual_points, projections] = await Promise.all([
    load_actual_player_points({
      player_ids: locked_pids,
      esbids: completed_esbids,
      scoring_format_hash
    }),
    load_player_projections({
      player_ids: pending_pids,
      week,
      year,
      scoring_format_hash
    })
  ])

  // Run simulation
  const results = simulation.run_simulation({
    players,
    projections,
    variance_cache,
    correlation_cache,
    archetypes,
    schedule,
    teams,
    n_simulations,
    seed,
    locked_scores: actual_points
  })

  return { ...results, locked_count: actual_points.size }
}
```

### 4. Simulation Engine Changes (`run-simulation.mjs`)

```javascript
export function run_simulation({
  players,
  projections,
  variance_cache,
  correlation_cache,
  archetypes,
  schedule,
  teams,
  n_simulations = 10000,
  seed,
  return_raw_scores = false,
  locked_scores = new Map()
}) {
  // Split players
  const locked = players.filter((p) => locked_scores.has(p.pid))
  const pending = players.filter((p) => !locked_scores.has(p.pid))

  // Build matrix only for pending players
  const { matrix } = build_correlation_matrix({
    players: pending,
    schedule,
    correlation_cache,
    position_ranks: new Map(pending.map((p) => [p.pid, p.position_rank])),
    archetypes
  })

  // Generate samples for pending only
  const uniforms = generate_correlated_uniforms({
    correlation_matrix: matrix,
    n_simulations,
    seed
  })

  // ... sample distributions for pending players ...

  // Sum team totals
  const team_totals = new Map(
    teams.map((t) => [t.team_id, new Array(n_simulations).fill(0)])
  )

  // Add locked (constant across all sims)
  for (const p of locked) {
    const pts = locked_scores.get(p.pid)
    const totals = team_totals.get(p.team_id)
    for (let i = 0; i < n_simulations; i++) totals[i] += pts
  }

  // Add simulated (varies per sim)
  for (const p of pending) {
    const scores = simulated_scores.get(p.pid)
    const totals = team_totals.get(p.team_id)
    for (let i = 0; i < n_simulations; i++) totals[i] += scores[i]
  }

  // ... calculate win probabilities ...
}
```

## Implementation Tasks

- [ ] Update `load_nfl_schedule()` to include `is_final` based on scores
- [ ] Add `load_actual_player_points()` function
- [ ] Update `simulate_matchup()` to categorize and load actual points
- [ ] Update `run_simulation()` to accept `locked_scores`
- [ ] Update `simulate_championship()` with same logic
- [ ] Add tests

## Edge Cases

| Case                                                       | Handling                                           |
| ---------------------------------------------------------- | -------------------------------------------------- |
| Game final, `scoring_format_player_gamelogs` not populated | Treat as pending (simulate); run generation script |
| Game in progress                                           | Treat as pending (simulate full game)              |
| DST players                                                | Same logic (team abbrev as PID)                    |
| Bye week                                                   | Not in schedule, use zero projection               |

## Pipeline Order

1. Gamelogs imported (`import-nfl-game-logs.mjs` or similar)
2. Run `generate-scoring-format-player-gamelogs.mjs --week 16 --year 2025`
3. Simulation uses actual points from `scoring_format_player_gamelogs`
