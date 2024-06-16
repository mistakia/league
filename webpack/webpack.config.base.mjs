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
    path: path.join(__dirname, '..', 'app'),
    globalObject: 'this'
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.json'],
    modules: [path.join(__dirname, '..', 'app'), 'node_modules'],
    alias: {
      react: path.resolve(__dirname, '../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../node_modules/react-dom'),
      '@emotion/react': path.resolve(
        __dirname,
        '../node_modules/@emotion/react'
      )
    }
  },

  plugins: [
    new webpack.IgnorePlugin({ resourceRegExp: /^(fs|child_process)$/ })
  ]
}
