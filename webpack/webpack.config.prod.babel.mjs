import path from 'path'
import webpack from 'webpack'
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import HtmlWebpackInlineSourcePlugin from 'html-webpack-inline-source-plugin'
import nib from 'nib'
import merge from 'webpack-merge'
import TerserPlugin from 'terser-webpack-plugin'
import baseConfig from './webpack.config.base.mjs'

const VERSION = '0.0.1'

export default merge.smart(baseConfig, {
  devtool: 'source-map',

  mode: 'production',

  entry: path.join(__dirname, '..', 'app/index.js'),

  output: {
    path: path.join(__dirname, '..', 'dist'),
    publicPath: './dist/',
    filename: 'index.js'
  },

  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.(styl|css)$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader'
          },
          {
            loader: 'stylus-loader',
            options: {
              use: [nib()],
              import: [
                '~nib/lib/nib/index.styl',
                path.resolve(__dirname, '../app/styles/variables.styl')
              ]
            }
          }
        ]
      },
      {
        test: /\.(png|jpg)$/,
        loader: 'url-loader',
        options: {
          limit: 8192
        }
      }
    ]
  },

  optimization: {
    minimize: true,
    minimizer: process.env.E2E_BUILD
      ? []
      : [
          new TerserPlugin({
            parallel: true,
            sourceMap: true
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

    /* new MiniCssExtractPlugin({
     *   filename: 'style.css'
     * }),
     */
    new HtmlWebpackPlugin({
      template: 'app/index.prod.html',
      inlineSource: '.(js|css)$'
    }),
    new HtmlWebpackInlineSourcePlugin(HtmlWebpackPlugin),
    new BundleAnalyzerPlugin({
      analyzerMode:
        process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true'
    })
    /* new BugsnagSourceMapUploaderPlugin({
     *   apiKey: '183fca706d9f94c00a661167bf8cfc5d',
     *   appVersion: VERSION
     * }) */
  ]
})
