import swaggerJSDoc from 'swagger-jsdoc'
import { bookmaker_constants, constants } from '#libs-shared'
import { league_settings_fields } from '#api/routes/leagues/league-settings.mjs'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'xo.football League API',
      version: '0.1.0-alpha',
      description:
        '**UNSTABLE API - UNDER HEAVY DEVELOPMENT**\n\nThis API is currently in active development and is not yet stable. Breaking changes are expected, and endpoints may be moved, renamed, or removed without notice. Use at your own risk in production environments.\n\nOpen-source fantasy football league management platform API with advanced analytics and betting market integration.',
      contact: {
        name: 'xo.football',
        url: 'https://github.com/mistakia/league'
      },
      license: {
        name: 'GNU GPLv3',
        url: 'https://github.com/mistakia/league/blob/master/LICENSE.md'
      }
    },
    servers: [
      {
        url: '/api',
        description: 'API base path'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login'
        }
      },
      schemas: {
        // Base ID schemas
        EntityId: {
          type: 'integer',
          description: 'Unique identifier',
          example: 12345
        },
        UserId: {
          type: 'integer',
          description: 'User ID',
          example: 1
        },
        LeagueId: {
          type: 'integer',
          description: 'Fantasy league ID',
          example: 2
        },
        TeamId: {
          type: 'integer',
          description: 'Fantasy team ID',
          example: 5
        },
        PlayerId: {
          type: 'string',
          description: 'Player ID in format FFFF-LLLL-YYYY-YYYY-MM-DD',
          example: 'PATR-MAHO-2017-1995-09-17',
          pattern: '^[A-Z]{4}-[A-Z]{4}-\\d{4}-\\d{4}-\\d{2}-\\d{2}$'
        },
        // Common property schemas
        UnixTimestamp: {
          type: 'integer',
          description: 'Unix timestamp',
          example: 1640995200
        },
        NFLTeamAbbreviation: {
          type: 'string',
          enum: [...constants.nflTeams, 'INA'],
          description: 'NFL team abbreviation (INA = Inactive)',
          example: 'KC'
        },
        FantasyPosition: {
          type: 'string',
          enum: [...constants.positions, 'DEF'],
          description: 'Fantasy-relevant position',
          example: 'QB'
        },
        // Base context schemas
        LeagueTeamContext: {
          type: 'object',
          properties: {
            lid: {
              $ref: '#/components/schemas/LeagueId'
            },
            tid: {
              $ref: '#/components/schemas/TeamId'
            }
          },
          required: ['lid', 'tid']
        },
        TimeContext: {
          type: 'object',
          properties: {
            year: {
              type: 'integer',
              minimum: 2020,
              description: 'Season year',
              example: 2024
            },
            week: {
              type: 'integer',
              minimum: 0,
              maximum: 18,
              description: 'Week number',
              example: 4
            },
            seas_type: {
              $ref: '#/components/schemas/SeasonTypeEnum'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            }
          },
          required: ['error']
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID'
            },
            username: {
              type: 'string',
              description: 'Username'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT token for authentication'
            },
            userId: {
              type: 'integer',
              description: 'User ID'
            }
          },
          required: ['token', 'userId']
        },
        Player: {
          type: 'object',
          properties: {
            pid: {
              $ref: '#/components/schemas/PlayerId'
            },
            fname: {
              type: 'string',
              maxLength: 20,
              description: 'First name',
              example: 'Patrick'
            },
            lname: {
              type: 'string',
              maxLength: 40,
              description: 'Last name',
              example: 'Mahomes'
            },
            pname: {
              type: 'string',
              maxLength: 25,
              description: 'Preferred name',
              example: 'P.Mahomes'
            },
            formatted: {
              type: 'string',
              maxLength: 50,
              description: 'Formatted name for display',
              example: 'patrick mahomes'
            },
            pos: {
              type: 'string',
              maxLength: 4,
              enum: [
                'QB',
                'RB',
                'WR',
                'TE',
                'K',
                'DEF',
                'DST',
                'FB',
                'CB',
                'S',
                'LB',
                'DE',
                'DT'
              ],
              description: 'Primary position',
              example: 'QB'
            },
            pos1: {
              type: 'string',
              maxLength: 4,
              description: 'Primary position',
              example: 'QB'
            },
            pos2: {
              type: 'string',
              maxLength: 4,
              nullable: true,
              description: 'Secondary position',
              example: null
            },
            height: {
              type: 'integer',
              description: 'Height in inches',
              example: 75
            },
            weight: {
              type: 'integer',
              description: 'Weight in pounds',
              example: 230
            },
            current_nfl_team: {
              $ref: '#/components/schemas/NFLTeamAbbreviation'
            },
            jnum: {
              type: 'integer',
              description: 'Jersey number',
              example: 15
            },
            nfl_draft_year: {
              type: 'integer',
              description: 'NFL draft year',
              example: 2017
            },
            round: {
              type: 'integer',
              description: 'Draft round (0 = undrafted)',
              example: 1
            },
            col: {
              type: 'string',
              description: 'College',
              example: 'Texas Tech'
            },
            status: {
              type: 'string',
              description: 'Player status',
              example: 'Active'
            },
            nfl_status: {
              type: 'string',
              enum: [
                'ACTIVE',
                'INACTIVE',
                'INJURED_RESERVE',
                'PRACTICE_SQUAD',
                'SUSPENDED'
              ],
              description: 'NFL roster status',
              example: 'ACTIVE'
            },
            injury_status: {
              type: 'string',
              nullable: true,
              enum: ['QUESTIONABLE', 'DOUBTFUL', 'OUT', null],
              description: 'Current injury status',
              example: null
            },
            dob: {
              type: 'string',
              format: 'date',
              description: 'Date of birth',
              example: '1995-09-17'
            }
          }
        },
        League: {
          type: 'object',
          properties: {
            uid: {
              type: 'integer',
              description: 'Fantasy league ID',
              example: 2
            },
            commishid: {
              type: 'integer',
              description: 'Commissioner user ID',
              example: 5
            },
            name: {
              type: 'string',
              description: 'Fantasy league name',
              example: 'TEFLON LEAGUE'
            },
            hosted: {
              type: 'boolean',
              description: 'Whether fantasy league is hosted on platform',
              example: false
            },
            espn_id: {
              type: 'integer',
              nullable: true,
              description: 'ESPN league ID for integration',
              example: null
            },
            sleeper_id: {
              type: 'integer',
              nullable: true,
              description: 'Sleeper league ID for integration',
              example: null
            },
            mfl_id: {
              type: 'integer',
              nullable: true,
              description: 'MyFantasyLeague ID for integration',
              example: null
            },
            fleaflicker_id: {
              type: 'integer',
              nullable: true,
              description: 'Fleaflicker league ID for integration',
              example: null
            },
            league_format_hash: {
              type: 'string',
              description: 'Hash identifying league format configuration',
              example:
                'b5310a7f7c47c20ce372e47e8a0a188b22b78b1d34e2ea18829d94b94ffdc342'
            },
            scoring_format_hash: {
              type: 'string',
              description: 'Hash identifying scoring format configuration',
              example:
                'eb75c8fd2acb21fea5d8754f53e9aa2e5d7c40327d5853c58592f658235ba756'
            },
            num_teams: {
              type: 'integer',
              description: 'Number of fantasy teams in league',
              example: 14
            },
            sqb: {
              type: 'integer',
              description: 'Starting QB slots',
              example: 1
            },
            srb: {
              type: 'integer',
              description: 'Starting RB slots',
              example: 2
            },
            swr: {
              type: 'integer',
              description: 'Starting WR slots',
              example: 3
            },
            ste: {
              type: 'integer',
              description: 'Starting TE slots',
              example: 1
            },
            srbwrte: {
              type: 'integer',
              description: 'RB/WR/TE flex slots',
              example: 1
            },
            sdst: {
              type: 'integer',
              description: 'Starting DEF/ST slots',
              example: 1
            },
            sk: {
              type: 'integer',
              description: 'Starting kicker slots',
              example: 1
            },
            bench: {
              type: 'integer',
              description: 'Bench spots',
              example: 6
            },
            ps: {
              type: 'integer',
              description: 'Practice squad spots',
              example: 4
            },
            ir: {
              type: 'integer',
              description: 'Injured reserve spots',
              example: 2
            },
            cap: {
              type: 'integer',
              description: 'Salary cap',
              example: 200
            },
            faab: {
              type: 'integer',
              description: 'Free Agent Acquisition Budget',
              example: 200
            }
          }
        },
        Team: {
          type: 'object',
          properties: {
            uid: {
              type: 'integer',
              description: 'Fantasy team ID',
              example: 13
            },
            year: {
              type: 'integer',
              description: 'Season year',
              example: 2024
            },
            lid: {
              type: 'integer',
              description: 'Fantasy league ID',
              example: 2
            },
            name: {
              type: 'string',
              description: 'Fantasy team name',
              example: 'Dynasty Warriors'
            },
            abbrv: {
              type: 'string',
              maxLength: 4,
              description: 'Fantasy team abbreviation',
              example: 'DW'
            },
            image: {
              type: 'string',
              nullable: true,
              description: 'Fantasy team logo/image URL',
              example: null
            },
            div: {
              type: 'integer',
              nullable: true,
              description: 'Division number',
              example: 1
            },
            waiver_order: {
              type: 'integer',
              nullable: true,
              description: 'Current waiver priority',
              example: 5
            },
            draft_order: {
              type: 'integer',
              nullable: true,
              description: 'Draft position',
              example: 3
            },
            cap: {
              type: 'integer',
              description: 'Fantasy team salary cap',
              example: 200
            },
            faab: {
              type: 'integer',
              description: 'Free Agent Acquisition Budget remaining',
              example: 150
            },
            pc: {
              type: 'string',
              nullable: true,
              description: 'Primary contact/owner',
              example: null
            },
            ac: {
              type: 'string',
              nullable: true,
              description: 'Assistant contact/co-owner',
              example: null
            }
          }
        },
        Projection: {
          type: 'object',
          properties: {
            pid: {
              type: 'string',
              description: 'Player ID',
              example: 'JALE-HURT-2020-1998-08-07'
            },
            sourceid: {
              type: 'integer',
              enum: Object.values(constants.sources),
              description:
                'Projection source ID (1=Fantasy Sharks, 2=CBS, 3=ESPN, 4=NFL, 6=PFF, 16=4for4, 18=Average, 28=Sleeper)',
              example: 16
            },
            week: {
              type: 'integer',
              minimum: 0,
              maximum: 18,
              description: 'Week number (0 for season totals)',
              example: 4
            },
            year: {
              type: 'integer',
              minimum: 2020,
              description: 'Season year',
              example: 2024
            },
            seas_type: {
              type: 'string',
              enum: ['REG', 'POST', 'PRE'],
              description: 'Season type',
              example: 'POST'
            },
            pos: {
              type: 'string',
              description: 'Player position',
              example: 'QB'
            },
            pa: {
              type: 'number',
              description: 'Projected pass attempts',
              example: 29.3
            },
            pc: {
              type: 'number',
              description: 'Projected completions',
              example: 20.1
            },
            py: {
              type: 'number',
              description: 'Projected passing yards',
              example: 219.8
            },
            ints: {
              type: 'number',
              description: 'Projected interceptions',
              example: 0.6
            },
            tdp: {
              type: 'number',
              description: 'Projected passing touchdowns',
              example: 0.8
            },
            ra: {
              type: 'number',
              description: 'Projected rush attempts',
              example: 8.5
            },
            ry: {
              type: 'number',
              description: 'Projected rushing yards',
              example: 42.4
            },
            tdr: {
              type: 'number',
              description: 'Projected rushing touchdowns',
              example: 0.8
            },
            trg: {
              type: 'number',
              description: 'Projected targets',
              example: 12.5
            },
            rec: {
              type: 'number',
              description: 'Projected receptions',
              example: 8.2
            },
            recy: {
              type: 'number',
              description: 'Projected receiving yards',
              example: 95.3
            },
            tdrec: {
              type: 'number',
              description: 'Projected receiving touchdowns',
              example: 0.7
            },
            pts: {
              type: 'number',
              description: 'Projected fantasy points',
              example: 18.5
            }
          }
        },
        BettingMarket: {
          type: 'object',
          properties: {
            market_type: {
              type: 'string',
              description: 'Type of betting market',
              example: 'player_passing_yards'
            },
            source_id: {
              type: 'string',
              enum: Object.values(bookmaker_constants.bookmakers),
              description: 'Sportsbook source',
              example: 'DRAFTKINGS'
            },
            source_market_name: {
              type: 'string',
              description: 'Market name from sportsbook',
              example:
                'Passing Props - Pass Yards O/U - Jayden Daniels Passing Yards O/U'
            },
            esbid: {
              type: 'string',
              description: 'Game ID',
              example: '2025012601'
            },
            open: {
              type: 'boolean',
              description: 'Whether market is open for betting',
              example: true
            },
            live: {
              type: 'boolean',
              nullable: true,
              description: 'Whether market is live',
              example: null
            },
            settled: {
              type: 'boolean',
              description: 'Whether market is settled',
              example: false
            },
            selections: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/BettingMarketSelection'
              },
              description: 'Available betting selections'
            }
          }
        },
        BettingMarketSelection: {
          type: 'object',
          properties: {
            selection_name: {
              type: 'string',
              description: 'Selection name',
              example: 'Over'
            },
            selection_type: {
              type: 'string',
              enum: Object.values(bookmaker_constants.selection_type),
              description: 'Type of selection',
              example: 'OVER'
            },
            selection_metric_line: {
              type: 'number',
              description: 'Betting line value',
              example: 226.5
            },
            odds_decimal: {
              type: 'number',
              description: 'Decimal odds',
              example: 1.87
            },
            odds_american: {
              type: 'integer',
              description: 'American odds',
              example: -115
            },
            current_season_hit_rate_hard: {
              type: 'number',
              nullable: true,
              description: 'Current season hit rate',
              example: 0.652
            },
            current_season_edge_hard: {
              type: 'number',
              nullable: true,
              description: 'Current season edge',
              example: 0.045
            }
          }
        },
        ProjectionSource: {
          type: 'object',
          properties: {
            uid: {
              type: 'integer',
              description: 'Source ID',
              example: 16
            },
            name: {
              type: 'string',
              description: 'Source name',
              example: '4for4'
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'Source website URL',
              example: 'https://www.4for4.com/'
            }
          }
        },
        BookmakerEnum: {
          type: 'string',
          enum: Object.values(bookmaker_constants.bookmakers),
          description: 'Sportsbook identifiers',
          example: 'DRAFTKINGS'
        },
        TimeTypeEnum: {
          type: 'string',
          enum: Object.values(bookmaker_constants.time_type),
          description: 'Market time type (when odds were captured)',
          example: 'CLOSE'
        },
        SelectionTypeEnum: {
          type: 'string',
          enum: Object.values(bookmaker_constants.selection_type),
          description: 'Type of betting selection',
          example: 'OVER'
        },
        SeasonTypeEnum: {
          type: 'string',
          enum: constants.seas_types,
          description: 'NFL season type',
          example: 'REG'
        },
        TeamFieldEnum: {
          type: 'string',
          enum: [
            'name',
            'image',
            'abbrv',
            'pc',
            'ac',
            'teamtext',
            'teamvoice',
            'leaguetext'
          ],
          description: 'Fantasy team field that can be updated',
          example: 'name'
        },
        MarketTypeEnum: {
          type: 'string',
          enum: [
            // Player Props (includes game, season, playoff, and leader props)
            ...Object.values(bookmaker_constants.player_prop_types),
            // Team Game Props
            ...Object.values(bookmaker_constants.team_game_market_types)
          ],
          description: 'Type of betting market (can be null for some records)',
          example: 'GAME_PASSING_YARDS'
        },
        LeagueBaseline: {
          type: 'object',
          properties: {
            lid: {
              type: 'integer',
              description: 'League ID',
              example: 2
            },
            week: {
              type: 'string',
              maxLength: 3,
              description: 'Week number (or "0" for season total)',
              example: '1'
            },
            year: {
              type: 'integer',
              description: 'Season year',
              example: 2024
            },
            pid: {
              type: 'string',
              maxLength: 25,
              description:
                'Player ID of the baseline player for this position/week',
              example: 'JACO-MYER-2020-1996-09-10'
            },
            type: {
              type: 'string',
              maxLength: 10,
              description:
                'Type of baseline calculation (e.g., "starter" for starting lineup baseline)',
              example: 'starter'
            },
            pos: {
              type: 'string',
              maxLength: 4,
              enum: [...constants.positions, 'DEF'],
              description: 'Position for this baseline calculation',
              example: 'WR'
            }
          },
          required: ['lid', 'week', 'type', 'pos']
        },
        WaiverTypeEnum: {
          type: 'integer',
          enum: [1, 2, 3],
          description:
            'Waiver claim type (1=FREE_AGENCY, 2=POACH, 3=FREE_AGENCY_PRACTICE)',
          example: 1
        },
        SuperPriorityStatus: {
          type: 'object',
          properties: {
            eligible: {
              type: 'boolean',
              description:
                'Whether the player is eligible for super priority waiver claim',
              example: true
            },
            original_tid: {
              type: 'integer',
              nullable: true,
              description:
                'Original team ID that can use super priority for this player',
              example: 5
            },
            player_id: {
              type: 'string',
              description: 'Player ID',
              example: 'ALVI-KAME-2022-1999-02-05'
            }
          },
          required: ['eligible', 'original_tid', 'player_id']
        },
        ProcessedWaiverClaim: {
          type: 'object',
          properties: {
            uid: {
              type: 'integer',
              description: 'Waiver claim ID',
              example: 12345
            },
            processed: {
              type: 'integer',
              description: 'Unix timestamp when the waiver was processed',
              example: 1640995200
            },
            release: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  pid: {
                    type: 'string',
                    description: 'Player ID of released player',
                    example: 'JORD-LOVE-2020-1998-11-02'
                  },
                  waiverid: {
                    type: 'integer',
                    description: 'Waiver claim ID',
                    example: 12345
                  }
                }
              },
              description:
                'Array of players released as part of this waiver claim'
            }
          },
          required: ['uid', 'processed', 'release']
        },
        WaiverClaimRequest: {
          type: 'object',
          properties: {
            pid: {
              type: 'string',
              description: 'Player ID to claim',
              example: 'ALVI-KAME-2022-1999-02-05'
            },
            teamId: {
              type: 'integer',
              description: 'Team ID submitting the claim',
              example: 5
            },
            leagueId: {
              type: 'integer',
              description: 'League ID',
              example: 2
            },
            type: {
              $ref: '#/components/schemas/WaiverTypeEnum'
            },
            bid: {
              type: 'integer',
              minimum: 0,
              description: 'Bid amount for free agency claims (FAAB)',
              example: 50
            },
            release: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of player IDs to release',
              example: ['JORD-LOVE-2020-1998-11-02']
            },
            super_priority: {
              type: 'boolean',
              description:
                'Whether to use super priority for practice squad claims',
              example: false
            }
          },
          required: ['pid', 'teamId', 'leagueId', 'type']
        },
        WaiverClaim: {
          type: 'object',
          properties: {
            uid: {
              type: 'integer',
              description: 'Waiver claim ID',
              example: 12345
            },
            tid: {
              type: 'integer',
              description: 'Team ID',
              example: 5
            },
            userid: {
              type: 'integer',
              description: 'User ID who submitted the claim',
              example: 1
            },
            lid: {
              type: 'integer',
              description: 'League ID',
              example: 2
            },
            pid: {
              type: 'string',
              description: 'Player ID',
              example: 'ALVI-KAME-2022-1999-02-05'
            },
            po: {
              type: 'integer',
              description: 'Priority order (lower values processed first)',
              example: 9999
            },
            submitted: {
              type: 'integer',
              description: 'Unix timestamp when claim was submitted',
              example: 1640995200
            },
            bid: {
              type: 'integer',
              minimum: 0,
              description: 'Bid amount (FAAB)',
              example: 50
            },
            type: {
              $ref: '#/components/schemas/WaiverTypeEnum'
            },
            super_priority: {
              type: 'integer',
              enum: [0, 1],
              description: 'Whether super priority was used (0=false, 1=true)',
              example: 0
            },
            release: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of player IDs to release',
              example: ['JORD-LOVE-2020-1998-11-02']
            }
          },
          required: [
            'uid',
            'tid',
            'userid',
            'lid',
            'pid',
            'po',
            'submitted',
            'bid',
            'type',
            'super_priority',
            'release'
          ]
        },
        WaiverOrderRequest: {
          type: 'object',
          properties: {
            teamId: {
              type: 'integer',
              description: 'Team ID',
              example: 5
            },
            leagueId: {
              type: 'integer',
              description: 'League ID',
              example: 2
            },
            waivers: {
              type: 'array',
              items: {
                type: 'integer'
              },
              description:
                'Array of waiver claim IDs in desired priority order',
              example: [12345, 12347, 12346]
            }
          },
          required: ['teamId', 'leagueId', 'waivers']
        },
        WaiverUpdateRequest: {
          type: 'object',
          properties: {
            teamId: {
              type: 'integer',
              description: 'Team ID',
              example: 5
            },
            leagueId: {
              type: 'integer',
              description: 'League ID',
              example: 2
            },
            bid: {
              type: 'integer',
              minimum: 0,
              description: 'New bid amount',
              example: 75
            },
            release: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Updated array of player IDs to release',
              example: ['JORD-LOVE-2020-1998-11-02']
            }
          },
          required: ['teamId', 'leagueId']
        },
        WaiverUpdateResponse: {
          type: 'object',
          properties: {
            uid: {
              type: 'integer',
              description: 'Waiver claim ID',
              example: 12345
            },
            bid: {
              type: 'integer',
              minimum: 0,
              description: 'Updated bid amount',
              example: 75
            },
            release: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Updated array of player IDs to release',
              example: ['JORD-LOVE-2020-1998-11-02']
            }
          },
          required: ['uid', 'bid', 'release']
        },
        WaiverCancelRequest: {
          type: 'object',
          properties: {
            teamId: {
              type: 'integer',
              description: 'Team ID',
              example: 5
            },
            leagueId: {
              type: 'integer',
              description: 'League ID',
              example: 2
            }
          },
          required: ['teamId', 'leagueId']
        },
        WaiverCancelResponse: {
          type: 'object',
          properties: {
            uid: {
              type: 'integer',
              description: 'Cancelled waiver claim ID',
              example: 12345
            },
            tid: {
              type: 'integer',
              description: 'Team ID',
              example: 5
            },
            lid: {
              type: 'integer',
              description: 'League ID',
              example: 2
            },
            cancelled: {
              type: 'integer',
              description: 'Unix timestamp when claim was cancelled',
              example: 1640995200
            }
          },
          required: ['uid', 'tid', 'lid', 'cancelled']
        },
        PlacedWager: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique wager ID',
              example: 12345
            },
            userid: {
              type: 'integer',
              description: 'User ID who placed the wager',
              example: 123
            },
            wager_type: {
              type: 'string',
              enum: ['SINGLE', 'PARLAY', 'ROUND_ROBIN'],
              description: 'Type of wager placed',
              example: 'PARLAY'
            },
            placed_at: {
              type: 'integer',
              description: 'Unix timestamp when wager was placed',
              example: 1640995200
            },
            bet_count: {
              type: 'integer',
              description:
                'Number of individual bets in the wager (usually 1 for single/parlay)',
              example: 1
            },
            selection_count: {
              type: 'integer',
              minimum: 1,
              maximum: 12,
              description: 'Total number of selections in the wager',
              example: 3
            },
            selection_lost: {
              type: 'integer',
              minimum: 0,
              maximum: 12,
              description: 'Number of selections that have lost',
              example: 0
            },
            status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              description: 'Current status of the wager',
              example: 'WON'
            },
            bet_wager_amount: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Amount wagered on this bet',
              example: 50.0
            },
            total_wager_amount: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description:
                'Total amount wagered (may include multiple bets for round robin)',
              example: 50.0
            },
            wager_returned_amount: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Amount returned/won from the wager',
              example: 175.5
            },
            book_id: {
              $ref: '#/components/schemas/BookmakerEnum',
              description: 'Sportsbook where the wager was placed',
              example: 'DRAFTKINGS'
            },
            book_wager_id: {
              type: 'string',
              description: 'Unique identifier from the sportsbook',
              example: 'DK_12345_ABC'
            },
            public: {
              type: 'boolean',
              description: 'Whether the wager is publicly visible',
              example: true
            },
            selection_1_id: {
              type: 'string',
              nullable: true,
              description: 'First selection ID',
              example: 'sel_123'
            },
            selection_1_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for first selection',
              example: -110
            },
            selection_1_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of first selection',
              example: 'WON'
            },
            selection_2_id: {
              type: 'string',
              nullable: true,
              description: 'Second selection ID',
              example: 'sel_456'
            },
            selection_2_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for second selection',
              example: 120
            },
            selection_2_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of second selection',
              example: 'WON'
            },
            selection_3_id: {
              type: 'string',
              nullable: true,
              description: 'Third selection ID',
              example: 'sel_789'
            },
            selection_3_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for third selection',
              example: -105
            },
            selection_3_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of third selection',
              example: 'WON'
            },
            selection_4_id: {
              type: 'string',
              nullable: true,
              description: 'Fourth selection ID',
              example: 'sel_abc'
            },
            selection_4_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for fourth selection',
              example: -115
            },
            selection_4_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of fourth selection',
              example: 'OPEN'
            },
            selection_5_id: {
              type: 'string',
              nullable: true,
              description: 'Fifth selection ID',
              example: null
            },
            selection_5_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for fifth selection',
              example: null
            },
            selection_5_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of fifth selection',
              example: null
            },
            selection_6_id: {
              type: 'string',
              nullable: true,
              description: 'Sixth selection ID',
              example: null
            },
            selection_6_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for sixth selection',
              example: null
            },
            selection_6_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of sixth selection',
              example: null
            },
            selection_7_id: {
              type: 'string',
              nullable: true,
              description: 'Seventh selection ID',
              example: null
            },
            selection_7_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for seventh selection',
              example: null
            },
            selection_7_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of seventh selection',
              example: null
            },
            selection_8_id: {
              type: 'string',
              nullable: true,
              description: 'Eighth selection ID',
              example: null
            },
            selection_8_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for eighth selection',
              example: null
            },
            selection_8_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of eighth selection',
              example: null
            },
            selection_9_id: {
              type: 'string',
              nullable: true,
              description: 'Ninth selection ID',
              example: null
            },
            selection_9_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for ninth selection',
              example: null
            },
            selection_9_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of ninth selection',
              example: null
            },
            selection_10_id: {
              type: 'string',
              nullable: true,
              description: 'Tenth selection ID',
              example: null
            },
            selection_10_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for tenth selection',
              example: null
            },
            selection_10_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of tenth selection',
              example: null
            },
            selection_11_id: {
              type: 'string',
              nullable: true,
              description: 'Eleventh selection ID',
              example: null
            },
            selection_11_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for eleventh selection',
              example: null
            },
            selection_11_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of eleventh selection',
              example: null
            },
            selection_12_id: {
              type: 'string',
              nullable: true,
              description: 'Twelfth selection ID',
              example: null
            },
            selection_12_odds: {
              type: 'integer',
              nullable: true,
              description: 'American odds for twelfth selection',
              example: null
            },
            selection_12_status: {
              type: 'string',
              enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
              nullable: true,
              description: 'Status of twelfth selection',
              example: null
            }
          },
          required: [
            'id',
            'userid',
            'wager_type',
            'placed_at',
            'bet_count',
            'selection_count',
            'selection_lost',
            'status',
            'bet_wager_amount',
            'total_wager_amount',
            'wager_returned_amount',
            'book_id',
            'book_wager_id',
            'public'
          ]
        },
        WagerTypeEnum: {
          type: 'string',
          enum: ['SINGLE', 'PARLAY', 'ROUND_ROBIN'],
          description: 'Type of betting wager',
          example: 'PARLAY'
        },
        WagerStatusEnum: {
          type: 'string',
          enum: ['OPEN', 'WON', 'LOST', 'PUSH', 'CANCELLED'],
          description: 'Status of a betting wager or selection',
          example: 'WON'
        },
        UserSourceSetting: {
          type: 'object',
          properties: {
            userid: {
              type: 'integer',
              description: 'User ID who owns this setting',
              example: 123
            },
            sourceid: {
              type: 'integer',
              enum: Object.values(constants.sources),
              description: 'Projection source ID',
              example: 16
            },
            weight: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description:
                'Weight assigned to this source for composite projections',
              example: 1.5
            }
          },
          required: ['userid', 'sourceid', 'weight']
        },
        SourceWeightUpdateRequest: {
          type: 'object',
          properties: {
            weight: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description:
                'Weight to assign to this source (1.0 = default, 0.0 = exclude)',
              example: 1.5
            }
          },
          required: ['weight']
        },
        SourceWeightUpdateResponse: {
          type: 'object',
          properties: {
            weight: {
              type: 'number',
              format: 'float',
              description: 'The weight that was applied to the source',
              example: 1.5
            }
          },
          required: ['weight']
        },
        NFLPlay: {
          type: 'object',
          properties: {
            esbid: {
              type: 'string',
              description: 'Game ID in format YYYYMMDDHH',
              example: '2024120801'
            },
            playId: {
              type: 'integer',
              description: 'Unique play identifier within the game',
              example: 1
            },
            year: {
              type: 'integer',
              description: 'Season year',
              example: 2024
            },
            week: {
              type: 'integer',
              description: 'Week number',
              example: 13
            },
            seas_type: {
              $ref: '#/components/schemas/SeasonTypeEnum'
            },
            off: {
              type: 'string',
              description: 'Offensive team abbreviation',
              example: 'KC'
            },
            def: {
              type: 'string',
              description: 'Defensive team abbreviation',
              example: 'LV'
            },
            down: {
              type: 'integer',
              nullable: true,
              description: 'Down number (1-4)',
              example: 1
            },
            yards_to_go: {
              type: 'integer',
              nullable: true,
              description: 'Yards to go for first down',
              example: 10
            },
            yfog: {
              type: 'integer',
              nullable: true,
              description: 'Yards from own goal line',
              example: 25
            },
            play_type: {
              type: 'string',
              nullable: true,
              description: 'Type of play (RUSH, PASS, KICK, etc.)',
              example: 'RUSH'
            },
            yards_gained: {
              type: 'integer',
              nullable: true,
              description: 'Yards gained on the play',
              example: 7
            }
          },
          required: [
            'esbid',
            'playId',
            'year',
            'week',
            'seas_type',
            'off',
            'def'
          ]
        },
        NFLPlayCharted: {
          allOf: [
            { $ref: '#/components/schemas/NFLPlay' },
            {
              type: 'object',
              properties: {
                day: {
                  type: 'string',
                  description: 'Day of the week',
                  example: 'Sunday'
                },
                qtr: {
                  type: 'integer',
                  nullable: true,
                  description: 'Quarter number (1-4)',
                  example: 1
                },
                player_fuml_pid: {
                  type: 'string',
                  nullable: true,
                  description: 'Player ID who fumbled',
                  example: 'PATR-MAHO-2017-1995-09-17'
                },
                fuml: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether a fumble occurred',
                  example: false
                },
                bc_pid: {
                  type: 'string',
                  nullable: true,
                  description: 'Ball carrier player ID',
                  example: 'PATR-MAHO-2017-1995-09-17'
                },
                pass_yds: {
                  type: 'integer',
                  nullable: true,
                  description: 'Passing yards on the play',
                  example: 15
                },
                rush_yds: {
                  type: 'integer',
                  nullable: true,
                  description: 'Rushing yards on the play',
                  example: 7
                },
                recv_yds: {
                  type: 'integer',
                  nullable: true,
                  description: 'Receiving yards on the play',
                  example: 12
                },
                first_down: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether play resulted in first down',
                  example: true
                },
                successful_play: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether play was considered successful',
                  example: true
                },
                psr_pid: {
                  type: 'string',
                  nullable: true,
                  description: 'Passer player ID',
                  example: 'PATR-MAHO-2017-1995-09-17'
                },
                trg_pid: {
                  type: 'string',
                  nullable: true,
                  description: 'Target player ID',
                  example: 'TRAV-KELC-2013-1989-10-05'
                },
                intp_pid: {
                  type: 'string',
                  nullable: true,
                  description: 'Intercepted by player ID',
                  example: 'MARC-PETE-2017-1995-07-26'
                },
                comp: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether pass was completed',
                  example: true
                },
                td: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether play resulted in touchdown',
                  example: false
                },
                sk: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether quarterback was sacked',
                  example: false
                },
                dwn: {
                  type: 'integer',
                  nullable: true,
                  description: 'Down number (1-4)',
                  example: 1
                },
                dot: {
                  type: 'integer',
                  nullable: true,
                  description: 'Distance to touchdown',
                  example: 75
                },
                qb_pressure: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether quarterback was pressured',
                  example: false
                },
                qb_hit: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether quarterback was hit',
                  example: false
                },
                qb_hurry: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether quarterback was hurried',
                  example: false
                },
                highlight_pass: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether pass was highlight-worthy',
                  example: false
                },
                int_worthy: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether pass was interception-worthy',
                  example: false
                },
                dropped_pass: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether pass was dropped',
                  example: false
                },
                contested_ball: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether ball was contested',
                  example: false
                },
                mbt: {
                  type: 'boolean',
                  nullable: true,
                  description: 'Whether play was a big time throw',
                  example: false
                },
                yards_after_catch: {
                  type: 'integer',
                  nullable: true,
                  description: 'Yards gained after catch',
                  example: 8
                },
                yards_after_any_contact: {
                  type: 'integer',
                  nullable: true,
                  description: 'Yards gained after any contact',
                  example: 3
                },
                cov_type_ngs: {
                  type: 'string',
                  nullable: true,
                  description: 'Coverage type (NGS)',
                  example: 'MAN'
                },
                sep: {
                  type: 'number',
                  nullable: true,
                  description: 'Separation distance',
                  example: 2.5
                },
                ydl_100: {
                  type: 'integer',
                  nullable: true,
                  description: 'Yards from own goal line (100-yard field)',
                  example: 25
                }
              }
            }
          ]
        },
        NFLPlayStats: {
          type: 'object',
          properties: {
            esbid: {
              type: 'string',
              description: 'Game ID',
              example: '2024120801'
            },
            playId: {
              type: 'integer',
              description: 'Play identifier',
              example: 1
            },
            pid: {
              type: 'string',
              description: 'Player ID',
              example: 'PATR-MAHO-2017-1995-09-17'
            },
            stat_type: {
              type: 'string',
              description: 'Type of statistic',
              example: 'PASSING'
            },
            yards: {
              type: 'integer',
              nullable: true,
              description: 'Yards gained/lost',
              example: 15
            },
            touchdown: {
              type: 'boolean',
              description: 'Whether play resulted in touchdown',
              example: false
            },
            interception: {
              type: 'boolean',
              description: 'Whether play resulted in interception',
              example: false
            },
            valid: {
              type: 'boolean',
              description: 'Whether statistic is valid',
              example: true
            },
            qb_kneel: {
              type: 'boolean',
              nullable: true,
              description: 'Whether play was a QB kneel',
              example: false
            },
            week: {
              type: 'integer',
              description: 'Week number',
              example: 13
            }
          },
          required: [
            'esbid',
            'playId',
            'pid',
            'stat_type',
            'touchdown',
            'interception',
            'valid'
          ]
        },
        NFLTeamSeasonLog: {
          type: 'object',
          properties: {
            year: {
              type: 'integer',
              description: 'Season year',
              example: 2024
            },
            tm: {
              type: 'string',
              description: 'Team abbreviation',
              example: 'KC'
            },
            stat_key: {
              type: 'string',
              description: 'Statistical category identifier',
              example: 'points_scored'
            },
            stat_value: {
              type: 'number',
              description: 'Statistical value',
              example: 345
            },
            pts: {
              type: 'number',
              nullable: true,
              description: 'Fantasy points (if league context provided)',
              example: 12.5
            },
            rnk: {
              type: 'integer',
              nullable: true,
              description: 'Rank (if league context provided)',
              example: 3
            }
          },
          required: ['year', 'tm', 'stat_key', 'stat_value']
        },
        Transaction: {
          allOf: [
            {
              $ref: '#/components/schemas/LeagueTeamContext'
            },
            {
              $ref: '#/components/schemas/TimeContext'
            },
            {
              type: 'object',
              properties: {
                uid: {
                  $ref: '#/components/schemas/EntityId'
                },
                userid: {
                  $ref: '#/components/schemas/UserId'
                },
                pid: {
                  $ref: '#/components/schemas/PlayerId'
                },
                type: {
                  type: 'integer',
                  description: 'Transaction type code',
                  example: 1
                },
                value: {
                  type: 'integer',
                  description: 'Transaction value/bid amount',
                  example: 50
                },
                timestamp: {
                  $ref: '#/components/schemas/UnixTimestamp'
                },
                waiverid: {
                  type: 'integer',
                  nullable: true,
                  description: 'Associated waiver claim ID',
                  example: null
                }
              },
              required: ['uid', 'userid', 'pid', 'type', 'timestamp']
            }
          ]
        },
        TransactionWithDraft: {
          allOf: [
            { $ref: '#/components/schemas/Transaction' },
            {
              type: 'object',
              properties: {
                pick: {
                  type: 'integer',
                  description: 'Draft pick number',
                  example: 15
                },
                pick_str: {
                  type: 'string',
                  description: 'Draft pick string (round.pick)',
                  example: '1.15'
                }
              }
            }
          ]
        },
        PlayerGameLog: {
          type: 'object',
          properties: {
            pid: {
              $ref: '#/components/schemas/PlayerId'
            },
            esbid: {
              type: 'string',
              description: 'Game ID (ESPN game identifier)',
              example: '2024120801'
            },
            pos: {
              type: 'string',
              description: 'Player position',
              example: 'QB'
            },
            tm: {
              $ref: '#/components/schemas/NFLTeamAbbreviation'
            },
            opp: {
              $ref: '#/components/schemas/NFLTeamAbbreviation'
            },
            year: {
              type: 'integer',
              description: 'Season year',
              example: 2024
            },
            week: {
              type: 'integer',
              description: 'Week number',
              example: 13
            },
            seas_type: {
              $ref: '#/components/schemas/SeasonTypeEnum'
            },
            day: {
              type: 'string',
              description: 'Day of week',
              example: 'Sunday'
            },
            date: {
              type: 'string',
              format: 'date',
              description: 'Game date',
              example: '2024-12-08'
            },
            timestamp: {
              type: 'string',
              description: 'Game timestamp',
              example: '1733686800'
            },
            active: {
              type: 'boolean',
              description: 'Whether player was active',
              example: true
            },
            started: {
              type: 'boolean',
              description: 'Whether player started the game',
              example: true
            },
            jnum: {
              type: 'integer',
              description: 'Jersey number',
              example: 15
            },
            career_game: {
              type: 'integer',
              description: 'Career game number',
              example: 125
            },
            snp: {
              type: 'integer',
              nullable: true,
              description: 'Number of snaps played',
              example: 65
            },
            points: {
              type: 'number',
              nullable: true,
              description:
                'Fantasy points based on league scoring (when leagueId provided)',
              example: 18.5
            },
            pos_rnk: {
              type: 'integer',
              nullable: true,
              description:
                'Position rank for the week (when leagueId provided)',
              example: 3
            },
            points_added: {
              type: 'number',
              nullable: true,
              description:
                'Points added above baseline (when leagueId provided)',
              example: 5.2
            },
            pa: {
              type: 'integer',
              nullable: true,
              description: 'Pass attempts (when passing=true)',
              example: 35
            },
            pc: {
              type: 'integer',
              nullable: true,
              description: 'Pass completions (when passing=true)',
              example: 22
            },
            py: {
              type: 'integer',
              nullable: true,
              description: 'Passing yards (when passing=true)',
              example: 287
            },
            tdp: {
              type: 'integer',
              nullable: true,
              description: 'Passing touchdowns (when passing=true)',
              example: 2
            },
            ints: {
              type: 'integer',
              nullable: true,
              description: 'Interceptions thrown (when passing=true)',
              example: 0
            },
            ra: {
              type: 'integer',
              nullable: true,
              description: 'Rush attempts (when rushing=true)',
              example: 8
            },
            ry: {
              type: 'integer',
              nullable: true,
              description: 'Rushing yards (when rushing=true)',
              example: 45
            },
            tdr: {
              type: 'integer',
              nullable: true,
              description: 'Rushing touchdowns (when rushing=true)',
              example: 1
            },
            rec: {
              type: 'integer',
              nullable: true,
              description: 'Receptions (when receiving=true)',
              example: 6
            },
            recy: {
              type: 'integer',
              nullable: true,
              description: 'Receiving yards (when receiving=true)',
              example: 78
            },
            tdrec: {
              type: 'integer',
              nullable: true,
              description: 'Receiving touchdowns (when receiving=true)',
              example: 1
            },
            trg: {
              type: 'integer',
              nullable: true,
              description: 'Targets (when receiving=true)',
              example: 8
            },
            fuml: {
              type: 'integer',
              nullable: true,
              description: 'Fumbles lost',
              example: 0
            },
            twoptc: {
              type: 'integer',
              nullable: true,
              description: 'Two-point conversions',
              example: 0
            },
            prtd: {
              type: 'integer',
              nullable: true,
              description: 'Punt return touchdowns',
              example: 0
            },
            krtd: {
              type: 'integer',
              nullable: true,
              description: 'Kickoff return touchdowns',
              example: 0
            },
            fgm: {
              type: 'integer',
              nullable: true,
              description: 'Field goals made',
              example: 2
            },
            fgy: {
              type: 'integer',
              nullable: true,
              description: 'Field goal yards',
              example: 95
            },
            fg19: {
              type: 'integer',
              nullable: true,
              description: 'Field goals 1-19 yards',
              example: 0
            },
            fg29: {
              type: 'integer',
              nullable: true,
              description: 'Field goals 20-29 yards',
              example: 1
            },
            fg39: {
              type: 'integer',
              nullable: true,
              description: 'Field goals 30-39 yards',
              example: 1
            },
            fg49: {
              type: 'integer',
              nullable: true,
              description: 'Field goals 40-49 yards',
              example: 0
            },
            fg50: {
              type: 'integer',
              nullable: true,
              description: 'Field goals 50+ yards',
              example: 0
            },
            xpm: {
              type: 'integer',
              nullable: true,
              description: 'Extra points made',
              example: 3
            },
            dsk: {
              type: 'integer',
              nullable: true,
              description: 'Defensive sacks',
              example: 1
            },
            dint: {
              type: 'integer',
              nullable: true,
              description: 'Defensive interceptions',
              example: 0
            },
            dff: {
              type: 'integer',
              nullable: true,
              description: 'Defensive forced fumbles',
              example: 0
            },
            drf: {
              type: 'integer',
              nullable: true,
              description: 'Defensive fumble recoveries',
              example: 0
            },
            dtno: {
              type: 'integer',
              nullable: true,
              description: 'Defensive tackles (nose)',
              example: 8
            },
            dfds: {
              type: 'integer',
              nullable: true,
              description: 'Defensive forced downs',
              example: 2
            },
            dpa: {
              type: 'integer',
              nullable: true,
              description: 'Defensive points allowed',
              example: 14
            },
            dya: {
              type: 'integer',
              nullable: true,
              description: 'Defensive yards allowed',
              example: 350
            },
            dblk: {
              type: 'integer',
              nullable: true,
              description: 'Defensive blocked kicks',
              example: 0
            },
            dsf: {
              type: 'integer',
              nullable: true,
              description: 'Defensive safeties',
              example: 0
            },
            dtpr: {
              type: 'integer',
              nullable: true,
              description: 'Defensive pass deflections',
              example: 1
            },
            dtd: {
              type: 'integer',
              nullable: true,
              description: 'Defensive touchdowns',
              example: 0
            }
          },
          required: [
            'pid',
            'esbid',
            'pos',
            'tm',
            'opp',
            'year',
            'week',
            'seas_type',
            'day',
            'date',
            'timestamp',
            'active',
            'started',
            'jnum',
            'career_game'
          ]
        },
        LeagueSettingsEnum: {
          type: 'string',
          enum: league_settings_fields,
          description: 'Fantasy league setting field that can be updated',
          example: 'name'
        },
        RosterTransaction: {
          type: 'object',
          properties: {
            pid: {
              $ref: '#/components/schemas/PlayerId'
            },
            tid: {
              $ref: '#/components/schemas/TeamId'
            },
            slot: {
              type: 'integer',
              description: 'Roster slot number',
              example: 1
            },
            rid: {
              type: 'integer',
              description: 'Roster ID',
              example: 1234
            },
            pos: {
              type: 'string',
              description: 'Player position',
              example: 'QB'
            },
            transaction: {
              $ref: '#/components/schemas/Transaction'
            }
          },
          required: ['pid', 'tid', 'slot', 'rid', 'pos', 'transaction']
        },
        TradeDetails: {
          type: 'object',
          properties: {
            uid: {
              $ref: '#/components/schemas/EntityId'
            },
            proposingTeamId: {
              $ref: '#/components/schemas/TeamId'
            },
            acceptingTeamId: {
              $ref: '#/components/schemas/TeamId'
            },
            lid: {
              $ref: '#/components/schemas/LeagueId'
            },
            proposingTeamReleasePlayers: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/PlayerId'
              },
              description: 'Player IDs to be released by proposing team',
              example: []
            },
            acceptingTeamReleasePlayers: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/PlayerId'
              },
              description: 'Player IDs to be released by accepting team',
              example: []
            },
            proposingTeamPlayers: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/PlayerId'
              },
              description: 'Player IDs traded by proposing team',
              example: ['JALE-HURT-2020-1998-08-07']
            },
            acceptingTeamPlayers: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/PlayerId'
              },
              description: 'Player IDs traded by accepting team',
              example: ['PATR-MAHO-2017-1995-09-17']
            },
            proposingTeamPicks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  year: {
                    type: 'integer',
                    description: 'Draft year',
                    example: 2025
                  },
                  round: {
                    type: 'integer',
                    description: 'Draft round',
                    example: 1
                  },
                  pick: {
                    type: 'integer',
                    description: 'Pick number within round',
                    example: 15
                  }
                }
              },
              description: 'Draft picks traded by proposing team',
              example: []
            },
            acceptingTeamPicks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  year: {
                    type: 'integer',
                    description: 'Draft year',
                    example: 2025
                  },
                  round: {
                    type: 'integer',
                    description: 'Draft round',
                    example: 2
                  },
                  pick: {
                    type: 'integer',
                    description: 'Pick number within round',
                    example: 3
                  }
                }
              },
              description: 'Draft picks traded by accepting team',
              example: []
            },
            status: {
              type: 'string',
              description: 'Trade status',
              example: 'pending'
            },
            timestamp: {
              $ref: '#/components/schemas/UnixTimestamp'
            }
          },
          required: [
            'uid',
            'proposingTeamId',
            'acceptingTeamId',
            'lid',
            'status',
            'timestamp'
          ]
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'invalid token'
              }
            }
          }
        },
        BadRequestError: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      },
      parameters: {
        leagueId: {
          name: 'leagueId',
          in: 'path',
          required: true,
          schema: {
            type: 'integer'
          },
          description: 'Fantasy league ID'
        },
        teamId: {
          name: 'teamId',
          in: 'path',
          required: true,
          schema: {
            type: 'integer'
          },
          description: 'Fantasy team ID'
        },
        playerId: {
          name: 'playerId',
          in: 'path',
          required: true,
          schema: {
            type: 'string'
          },
          description: 'Player ID'
        },
        week: {
          name: 'week',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 0,
            maximum: 18
          },
          description: 'Week number (0 for season totals, 1-18 for weekly)',
          example: 4
        },
        year: {
          name: 'year',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 2020,
            maximum: 2030
          },
          description: 'Season year',
          example: 2024
        },
        nflTeam: {
          name: 'nfl_team',
          in: 'query',
          schema: {
            type: 'string',
            enum: constants.nflTeams
          },
          description: 'NFL team abbreviation',
          example: 'KC'
        },
        position: {
          name: 'position',
          in: 'query',
          schema: {
            oneOf: [
              {
                type: 'string',
                enum: [...constants.positions, 'DEF']
              },
              {
                type: 'array',
                items: {
                  type: 'string',
                  enum: [...constants.positions, 'DEF']
                }
              }
            ]
          },
          description: 'Player position(s) to filter by',
          example: 'QB'
        },
        seasonType: {
          name: 'seas_type',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['REG', 'POST', 'PRE']
          },
          description:
            'Season type (REG=Regular, POST=Playoffs, PRE=Preseason)',
          example: 'REG'
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication endpoints'
      },
      {
        name: 'Players',
        description: 'Player data and statistics endpoints'
      },
      {
        name: 'Leagues',
        description: 'League management endpoints'
      },
      {
        name: 'Teams',
        description: 'Team management endpoints'
      },
      {
        name: 'Projections',
        description: 'Player projection endpoints'
      },
      {
        name: 'Schedule',
        description: 'NFL schedule endpoints'
      },
      {
        name: 'Stats',
        description: 'Player and team statistics endpoints'
      },
      {
        name: 'Markets',
        description: 'Betting market endpoints'
      },
      {
        name: 'Wagers',
        description: 'Betting wager endpoints'
      },
      {
        name: 'Cache',
        description:
          'Cache management endpoints for storing and retrieving temporary data'
      },
      {
        name: 'Data Views',
        description:
          'Custom data view management endpoints for creating, saving, and sharing table configurations'
      },
      {
        name: 'Waivers',
        description:
          'Fantasy football waiver claim management endpoints for free agency, practice squad, and poaching claims'
      },
      {
        name: 'Settings',
        description:
          'User settings and configuration endpoints for personalizing projection sources and application preferences'
      },
      {
        name: 'Plays',
        description:
          'NFL play-by-play data endpoints for retrieving detailed game information'
      },
      {
        name: 'Scoreboard',
        description: 'Live game data and scoreboard information endpoints'
      },
      {
        name: 'Utilities',
        description:
          'Utility endpoints for URL shortening and other helper functions'
      }
    ]
  },
  apis: ['./api/routes/*.mjs', './api/routes/**/*.mjs']
}

const specs = swaggerJSDoc(options)

export default specs
