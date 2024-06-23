<div class="table-of-contents">

#### Table of Contents

- [Create New View](#create-new-view)
  - [Examples Views](#examples-views)
    - [Total targets on first series of a drive in 2023](#total-targets-on-first-series-of-a-drive-in-2023)
    - [Total targets on third and fourth down in 2022 and 2023](#total-targets-on-third-and-fourth-down-in-2022-and-2023)
    - [Receiving Yards from 1 WR Formations in 2023](#receiving-yards-from-1-wr-formations-in-2023)
    - [Career Receiving Yards & Age of players under 23 years old](#career-receiving-yards--age-of-players-under-23-years-old)
    - [Receiving Yards in Week 1 (Column for Each Year between 2019-2023)](#receiving-yards-in-week-1-column-for-each-year-between-2019-2023)
    - [Total Receiving Yards from Week 1-3 Between 2021-2023](#total-receiving-yards-from-week-1-3-between-2021-2023)
    - [Most Receptions over 60 yards since 2021](#most-receptions-over-60-yards-since-2021)
    - [Receiving Yards & Touchdowns from players with an overall ESPN open score over 80](#receiving-yards--touchdowns-from-players-with-an-overall-espn-open-score-over-80)
    - [Players with over 80 receiving yards in Week 1 and 1200+ receiving yards in 2023](#players-with-over-80-receiving-yards-in-week-1-and-1200-receiving-yards-in-2023)
    - [Receiving yards from non first read targets](#receiving-yards-from-non-first-read-targets)
    - [Receiving yards in the first quarter in 2023](#receiving-yards-in-the-first-quarter-in-2023)
    - [Passing yards while the winning percentage is less than 75% in 2022 and 2023](#passing-yards-while-the-winning-percentage-is-less-than-75-in-2022-and-2023)
- [Share / Export View](#share--export-view)

</div>

<div class="body">

Start off by familiarizing yourself with the available metrics and play by play columns in the [glossary](https://xo.football/glossary). It's always a good idea to check the coverage for a given stat or play by play column in the glossary to understand how complete the results are.

If there's something you'd like to see, or if coverage for a data point is lacking, let us know on [Discord](https://discord.gg/xo) or [submit a stat or improvement on Github](https://github.com/mistakia/league/issues/new?assignees=&labels=kind%2Fstat%2C+status%2Fready&projects=&template=submit-a-stat.md&title=Add+stat%3A+%3CSTAT+NAME%3E).

## Create New View

1. Create a view by clicking on the view controller that lists the current view (top left) and selecting `+ Add View`.
2. Define the columns and/or filters for your new view.
   1. Add columns by opening the columns controller.
      1. Columns & Filters will be organized into categories.
      2. Hover over a column you'd like to add and click `+`.
      3. Play by Play columns will have additional parameters you can modify.
         1. Hover over the selected column under the `shown in table` section (at the top) and click the down arrow to expand and view the available parameters.
      4. Columns in the `shown in table` section can be dragged and dropped to reorder the columns.
   2. As you add/remove columns and/or filters, select `Apply` to update the view and display results.

### Examples Views

#### Total targets on first series of a drive in 2023

[View Link](https://xo.football/leagues/0/players-table?columns=%5B%7B%22column_id%22%3A%22player_targets_from_plays%22%2C%22params%22%3A%7B%22series_seq%22%3A%5B1%2C1%5D%2C%22year%22%3A%5B2023%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_targets_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%5D&view_id=be8c95c6-b3a0-45e1-a916-c9e2f25a5a23&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- new view
- open columns controller
- filter for `targets`, scroll and select `Targets (By Play)`
- expand column to view available parameters
- set column params
  - `series_seq` to `1 to 1`
  - `Year` to `2023`
```

#### Total targets on third and fourth down in 2022 and 2023

[View Link](https://xo.football/leagues/0/players-table?columns=%5B%7B%22column_id%22%3A%22player_targets_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%2C2022%5D%2C%22dwn%22%3A%5B3%2C4%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_targets_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%5D&view_id=a347f89b-b9c5-4c7b-9247-b59904691bc3&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- new view
- open columns controller
- filter for `targets`, scroll and select `Targets (By Play)`
- expand column to view available parameters
- set column params
  - `down` to `3 to 4`
  - `Year` to `2023`
```

#### Receiving Yards from 1 WR Formations in 2023

TODO

#### Career Receiving Yards & Age of players under 23 years old

[View Link](https://xo.football/leagues/0/players-table?columns=%5B%22player_receiving_yards_from_plays%22%2C%22player_age%22%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%7B%22column_id%22%3A%22player_age%22%2C%22operator%22%3A%22%3C%3D%22%2C%22value%22%3A%2223%22%7D%5D&view_id=a4f07e01-37b6-4743-9557-76644968a361&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- new view
- open columns controller
- filter for `receiving yards`, scroll and select `Receiving Yards (By Play)`
- filter for `age`, scroll and select `Age`
- select apply (apply the column to the view)
- open filters controller
- filter for `Age`, scrolle and select `Age`
  - set the operator to `Less than or equal`
  - set the value to `23`
- select apply (apply the filter to the view)
```

#### Receiving Yards in Week 1 (Column for Each Year between 2019-2023)

[View Link](https://xo.football/leagues/0/players-table?columns=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2022%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2021%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2020%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2019%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%2C2022%2C2021%2C2020%2C2019%5D%2C%22week%22%3A%5B1%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22desc%22%3Atrue%2C%22column_index%22%3A5%7D%5D&where=%5B%5D&view_id=8ec84f0b-6253-4472-8f25-ade76ec8dd5d&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- new view
- open columns controller
- filter for `receiving yards`, scroll and select `Receiving Yards (By Play)` 5 times
- expand each column to view available parameters
- set column params to a different year for each column
  - `Year` to `2023`
  - `Year` to `2022`
  - `Year` to `2021`
  - `Year` to `2020`
  - `Year` to `2019`
  - set `Week` to `1` for each column
- add another column for cumulative receiving yards across those years from week 1 games
- filter for `receiving yards`, scroll and select `Receiving Yards (By Play)`
- expand column to view available parameters
- set column params
  - `Year` to `2019`, `2020`, `2021`, `2022`, `2023`
  - `Week` to `1`
- sort by the cumulative receiving yards column descending
```

#### Total Receiving Yards from Week 1-3 Between 2021-2023

[View Link](https://xo.football/leagues/0/players-table?columns=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22week%22%3A%5B1%2C2%2C3%5D%2C%22year%22%3A%5B2023%2C2022%2C2021%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%5D&view_id=461ff2dd-dd68-4ad8-b52e-e19233f7c23d&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- new view
- open columns controller
- filter for `receiving yards`, scroll and select `Receiving Yards (By Play)`
- expand column to view available parameters
- set column params
  - `Year` to `2021`, `2022`, `2023`
  - `Week` to `1` to `3`
```

#### Most Receptions over 60 yards since 2021

[View Link](https://xo.football/leagues/0/players-table?columns=%5B%7B%22column_id%22%3A%22player_receptions_from_plays%22%2C%22params%22%3A%7B%22week%22%3A%5B1%2C2%2C3%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C12%2C13%2C14%2C15%2C16%2C17%2C18%2C19%2C20%2C21%5D%2C%22year%22%3A%5B2023%2C2022%2C2021%5D%2C%22recv_yds%22%3A%5B60%2C99%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receptions_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%5D&view_id=0a0b78b0-6e4f-4d0d-8a85-4ee9f301b68c&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- new view
- open columns controller
- filter for `receptions`, scroll and select `Receptions (By Play)`
- expand column to view available parameters
- set column params
  - `Year` to `2021`, `2022`, `2023`
  - `Recv Yds` to `60` to `99`
```

#### Receiving Yards & Touchdowns from players with an overall ESPN open score over 80

TODO

#### Players with over 80 receiving yards in Week 1 and 1200+ receiving yards in 2023

[View Link](https://xo.football/leagues/0/players-table?columns=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22operator%22%3A%22%3E%3D%22%2C%22value%22%3A%2280%22%2C%22params%22%3A%7B%22week%22%3A%5B1%5D%2C%22year%22%3A%5B2023%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22operator%22%3A%22%3E%3D%22%2C%22value%22%3A%221200%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%7D%7D%5D&view_id=18c19779-091e-4c31-9791-0b74180d3a8d&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- new view
- open columns controller
- filter for `receiving yards`, scroll and select `Receiving Yards (By Play)`
  - set the operator to `Greater Than or Equal`
  - set the value to `80`
  - expand filter to view available parameters
  - set filter params
    - `Year` to `2023`
    - `Week` to `1`
  - `Recv Yds` to `80` to `99`
- add another filter for `receiving yards`, scroll and select `Receiving Yards (By Play)`
  - set the operator to `Greater Than or Equal`
  - set the value to `1200`
  - expand filter to view available parameters
  - set filter params
    - `Year` to `2023`
```

#### Receiving yards from non first read targets

TODO

#### Receiving yards in the first quarter in 2023

[View Link](https://xo.football/leagues/0/players-table?columns=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%2C%22qtr%22%3A%5B1%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%5D&view_id=b276184a-5c72-4088-a2cb-e65124f00bb6&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- new view
- open columns controller
- filter for `receiving yards`, scroll and select `Receiving Yards (By Play)`
- expand column to view available parameters
- set column params
  - `Year` to `2023`
  - `Qtr` to `1`
```

#### Passing yards while the winning percentage is less than 75% in 2022 and 2023

TODO

## Share / Export View

For logged out users, you can obtain a link to the current state of a view by clicking on the ellipsis (`...`) button in the top right corner of the table and selecting `Copy Link`. This link can be shared with anyone, allowing them to view the same view in its current state. If you make any changes, you'll have to grab a new link.

For logged in users, you can save the current view by clicking `save` in the top right corner of the table.

</div>
