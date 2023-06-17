/* eslint global-require: off, import/no-extraneous-dependencies: off */

const developmentEnvironments = ['development', 'test']

const developmentPlugins = [require('react-hot-loader/babel')]

const productionPlugins = [
  require('babel-plugin-dev-expression'),

  // babel-preset-react-optimize
  require('@babel/plugin-transform-react-constant-elements'),
  require('@babel/plugin-transform-react-inline-elements'),
  require('babel-plugin-transform-react-remove-prop-types')
]

module.exports = (api) => {
  // See docs about api at https://babeljs.io/docs/en/config-files#apicache

  const development = api.env(developmentEnvironments)

  return {
    presets: [
      // @babel/preset-env will automatically target browserslist (package.json) targets
      require('@babel/preset-env'),
      [require('@babel/preset-react'), { development }]
    ],
    plugins: [
      require('@babel/plugin-transform-runtime'),
      require('@babel/plugin-proposal-object-rest-spread'),
      require('@babel/plugin-proposal-class-properties'),

      // aliases
      [
        require('babel-plugin-module-resolver'),
        {
          root: ['./'],
          alias: {
            '@libs-shared': './libs-shared/index.mjs',
            '@views': './app/views',
            '@pages': './app/views/pages',
            '@core': './app/core',
            '@components': './app/views/components',
            '@styles': './app/styles',
            '@layouts': './app/views/layouts'
          }
        }
      ],

      ...(development ? developmentPlugins : productionPlugins)
    ]
  }
}
