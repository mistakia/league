import { calculate_wager_summary } from './wager-calculations.mjs'

// Analyze prop combinations to identify near-miss scenarios
export const analyze_prop_near_miss_combinations = (
  lost_props,
  filtered_wagers,
  wager_summary
) => {
  const one_prop = []
  const two_props = []
  const three_props = []

  const prop_summaries = new Map()
  const actual_prop_summaries = new Map()
  const wager_indices = new Map()
  const props_by_source = new Map()
  const wagers_by_source = new Map()

  // Index wagers and props by source_id
  filtered_wagers.forEach((wager, index) => {
    if (!wagers_by_source.has(wager.source_id)) {
      wagers_by_source.set(wager.source_id, [])
    }
    wagers_by_source.get(wager.source_id).push(wager)

    wager.selections.forEach((selection) => {
      const key = `${wager.source_id}:${selection.selection_id}`
      if (!wager_indices.has(key)) {
        wager_indices.set(key, new Set())
      }
      wager_indices.get(key).add(index)
    })
  })

  // Pre-calculate summaries for individual props
  const calculate_summary = ({ source_id, prop_ids, actual = false }) => {
    // Get the set of wager indices for the first prop
    const first_prop_key = `${source_id}:${prop_ids[0]}`
    let relevant_wager_indices = new Set(
      wager_indices.get(first_prop_key) || []
    )

    // Intersect with the indices of the remaining props
    for (let i = 1; i < prop_ids.length; i++) {
      const prop_key = `${source_id}:${prop_ids[i]}`
      const prop_indices = wager_indices.get(prop_key) || []
      relevant_wager_indices = new Set(
        [...relevant_wager_indices].filter((index) => prop_indices.has(index))
      )
    }

    const relevant_wagers = Array.from(relevant_wager_indices).map(
      (index) => filtered_wagers[index]
    )

    return calculate_wager_summary({
      wagers: relevant_wagers,
      props: actual
        ? []
        : prop_ids.map((id) =>
            lost_props.find(
              (p) => p.selection_id === id && p.source_id === source_id
            )
          )
    })
  }

  const get_prop_summary = ({ source_id, prop_ids = [], actual = false }) => {
    const key = `${source_id}:${prop_ids.sort().join('|')}${actual ? ':actual' : ''}`
    if (!prop_summaries.has(key)) {
      prop_summaries.set(
        key,
        calculate_summary({ source_id, prop_ids, actual })
      )
    }
    return prop_summaries.get(key)
  }

  const calculate_potential_gain = ({ actual_summary, prop_summary }) => ({
    potential_gain: prop_summary.total_won - actual_summary.total_won,
    potential_wins: prop_summary.wagers_won - actual_summary.wagers_won,
    potential_roi_added:
      ((prop_summary.total_won - actual_summary.total_won) /
        wager_summary.total_risk) *
      100
  })

  lost_props.forEach((prop) => {
    if (!props_by_source.has(prop.source_id)) {
      props_by_source.set(prop.source_id, [])
    }
    props_by_source.get(prop.source_id).push(prop)
    const summary = calculate_summary({
      source_id: prop.source_id,
      prop_ids: [prop.selection_id]
    })
    const actual_summary = calculate_summary({
      source_id: prop.source_id,
      prop_ids: [prop.selection_id],
      actual: true
    })
    prop_summaries.set(prop.selection_id, summary)
    actual_prop_summaries.set(prop.selection_id, actual_summary)
  })

  // Use a Set for faster lookups
  const processed_combinations = new Set()

  // Analyze combinations for each source_id
  for (const [source_id, source_props] of props_by_source.entries()) {
    // Single prop analysis
    source_props.forEach((prop) => {
      const actual_summary = get_prop_summary({
        source_id,
        prop_ids: [prop.selection_id],
        actual: true
      })
      const summary = get_prop_summary({
        source_id,
        prop_ids: [prop.selection_id]
      })
      const { potential_gain, potential_wins, potential_roi_added } =
        calculate_potential_gain({ actual_summary, prop_summary: summary })

      if (potential_gain > 0) {
        one_prop.push({
          name: prop.name,
          selection_id: prop.selection_id,
          source_id,
          potential_gain,
          potential_wins,
          potential_roi_added
        })
      }
    })

    // Two-prop and three-prop combinations
    for (let i = 0; i < source_props.length - 1; i++) {
      for (let j = i + 1; j < source_props.length; j++) {
        const two_prop_ids = [
          source_props[i].selection_id,
          source_props[j].selection_id
        ]
        const two_prop_key = `${source_id}:${two_prop_ids.sort().join('|')}`

        if (!processed_combinations.has(two_prop_key)) {
          processed_combinations.add(two_prop_key)
          const actual_summary = get_prop_summary({
            source_id,
            prop_ids: two_prop_ids,
            actual: true
          })
          const two_prop_summary = get_prop_summary({
            source_id,
            prop_ids: two_prop_ids
          })
          const { potential_gain, potential_wins, potential_roi_added } =
            calculate_potential_gain({
              actual_summary,
              prop_summary: two_prop_summary
            })

          const individual_gains = [
            get_prop_summary({
              source_id,
              prop_ids: [source_props[i].selection_id]
            }).total_won,
            get_prop_summary({
              source_id,
              prop_ids: [source_props[j].selection_id]
            }).total_won
          ]

          if (
            potential_gain > 0 &&
            two_prop_summary.total_won > Math.max(...individual_gains)
          ) {
            two_props.push({
              name: [source_props[i].name, source_props[j].name].join(' / '),
              selection_ids: two_prop_ids,
              source_id,
              potential_gain,
              potential_wins,
              potential_roi_added
            })
          }

          // Three-prop combinations
          for (let k = j + 1; k < source_props.length; k++) {
            const three_prop_ids = [
              ...two_prop_ids,
              source_props[k].selection_id
            ]
            const three_prop_key = `${source_id}:${three_prop_ids.sort().join('|')}`

            if (!processed_combinations.has(three_prop_key)) {
              processed_combinations.add(three_prop_key)
              const actual_summary = get_prop_summary({
                source_id,
                prop_ids: three_prop_ids,
                actual: true
              })
              const three_prop_summary = get_prop_summary({
                source_id,
                prop_ids: three_prop_ids
              })
              const three_prop_result = calculate_potential_gain({
                actual_summary,
                prop_summary: three_prop_summary
              })

              const two_prop_gains = [
                get_prop_summary({
                  source_id,
                  prop_ids: [
                    source_props[i].selection_id,
                    source_props[j].selection_id
                  ]
                }).total_won,
                get_prop_summary({
                  source_id,
                  prop_ids: [
                    source_props[i].selection_id,
                    source_props[k].selection_id
                  ]
                }).total_won,
                get_prop_summary({
                  source_id,
                  prop_ids: [
                    source_props[j].selection_id,
                    source_props[k].selection_id
                  ]
                }).total_won
              ]

              if (
                three_prop_result.potential_gain > 0 &&
                three_prop_summary.total_won >
                  Math.max(...two_prop_gains, ...individual_gains)
              ) {
                three_props.push({
                  name: [
                    source_props[i].name,
                    source_props[j].name,
                    source_props[k].name
                  ].join(' / '),
                  selection_ids: three_prop_ids,
                  source_id,
                  ...three_prop_result
                })
              }
            }
          }
        }
      }
    }
  }

  return { one_prop, two_props, three_props }
}
