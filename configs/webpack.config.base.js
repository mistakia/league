/**
 * Base webpack config used across other specific configs
 */

const path = require('path')
const webpack = require('webpack')
const nib = require('nib')

module.exports = {
  externals: [],

  target: 'web',

  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true
          }
        }
      }, {
        test: /\.(styl|css)$/,
        use: [{
	      loader: 'style-loader'
        }, {
	      loader: 'css-loader',
        }, {
	      loader: 'stylus-loader',
	      options: {
	        use: [nib()],
	        import: [
	          '~nib/lib/nib/index.styl',
	          path.resolve(__dirname, '../app/styles/variables.styl')
	        ]
	      }
        }]
      }, {
        test: /\.(png|jpg)$/,
        loader: 'url-loader',
        options: {
	      limit: 8192
        }
      }
    ]
  },

  output: {
    path: path.join(__dirname, '..', 'app')
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.json'],
    modules: [path.join(__dirname, '..', 'app'), 'node_modules'],
    alias: {
      'react-dom': '@hot-loader/react-dom'
    }
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production'
    }),

    new webpack.NamedModulesPlugin()
  ]
}
