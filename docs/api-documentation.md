# API Documentation

## Overview

The xo.football API provides comprehensive access to fantasy football data, including player statistics, league management, betting markets, and advanced analytics.

## Base URL

```
/api
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Get a token by calling `/api/auth/login` with your credentials.

## Interactive Documentation

For interactive API exploration, visit `/api/docs` which provides a Swagger UI interface with:

- Complete endpoint documentation
- Parameter descriptions
- Request/response examples
- Try-it-out functionality

## Core Endpoints

### Authentication

- `POST /auth/login` - User login
- `POST /auth/register` - User registration (requires invite code)

### Players

- `POST /players` - Search and retrieve players
- `GET /players/{pid}` - Get individual player details
- `GET /players/{pid}/practices` - Get player practice reports
- `GET /players/{pid}/gamelogs` - Get player game-by-game statistics
- `GET /players/{pid}/markets` - Get player betting markets

### Fantasy Leagues

- `GET /leagues` - List accessible leagues
- `GET /leagues/{lid}` - Get league details
- `GET /leagues/{lid}/teams` - Get league teams
- `GET /leagues/{lid}/players` - Get league players
- `GET /leagues/{lid}/restricted-free-agency` - Completed restricted free agency auctions for a season (`?year=`), each with all of its bids, the winner, and an outcome code per losing bid. Resolved auctions are fully disclosed; a live auction is absent because the filter is the nomination's processing timestamp rather than a permission check.

- `POST /leagues/{lid}/pause` - Open a league pause (commissioner only)
- `DELETE /leagues/{lid}/pause` - Resume a paused league (commissioner only)

#### League pause

While a league is paused every mutating route under `/leagues/{lid}` and
`/teams/{tid}` answers **423 Locked** with `{"error": "league is paused"}`, and
reads pass through untouched. The refusal body carries nothing else: the guard
runs above the blanket 401, so an anonymous caller reaches it and must learn
neither the reason nor when the pause began.

The league payload on `GET /leagues/{lid}` and `GET /me` carries two pause
fields, and both routes must carry them — the SPA populates its league store
from whichever answers last:

- `paused_at` — when the open pause began, null when the league is live. This
  is what the every-route pause banner renders and what freezes the rookie
  draft clocks.
- `resumed_at` — when the latest COMPLETED pause ended, null only when the
  league has never finished a pause. It is independent of `paused_at`: a league
  paused again after an earlier resume carries both. The draft window
  calculator reads it as a single scalar — a resume voids the standing
  publication, so no pick has a window and none can be passed until the next
  daily boundary at or after it. It replaced a `draft_pause_periods` interval
  array, which credited the open time back to the pick clock.

The commissioner's free-text `pause_reason` is deliberately absent from both
payloads and is served only from the authenticated pause route.

### Fantasy Teams

- `GET /teams/{tid}` - Get team details
- `GET /teams/{tid}/lineups` - Get team lineups
- `POST /teams/{tid}/lineups` - Update team lineup

### Player Projections

- `GET /projections` - Get player projections
- `POST /projections` - Update projections (admin only)

### Statistics

- `GET /stats` - Player and team statistics
- `GET /seasonlogs` - Season-long statistics
- `GET /plays` - Play-by-play data

### Prediction Markets & Betting

- `GET /markets` - Betting markets
- `GET /wagers` - User wagers

### Utilities

- `GET /status` - API status
- `GET /schedule` - NFL schedule
- `GET /sources` - Data sources

## Response Format

All responses are in JSON format. Successful responses return data directly or in arrays. Error responses follow this format:

```json
{
  "error": "Error message description"
}
```

## Rate Limiting

Some endpoints have rate limiting applied:

- `/stats`, `/plays`, `/markets` - Limited to prevent abuses

## Query Parameters

Common query parameters:

- `week` - NFL week (0 for season totals, 1-18 for weekly)
- `year` - Season year
- `league_id` - League context for scoring formats

## Data Types

- **Player ID (pid)** - String format like "AARI-PENT-008269" (FFFF-LLLL-NNNNNN, where FFFF = first four letters of first name, LLLL = first four of last name, and NNNNNN = an immutable zero-padded serial that carries the identity; the name prefix is a frozen snapshot and is never recomputed. DSTs use the bare team abbreviation)
- **League ID (lid or league_id)** - Integer (xo.football internal ID)
- **Team ID (tid)** - Integer (xo.football internal ID)
- **Week** - Integer (0-18)
- **Year** - Integer (1999+)

## Support

For technical issues or questions about the API, please refer to the project repository or contact the development team.
