<div class="table-of-contents">

#### Table of Contents

- [Quick start](#quick-start)
- [The controls](#the-controls)
- [What a row is](#what-a-row-is)
- [Columns and field parameters](#columns-and-field-parameters)
- [Filters](#filters)
- [Splits](#splits)
- [Sorting](#sorting)
- [Saving and sharing](#saving-and-sharing)
- [Exporting](#exporting)
- [Scatter plots](#scatter-plots)
- [Terminology](#terminology)
- [Example views](#example-views)
  - [Total targets on first series of a drive in 2023](#total-targets-on-first-series-of-a-drive-in-2023)
  - [Total targets on third and fourth down in 2022 and 2023](#total-targets-on-third-and-fourth-down-in-2022-and-2023)
  - [Career receiving yards and age of players under 23](#career-receiving-yards-and-age-of-players-under-23)
  - [Receiving yards in week 1, a column for each year 2019-2023](#receiving-yards-in-week-1-a-column-for-each-year-2019-2023)
  - [Total receiving yards from weeks 1-3 between 2021 and 2023](#total-receiving-yards-from-weeks-1-3-between-2021-and-2023)
  - [Most receptions over 60 yards since 2021](#most-receptions-over-60-yards-since-2021)
  - [Receiving yards and touchdowns for players with an ESPN open score over 80 in 2023](#receiving-yards-and-touchdowns-for-players-with-an-espn-open-score-over-80-in-2023)
  - [Players with 80+ receiving yards in week 1 and 1200+ in 2023](#players-with-80-receiving-yards-in-week-1-and-1200-in-2023)
  - [Receiving yards in the first quarter in 2023](#receiving-yards-in-the-first-quarter-in-2023)

</div>

<div class="body">

A data view is a table you build yourself: you choose the columns, the filters, and what each row represents. Nothing here is preset — the built-in views are just starting points you can copy and change.

## Quick start

1. Open the **Current View** panel at the top left and select **Add view**.
2. Open **Columns**, find a field, and click `+` to add it. It appears under **SHOWN IN TABLE** at the top of the panel.
3. Hover the field under **SHOWN IN TABLE** and click the arrow to expand its parameters — season, week, and anything else that changes how the number is calculated.
4. Select **Apply**. Results load immediately.

That is the whole loop. Everything below is detail on one of those steps.

Before you go far, skim the [glossary](https://xo.football/glossary) — it defines every metric and play-by-play column, and it lists the coverage for each one, which is the fastest way to find out whether a stat goes back as far as you need.

If a data point is missing or its coverage is thin, say so on [Discord](https://discord.gg/azSX97Qj9Z) or [submit a stat request on GitHub](https://github.com/mistakia/league/issues/new?assignees=&labels=kind%2Fstat%2C+status%2Fready&projects=&template=submit-a-stat.md&title=Add+stat%3A+%3CSTAT+NAME%3E).

## The controls

Everything lives in one bar above the table.

| Control               | What it does                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------- |
| **Current View**      | Names the view you are on. Opens a panel to search views, switch, duplicate, or **Add view**. |
| **⋮** (the view menu) | Copy a share link, export, recalculate, clear the local cache.                                |
| **Player** / **Team** | What each row represents.                                                                     |
| **Columns**           | Add, remove, reorder columns and edit their parameters.                                       |
| **Filter**            | Narrow which rows come back.                                                                  |
| **Splits**            | Break each row out along an axis such as season or week.                                      |
| **Save** / **Reset**  | Appear once you have unsaved changes. **Reset** discards them; **Save** keeps the view.       |

Two things about **Apply** are worth knowing up front, because both read as the control being broken.

**Apply and Discard only exist while you have a pending change.** Inside **Columns**, **Filter** and **Splits**, your edits are held locally until you apply them, and the two buttons appear at that moment. An open panel with no buttons means you have not changed anything yet.

**Splits is empty unless a selected column offers an axis.** With nothing applicable selected it says `No splits available for selected columns`, which is a statement about your columns rather than a fault.

## What a row is

The **Player** / **Team** toggle sets what each row means. In the app's own words: _what each row in the table represents. Switching prunes columns, filters, and sorts to those compatible with the selected grain._

So switching is not purely cosmetic — a column that only makes sense per player is dropped when you switch to **Team**, and the same for filters and sorts. Your selections for each side are remembered for the session, so flipping back restores what you had.

Each grain seeds its own leading columns: **Player** starts with name, NFL team and position; **Team** starts with the team code and name.

## Columns and field parameters

Open **Columns**. The panel has two halves:

- **SHOWN IN TABLE** — the columns currently in the view. Drag to reorder. Hover one and expand it to edit its parameters. **Bulk Edit** edits a parameter across several columns at once; **Remove All** clears them.
- **AVAILABLE COLUMNS** — everything else, grouped by category (projection, measurables, betting markets, PFF, ESPN, rankings, and more). Use **Search columns** rather than scrolling; there are several hundred.

**Field parameters are the part people miss, and they are where most of the power is.** A field such as `Receiving Yards (By Play)` is not one number — it is a calculation over play-by-play data, and its parameters decide which plays count: which seasons, which weeks, which downs, which quarter, which field position. Two columns of the same field with different parameters are two different questions side by side, which is how most of the examples below are built.

You can add the same field more than once. That is deliberate — a column per season is the normal way to see a trend.

## Filters

Open **Filter**. Search for a field, add it, then set an operator and a value. Filters accept parameters too, under the same expand-and-edit pattern as columns.

**A filter and a field parameter are different things and are easy to confuse.** A filter decides which ROWS come back. A field parameter decides which plays feed the VALUE in one column. "Players who had at least 1200 receiving yards" is a filter; "receiving yards, but only from the first quarter" is a parameter.

A filter does not need its field to be a visible column, and a visible column does not have to be filtered.

## Splits

**Splits** breaks each row out along an axis, so one player becomes one row per season, or per week. It appears when a selected column offers an axis; columns that cannot answer along that axis do not offer it.

Two columns can offer the same axis and mean different things by it, and when that happens the option is disabled with both sides named rather than silently picking one.

## Sorting

Click a column header for its menu: **Sort ascending**, **Sort descending**, and the `(multi)` variants that add the column to an existing sort instead of replacing it. The same menu carries **Filter** (adds this column as a filter) and **Remove column**.

## Saving and sharing

**Save** keeps the view on your account and requires being signed in. If the view is not yours to edit — a built-in, or one you opened from someone's link — **Save** is disabled and the way forward is to duplicate it from the **Current View** panel first.

**Copy Link** in the view menu works whether or not you are signed in, and captures the view exactly as it stands. It is a snapshot: change the view afterwards and you need a fresh link.

## Exporting

From the view menu: **Export CSV**, **Export JSON**, **Export Markdown**, and **Copy To Clipboard**.

Saved views additionally get an API URL in that menu, returning the same data as CSV or JSON — useful for a spreadsheet or a script that should re-fetch rather than hold a stale copy.

Two other entries live there. **Recalculate View** re-runs the query instead of taking a cached result, which is what you want after the underlying data has been updated. **Clear Local Cache** discards the view state this browser has stored.

## Scatter plots

On any numeric column's header menu, choose **Select for scatter plot X**, and another column's **Select for scatter plot Y**. A **Show Plot** button then appears in the toolbar. Points carry team logos, and you can color them by team or position from inside the plot.

## Terminology

| Term                        | Definition                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **View**                    | A saved combination of columns, filters, sorting, row grain and splits.                                                                |
| **Field**                   | A single data point or metric. Shown as a column.                                                                                      |
| **Field parameters**        | Options that change how a field is calculated — which seasons, weeks, downs, and so on.                                                |
| **Filter**                  | A condition on which rows come back. Not the same as a field parameter: filters narrow ROWS, parameters narrow the values in a COLUMN. |
| **Row grain**               | What one row represents — a player or a team.                                                                                          |
| **Split**                   | An axis that expands one row into several, such as a row per season.                                                                   |
| **Current View panel**      | Names the current view; used to search, switch, duplicate and add views.                                                               |
| **Columns / Filter panels** | Where columns and filters are added, removed and configured.                                                                           |
| **View menu**               | The `⋮` button: sharing, exporting, recalculating.                                                                                     |

For technical detail — row-grain identities, the column contract, the sandboxed SQL tier — see the [Data Views System documentation](../data-views-system.md).

## Example views

Each example links to a live view, followed by the steps to build it yourself. They assume you have opened **Columns** and are working in the **AVAILABLE COLUMNS** half; every one ends with **Apply**.

#### Total targets on first series of a drive in 2023

[View Link](https://xo.football/data-views?columns=%5B%7B%22column_id%22%3A%22player_targets_from_plays%22%2C%22params%22%3A%7B%22series_seq%22%3A%5B1%2C1%5D%2C%22year%22%3A%5B2023%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_targets_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%5D&view_id=be8c95c6-b3a0-45e1-a916-c9e2f25a5a23&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- add view
- open Columns
- search for `targets` and select `Targets (By Play)`, under the Receiving category
- the column appears under SHOWN IN TABLE at the top of the panel
- hover it there and expand it to show its parameters
- set the parameters
  - `series_sequence` to `1 to 1`
  - `Year` to `2023`
- select Apply
- press `esc` or click away to close the panel
```

#### Total targets on third and fourth down in 2022 and 2023

[View Link](https://xo.football/data-views?columns=%5B%7B%22column_id%22%3A%22player_targets_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%2C2022%5D%2C%22dwn%22%3A%5B3%2C4%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_targets_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%5D&view_id=a347f89b-b9c5-4c7b-9247-b59904691bc3&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- add view
- open Columns
- search for `targets` and select `Targets (By Play)`, under the Receiving category
- hover it under SHOWN IN TABLE and expand it
- set the parameters
  - `down` to `3 to 4`
  - `Year` to `2022` and `2023`
- select Apply
```

#### Career receiving yards and age of players under 23

[View Link](https://xo.football/data-views?columns=%5B%22player_receiving_yards_from_plays%22%2C%22player_age%22%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%7B%22column_id%22%3A%22player_age%22%2C%22operator%22%3A%22%3C%3D%22%2C%22value%22%3A%2223%22%7D%5D&view_id=a4f07e01-37b6-4743-9557-76644968a361&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

This one uses a filter as well as columns, and shows that the filtered field can also be a visible column.

```
- add view
- open Columns
- search for `receiving yards` and select `Receiving Yards (By Play)`, under the Receiving category
- search for `age` and select `Age`
- select Apply, then close the panel
- open Filter
- search for `Age` and select `Age`
  - set the operator to `Less than or equal`
  - set the value to `23`
- select Apply
```

#### Receiving yards in week 1, a column for each year 2019-2023

[View Link](https://xo.football/data-views?columns=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2022%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2021%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2020%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2019%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%2C2022%2C2021%2C2020%2C2019%5D%2C%22week%22%3A%5B1%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22desc%22%3Atrue%2C%22column_index%22%3A5%7D%5D&where=%5B%5D&view_id=8ec84f0b-6253-4472-8f25-ade76ec8dd5d&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

The clearest illustration of one field added repeatedly with different parameters. Note the last column totals all five seasons, so it is the one worth sorting on.

```
- add view
- open Columns
- search for `receiving yards` and select `Receiving Yards (By Play)`, under the Receiving category
  - click `+` five times to add five copies
- five `Receiving Yards (By Play)` entries now sit under SHOWN IN TABLE
- expand the first and set
  - `Year` to `2023`
  - `Week` to `1`
- repeat for the other four, setting `Year` to 2022, 2021, 2020 and 2019
- add a sixth copy for the cumulative total and set
  - `Year` to 2019, 2020, 2021, 2022 and 2023
  - `Week` to `1`
- select Apply and close the panel
- sort descending on the cumulative column
```

#### Total receiving yards from weeks 1-3 between 2021 and 2023

[View Link](https://xo.football/data-views?columns=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22week%22%3A%5B1%2C2%2C3%5D%2C%22year%22%3A%5B2023%2C2022%2C2021%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%5D&view_id=461ff2dd-dd68-4ad8-b52e-e19233f7c23d&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- add view
- open Columns
- search for `receiving yards` and select `Receiving Yards (By Play)`
- expand it under SHOWN IN TABLE and set
  - `Year` to 2021, 2022 and 2023
  - `Week` to `1 to 3`
- select Apply
```

#### Most receptions over 60 yards since 2021

[View Link](https://xo.football/data-views?columns=%5B%7B%22column_id%22%3A%22player_receptions_from_plays%22%2C%22params%22%3A%7B%22week%22%3A%5B1%2C2%2C3%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C12%2C13%2C14%2C15%2C16%2C17%2C18%2C19%2C20%2C21%5D%2C%22year%22%3A%5B2023%2C2022%2C2021%5D%2C%22recv_yds%22%3A%5B60%2C99%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receptions_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%5D&view_id=0a0b78b0-6e4f-4d0d-8a85-4ee9f301b68c&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

A parameter, not a filter: the length condition selects which PLAYS are counted, so the column holds a count of long receptions rather than a filtered list of players.

```
- add view
- open Columns
- search for `receptions` and select `Receptions (By Play)`, under the Receiving category
- expand it under SHOWN IN TABLE and set
  - `Year` to 2021, 2022 and 2023
  - `Recv Yds` to `60 to 99`
- select Apply
```

#### Receiving yards and touchdowns for players with an ESPN open score over 80 in 2023

[View Link](https://xo.football/data-views?columns=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_touchdowns_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%7D%7D%2C%7B%22column_id%22%3A%22player_espn_open_score%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%7B%22column_id%22%3A%22player_espn_open_score%22%2C%22operator%22%3A%22%3E%3D%22%2C%22value%22%3A%2280%22%7D%5D&view_id=48240f40-87a3-48e3-b03a-4536b9928a17&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

Note the filter carries its own `Year` parameter. Without it the filter would judge a different season than the columns show.

```
- add view
- open Columns
- add `Receiving Yards (By Play)` and set `Year` to `2023`
- add `Receiving Touchdowns (By Play)` and set `Year` to `2023`
- add `ESPN Open Score`, under the ESPN category, and set `Year` to `2023`
- select Apply and close the panel
- open Filter
- search for `espn open score` and select `ESPN Open Score`
  - set the operator to `Greater than or equal`
  - set the value to `80`
  - expand the filter and set `Year` to `2023`
- select Apply
```

#### Players with 80+ receiving yards in week 1 and 1200+ in 2023

[View Link](https://xo.football/data-views?columns=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%2C%22week%22%3A%5B1%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22operator%22%3A%22%3E%3D%22%2C%22value%22%3A%2280%22%2C%22params%22%3A%7B%22week%22%3A%5B1%5D%2C%22year%22%3A%5B2023%5D%7D%7D%2C%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22operator%22%3A%22%3E%3D%22%2C%22value%22%3A%221200%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%7D%7D%5D&view_id=18c19779-091e-4c31-9791-0b74180d3a8d&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

Two filters on the same field with different parameters — the same trick as repeated columns, applied to rows.

```
- add view
- open Columns
- add `Receiving Yards (By Play)` and set `Year` to `2023`, `Week` to `1`
- add a second `Receiving Yards (By Play)` and set `Year` to `2023`
- select Apply and close the panel
- open Filter
- add `Receiving Yards (By Play)`
  - operator `Greater than or equal`, value `80`
  - expand and set `Year` to `2023`, `Week` to `1`
- add a second `Receiving Yards (By Play)`
  - operator `Greater than or equal`, value `1200`
  - expand and set `Year` to `2023`
- select Apply
```

#### Receiving yards in the first quarter in 2023

[View Link](https://xo.football/data-views?columns=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22params%22%3A%7B%22year%22%3A%5B2023%5D%2C%22qtr%22%3A%5B1%5D%7D%7D%5D&prefix_columns=%5B%22player_name%22%5D&sort=%5B%7B%22column_id%22%3A%22player_receiving_yards_from_plays%22%2C%22desc%22%3Atrue%7D%5D&where=%5B%5D&view_id=b276184a-5c72-4088-a2cb-e65124f00bb6&view_name=New+view&view_search_column_id=player_name&view_description=New+view+description)

```
- add view
- open Columns
- search for `receiving yards` and select `Receiving Yards (By Play)`
- expand it under SHOWN IN TABLE and set
  - `Year` to `2023`
  - `Qtr` to `1`
- select Apply
```

</div>
