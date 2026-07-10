import path, { dirname } from 'path'
import { execSync } from 'child_process'
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

// Git SHA this bundle was built from. Emitted into dist/build-manifest.json (a
// separate file, NOT injected into the JS via DefinePlugin — embedding it would
// change every content hash on every commit and defeat reproducible builds).
// The config-drift monitor reads the deployed manifest to detect a client that
// was never rebuilt for the latest frontend commits.
const BUILD_SHA = (() => {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: path.join(__dirname, '..')
    })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
})()

// Emit dist/build-manifest.json during compilation so it survives `output.clean`.
const build_manifest_plugin = {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('BuildManifestPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'BuildManifestPlugin',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
        },
        () => {
          const manifest = JSON.stringify({
            sha: BUILD_SHA,
            built_at: new Date().toISOString()
          })
          compilation.emitAsset(
            'build-manifest.json',
            new webpack.sources.RawSource(manifest)
          )
        }
      )
    })
  }
}

export default merge(baseConfig, {
  devtool: 'source-map',

  mode: 'production',

  entry: path.join(__dirname, '..', 'app/index.js'),

  output: {
    path: path.join(__dirname, '..', 'dist'),
    // Use '/' for webpack serve, '/dist/' for builds (can be overridden via --public-path)
    publicPath: process.env.WEBPACK_SERVE ? '/' : '/dist/',
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
    clean: true
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
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
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

    build_manifest_plugin,

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
  ],

  // Add devServer config for serving production builds locally
  devServer: {
    port: 8091,
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
