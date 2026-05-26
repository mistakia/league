/* eslint global-require: off, import/no-extraneous-dependencies: off */

const development_environments = ['development', 'test']

const development_plugins = [require('react-hot-loader/babel')]

const production_plugins = [
  require('babel-plugin-dev-expression'),

  // babel-preset-react-optimize
  require('@babel/plugin-transform-react-constant-elements'),
  require('@babel/plugin-transform-react-inline-elements'),
  require('babel-plugin-transform-react-remove-prop-types')
]

module.exports = (api) => {
  // See docs about api at https://babeljs.io/docs/en/config-files#apicache

  const development = api.env(development_environments)

  return {
    presets: [
      // @babel/preset-env automatically targets browserslist (package.json) targets
      [
        require('@babel/preset-env'),
        {
          bugfixes: true,
          useBuiltIns: false,
          modules: false
        }
      ],
      [require('@babel/preset-react'), { development, runtime: 'automatic' }]
    ],
    plugins: [
      require('@babel/plugin-transform-runtime'),
      require('@babel/plugin-proposal-object-rest-spread'),
      require('@babel/plugin-proposal-class-properties'),

      ...(development ? development_plugins : production_plugins)
    ]
  }
}
