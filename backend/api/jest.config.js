/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@heuresys/shared$': '<rootDir>/../../packages/shared/dist/index.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  resolver: '<rootDir>/src/__tests__/resolver.cjs',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          isolatedModules: true,
          noUncheckedIndexedAccess: false,
        },
      },
    ],
  },
  testMatch: [
    '**/src/__tests__/**/*.test.ts',
    '**/src/**/*.spec.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!dist/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    // Coverage thresholds for critical middleware (50% across all metrics)
    // Glob pattern applied per-file against absolute paths
    '**/src/middleware/auth.ts': {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    '**/src/middleware/errorHandler.ts': {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    '**/src/middleware/security.ts': {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    // Global thresholds — raised to 30% floor (WAVE 7 hardening)
    global: {
      branches: 20,
      functions: 25,
      lines: 30,
      statements: 30,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
  verbose: true,
}
