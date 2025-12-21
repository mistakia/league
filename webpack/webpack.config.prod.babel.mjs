import path, { dirname } from 'path'
import webpack from 'webpack'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin'
// import Visualizer from 'webpack-visualizer-plugin2'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import HtmlWebpackInlineSourcePlugin from 'html-webpack-inline-source-plugin'
import { merge } from 'webpack-merge'
import TerserPlugin from 'terser-webpack-plugin'
import { fileURLToPath } from 'url'
import nib from 'nib'

import baseConfig from './webpack.config.base.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VERSION = '0.0.1'

export default merge(baseConfig, {
  devtool: 'source-map',

  mode: 'production',

  entry: path.join(__dirname, '..', 'app/index.js'),

  output: {
    path: path.join(__dirname, '..', 'dist'),
    // Use '/' for webpack serve, '/dist/' for builds (can be overridden via --public-path)
    publicPath: process.env.WEBPACK_SERVE ? '/' : '/dist/',
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js'
  },

  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      },
      {
        test: /\.styl$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'stylus-loader',
            options: {
              stylusOptions: {
                use: [nib()],
                import: [
                  'nib',
                  path.resolve(__dirname, '../app/styles/variables.styl')
                ]
              }
            }
          }
        ]
      }
    ]
  },

  optimization: {
    minimize: true,
    minimizer: process.env.E2E_BUILD
      ? []
      : [
          new TerserPlugin({
            parallel: true
          }),
          new CssMinimizerPlugin()
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
      template: 'app/index.html',
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

    new MiniCssExtractPlugin({
      filename: '[name].[contenthash:8].css',
      chunkFilename: '[name].[contenthash:8].chunk.css'
    }),

    new HtmlWebpackInlineSourcePlugin(HtmlWebpackPlugin),
    new BundleAnalyzerPlugin({
      analyzerMode:
        process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true'
    })
    // new Visualizer()
    /* new BugsnagSourceMapUploaderPlugin({
     *   apiKey: '183fca706d9f94c00a661167bf8cfc5d',
     *   appVersion: VERSION
     * }) */
  ],

  // Add devServer config for serving production builds locally
  devServer: {
    port: 8083,
    compress: true,
    open: true,
    hot: false, // Disable HMR for production
    headers: { 'Access-Control-Allow-Origin': '*' },
    historyApiFallback: {
      verbose: true,
      disableDotRule: false
    },
    static: {
      directory: path.join(__dirname, '..', 'static'),
      publicPath: '/static'
    }
  }
})
