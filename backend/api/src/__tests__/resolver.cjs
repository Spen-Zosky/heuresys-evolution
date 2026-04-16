/**
 * Custom Jest resolver for ESM TypeScript
 * Resolves .js imports to .ts files in source code
 */
const path = require('path');

module.exports = (request, options) => {
  // Handle .js to .ts resolution for local imports
  if (request.endsWith('.js') && request.startsWith('.')) {
    const tsRequest = request.replace(/\.js$/, '.ts');
    try {
      return options.defaultResolver(tsRequest, options);
    } catch {
      // Fall through to default resolution
    }
  }

  // Handle extensionless imports for local files (relative paths only)
  if (request.startsWith('.')) {
    // Try .ts extension first
    try {
      return options.defaultResolver(request + '.ts', options);
    } catch {
      // Try /index.ts
      try {
        return options.defaultResolver(request + '/index.ts', options);
      } catch {
        // Try .js extension
        try {
          return options.defaultResolver(request + '.js', options);
        } catch {
          // Fall through to default resolution
        }
      }
    }
  }

  // Default resolution
  return options.defaultResolver(request, options);
};
