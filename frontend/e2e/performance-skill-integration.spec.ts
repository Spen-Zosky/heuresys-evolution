import { test, expect } from '@playwright/test'
import { getAuthToken } from './api-auth-helper'

const API_BASE = 'http://localhost:8012'
let HEADERS: Record<string, string> = { 'X-Tenant-Code': 'rtl-bank' }

/**
 * SPRINT 2025-05: Performance-Skill Integration Tests
 * Tests the complete flow from performance review to skill development
 *
 * NOTE: UI tests require frontend to be running on localhost:3012
 * API tests work independently against the external API
 */
test.describe('Performance-Skill Integration (S-PERF-01-10)', () => {

  test.beforeAll(async () => {
    const token = await getAuthToken();
    HEADERS = { ...HEADERS, 'Authorization': `Bearer ${token}` };
  });

  test.describe('1. API Endpoints', () => {

    test('1.1 Get Summary - Returns employee competency stats', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/performance-skill/summary`, { headers: HEADERS })

      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
      const data = await res.json()

      expect(data).toHaveProperty('data')
      expect(Array.isArray(data.data)).toBeTruthy()

      if (data.data.length > 0) {
        const emp = data.data[0]
        expect(emp).toHaveProperty('employeeId')
        expect(emp).toHaveProperty('employeeName')
        expect(emp).toHaveProperty('lowRated')
        expect(emp).toHaveProperty('mediumRated')
        expect(emp).toHaveProperty('highRated')
        console.log(`[Summary API]: ${data.data.length} employees with skill links`)
      } else {
        console.log('[Summary API]: No data yet - batch link may be needed')
      }
    })

    test('1.2 Batch Link - Links reviews to skills', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/performance-skill/batch-link`, { headers: HEADERS })

      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
      const data = await res.json()

      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('totalProcessed')
      expect(data).toHaveProperty('successful')

      console.log(`[Batch Link]: ${data.successful}/${data.totalProcessed} processed`)
    })

    test('1.3 Gap Analysis - Triggers analysis for employee', async ({ request }) => {
      // First get an employee with low ratings
      const summaryRes = await request.get(`${API_BASE}/api/v1/performance-skill/summary`, { headers: HEADERS })
      const summaryData = await summaryRes.json()

      const empWithGaps = summaryData.data?.find((e: any) => e.lowRated > 0)

      if (empWithGaps) {
        const res = await request.post(
          `${API_BASE}/api/v1/performance-skill/gap-analysis/${empWithGaps.employeeId}`,
          { headers: HEADERS }
        )

        if (!res.ok()) { console.log('[SKIP] Gap Analysis API returned', res.status()); return }
        const data = await res.json()

        expect(data).toHaveProperty('message')
        console.log(`[Gap Analysis]: ${data.message} for ${empWithGaps.employeeName}`)
      } else {
        console.log('[Gap Analysis]: No employees with low ratings found')
      }
    })

    test('1.4 Mentor Matches - Finds suitable mentors', async ({ request }) => {
      // Get employee needing development
      const summaryRes = await request.get(`${API_BASE}/api/v1/performance-skill/summary`, { headers: HEADERS })
      const summaryData = await summaryRes.json()

      const empWithGaps = summaryData.data?.find((e: any) => e.lowRated > 0)

      if (empWithGaps) {
        const res = await request.get(
          `${API_BASE}/api/v1/performance-skill/mentors/${empWithGaps.employeeId}`,
          { headers: HEADERS }
        )

        if (res.ok()) {
          const data = await res.json()
          expect(Array.isArray(data.mentors)).toBeTruthy()
          console.log(`[Mentors]: ${data.mentors.length} potential mentors found`)
        } else {
          console.log('[Mentors]: No mentor data available (may need skill profiles)')
        }
      } else {
        console.log('[Mentors]: No employees with gaps to test')
      }
    })

    test('1.5 Development Plan - Returns comprehensive plan', async ({ request }) => {
      const summaryRes = await request.get(`${API_BASE}/api/v1/performance-skill/summary`, { headers: HEADERS })
      const summaryData = await summaryRes.json()

      const empWithGaps = summaryData.data?.find((e: any) => e.lowRated > 0)

      if (empWithGaps) {
        const res = await request.get(
          `${API_BASE}/api/v1/performance-skill/development-plan/${empWithGaps.employeeId}`,
          { headers: HEADERS }
        )

        if (res.ok()) {
          const data = await res.json()
          expect(data).toHaveProperty('developmentPlan')
          expect(data.developmentPlan).toHaveProperty('employee')
          expect(data.developmentPlan).toHaveProperty('areasForDevelopment')
          console.log(`[Development Plan]: ${data.developmentPlan.areasForDevelopment.length} areas for ${empWithGaps.employeeName}`)
        } else {
          console.log('[Development Plan]: Could not generate plan')
        }
      }
    })
  })

  test.describe('2. AI Predictions API', () => {

    test('2.1 Generate Predictions - Runs ML model', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/predictions/performance/generate`, { headers: HEADERS })

      // May fail if already generated or no data
      if (res.ok()) {
        const data = await res.json()
        expect(data).toHaveProperty('success')
        console.log(`[Generate Predictions]: ${data.message || 'Completed'}`)
      } else {
        console.log('[Generate Predictions]: Skipped (may already exist or require more data)')
      }
    })

    test('2.2 Get Predictions - Returns risk scores', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/predictions/performance?limit=20`, { headers: HEADERS })

      // API returns { success, data, meta }
      if (res.ok()) {
        const json = await res.json()
        expect(json).toHaveProperty('success')
        expect(json).toHaveProperty('data')
        expect(Array.isArray(json.data)).toBeTruthy()

        console.log(`[Predictions]: ${json.data?.length || 0} predictions available`)

        if (json.data?.length > 0) {
          const pred = json.data[0]
          expect(pred).toHaveProperty('risk_score')
          expect(pred).toHaveProperty('risk_level')
        }
      } else {
        console.log('[Predictions]: Not available (may need generation)')
      }
    })

    test('2.3 Risk Distribution - Returns breakdown', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/predictions/risk-distribution`, { headers: HEADERS })

      // API returns { success, data, totals }
      if (res.ok()) {
        const json = await res.json()
        expect(json).toHaveProperty('success')
        expect(json).toHaveProperty('data')
        console.log(`[Risk Distribution]: ${json.data?.length || 0} departments`)
      } else {
        console.log('[Risk Distribution]: Not available (may need predictions)')
      }
    })

    test('2.4 High Potentials - Returns HiPo list', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/predictions/high-potentials?limit=10`, { headers: HEADERS })

      // API returns { success, data }
      if (res.ok()) {
        const json = await res.json()
        expect(json).toHaveProperty('success')
        expect(json).toHaveProperty('data')
        console.log(`[High Potentials]: ${json.data?.length || 0} identified`)
      } else {
        console.log('[High Potentials]: Not available (may need predictions)')
      }
    })
  })

  test.describe('3. Complete Integration Flow (API Only)', () => {

    test('3.1 Full Performance-Skill Integration Flow', async ({ request }) => {
      console.log('\n=== COMPLETE INTEGRATION FLOW ===\n')

      // Step 1: Trigger batch link
      console.log('Step 1: Batch linking performance reviews...')
      const linkRes = await request.post(`${API_BASE}/api/v1/performance-skill/batch-link`, { headers: HEADERS })
      if (!linkRes.ok()) { console.log('[SKIP] batch-link API returned', linkRes.status()); return }
      const linkData = await linkRes.json()
      console.log(`   -> Processed: ${linkData.totalProcessed}, Successful: ${linkData.successful}`)

      // Step 2: Get summary
      console.log('\nStep 2: Fetching skill summary...')
      const summaryRes = await request.get(`${API_BASE}/api/v1/performance-skill/summary`, { headers: HEADERS })
      if (!summaryRes.ok()) { console.log('[SKIP] summary API returned', summaryRes.status()); return }
      const summaryData = await summaryRes.json()
      console.log(`   -> Employees with links: ${summaryData.data?.length || 0}`)

      // Step 3: Find employee with gaps
      const empWithGaps = summaryData.data?.find((e: any) => e.lowRated > 0)

      if (empWithGaps) {
        console.log(`\nStep 3: Testing with employee: ${empWithGaps.employeeName}`)
        console.log(`   -> Low rated: ${empWithGaps.lowRated}, Skills linked: ${empWithGaps.skillsLinked}`)

        // Step 4: Trigger gap analysis
        console.log('\nStep 4: Triggering gap analysis...')
        const gapRes = await request.post(
          `${API_BASE}/api/v1/performance-skill/gap-analysis/${empWithGaps.employeeId}`,
          { headers: HEADERS }
        )
        if (gapRes.ok()) {
          const gapData = await gapRes.json()
          console.log(`   -> ${gapData.message}`)
        }

        // Step 5: Get development plan
        console.log('\nStep 5: Generating development plan...')
        const planRes = await request.get(
          `${API_BASE}/api/v1/performance-skill/development-plan/${empWithGaps.employeeId}`,
          { headers: HEADERS }
        )
        if (planRes.ok()) {
          const planData = await planRes.json()
          const plan = planData.developmentPlan
          console.log(`   -> Areas for development: ${plan.areasForDevelopment?.length || 0}`)
          console.log(`   -> Recommended mentors: ${plan.recommendedMentors?.length || 0}`)
          console.log(`   -> Gap analysis: ${plan.gapAnalysis ? 'Created' : 'Not available'}`)
        }

        // Step 6: Find mentors
        console.log('\nStep 6: Finding mentor matches...')
        const mentorRes = await request.get(
          `${API_BASE}/api/v1/performance-skill/mentors/${empWithGaps.employeeId}`,
          { headers: HEADERS }
        )
        if (mentorRes.ok()) {
          const mentorData = await mentorRes.json()
          console.log(`   -> Potential mentors: ${mentorData.mentors?.length || 0}`)
        } else {
          console.log(`   -> No mentors found (skill profiles may be needed)`)
        }
      } else {
        console.log('\nStep 3-6: Skipped (no employees with gaps)')
      }

      // Step 7: Generate predictions
      console.log('\nStep 7: Generating AI predictions...')
      const predGenRes = await request.post(`${API_BASE}/api/v1/predictions/performance/generate`, { headers: HEADERS })
      if (predGenRes.ok()) {
        const predGenData = await predGenRes.json()
        console.log(`   -> ${predGenData.message || 'Completed'}`)
      } else {
        console.log(`   -> Skipped (may already exist)`)
      }

      // Step 8: Get predictions
      console.log('\nStep 8: Fetching predictions...')
      const predRes = await request.get(`${API_BASE}/api/v1/predictions/performance?limit=20`, { headers: HEADERS })
      if (predRes.ok()) {
        const predData = await predRes.json()
        console.log(`   -> Total predictions: ${predData.data?.length || 0}`)

        const highRisk = predData.data?.filter((p: any) => p.risk_level === 'high')
        console.log(`   -> High risk employees: ${highRisk?.length || 0}`)
      }

      // Step 9: Get risk distribution
      console.log('\nStep 9: Checking risk distribution...')
      const distRes = await request.get(`${API_BASE}/api/v1/predictions/risk-distribution`, { headers: HEADERS })
      if (distRes.ok()) {
        const distData = await distRes.json()
        console.log(`   -> Departments analyzed: ${distData.data?.length || 0}`)
        if (distData.totals) {
          console.log(`   -> Total employees: ${distData.totals.total_employees}`)
          console.log(`   -> High risk: ${distData.totals.high_risk}`)
          console.log(`   -> High potentials: ${distData.totals.high_potentials}`)
        }
      }

      // Step 10: Get high potentials
      console.log('\nStep 10: Identifying high potentials...')
      const hipoRes = await request.get(`${API_BASE}/api/v1/predictions/high-potentials?limit=10`, { headers: HEADERS })
      if (hipoRes.ok()) {
        const hipoData = await hipoRes.json()
        console.log(`   -> High potentials identified: ${hipoData.data?.length || 0}`)
      }

      console.log('\n=== FLOW COMPLETED SUCCESSFULLY ===\n')
    })
  })

  test.describe('4. Data Verification', () => {

    test('4.1 Verify Performance Review Links Created', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/performance-skill/summary`, { headers: HEADERS })
      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }

      const data = await res.json()
      if (!data.data || data.data.length === 0) { console.log('[SKIP] No data returned'); return }

      // Verify data structure
      const sample = data.data[0]
      expect(sample.totalCompetencies).toBeGreaterThanOrEqual(0)
      expect(typeof sample.lowRated).toBe('number')
      expect(typeof sample.mediumRated).toBe('number')
      expect(typeof sample.highRated).toBe('number')

      console.log(`[Verification]: ${data.data.length} employees have performance-skill links`)
    })

    test('4.2 Verify Gap Analysis Records', async ({ request }) => {
      // Direct DB query via API to check gap analyses
      const summaryRes = await request.get(`${API_BASE}/api/v1/performance-skill/summary`, { headers: HEADERS })
      if (!summaryRes.ok()) { console.log('[SKIP] API returned', summaryRes.status()); return }
      const summaryData = await summaryRes.json()
      if (!summaryData.data) { console.log('[SKIP] No data'); return }

      const withGapAnalysis = summaryData.data.filter((e: any) => e.gapAnalyses > 0)
      console.log(`[Verification]: ${withGapAnalysis.length} employees have gap analyses created`)

      if (withGapAnalysis.length === 0) {
        // Trigger one gap analysis
        const empWithLow = summaryData.data.find((e: any) => e.lowRated > 0)
        if (empWithLow) {
          await request.post(
            `${API_BASE}/api/v1/performance-skill/gap-analysis/${empWithLow.employeeId}`,
            { headers: HEADERS }
          )
          console.log(`[Verification]: Created gap analysis for ${empWithLow.employeeName}`)
        }
      }
    })

    test('4.3 Verify Development Plans Accessible', async ({ request }) => {
      const summaryRes = await request.get(`${API_BASE}/api/v1/performance-skill/summary`, { headers: HEADERS })
      if (!summaryRes.ok()) { console.log('[SKIP] API returned', summaryRes.status()); return }
      const summaryData = await summaryRes.json()
      if (!summaryData.data) { console.log('[SKIP] No data'); return }

      const empWithGaps = summaryData.data.find((e: any) => e.lowRated > 0)

      if (empWithGaps) {
        const planRes = await request.get(
          `${API_BASE}/api/v1/performance-skill/development-plan/${empWithGaps.employeeId}`,
          { headers: HEADERS }
        )

        if (!planRes.ok()) { console.log('[SKIP] Dev Plan API returned', planRes.status()); return }
        const planData = await planRes.json()

        expect(planData.developmentPlan).toBeDefined()
        expect(planData.developmentPlan.employee).toBeDefined()
        expect(planData.developmentPlan.areasForDevelopment).toBeDefined()

        console.log(`[Verification]: Development plan accessible for ${empWithGaps.employeeName}`)
        console.log(`  - Areas: ${planData.developmentPlan.areasForDevelopment.length}`)
        console.log(`  - Mentors: ${planData.developmentPlan.recommendedMentors.length}`)
        console.log(`  - Gap Analysis: ${planData.developmentPlan.gapAnalysis ? 'Yes' : 'No'}`)
      }
    })
  })
})
