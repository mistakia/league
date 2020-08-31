const path = require('path')
// const fs = require('fs')
const webpack = require('webpack')
// const chalk = require('chalk')
const merge = require('webpack-merge')
const { spawn } = require('child_process')

const baseConfig = require('./webpack.config.base')
// import CheckNodeEnv from '../internals/scripts/CheckNodeEnv'

// When an ESLint server is running, we can't set the NODE_ENV so we'll check if it's
// at the dev webpack config is not accidentally run in a production environment
/* if (process.env.NODE_ENV === 'production') {
 *   CheckNodeEnv('development')
 * }
 *  */
const port = process.env.PORT || 1212
const publicPath = `http://localhost:${port}/dist`

module.exports = merge.smart(baseConfig, {
  devtool: 'inline-source-map',

  mode: 'development',

  entry: [
    ...(process.env.PLAIN_HMR ? [] : ['react-hot-loader/patch']),
    `webpack-dev-server/client?http://localhost:${port}/`,
    'webpack/hot/only-dev-server',
    require.resolve('../app/index.js')
  ],

  output: {
    publicPath: `http://localhost:${port}/dist/`,
    filename: 'index.js'
  },

  resolve: {
    alias: {
      'react-dom': '@hot-loader/react-dom'
    }
  },

  plugins: [

    new webpack.HotModuleReplacementPlugin({
      multiStep: true
    }),

    new webpack.NoEmitOnErrorsPlugin(),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     *
     * By default, use 'development' as NODE_ENV. This can be overriden with
     * 'staging', for example, by changing the ENV variables in the npm scripts
     */
    new webpack.DefinePlugin({
      IS_DEV: true,
      APP_VERSION: JSON.stringify('0.0.x')
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true
    })
  ],

  node: {
    __dirname: false,
    __filename: false
  },

  devServer: {
    port,
    publicPath,
    compress: true,
    open: true,
    noInfo: true,
    stats: 'errors-only',
    inline: true,
    lazy: false,
    hot: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    contentBase: path.join(__dirname, '..', 'app'),
    watchOptions: {
      aggregateTimeout: 300,
      ignored: /node_modules/,
      poll: 100
    },
    historyApiFallback: {
      verbose: true,
      disableDotRule: false
    },
    before () {
      if (process.env.START_HOT) {
        console.log('Starting API...')
        const api = spawn('npm', ['run', 'start:api'], {
          shell: true,
          env: process.env,
          stdio: 'inherit'
        })
          .on('close', code => process.exit(code))
          .on('error', spawnError => console.error(spawnError))

        process.on('exit', () => api.kill())
      }
    }
  }
})
