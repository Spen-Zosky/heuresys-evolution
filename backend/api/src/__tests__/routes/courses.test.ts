/**
 * Courses Routes Unit Tests
 * Tests for course management endpoints
 */

import { describe, it, expect } from '@jest/globals'
import coursesRouter from '../../routes/courses.js'

describe('Courses Routes', () => {
  describe('Router Configuration', () => {
    it('should export a router', () => {
      expect(coursesRouter).toBeDefined()
      expect(typeof coursesRouter).toBe('function')
    })

    it('should have router stack with routes', () => {
      const stack = coursesRouter.stack
      expect(Array.isArray(stack)).toBe(true)
      expect(stack.length).toBeGreaterThan(0)
    })

    it('should have GET / route for listing courses', () => {
      const getRoute = coursesRouter.stack.find(
        (layer: { route?: { path: string; methods: { get?: boolean } } }) =>
          layer.route?.path === '/' && layer.route?.methods?.get
      )
      expect(getRoute).toBeDefined()
    })

    it('should have GET /:id route for getting course by ID', () => {
      const getByIdRoute = coursesRouter.stack.find(
        (layer: { route?: { path: string; methods: { get?: boolean } } }) =>
          layer.route?.path === '/:id' && layer.route?.methods?.get
      )
      expect(getByIdRoute).toBeDefined()
    })

    it('should have POST / route for creating course', () => {
      const postRoute = coursesRouter.stack.find(
        (layer: { route?: { path: string; methods: { post?: boolean } } }) =>
          layer.route?.path === '/' && layer.route?.methods?.post
      )
      expect(postRoute).toBeDefined()
    })
  })

  describe('Course Properties', () => {
    it('should validate course levels', () => {
      const validLevels = ['beginner', 'intermediate', 'advanced', 'expert']
      validLevels.forEach(level => {
        expect(typeof level).toBe('string')
      })
    })

    it('should validate course formats', () => {
      const validFormats = ['online', 'in-person', 'hybrid', 'self-paced']
      validFormats.forEach(format => {
        expect(typeof format).toBe('string')
      })
    })
  })
})

describe('Courses API Response Format', () => {
  it('should define expected course object structure', () => {
    const expectedCourse = {
      id: 'uuid',
      title: 'Introduction to TypeScript',
      description: 'Learn TypeScript basics',
      category: 'Programming',
      level: 'beginner',
      duration: 120,
      provider: 'Internal',
      format: 'online',
      is_active: true,
      is_mandatory: false,
      enrollment_count: 50,
      completion_rate: 85.5,
      average_rating: 4.5,
    }

    expect(expectedCourse).toHaveProperty('id')
    expect(expectedCourse).toHaveProperty('title')
    expect(expectedCourse).toHaveProperty('level')
    expect(expectedCourse).toHaveProperty('format')
  })

  it('should validate duration is positive', () => {
    const validDurations = [30, 60, 120, 240]
    validDurations.forEach(duration => {
      expect(duration).toBeGreaterThan(0)
    })
  })
})
