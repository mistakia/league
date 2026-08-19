// PFR spells HOU as both the Oilers (1990-96) and the Texans (2002+); the draft
// year disambiguates. The shared fixTeam maps HOU to the Texans for its other
// callers, so the Oilers era is resolved here — to TEN, the franchise fixTeam
// already maps OTI to. Kept dependency-free so a spec can pin the boundary
// without importing the importer (whose #private fetch path is absent in CI).
export const resolve_pfr_draft_team = (team, year) => {
  if (team === 'HOU' && year <= 1996) return 'TEN'
  return team
}
