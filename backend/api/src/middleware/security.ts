/**
 * Security Middleware Configuration
 * Provides comprehensive security headers for the API Gateway
 */

import helmet from 'helmet';
import { config } from '../config/index.js';

/**
 * Content Security Policy directives for API responses
 * Note: API Gateway primarily returns JSON, but CSP is still valuable
 * for any HTML error pages or documentation endpoints
 */
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for error pages
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
};

/**
 * Helmet configuration with all security headers
 */
export const helmetConfig = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: cspDirectives,
    reportOnly: config.nodeEnv !== 'production', // Report-only in dev
  },

  // Cross-Origin-Embedder-Policy
  crossOriginEmbedderPolicy: false, // Disabled for API compatibility

  // Cross-Origin-Opener-Policy
  crossOriginOpenerPolicy: { policy: 'same-origin' as const },

  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy: { policy: 'same-origin' as const },

  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },

  // X-Download-Options (IE specific)
  ieNoOpen: true,

  // X-Frame-Options - prevent clickjacking
  frameguard: { action: 'deny' as const },

  // Strict-Transport-Security
  hsts: config.nodeEnv === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,

  // X-Content-Type-Options
  noSniff: true,

  // Origin-Agent-Cluster
  originAgentCluster: true,

  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies: { permittedPolicies: 'none' as const },

  // Referrer-Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },

  // X-XSS-Protection (legacy but still useful)
  xssFilter: true,
};

/**
 * Security middleware with full configuration
 */
export const securityMiddleware = helmet(helmetConfig);

/**
 * Additional security response headers
 * Applied after helmet for any custom headers
 */
export function additionalSecurityHeaders(
  _req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
): void {
  // Feature Policy / Permissions Policy
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  // Cache Control for API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Server header (hide server software)
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Export combined security middleware
 */
export default [securityMiddleware, additionalSecurityHeaders];
