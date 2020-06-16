import { Record, List, Map } from 'immutable'

export const Player = new Record({
  player: null,
  name: null,
  pname: null,
  fname: null,
  lname: null,
  pos1: null,
  height: null,
  weight: null,
  dob: null,
  forty: null,
  bench: null,
  vertical: null,
  broad: null,
  shuttle: null,
  cone: null,
  arm: null,
  hand: null,
  dpos: null,
  college: null,
  college_division: null,
  draft_year: null,
  team: null,
  depth_position: null,
  depth_number: null,
  jersey: null,
  projection: new Map(),
  points: new Map(),
  values: new Map(),
  vorp: new Map(),
  games: new List(),
  projections: new List()
})

export function createPlayer ({
  player,
  fname,
  lname,
  pname,
  pos1,
  height,
  weight,
  dob,
  forty,
  bench,
  vertical,
  broad,
  shuttle,
  cone,
  arm,
  hand,
  dpos,
  col,
  dv,
  start,
  cteam,
  posd,
  jnum,
  dcp,
  projection,
  points,
  values,
  vorp,
  projections,
  games
}) {
  return new Player({
    player,
    name: `${fname} ${lname}`,
    pname,
    fname,
    lname,
    pos1,
    height,
    weight,
    dob,
    forty,
    bench,
    vertical,
    broad,
    shuttle,
    cone,
    arm,
    hand,
    dpos,
    college: col,
    college_division: dv,
    draft_year: start,
    team: cteam,
    depth_position: posd,
    jersey: jnum,
    depth_number: dcp,
    projection: new Map(projection),
    points: new Map(points),
    values: new Map(values),
    vorp: new Map(vorp),
    games: new List(games),
    projections: new List(projections)
  })
}
