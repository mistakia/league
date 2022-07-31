export class EmptyPoachingWaivers extends Error {
  constructor(message = 'no poaching waivers to process') {
    super(message)
    this.name = 'EmptyPoachingWaiversError'
  }
}

export class EmptyPoachingClaims extends Error {
  constructor(message = 'no poaching claims to process') {
    super(message)
    this.name = 'EmptyPoachingClaimsError'
  }
}

export class NotRegularSeason extends Error {
  constructor(message = 'not regular season') {
    super(message)
    this.name = 'NotRegularSeasonError'
  }
}

export class EmptyFreeAgencyWaivers extends Error {
  constructor(message = 'no free agency waivers to process') {
    super(message)
    this.name = 'EmptyFreeAgencyError'
  }
}

export class EmptyPracticeSquadFreeAgencyWaivers extends Error {
  constructor(message = 'no practice squad free agency waivers to process') {
    super(message)
    this.name = 'EmptyPracticeSquadFreeAgencyError'
  }
}

export class MatchedMultiplePlayers extends Error {
  constructor(message = 'matched multiple players') {
    super(message)
    this.name = 'MatchedMultiplePlayersError'
  }
}
