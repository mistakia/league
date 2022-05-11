import config from '#config'

const fields = [
  '{id',
  'gameTime',
  'attendance',
  'stadium',
  'homePointsOvertime',
  'homePointsOvertimeTotal',
  'homePointsTotal',
  'homePointsQ1',
  'homePointsQ2',
  'homePointsQ3',
  'homePointsQ4',

  'homeTeam{nickName',
  'id',
  'abbreviation}',

  'homeTimeoutsUsed',
  'period',
  'phase',
  'visitorPointsOvertime',
  'visitorPointsOvertimeTotal',
  'visitorPointsQ1',
  'visitorPointsQ2',
  'visitorPointsQ3',
  'visitorPointsQ4',
  'visitorPointsTotal',

  'visitorTeam{nickName',
  'id',
  'abbreviation}',

  'visitorTimeoutsUsed',

  'weather{location',
  'currentFahrenheit',
  'currentRealFeelFahrenheit',
  'longDescription',
  'shortDescription}',

  'scoringSummaries{playId',
  'playDescription',
  'patPlayId',
  'homeScore',
  'visitorScore}',

  'drives{quarterStart',
  'endTransition',
  'endYardLine',
  'endedWithScore',
  'firstDowns',
  'gameClockEnd',
  'gameClockStart',
  'howEndedDescription',
  'howStartedDescription',
  'inside20',
  'orderSequence',
  'playCount',
  'playIdEnded',
  'playIdStarted',
  'playSeqEnded',
  'playSeqStarted',
  'possessionTeam{abbreviation',
  'nickName}',
  'quarterEnd',
  'realStartTime',
  'startTransition',
  'startYardLine',
  'timeOfPossession',
  'yards',
  'yardsPenalized}',

  'plays{clockTime',
  'down',
  'driveNetYards',
  'drivePlayCount',
  'driveSequenceNumber',
  'endClockTime',
  'endYardLine',
  'firstDown',
  'goalToGo',
  'nextPlayIsGoalToGo',
  'nextPlayType',
  'orderSequence',
  'penaltyOnPlay',
  'playClock',
  'playDeleted',
  'playDescription',
  'playId',
  'playReviewStatus',
  'isBigPlay',
  'playType',

  'playStats{statId',
  'yards',
  'playerName',
  'team{id',
  'abbreviation}',
  'gsisPlayer{id',
  'position}}',

  'possessionTeam{abbreviation',
  'nickName}prePlayByPlay',
  'quarter',
  'scoringPlay',
  'scoringPlayType',

  'scoringTeam{id',
  'abbreviation',
  'nickName}shortDescription',
  'specialTeamsPlay',
  'stPlayType',
  'timeOfDay',
  'yardLine',
  'yards',
  'yardsToGo',
  'latestPlay}}'
]

const buildQuery = (id) =>
  `query{viewer{gameDetail(id:"${id}")${fields.join(' ')}}}`

const getGameDetailUrl = (id) =>
  `${config.nfl_api_url}/v3/shield/?query=${encodeURIComponent(
    buildQuery(id)
  )}&variables=null`

export default getGameDetailUrl
