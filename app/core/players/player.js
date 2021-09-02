import { Record, List, Map } from 'immutable'

import { constants } from '@common'

export const Player = new Record({
  player: null,
  name: null,
  pname: null,
  fname: null,
  lname: null,
  pos: null,
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
  stats: new Map(constants.createFullStats()),
  points: new Map(),
  market_salary: new Map(),
  market_salary_adj: new Map(),
  vorp: new Map(),
  vorp_adj: new Map(),
  projections: new List(),
  lineups: new Map(),
  value: null,
  slot: null,
  type: null, // transaction type
  tid: null,
  tag: null,
  inflation: null,
  inflationSeason: null,
  status: null,
  injury_status: null,
  injuyrBodyPart: null,
  espn_id: null,
  gsisid: null,
  esbid: null,
  gsispid: null,
  gamestatus: null,
  practice: new List(),
  extensions: new List(),
  bid: null
})

export function createPlayer({
  player,
  fname,
  lname,
  pname,
  pos,
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
  market_salary,
  market_salary_adj,
  vorp,
  vorp_adj,
  projections,
  value,
  slot,
  type,
  tid,
  tag,
  status,
  injury_status,
  injuryBodyPart,
  espn_id,
  gsisid,
  esbid,
  gsispid,
  gamestatus,
  practice,
  extensions,
  bid
}) {
  return new Player({
    player,
    name: `${fname} ${lname}`,
    pname,
    fname,
    lname,
    pos,
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
    market_salary: new Map(market_salary),
    market_salary_adj: new Map(market_salary_adj),
    vorp: new Map(vorp),
    vorp_adj: new Map(vorp_adj),
    projections: new List(projections),
    value,
    slot,
    type,
    tid,
    tag,
    status,
    injury_status,
    injuryBodyPart,
    espn_id,
    gsisid,
    esbid,
    gsispid,
    gamestatus,
    practice: new List(practice),
    extensions: new List(extensions),
    bid
  })
}
