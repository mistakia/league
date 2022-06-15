import path from 'path'
import webpack from 'webpack'
import { merge } from 'webpack-merge'
import HtmlWebpackPlugin from 'html-webpack-plugin'

import baseConfig from './webpack.config.base.mjs'

export default merge(baseConfig, {
  devtool: 'inline-source-map',

  mode: 'development',

  // Add hot reloading in development
  entry: [path.join(process.cwd(), 'app/index.js')],

  // Don't use hashes in dev mode for better performance
  output: {
    publicPath: '/',
    filename: '[name].js',
    chunkFilename: '[name].chunk.js'
  },

  plugins: [
    new webpack.HotModuleReplacementPlugin(),

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
      IS_DEV: !process.env.NC_DEV_LIVE,
      APP_VERSION: JSON.stringify('0.0.x')
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true
    }),

    new HtmlWebpackPlugin({
      inject: true, // Inject all files that are generated by webpack, e.g. bundle.js
      template: 'app/index.html',
      favicon: 'dist/favicon.ico'
    })
  ],

  node: {
    __dirname: false,
    __filename: false
  },

  devServer: {
    port: 8081,
    compress: true,
    open: true,
    hot: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    historyApiFallback: {
      verbose: true,
      disableDotRule: false
    }
  }
})
