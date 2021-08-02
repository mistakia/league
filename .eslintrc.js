module.exports = {
  ignorePatterns: ['dist/*'],
  env: {
    browser: true,
    es2021: true
  },
  extends: ['standard', 'eslint:recommended', 'plugin:react/recommended'],
  settings: {
    react: {
      version: 'detect'
    }
  },
  parser: 'babel-eslint',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: ['react'],
  rules: {
    curly: ['off'],
    indent: ['off'],
    'multiline-ternary': ['off', 'always'],
    'generator-star-spacing': [
      'error',
      {
        before: false,
        after: true
      }
    ],
    'space-before-function-paren': [
      'error',
      {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always'
      }
    ]
  }
}
