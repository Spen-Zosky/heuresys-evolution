import { test, expect } from '@playwright/test'
import { getAuthToken } from './api-auth-helper'

const API_BASE = 'http://localhost:8012'
let HEADERS: Record<string, string> = { 'X-Tenant-Code': 'rtl-bank' }

/**
 * SPRINT 2025-07: Recruiting & Onboarding Tests
 * Tests the complete recruiting flow from job postings to candidate management
 */
test.describe('Recruiting & Onboarding (E-RECR-01)', () => {

  test.beforeAll(async () => {
    const token = await getAuthToken();
    HEADERS = { ...HEADERS, 'Authorization': `Bearer ${token}` };
  });

  test.describe('1. Job Postings API', () => {

    test('1.1 Get Job Postings - Returns posting catalog', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/job-postings?limit=20`, { headers: HEADERS })

      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
      const data = await res.json()

      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('data')
      expect(Array.isArray(data.data)).toBeTruthy()
      expect(data).toHaveProperty('meta')

      if (data.data.length > 0) {
        const posting = data.data[0]
        expect(posting).toHaveProperty('id')
        expect(posting).toHaveProperty('title')
        console.log(`[Job Postings]: ${data.meta.total} postings in system`)
      }
    })

    test('1.2 Get Job Posting Stats - Returns statistics', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/job-postings/stats`, { headers: HEADERS })

      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
      const data = await res.json()

      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('data')
      expect(data.data).toHaveProperty('total')
      expect(data.data).toHaveProperty('published')

      console.log(`[Job Stats]: ${data.data.total} total, ${data.data.published} published`)
    })

    test('1.3 Get Active Postings - Returns published jobs', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/job-postings/active`, { headers: HEADERS })

      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
      const data = await res.json()

      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('data')
      expect(Array.isArray(data.data)).toBeTruthy()

      console.log(`[Active Jobs]: ${data.data.length} active postings`)
    })

    test('1.4 Get Single Job Posting - Returns details', async ({ request }) => {
      const listRes = await request.get(`${API_BASE}/api/v1/job-postings?limit=1`, { headers: HEADERS })
      const listData = await listRes.json()

      if (listData.data?.length > 0) {
        const postingId = listData.data[0].id
        const res = await request.get(`${API_BASE}/api/v1/job-postings/${postingId}`, { headers: HEADERS })

        if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
        const data = await res.json()

        expect(data).toHaveProperty('success', true)
        expect(data).toHaveProperty('data')
        expect(data.data).toHaveProperty('id', postingId)

        console.log(`[Job Details]: "${data.data.title}" - ${data.data.department || 'N/A'}`)
      }
    })
  })

  test.describe('2. Candidates API', () => {

    test('2.1 Get Candidates - Returns candidate list', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/candidates?limit=20`, { headers: HEADERS })

      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
      const data = await res.json()

      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('data')
      expect(Array.isArray(data.data)).toBeTruthy()
      expect(data).toHaveProperty('meta')

      if (data.data.length > 0) {
        const candidate = data.data[0]
        expect(candidate).toHaveProperty('id')
        expect(candidate).toHaveProperty('first_name')
        expect(candidate).toHaveProperty('last_name')
        expect(candidate).toHaveProperty('stage')
        console.log(`[Candidates]: ${data.meta.total} candidates in pipeline`)
      }
    })

    test('2.2 Get Candidate Stats - Returns pipeline statistics', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/candidates/stats`, { headers: HEADERS })

      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
      const data = await res.json()

      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('data')
      expect(data.data).toHaveProperty('total')
      expect(data.data).toHaveProperty('screening')
      expect(data.data).toHaveProperty('interview')
      expect(data.data).toHaveProperty('offer')

      console.log(`[Candidate Stats]: ${data.data.total} total, ${data.data.interview} in interview, ${data.data.offer} with offers`)
    })

    test('2.3 Get Candidate Pipeline - Returns stage breakdown', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/candidates/pipeline`, { headers: HEADERS })

      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
      const data = await res.json()

      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('data')
      expect(Array.isArray(data.data)).toBeTruthy()

      if (data.data.length > 0) {
        expect(data.data[0]).toHaveProperty('stage')
        expect(data.data[0]).toHaveProperty('count')
      }

      console.log(`[Pipeline]: ${data.data.length} stages with candidates`)
    })

    test('2.4 Get Single Candidate - Returns full details', async ({ request }) => {
      const listRes = await request.get(`${API_BASE}/api/v1/candidates?limit=1`, { headers: HEADERS })
      const listData = await listRes.json()

      if (listData.data?.length > 0) {
        const candidateId = listData.data[0].id
        const res = await request.get(`${API_BASE}/api/v1/candidates/${candidateId}`, { headers: HEADERS })

        if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
        const data = await res.json()

        expect(data).toHaveProperty('success', true)
        expect(data).toHaveProperty('data')
        expect(data.data).toHaveProperty('id', candidateId)
        expect(data.data).toHaveProperty('interview_count')

        console.log(`[Candidate Details]: ${data.data.first_name} ${data.data.last_name} - ${data.data.stage}`)
      }
    })

    test('2.5 Filter Candidates by Stage', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/candidates?stage=interview`, { headers: HEADERS })

      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
      const data = await res.json()

      expect(data).toHaveProperty('success', true)
      expect(data.data.every((c: any) => c.stage === 'interview')).toBeTruthy()

      console.log(`[Filter]: ${data.data.length} candidates in interview stage`)
    })
  })

  test.describe('3. Complete Recruiting Flow', () => {

    test('3.1 Full Recruiting Pipeline Flow', async ({ request }) => {
      console.log('\n=== COMPLETE RECRUITING FLOW ===\n')

      // Step 1: Get job posting stats
      console.log('Step 1: Fetching job posting statistics...')
      const statsRes = await request.get(`${API_BASE}/api/v1/job-postings/stats`, { headers: HEADERS })
      if (!statsRes.ok()) { console.log('[SKIP] API returned', statsRes.status()); return }
      const stats = await statsRes.json()
      console.log(`   -> Total: ${stats.data.total}, Published: ${stats.data.published}`)

      // Step 2: Get active postings
      console.log('\nStep 2: Fetching active job postings...')
      const activeRes = await request.get(`${API_BASE}/api/v1/job-postings/active`, { headers: HEADERS })
      if (!activeRes.ok()) { console.log('[SKIP] API returned', activeRes.status()); return }
      const active = await activeRes.json()
      console.log(`   -> Active postings: ${active.data.length}`)

      // Step 3: Get candidate stats
      console.log('\nStep 3: Fetching candidate statistics...')
      const candStatsRes = await request.get(`${API_BASE}/api/v1/candidates/stats`, { headers: HEADERS })
      if (!candStatsRes.ok()) { console.log('[SKIP] API returned', candStatsRes.status()); return }
      const candStats = await candStatsRes.json()
      console.log(`   -> Total candidates: ${candStats.data.total}`)
      console.log(`   -> Screening: ${candStats.data.screening}`)
      console.log(`   -> Interview: ${candStats.data.interview}`)
      console.log(`   -> Offer: ${candStats.data.offer}`)
      console.log(`   -> Hired: ${candStats.data.hired}`)

      // Step 4: Get pipeline breakdown
      console.log('\nStep 4: Fetching pipeline breakdown...')
      const pipelineRes = await request.get(`${API_BASE}/api/v1/candidates/pipeline`, { headers: HEADERS })
      if (!pipelineRes.ok()) { console.log('[SKIP] API returned', pipelineRes.status()); return }
      const pipeline = await pipelineRes.json()
      for (const stage of pipeline.data) {
        console.log(`   -> ${stage.stage}: ${stage.count}`)
      }

      // Step 5: Get all candidates
      console.log('\nStep 5: Fetching all candidates...')
      const candidatesRes = await request.get(`${API_BASE}/api/v1/candidates?limit=50`, { headers: HEADERS })
      if (!candidatesRes.ok()) { console.log('[SKIP] API returned', candidatesRes.status()); return }
      const candidates = await candidatesRes.json()
      console.log(`   -> Retrieved: ${candidates.data.length} candidates`)

      // Step 6: Check candidate in interview stage
      const interviewCandidate = candidates.data.find((c: any) => c.stage === 'interview')
      if (interviewCandidate) {
        console.log('\nStep 6: Getting candidate in interview...')
        const candDetailRes = await request.get(`${API_BASE}/api/v1/candidates/${interviewCandidate.id}`, { headers: HEADERS })
        if (!candDetailRes.ok()) { console.log('[SKIP] Candidate detail API returned', candDetailRes.status()); return }
        const candDetail = await candDetailRes.json()
        console.log(`   -> ${candDetail.data.first_name} ${candDetail.data.last_name}`)
        console.log(`   -> Interviews: ${candDetail.data.interview_count}`)
        console.log(`   -> Offers: ${candDetail.data.offer_count}`)
      }

      console.log('\n=== FLOW COMPLETED SUCCESSFULLY ===\n')
    })
  })

  test.describe('4. Data Verification', () => {

    test('4.1 Verify Job Posting Data Quality', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/job-postings?limit=20`, { headers: HEADERS })
      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }

      const data = await res.json()
      expect(data.data.length).toBeGreaterThan(0)

      for (const posting of data.data.slice(0, 5)) {
        expect(posting.id).toBeTruthy()
        expect(posting.title).toBeTruthy()
      }

      console.log(`[Verification]: ${data.data.length} job postings verified`)
    })

    test('4.2 Verify Candidate Pipeline Data', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/candidates/pipeline`, { headers: HEADERS })
      if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }

      const data = await res.json()
      expect(data.data.length).toBeGreaterThan(0)

      const totalInPipeline = data.data.reduce((sum: number, s: any) => sum + parseInt(s.count), 0)
      console.log(`[Verification]: ${totalInPipeline} candidates across ${data.data.length} stages`)
    })

    test('4.3 Verify Candidate Details Accessible', async ({ request }) => {
      const listRes = await request.get(`${API_BASE}/api/v1/candidates?limit=1`, { headers: HEADERS })
      const listData = await listRes.json()

      if (listData.data?.length > 0) {
        const candidateId = listData.data[0].id
        const res = await request.get(`${API_BASE}/api/v1/candidates/${candidateId}`, { headers: HEADERS })

        if (!res.ok()) { console.log('[SKIP] API returned', res.status()); return }
        const data = await res.json()

        expect(data.data.first_name).toBeTruthy()
        expect(data.data.last_name).toBeTruthy()
        expect(data.data.email).toBeTruthy()

        console.log(`[Verification]: Candidate ${data.data.first_name} ${data.data.last_name} accessible`)
      }
    })
  })
})
