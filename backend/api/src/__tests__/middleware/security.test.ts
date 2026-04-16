/**
 * Security Middleware Unit Tests
 * Tests for security headers and CSP configuration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { Request, Response, NextFunction } from 'express'

// Import the security middleware components
import {
  securityMiddleware,
  additionalSecurityHeaders,
  helmetConfig,
} from '../../middleware/security.js'

describe('Security Middleware', () => {
  describe('securityMiddleware (Helmet)', () => {
    it('should be a function (middleware)', () => {
      expect(typeof securityMiddleware).toBe('function')
    })

    it('should have correct middleware signature', () => {
      // Helmet middleware has the standard (req, res, next) signature
      expect(securityMiddleware.length).toBe(3)
    })
  })

  describe('additionalSecurityHeaders', () => {
    let mockReq: Partial<Request>
    let mockRes: Partial<Response>
    let mockNext: jest.Mock
    let mockSetHeader: jest.Mock
    let mockRemoveHeader: jest.Mock

    beforeEach(() => {
      mockSetHeader = jest.fn()
      mockRemoveHeader = jest.fn()
      mockReq = {}
      mockRes = {
        setHeader: mockSetHeader,
        removeHeader: mockRemoveHeader,
      }
      mockNext = jest.fn()
    })

    it('should set Permissions-Policy header', () => {
      additionalSecurityHeaders(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockSetHeader).toHaveBeenCalledWith(
        'Permissions-Policy',
        expect.stringContaining('camera=()')
      )
    })

    it('should set Cache-Control headers', () => {
      additionalSecurityHeaders(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockSetHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      )
      expect(mockSetHeader).toHaveBeenCalledWith('Pragma', 'no-cache')
      expect(mockSetHeader).toHaveBeenCalledWith('Expires', '0')
    })

    it('should remove X-Powered-By header', () => {
      additionalSecurityHeaders(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockRemoveHeader).toHaveBeenCalledWith('X-Powered-By')
    })

    it('should call next()', () => {
      additionalSecurityHeaders(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      )

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('helmetConfig', () => {
    it('should have CSP configuration', () => {
      expect(helmetConfig.contentSecurityPolicy).toBeDefined()
      expect(helmetConfig.contentSecurityPolicy.directives).toBeDefined()
    })

    it('should deny framing (clickjacking protection)', () => {
      expect(helmetConfig.frameguard).toEqual({ action: 'deny' })
    })

    it('should enable noSniff (MIME type sniffing protection)', () => {
      expect(helmetConfig.noSniff).toBe(true)
    })

    it('should enable xssFilter', () => {
      expect(helmetConfig.xssFilter).toBe(true)
    })

    it('should have strict referrer policy', () => {
      expect(helmetConfig.referrerPolicy).toEqual({
        policy: 'strict-origin-when-cross-origin'
      })
    })

    it('should disable DNS prefetch', () => {
      expect(helmetConfig.dnsPrefetchControl).toEqual({ allow: false })
    })

    it('should enable origin agent cluster', () => {
      expect(helmetConfig.originAgentCluster).toBe(true)
    })
  })

  describe('CSP Directives', () => {
    const cspDirectives = helmetConfig.contentSecurityPolicy.directives

    it('should have restrictive default-src', () => {
      expect(cspDirectives.defaultSrc).toContain("'self'")
    })

    it('should block object embedding', () => {
      expect(cspDirectives.objectSrc).toContain("'none'")
    })

    it('should block framing', () => {
      expect(cspDirectives.frameSrc).toContain("'none'")
    })

    it('should block frame ancestors', () => {
      expect(cspDirectives.frameAncestors).toContain("'none'")
    })

    it('should restrict base-uri', () => {
      expect(cspDirectives.baseUri).toContain("'self'")
    })

    it('should restrict form-action', () => {
      expect(cspDirectives.formAction).toContain("'self'")
    })
  })
})

describe('Security Headers Best Practices', () => {
  it('should follow OWASP recommended headers', () => {
    // List of OWASP recommended security headers
    const requiredHeaders = [
      'contentSecurityPolicy',
      'frameguard',
      'noSniff',
      'xssFilter',
      'hsts',
      'referrerPolicy',
    ]

    requiredHeaders.forEach(header => {
      expect(helmetConfig).toHaveProperty(header)
    })
  })
})
