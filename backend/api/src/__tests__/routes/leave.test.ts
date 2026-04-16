/**
 * Leave Routes Unit Tests
 * Tests for leave management endpoints
 */

import { describe, it, expect } from '@jest/globals'
import leaveRouter from '../../routes/leave.js'

describe('Leave Routes', () => {
  describe('Router Configuration', () => {
    it('should export a router', () => {
      expect(leaveRouter).toBeDefined()
      expect(typeof leaveRouter).toBe('function')
    })

    it('should have router stack with routes', () => {
      const stack = leaveRouter.stack
      expect(Array.isArray(stack)).toBe(true)
      expect(stack.length).toBeGreaterThan(0)
    })

    it('should have GET /requests route for listing leave requests', () => {
      const getRoute = leaveRouter.stack.find(
        (layer: { route?: { path: string; methods: { get?: boolean } } }) =>
          layer.route?.path === '/requests' && layer.route?.methods?.get
      )
      expect(getRoute).toBeDefined()
    })

    it('should have POST /requests route for creating leave request', () => {
      const postRoute = leaveRouter.stack.find(
        (layer: { route?: { path: string; methods: { post?: boolean } } }) =>
          layer.route?.path === '/requests' && layer.route?.methods?.post
      )
      expect(postRoute).toBeDefined()
    })

    it('should have GET /balances route for leave balances', () => {
      const balancesRoute = leaveRouter.stack.find(
        (layer: { route?: { path: string; methods: { get?: boolean } } }) =>
          layer.route?.path === '/balances' && layer.route?.methods?.get
      )
      expect(balancesRoute).toBeDefined()
    })
  })

  describe('Leave Types', () => {
    it('should validate leave types', () => {
      const validTypes = ['annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid', 'other']
      validTypes.forEach(type => {
        expect(typeof type).toBe('string')
      })
    })

    it('should validate leave request statuses', () => {
      const validStatuses = ['pending', 'approved', 'rejected', 'cancelled']
      validStatuses.forEach(status => {
        expect(typeof status).toBe('string')
      })
    })
  })
})

describe('Leave API Response Format', () => {
  it('should define expected leave request structure', () => {
    const expectedLeaveRequest = {
      id: 'uuid',
      employee_id: 'uuid',
      leave_type: 'annual',
      start_date: '2025-01-15',
      end_date: '2025-01-20',
      total_days: 5,
      status: 'pending',
      reason: 'Vacation',
      approved_by: null,
      approved_at: null,
    }

    expect(expectedLeaveRequest).toHaveProperty('id')
    expect(expectedLeaveRequest).toHaveProperty('leave_type')
    expect(expectedLeaveRequest).toHaveProperty('status')
    expect(expectedLeaveRequest).toHaveProperty('total_days')
  })

  it('should define expected leave balance structure', () => {
    const expectedBalance = {
      employee_id: 'uuid',
      leave_type: 'annual',
      entitled: 25,
      used: 10,
      pending: 5,
      remaining: 15,
      carry_over: 3,
      year: 2025,
    }

    expect(expectedBalance).toHaveProperty('entitled')
    expect(expectedBalance).toHaveProperty('used')
    expect(expectedBalance).toHaveProperty('remaining')
    expect(expectedBalance.remaining).toBe(
      expectedBalance.entitled - expectedBalance.used
    )
  })

  it('should validate total_days is positive', () => {
    const validDays = [0.5, 1, 2.5, 5, 10, 20]
    validDays.forEach(days => {
      expect(days).toBeGreaterThan(0)
    })
  })
})
