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

// A find_player_row call that mixes lookup dimensions the query cannot honor
// together. This is a programming error at the call site, not a data outcome --
// unlike MatchedMultiplePlayers, which is a legitimate abstention.
export class AmbiguousPlayerLookup extends Error {
  constructor(message = 'ambiguous player lookup') {
    super(message)
    this.name = 'AmbiguousPlayerLookupError'
  }
}

// The league has an open pause, so no transaction may be written and no
// processor may run for it.
//
// This is a HOLD, not a failure, and every consumer must treat it as one. A
// processor that catches this has correctly declined to act; reporting it as a
// shortfall is the trap the RFA pause precedent already recorded -- a paused job
// that goes quiet reads to the runs-ledger staleness sweep as a broken pipeline.
// It sits alongside the Empty* abstentions above for that reason.
export class LeaguePaused extends Error {
  constructor(message = 'league is paused') {
    super(message)
    this.name = 'LeaguePausedError'
  }
}
