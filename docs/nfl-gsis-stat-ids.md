# NFL GSIS Stat IDs Reference

This document provides a reference for NFL GSIS (Game Statistics and Information System) Stat IDs used in the play-by-play data processing.

## Official Documentation Source

The authoritative source for NFL stat IDs is the NFL GSIS Documentation:

- **URL**: http://www.nflgsis.com/gsis/Documentation/Partners/StatIDs.html
- **Alternative Reference**: https://www.nflfastr.com/reference/stat_ids.html (nflfastR R package)

## Stat ID Reference

The NFL GSIS system uses numeric Stat IDs to categorize different types of play statistics. There are 119 distinct stat IDs covering all aspects of football statistics.

### Team-Level Statistics (No Player Association)

These stats are recorded at the team level and do not have associated player IDs:

| Stat ID | Name                       | Description                                                           |
| ------- | -------------------------- | --------------------------------------------------------------------- |
| 1       | Rushing Yards - Minus      | Used in addition to other Rushing stats (negative yardage adjustment) |
| 2       | Punt Blocked (Offense)     | Punt was blocked                                                      |
| 3       | 1st Down Rushing           | A first down or TD occurred due to a rush (TEAM STAT)                 |
| 4       | 1st Down Passing           | A first down or TD occurred due to a pass (TEAM STAT)                 |
| 5       | 1st Down Penalty           | A first down or TD occurred due to a penalty                          |
| 6       | 3rd Down Attempt Converted | 3rd down play resulted in a first down or TD                          |
| 7       | 3rd Down Attempt Failed    | 3rd down play did NOT result in a first down                          |
| 8       | 4th Down Attempt Converted | 4th down play resulted in a first down or TD                          |
| 9       | 4th Down Attempt Failed    | 4th down play did NOT result in a first down                          |
| 20      | Sack Yards (Team)          | Team sack yardage lost                                                |
| 64      | Touchdown (Team)           | Team touchdown                                                        |
| 68      | Timeout                    | Timeout                                                               |

### Rushing Statistics

| Stat ID | Name                      | Description                                         |
| ------- | ------------------------- | --------------------------------------------------- |
| 10      | Rushing Yards             | Rushing yards and credit for a rushing attempt      |
| 11      | Rushing Touchdown         | Rushing touchdown with yards                        |
| 12      | Lateral Rushing           | Rushing yards after lateral (no attempt credit)     |
| 13      | Lateral Rushing Touchdown | Rushing touchdown after lateral (no attempt credit) |

### Passing Statistics

| Stat ID | Name                 | Description                                 |
| ------- | -------------------- | ------------------------------------------- |
| 14      | Passing Incomplete   | Incomplete pass attempt                     |
| 15      | Passing Yards        | Completed pass with yards                   |
| 16      | Passing Touchdown    | Passing touchdown with yards                |
| 17      | Sack (Passer)        | Quarterback sacked (yards lost)             |
| 18      | Sack Yards (Passer)  | Yards lost on sack                          |
| 19      | Interception         | Pass intercepted                            |
| 111     | Air Yards Complete   | Completed pass air yards (depth of target)  |
| 112     | Air Yards Incomplete | Incomplete pass air yards (depth of target) |

### Receiving Statistics

| Stat ID | Name                        | Description                                             |
| ------- | --------------------------- | ------------------------------------------------------- |
| 21      | Receiving Yards             | Reception with yards                                    |
| 22      | Receiving Touchdown         | Receiving touchdown with yards                          |
| 23      | Lateral Receiving           | Receiving yards after lateral (no reception credit)     |
| 24      | Lateral Receiving Touchdown | Receiving touchdown after lateral (no reception credit) |
| 113     | Yards After Catch           | Yards gained after the catch                            |
| 115     | Target                      | Pass target (intended receiver)                         |

### Interception Returns

| Stat ID | Name                                  | Description                             |
| ------- | ------------------------------------- | --------------------------------------- |
| 25      | Interception Return                   | Interception return yards               |
| 26      | Interception Return Touchdown         | Interception returned for touchdown     |
| 27      | Lateral Interception Return           | Interception return yards after lateral |
| 28      | Lateral Interception Return Touchdown | Interception return TD after lateral    |

### Punting Statistics

| Stat ID | Name               | Description                      |
| ------- | ------------------ | -------------------------------- |
| 29      | Punt Yards         | Punt with yards                  |
| 30      | Punt Inside 20     | Punt downed inside opponent's 20 |
| 31      | Punt Into Endzone  | Punt into endzone (touchback)    |
| 32      | Punt (No Return)   | Punt with no return              |
| 37      | Punt Out of Bounds | Punt went out of bounds          |
| 38      | Punt Downed        | Punt downed by coverage          |
| 39      | Punt Fair Catch    | Punt fair caught                 |
| 40      | Punt (Attempt)     | Punt attempt                     |

### Punt Returns

| Stat ID | Name                          | Description                     |
| ------- | ----------------------------- | ------------------------------- |
| 33      | Punt Return Yards             | Punt return with yards          |
| 34      | Punt Return Touchdown         | Punt returned for touchdown     |
| 35      | Lateral Punt Return           | Punt return yards after lateral |
| 36      | Lateral Punt Return Touchdown | Punt return TD after lateral    |

### Kickoff Statistics

| Stat ID | Name                  | Description                              |
| ------- | --------------------- | ---------------------------------------- |
| 41      | Kickoff Yards         | Kickoff with yards                       |
| 42      | Kickoff Inside 20     | Kickoff resulted in possession inside 20 |
| 43      | Kickoff Into Endzone  | Kickoff into endzone                     |
| 44      | Kickoff (No Yards)    | Kickoff attempt (no return)              |
| 49      | Kickoff Out of Bounds | Kickoff went out of bounds               |
| 50      | Kickoff Fair Catch    | Kickoff fair caught                      |
| 51      | Kickoff (Attempt)     | Kickoff attempt                          |
| 102     | Kickoff Downed        | Kickoff downed                           |
| 410     | Kickoff (Player)      | Kickoff attempt (player credit)          |

### Kickoff Returns

| Stat ID | Name                             | Description                        |
| ------- | -------------------------------- | ---------------------------------- |
| 45      | Kickoff Return Yards             | Kickoff return with yards          |
| 46      | Kickoff Return Touchdown         | Kickoff returned for touchdown     |
| 47      | Lateral Kickoff Return           | Kickoff return yards after lateral |
| 48      | Lateral Kickoff Return Touchdown | Kickoff return TD after lateral    |
| 107     | Own Kickoff Recovery             | Own kickoff recovered              |
| 108     | Own Kickoff Recovery Touchdown   | Own kickoff recovered for TD       |

### Fumble Statistics

| Stat ID | Name                                  | Description                                  |
| ------- | ------------------------------------- | -------------------------------------------- |
| 52      | Forced Fumble                         | Fumble forced by defender                    |
| 53      | Fumble Not Forced                     | Fumble not forced                            |
| 54      | Fumble Out of Bounds                  | Fumble went out of bounds                    |
| 55      | Fumble Recovery (Own)                 | Own fumble recovered with return yards       |
| 56      | Fumble Recovery Touchdown (Own)       | Own fumble recovered for touchdown           |
| 57      | Lateral Fumble Recovery (Own)         | Own fumble recovery yards after lateral      |
| 58      | Lateral Fumble Recovery TD (Own)      | Own fumble recovery TD after lateral         |
| 59      | Fumble Recovery (Opponent)            | Opponent fumble recovered with return yards  |
| 60      | Fumble Recovery Touchdown (Opponent)  | Opponent fumble recovered for TD             |
| 61      | Lateral Fumble Recovery (Opponent)    | Opponent fumble recovery yards after lateral |
| 62      | Lateral Fumble Recovery TD (Opponent) | Opponent fumble recovery TD after lateral    |
| 106     | Fumble Lost                           | Fumble lost to opponent                      |

### Field Goal Statistics

| Stat ID | Name                        | Description                   |
| ------- | --------------------------- | ----------------------------- |
| 69      | Field Goal Missed           | Missed field goal attempt     |
| 70      | Field Goal Made             | Made field goal with distance |
| 71      | Field Goal Blocked          | Field goal blocked            |
| 88      | Blocked Field Goal (Player) | Player who blocked field goal |

### Extra Point Statistics

| Stat ID | Name                | Description                   |
| ------- | ------------------- | ----------------------------- |
| 72      | Extra Point Made    | Made extra point              |
| 73      | Extra Point Missed  | Missed extra point            |
| 74      | Extra Point Blocked | Extra point blocked           |
| 96      | Extra Point Safety  | Safety on extra point attempt |
| 301     | Extra Point Aborted | Extra point attempt aborted   |

### Two Point Conversion Statistics

| Stat ID | Name                       | Description                               |
| ------- | -------------------------- | ----------------------------------------- |
| 75      | Two Point Rush Good        | Two point conversion rushing successful   |
| 76      | Two Point Rush Failed      | Two point conversion rushing failed       |
| 77      | Two Point Pass Good        | Two point conversion passing successful   |
| 78      | Two Point Pass Failed      | Two point conversion passing failed       |
| 99      | Two Point Rush Safety      | Safety on two point rush attempt          |
| 100     | Two Point Pass Safety      | Safety on two point pass attempt          |
| 104     | Two Point Reception Good   | Two point conversion reception successful |
| 105     | Two Point Reception Failed | Two point conversion reception failed     |
| 420     | Two Point Return           | Defensive two point return                |

### Defensive Statistics

| Stat ID | Name                         | Description                       |
| ------- | ---------------------------- | --------------------------------- |
| 79      | Solo Tackle                  | Unassisted tackle                 |
| 80      | Assisted Tackle              | Tackle with assist                |
| 82      | Tackle Assist                | Assist on a tackle                |
| 83      | Sack (Player)                | Individual player sack            |
| 84      | Sack Assist                  | Assisted sack                     |
| 85      | Pass Defended                | Pass deflected/defended           |
| 86      | Punt Blocked (Player)        | Player who blocked punt           |
| 87      | Extra Point Blocked (Player) | Player who blocked extra point    |
| 89      | Safety                       | Safety scored                     |
| 91      | Forced Fumble (Player)       | Player who forced fumble          |
| 93      | Penalty (Player)             | Penalty with yards                |
| 95      | Tackle for Loss              | Tackle resulting in loss of yards |
| 103     | Lateral Sack                 | Sack with lateral                 |
| 110     | QB Hit                       | Quarterback hit                   |
| 120     | Tackle for Loss (Player)     | Player who made tackle for loss   |

### Defensive Scoring

| Stat ID | Name                             | Description                               |
| ------- | -------------------------------- | ----------------------------------------- |
| 403     | Defensive Two Point Attempt      | Defensive two point conversion attempt    |
| 404     | Defensive Two Point Conversion   | Defensive two point conversion successful |
| 405     | Defensive Extra Point Attempt    | Defensive extra point attempt             |
| 406     | Defensive Extra Point Conversion | Defensive extra point successful          |

### Other/Miscellaneous

| Stat ID | Name      | Description             |
| ------- | --------- | ----------------------- |
| 63      | Misc Stat | Miscellaneous statistic |
| 402     | Unknown   | Unknown statistic type  |

## Important Notes for Fantasy Point Calculations

### Team-Level vs Player-Level Stats

**Critical**: Stat IDs 3 (1st Down Rushing) and 4 (1st Down Passing) are **team-level statistics** with no player association. They record that a first down occurred but do NOT indicate which player earned the first down.

To track player-level first downs for fantasy scoring, use the `first_down` flag at the play level combined with the receiving/rushing stat:

```javascript
// Player-level first down tracking
case 10: // Rushing Yards
  if (playStat.first_down) {
    stats.rush_first_down += 1
  }
  break

case 21: // Receiving Yards
  if (playStat.first_down) {
    stats.rec_first_down += 1
  }
  break
```

### QB Kneels

QB kneels are recorded as rushing attempts (stat ID 10) with negative yards. To exclude kneels from rushing yard calculations, check the `qb_kneel` flag on the play.

### Lateral Plays

Lateral plays (stat IDs 12, 13, 23, 24, etc.) add yardage but do NOT credit additional attempts or receptions to the player receiving the lateral.

## Related Files

- `libs-shared/calculate-stats-from-play-stats.mjs` - Processes play stats using these stat IDs
- `libs-server/play-stats-utils.mjs` - Utility functions for play stat processing
- `docs/adding-new-fantasy-statistics.md` - Guide for adding new fantasy statistics
