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
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20000,
      cacheGroups: {
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|react-redux|redux|redux-saga|reselect)[\\/]/,
          name: 'vendor-react',
          priority: 40,
          reuseExistingChunk: true
        },
        mui: {
          test: /[\\/]node_modules[\\/](@mui|@emotion)[\\/]/,
          name: 'vendor-mui',
          priority: 35,
          reuseExistingChunk: true
        },
        highcharts: {
          test: /[\\/]node_modules[\\/](highcharts|highcharts-react-official|highcharts-custom-events)[\\/]/,
          name: 'vendor-highcharts',
          priority: 35,
          reuseExistingChunk: true
        },
        bugsnag: {
          test: /[\\/]node_modules[\\/]@?bugsnag[\\/]/,
          name: 'vendor-bugsnag',
          priority: 35,
          reuseExistingChunk: true
        },
        immutable: {
          test: /[\\/]node_modules[\\/]immutable[\\/]/,
          name: 'vendor-immutable',
          priority: 35,
          reuseExistingChunk: true
        },
        dataviz: {
          test: /[\\/]node_modules[\\/](d3-.*|recharts|victory.*)[\\/]/,
          name: 'vendor-dataviz',
          priority: 30,
          reuseExistingChunk: true
        },
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          priority: 10,
          reuseExistingChunk: true,
          minChunks: 1
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true
        }
      }
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
    extensions: ['.js', '.mjs', '.json'],
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
      '@libs-shared': path.resolve(__dirname, '../libs-shared'),
      '@constants': path.resolve(__dirname, '../libs-shared/constants'),
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
