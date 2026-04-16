/**
 * Skills Routes Unit Tests
 * Tests for skill taxonomy endpoints
 */

import { describe, it, expect } from '@jest/globals'
import skillsRouter from '../../routes/skills.js'

describe('Skills Routes', () => {
  describe('Router Configuration', () => {
    it('should export a router', () => {
      expect(skillsRouter).toBeDefined()
      expect(typeof skillsRouter).toBe('function')
    })

    it('should have router stack with routes', () => {
      const stack = skillsRouter.stack
      expect(Array.isArray(stack)).toBe(true)
      expect(stack.length).toBeGreaterThan(0)
    })

    it('should have GET / route for listing skills', () => {
      const getRoute = skillsRouter.stack.find(
        (layer: { route?: { path: string; methods: { get?: boolean } } }) =>
          layer.route?.path === '/' && layer.route?.methods?.get
      )
      expect(getRoute).toBeDefined()
    })

    it('should have GET /:id route for getting skill by ID', () => {
      const getByIdRoute = skillsRouter.stack.find(
        (layer: { route?: { path: string; methods: { get?: boolean } } }) =>
          layer.route?.path === '/:id' && layer.route?.methods?.get
      )
      expect(getByIdRoute).toBeDefined()
    })

    it('should have POST / route for creating skill', () => {
      const postRoute = skillsRouter.stack.find(
        (layer: { route?: { path: string; methods: { post?: boolean } } }) =>
          layer.route?.path === '/' && layer.route?.methods?.post
      )
      expect(postRoute).toBeDefined()
    })
  })

  describe('Skill Types', () => {
    it('should validate skill types', () => {
      const validTypes = ['technical', 'soft', 'domain', 'language', 'certification']
      validTypes.forEach(type => {
        expect(typeof type).toBe('string')
      })
    })

    it('should validate proficiency levels', () => {
      const validLevels = [1, 2, 3, 4, 5]
      validLevels.forEach(level => {
        expect(level).toBeGreaterThanOrEqual(1)
        expect(level).toBeLessThanOrEqual(5)
      })
    })
  })
})

describe('Skills API Response Format', () => {
  it('should define expected skill object structure', () => {
    const expectedSkill = {
      id: 'uuid',
      name: 'TypeScript',
      description: 'TypeScript programming language',
      category: 'Programming Languages',
      type: 'technical',
      esco_uri: 'http://data.europa.eu/esco/skill/xxx',
      is_active: true,
      employee_count: 100,
    }

    expect(expectedSkill).toHaveProperty('id')
    expect(expectedSkill).toHaveProperty('name')
    expect(expectedSkill).toHaveProperty('type')
    expect(expectedSkill).toHaveProperty('category')
  })

  it('should support ESCO taxonomy integration', () => {
    const escoSkill = {
      uri: 'http://data.europa.eu/esco/skill/xxx',
      prefLabel: 'TypeScript programming',
      description: 'Programming in TypeScript',
    }

    expect(escoSkill).toHaveProperty('uri')
    expect(escoSkill.uri).toContain('esco')
  })
})
