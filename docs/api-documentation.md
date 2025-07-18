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

- **Player ID (pid)** - String format like "AARI-PENT-2017-1994-09-03" (see: FFFF-LLLL-YYYY-YYYY-MM-DD, where FFFF = first four letters of first name, LLLL = first four of last name, YYYY = draft year, YYYY-MM-DD = date of birth; DSTs use team abbreviation)
- **League ID (lid or league_id)** - Integer (xo.football internal ID)
- **Team ID (tid)** - Integer (xo.football internal ID)
- **Week** - Integer (0-18)
- **Year** - Integer (1999+)

## Support

For technical issues or questions about the API, please refer to the project repository or contact the development team.
