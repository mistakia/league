import fetch from 'node-fetch'
// import debug from 'debug'

import config from '#config'
import { constants } from '#common'

// const log = debug('caesars')
// debug.enable('caesars')

export const markets = {
  PASSING_TOUCHDOWNS: constants.player_prop_types.GAME_PASSING_TOUCHDOWNS,
  PASSING_YARDS: constants.player_prop_types.GAME_PASSING_YARDS,
  INTERCEPTIONS: constants.player_prop_types.GAME_PASSING_INTERCEPTIONS,
  PASSING_COMPLETIONS: constants.player_prop_types.GAME_PASSING_COMPLETIONS,
  PASSING_ATTEMPTS: constants.player_prop_types.GAME_PASSING_ATTEMPTS,
  LONGEST_PASSING_COMPLETION:
    constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION,
  RUSHING_YARDS: constants.player_prop_types.GAME_RUSHING_YARDS,
  RUSHING_ATTEMPTS: constants.player_prop_types.GAME_RUSHING_ATTEMPTS,
  RUSHING_RECEIVING_YARDS:
    constants.player_prop_types.GAME_RUSHING_RECEIVING_YARDS,
  RECEPTIONS: constants.player_prop_types.GAME_RECEPTIONS,
  RECEIVING_YARDS: constants.player_prop_types.GAME_RECEIVING_YARDS,
  LONGEST_RECEPTION: constants.player_prop_types.GAME_LONGEST_RECEPTION,
  TACKLES_ASSISTS: constants.player_prop_types.GAME_TACKLES_ASSISTS
}

// TODO - FIND MISSING
// longest rush, receiving touchdowns, rushing touchdowns

// TODO - ADD EXISTING
// KICKING_POINTS
// EXTRA_POINT_MADE

export const getSchedule = async () => {
  const url = `${config.caesars_api_v3_url}/sports/americanfootball/events/schedule?competitionIds=007d7c61-07a7-4e18-bb40-15104b6eac92`

  // log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  return data
}

export const getFutures = async () => {
  const url = `${config.caesars_api_v3_url}/sports/americanfootball/events/futures?competitionIds=007d7c61-07a7-4e18-bb40-15104b6eac92`

  // log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  return data
}

export const getEvent = async (eventId) => {
  const url = `${config.caesars_api_v3_url}/events/${eventId}`

  // log(`fetching ${url}`)
  const res = await fetch(url)
  const data = await res.json()

  return data
}

// player prop marketIds

/* 1b60e061-d95b-3bdd-ac01-d515634e6d45
 * 7db29b63-205a-33ba-aa6a-d3e2fd8ae336
 * cfdc8e07-e409-3432-8cbf-e7098a737c30
 * 4541ca11-3f91-39f0-88f4-82a7b68d83fc
 * ddbef4ff-b355-3b4b-9463-ad6f9769eb74
 * d442902e-7898-387d-a323-2712ddaf8e7b
 * aadedde5-ca0c-3396-bbd1-3ced67cf1243
 * d241e481-2613-3216-973a-cdf4b3ec515d
 * 59130eb0-fa03-3520-83b9-15ae1561b13f
 * 546f7918-c700-3ff0-be6a-9b0d3121ae4e
 * 686d4965-ae1c-33a2-8b5a-d2cc409b9081
 * cf796cc4-d89c-3224-b4c9-74db7a182270
 * 3d332bf6-d212-3575-aedf-5869d93f3fc8
 * 59716d16-d97e-3274-b5d5-b23e600bddf1
 * 4bfc4795-1aa2-3cd1-8262-e8dea9656b54
 * 3e73ed2d-89bf-355d-9f13-7f0ec414d50a
 * 9ebbca4b-61d0-3aab-af30-afb77210c771
 * 6b1d4d47-c1a3-3409-a2be-8928a425abd5
 * 83945310-cf18-3441-b147-36b10ff549f4
 * 86159415-273d-3ee8-be11-cca0405d593e
 * 89f154b7-7a4c-3290-8fe4-ebf65fe82b43
 * 5af744e0-2526-34fd-b55b-91da556452d1
 * 55151aeb-b4d5-3d4b-8803-ad2af207d950
 * 4530367d-5ae5-3725-a85f-3b58ba14659c
 * 18bd9ee3-86f4-3d9c-98c0-df87afd0fe73
 * ea5f25b1-3e57-3f21-8850-b029064f5dad
 * 8d36405c-77c3-3118-9c0d-541db5cced7f
 * 9b61d98f-ac5f-3f5c-a73e-9fb46acb81e4
 * 63211fb9-9642-39ff-aef7-714ef186eb2a
 * 7387b8c6-7907-3fb3-98d4-26c8349f1e60
 * f067d782-9b20-3c3c-a212-c599e5527335
 * b4dc8ac1-ae59-3a9e-b9b2-952494b0c22c
 * 3fa6f09b-45da-3bf1-b63d-4e662b696829
 * 27384620-8fab-3686-bc67-4fcce44b1834
 * 8c8e5d38-f4ee-3b1f-88d1-49ec1721f8dd
 * 893cdf83-7be8-3d36-8b23-73dd754ad3f5
 * 06e6838e-0acf-3e60-80e6-0e00f2fb81e1
 * 44811c80-9bc2-3892-91a8-d2f8c9e8dc95
 * baffb624-14c6-328a-80f4-c73895cbe7ed
 * cf49fb8d-3206-3e45-9e9b-5b47506c22dd
 * e131366a-aa1f-33e0-8e7f-aedebac63055
 * c66c44d0-6532-3cb1-93ee-01a709110181
 * 45640591-7608-3760-94a6-0359764304f3
 * f0fe91f9-95b6-3207-bd86-e499e3d6d16f
 * 0b2bbeb7-0cfc-31e8-9530-d0935feb5a49
 * d8b46ebb-901d-308f-98a8-5b4d33fc410c
 * ef39cd04-2538-3f7d-a7a5-c1a122efd157
 * dbb6cce7-674e-3c30-98bf-6669bfcc9759
 * 6405a51d-aaf0-3888-a873-1c23b8e14e6f
 * f130adfd-34fc-3d92-8e97-f731db03498a
 * 0584daac-de52-3698-9110-7c2db1aa0631
 * 5ee98743-3edb-3030-8c57-441b44618a6f
 * df930d9d-84a8-3c35-9ec9-6d3b4242b680
 * 96eeae13-86a3-39a4-8693-be8a59986016
 * 9cbb0d1d-ad35-3ed4-8311-4416da684366
 * 50d8cb67-efd5-32d7-bcd8-b30887c9ea4c
 * f1c21a98-cc6c-3bd4-ad77-a4144884a170
 * bc210d34-7158-3bfb-9dc6-1990ad8f39f9
 * 5b524b6b-1d37-3f08-8208-810ca536102f
 * 261bb0dc-b6b7-334a-b59d-94cb51fa1eef
 * 939b5abf-736d-3a51-8820-ead75a205a1e
 * e5c4eebb-dafc-3276-ac2d-e013b3d2015f
 * 802900f0-b775-33df-a486-d691b2120663
 * 9e93cd7c-3c7a-3478-8997-bbe520570a4f
 * 2eb1fb2d-a40c-3852-be32-5ad7b1c2bb70
 * 211ce87d-5f0f-3e7e-b196-820f2a6ef28e
 * 97df01b0-e8c4-37c2-b9ae-d0fcde22ad5a
 * 85849a79-1a96-307c-8cff-6ef3565f3239
 * 6fb61e48-d27b-347f-a3e5-70b460089874
 * f32808ec-a8e6-3731-a66d-a51f57002652
 * ff810ef4-7f92-374d-a507-5f87ccdaff40
 * 2fc20e95-94c1-33c4-96d5-d67b953c779f
 * 5ef14a37-1258-3f9e-84e7-30a159dd6385
 * e2c31b76-206b-3104-a733-7de80040a082
 * 0af8c7bd-1325-30a3-97a6-7714c973ce7a
 * 68cc2d76-e44e-3061-b8ab-ffe09408c363
 * 8c5ee367-f48b-3f54-b0c0-74a6d5b72830
 * b0cfa41c-4ce4-39d3-a1d7-60eb59046df7
 * 9dc1e864-a730-333d-89cd-f737db8cd0cc
 * b8407abf-3139-313a-ba1e-82b08b42709c
 * 49749f32-6620-3f3f-a8e9-c0a1b8a6103a
 * 27ba75e6-0205-3aad-be0a-28326479d8de
 * f5afa0e0-b4a1-3e72-b3b6-2a828c050cc0
 * a4fde09b-0479-38bb-a95e-d9b0063bfd9a
 * 830406d1-095f-352b-afca-1426a58b0a9e
 * 5cc2dc50-ea8a-3c1d-8058-fa8399df66a7
 * 805ea0f2-480a-35cd-bd2f-dfdbbe1358d3
 * 6b75233b-686c-39fa-ba38-3adf113c2c14
 * f2ca6131-af85-3eb8-a173-5b27fcdf2361
 * 5d6801d6-78aa-32d4-b68d-7ddeaddb48e5
 * 55bd3965-5120-3a76-9667-39702af4acfa
 * 201e0b0b-8a88-3221-8959-1be536ad420a
 * a672d21d-be71-333b-a035-e23da126f403
 * 02a52402-7e48-38b4-8d6a-e67cba5fa48d
 * 950d5c3f-063c-3d22-a67f-9e7d3f853391
 * b45d57f3-1259-3c3e-9d8b-18487eb7a14d
 * a1db7048-d513-3097-a57e-04704c0c5c88
 * 385bebf8-1c6a-3264-93f6-885849b317c1
 * 06a0e673-c742-38d1-b64b-30d99003bace
 * b8b18f95-2027-3486-bcff-4c987e9b8f6f
 * 248677cc-ece5-3faf-8e2c-ccfa5080b50e
 * a637181d-dd3f-315b-b571-9b6f0d65b6e2
 * 3229d835-361c-3f3c-8d5e-32ea62db21bb
 * 6bf462f0-7af5-3d34-8bfa-6c9a7ff5a440
 * c8278b29-b6eb-3279-9c10-e52902cc62f4
 * 81de6120-e323-3c75-9fe3-1b459189731a
 * e96a600f-0f0f-331e-bda4-003e37289961
 * d46defa1-65a5-3877-b630-a3b0cf43d657
 * dab0fbda-b107-3bd7-ae1e-c4abb3e2e6af
 * bc6fcf62-4408-38fc-ba79-527d329dea0d
 * 7498fbfd-cbdd-34ed-aa19-a0213d3a12a2
 * e73dfde5-6958-394a-b901-afd7795f2aec
 * 36bbd22b-6c53-37df-9e2a-7f1bb4f4de9b
 * 5316e76d-5b51-3be4-b0d6-39644edabe24
 * 300e469e-490d-33c5-9a01-89f9b1dcbbe4
 * 6ea3f885-35d9-315c-9871-2ba94011d162
 * 1e1b323a-c79f-3657-8208-87fdd76fec72
 * 55d4d0c9-4fb8-3ccd-a10a-b5e807d01f81
 * bf2b77e5-1f30-3f44-a772-7b4393807c61
 * 5cbc8952-684f-3f00-b689-7c00645cd4de
 * 8d6be42b-caab-3658-8f23-c883d4f178c9
 * ae285bd3-1008-3157-ba3f-01aab2cd16d6
 * 9bb59f0e-5bd1-35b2-9171-38139bd23bef
 * e1db2ee1-014e-3316-b770-8bd0b2b7ef92
 * 33bea463-8660-36af-b81e-238cbafc294f
 * 93ed2074-3aeb-3ea2-b3e6-005c6711e084
 * 0374393a-1b4e-30f4-ac35-f0916f5010c7
 * 675e1aa6-a3f6-3acb-90c1-4196718cd846
 * 49804d1c-0454-3866-92fd-9736cb8f526c
 * 45589946-dda0-378c-8e9b-b01eaa949be9
 * 6b15bee3-137b-37a4-8d85-53badb689ef0
 * 741b3604-6aba-3821-870a-ba947ed561c3
 * d1bcec82-e58e-3317-8d60-48ec383f7e39
 * 14c0d40e-9b9d-3fe0-a0f4-c30163e2044a
 * e172477c-a0be-3f4a-a640-74c6f81ecd37
 * 266bd9a0-fc13-3443-aba4-48d3323d5feb
 * b08ed037-bc7d-33da-b62b-6dc6c187f8ac
 * a87469e1-fefe-370e-92d5-6cca437e69a7
 * f3b7e1a0-50a5-31a9-aec1-00801351a907
 * 7f19cb05-ba72-3c4f-9b65-b7dc0c89065d
 * 84c1ec9a-b6f2-3d23-988f-75c5ca25b58a
 * 2eb9c181-b44c-351d-8480-f55181e27062
 * 2deed84c-57c0-3ac4-926c-a72b092e3912
 * d9ce91cb-d1e3-3bbc-ae9a-a27153701ae7
 * e1455621-6f59-3d1a-af97-bf23922dd1bd
 * 5c1c503f-7e6f-3379-9750-f676a6b9c657 */
