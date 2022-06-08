import path, { dirname } from 'path'
import webpack from 'webpack'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import Visualizer from 'webpack-visualizer-plugin2'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import HtmlWebpackInlineSourcePlugin from 'html-webpack-inline-source-plugin'
import { merge } from 'webpack-merge'
import TerserPlugin from 'terser-webpack-plugin'
import { fileURLToPath } from 'url'

import baseConfig from './webpack.config.base.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VERSION = '0.0.1'

export default merge(baseConfig, {
  devtool: 'source-map',

  mode: 'production',

  entry: path.join(__dirname, '..', 'app/index.js'),

  output: {
    path: path.join(__dirname, '..', 'dist'),
    publicPath: './dist/',
    filename: 'index.js'
  },

  optimization: {
    minimize: true,
    minimizer: process.env.E2E_BUILD
      ? []
      : [
          new TerserPlugin({
            parallel: true
          })
        ]
  },

  plugins: [
    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new webpack.DefinePlugin({
      IS_DEV: false,
      APP_VERSION: JSON.stringify(VERSION)
    }),

    new HtmlWebpackPlugin({
      template: 'app/index.prod.html',
      inlineSource: '.(js|css)$',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
      }
    }),
    new HtmlWebpackInlineSourcePlugin(HtmlWebpackPlugin),
    new BundleAnalyzerPlugin({
      analyzerMode:
        process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true'
    }),
    new Visualizer()
    /* new BugsnagSourceMapUploaderPlugin({
     *   apiKey: '183fca706d9f94c00a661167bf8cfc5d',
     *   appVersion: VERSION
     * }) */
  ]
})
