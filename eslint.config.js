import neostandard from 'neostandard'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()],
    noJsx: true
  }),
  {
    rules: {
      curly: ['error', 'all'],
      'consistent-return': 'error'
    }
  },
  {
    files: ['src/**/*.js'],
    ignores: ['**/*.test.js', '**/test-helpers/**'],
    rules: {
      'no-magic-numbers': ['error', {
        ignore: [-1, 0, 1],
        ignoreArrayIndexes: true,
        enforceConst: true
      }]
    }
  }
]
