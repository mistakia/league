import path, { dirname } from 'path'
import webpack from 'webpack'
import nib from 'nib'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default {
  externals: ['fs', 'child_process'],

  target: 'web',

  optimization: {
    splitChunks: {
      chunks: 'all'
    },
    moduleIds: 'named'
  },

  module: {
    rules: [
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false
        }
      },
      {
        test: /\.m?js$/,
        exclude: /node_modules\/(?!react-table)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            cacheDirectory: true
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              insert: 'head', // insert style tag inside of <head>
              injectType: 'singletonStyleTag' // this is for wrap all your style in just one style tag
            }
          },
          {
            loader: 'css-loader'
          }
        ]
      },
      {
        test: /\.styl$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              insert: 'head', // insert style tag inside of <head>
              injectType: 'singletonStyleTag' // this is for wrap all your style in just one style tag
            }
          },
          {
            loader: 'css-loader'
          },
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

  output: {
    path: path.join(__dirname, '..', 'dist'),
    globalObject: 'this'
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.json'],
    modules: [path.join(__dirname, '..', 'app'), 'node_modules'],
    alias: {
      dayjs: path.resolve(__dirname, '../node_modules/dayjs'),
      react: path.resolve(__dirname, '../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../node_modules/react-dom'),
      '@mui/x-date-pickers': path.resolve(
        __dirname,
        '../node_modules/@mui/x-date-pickers'
      ),
      '@emotion/react': path.resolve(
        __dirname,
        '../node_modules/@emotion/react'
      ),
      'highcharts-react-official': path.resolve(
        __dirname,
        '../node_modules/highcharts-react-official'
      ),
      highcharts: path.resolve(__dirname, '../node_modules/highcharts'),
      'timeago.js': path.resolve(__dirname, '../node_modules/timeago.js'),
      '@libs-shared/job-constants': path.resolve(
        __dirname,
        '../libs-shared/job-constants.mjs'
      ),
      '@libs-shared/data-views-nfl-week-migration.mjs': path.resolve(
        __dirname,
        '../libs-shared/data-views-nfl-week-migration.mjs'
      ),
      '@libs-shared': path.resolve(__dirname, '../libs-shared/index.mjs'),
      '@constants/season-constants': path.resolve(
        __dirname,
        '../libs-shared/constants/season-constants.mjs'
      ),
      '@constants/stats-constants': path.resolve(
        __dirname,
        '../libs-shared/constants/stats-constants.mjs'
      ),
      '@constants/player-status-constants': path.resolve(
        __dirname,
        '../libs-shared/constants/player-status-constants.mjs'
      ),
      '@constants/nfl-teams-constants': path.resolve(
        __dirname,
        '../libs-shared/constants/nfl-teams-constants.mjs'
      ),
      '@constants/colleges-constants': path.resolve(
        __dirname,
        '../libs-shared/constants/colleges-constants.mjs'
      ),
      '@constants/roster-constants': path.resolve(
        __dirname,
        '../libs-shared/constants/roster-constants.mjs'
      ),
      '@constants/transaction-constants': path.resolve(
        __dirname,
        '../libs-shared/constants/transaction-constants.mjs'
      ),
      '@constants/source-constants': path.resolve(
        __dirname,
        '../libs-shared/constants/source-constants.mjs'
      ),
      '@constants/error-constants': path.resolve(
        __dirname,
        '../libs-shared/constants/error-constants.mjs'
      ),
      '@constants': path.resolve(
        __dirname,
        '../libs-shared/constants/index.mjs'
      ),
      '@views': path.resolve(__dirname, '../app/views'),
      '@pages': path.resolve(__dirname, '../app/views/pages'),
      '@core': path.resolve(__dirname, '../app/core'),
      '@components': path.resolve(__dirname, '../app/views/components'),
      '@styles': path.resolve(__dirname, '../app/styles'),
      '@layouts': path.resolve(__dirname, '../app/views/layouts')
    }
  },

  plugins: [
    new webpack.IgnorePlugin({ resourceRegExp: /^(fs|child_process)$/ })
  ]
}
