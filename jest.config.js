/** @type {import('jest').Config} */
// eslint-disable-next-line no-undef
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  watchman: false,
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/configs/**/*.ts',
    '!src/app.ts',
    '!src/shared/infrastructure/adapters/http/*.adapter.ts',
    '!src/**/*.routes.ts',
    '!src/**/*.schema.ts',
  ],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@configs/(.*)$': '<rootDir>/src/configs/$1',
    '^@config/(.*)$': '<rootDir>/src/configs/$1',
  },
};
