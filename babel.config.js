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
      // @babel/preset-env will automatically target browserslist (package.json) targets
      require('@babel/preset-env'),
      [require('@babel/preset-react'), { development, runtime: 'automatic' }]
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
            '@libs-shared/job-constants': './libs-shared/job-constants.mjs',
            '@libs-shared': './libs-shared/index.mjs',
            '@constants/season-constants':
              './libs-shared/constants/season-constants.mjs',
            '@constants/stats-constants':
              './libs-shared/constants/stats-constants.mjs',
            '@constants/player-status-constants':
              './libs-shared/constants/player-status-constants.mjs',
            '@constants/nfl-teams-constants':
              './libs-shared/constants/nfl-teams-constants.mjs',
            '@constants/colleges-constants':
              './libs-shared/constants/colleges-constants.mjs',
            '@constants/roster-constants':
              './libs-shared/constants/roster-constants.mjs',
            '@constants/transaction-constants':
              './libs-shared/constants/transaction-constants.mjs',
            '@constants/source-constants':
              './libs-shared/constants/source-constants.mjs',
            '@constants/error-constants':
              './libs-shared/constants/error-constants.mjs',
            '@constants': './libs-shared/constants/index.mjs',
            '@views': './app/views',
            '@pages': './app/views/pages',
            '@core': './app/core',
            '@components': './app/views/components',
            '@styles': './app/styles',
            '@layouts': './app/views/layouts'
          }
        }
      ],

      ...(development ? development_plugins : production_plugins)
    ]
  }
}
