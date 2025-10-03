// Print all tables for analyze_wagers output
export const print_wagers_analysis_tables = ({
  player_summary_table,
  wager_summary_table,
  lost_by_legs_table,
  unique_props_table,
  event_tables,
  prop_combination_tables,
  wager_tables,
  show_counts = false
}) => {
  player_summary_table.printTable()
  wager_summary_table.printTable()

  if (show_counts && lost_by_legs_table) {
    lost_by_legs_table.printTable()
  }

  unique_props_table.printTable()

  if (event_tables) {
    event_tables.forEach((table) => table.printTable())
  }

  if (prop_combination_tables) {
    prop_combination_tables.forEach((table) => {
      if (table) table.printTable()
    })
  }

  if (wager_tables) {
    wager_tables.forEach((table) => table.printTable())
  }
}
