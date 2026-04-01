// Static mapping of Sumer Sports team UUIDs to NFL team abbreviations.
// Built by matching API plays against existing DB plays across all 32 teams.
const SUMER_TEAM_ID_TO_NFL = {
  '29bc477a-e5b7-57dd-b73c-ad9783e85b3c': 'ARI',
  '05b24043-bb4c-50e7-88f6-f2e43146b5a2': 'ATL',
  'a2c18dc9-2b95-595a-91c1-c07d8bf10ffc': 'BAL',
  '645fddd1-df20-5323-93e4-c7c176baa507': 'BUF',
  'b0afc250-bc45-565b-ab31-c09e2d5209e8': 'CAR',
  'a939ecc7-fdbe-5f71-af12-b480efb5ffeb': 'CHI',
  'd6ee26d1-1c8a-5599-a3bd-1537e7de85bc': 'CIN',
  'becdb626-1b97-5904-9eed-71842375bc39': 'CLE',
  '1afbdd15-d429-5bcb-a55b-af7199345da5': 'DAL',
  '30a0f7e1-9843-5edd-8cf1-c60918b7f861': 'DEN',
  '9bbd6453-9703-5015-8a11-1a607b8805bd': 'DET',
  '63d59843-d136-5f8b-9c55-de09a20ab321': 'GB',
  'e871178d-ca00-52ff-9e93-e3f7a8a9bc9f': 'HOU',
  '632cbb59-f592-5648-b181-6b23bdf9d85d': 'IND',
  'b0d7698e-edf7-5afe-98fe-85827218adb9': 'JAX',
  '3baabdb4-8c73-58f8-8e87-8db435aefb16': 'KC',
  '252e01fc-2471-563e-aa87-4876e74fbf06': 'LA',
  'dd0c9c81-33c9-5cc9-bee2-7c26a6327f6c': 'LAC',
  'bb3667cc-9ac6-5170-9572-2b840882facd': 'LV',
  '4857a921-f6c9-5357-8527-f8589332184b': 'MIA',
  '2315da89-83d2-5174-b6a7-1e81d98032a2': 'MIN',
  'cb8fb75c-0a4c-5080-8580-9b2d46e98591': 'NE',
  '361e23bb-82f8-554d-b60d-24ac2d7679c3': 'NO',
  '8f5bf2a9-6ce9-5164-988e-2e0062f32090': 'NYG',
  '84f58345-4a56-5c30-92b4-7365ac46b68f': 'NYJ',
  'eb0beb8f-2a1e-51e2-9ab2-793f72994559': 'PHI',
  '995a2dd0-93bd-5651-a60d-6708b62b17b3': 'PIT',
  'bc17557b-b749-58b5-9404-8682a796a9d2': 'SEA',
  '88397334-0092-5b55-8ce1-2bd467e0edf8': 'SF',
  '07f46f9d-1c41-534e-ab68-574e82c94a46': 'TB',
  'b4a5ebdf-c1ab-5046-9985-a69f83a44ace': 'TEN',
  'e3003a6c-2896-5b55-9ede-2d9a2b16dca2': 'WAS'
}

export function resolve_sumer_team(sumer_team_id) {
  if (!sumer_team_id) return null
  return SUMER_TEAM_ID_TO_NFL[sumer_team_id] || null
}

export { SUMER_TEAM_ID_TO_NFL }
