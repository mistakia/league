import Highcharts from 'highcharts'

// react-table imports highcharts/modules/exporting at module load (Highcharts 12
// self-composes), which would otherwise turn on the burger-menu export group on
// every chart in the app. Opt out globally; charts that want export tooling
// (e.g. analytical views) opt back in per-chart with exporting.enabled = true.
Highcharts.setOptions({
  chart: {
    style: {
      fontFamily: "'IBM Plex Mono', monospace"
    }
  },
  exporting: {
    enabled: false
  },
  credits: {
    enabled: false
  }
})

export default Highcharts
