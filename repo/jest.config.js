/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/unit_tests/**/*.spec.ts'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      moduleNameMapper: {
        '^sequelize$': '<rootDir>/src/__mocks__/sequelize.mock.ts',
        '^../config/database$': '<rootDir>/src/__mocks__/sequelize.mock.ts',
        '^../../config/database$': '<rootDir>/src/__mocks__/sequelize.mock.ts',
      },
    },
    {
      displayName: 'api',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/API_tests/**/*.spec.ts'],
      moduleFileExtensions: ['ts', 'js', 'json'],
    },
  ],
};
