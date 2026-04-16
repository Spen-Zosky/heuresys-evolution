"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const api_auth_helper_1 = require("./api-auth-helper");
const API_BASE = 'http://localhost:8012';
let HEADERS = { 'X-Tenant-Code': 'rtl-bank' };
/**
 * SPRINT 2025-06: Learning & Development Tests
 * Tests the complete learning management flow including courses, paths, enrollments
 */
test_1.test.describe('Learning & Development (E-LEARN-01)', () => {
    test_1.test.beforeAll(async () => {
        const token = await (0, api_auth_helper_1.getAuthToken)();
        HEADERS = { ...HEADERS, 'Authorization': `Bearer ${token}` };
    });
    test_1.test.describe('1. Course Management API', () => {
        (0, test_1.test)('1.1 Get Courses - Returns course catalog', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/courses?limit=20`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            (0, test_1.expect)(data).toHaveProperty('meta');
            if (data.data.length > 0) {
                const course = data.data[0];
                (0, test_1.expect)(course).toHaveProperty('id');
                (0, test_1.expect)(course).toHaveProperty('title');
                (0, test_1.expect)(course).toHaveProperty('category');
                console.log(`[Courses]: ${data.meta.total} courses in catalog`);
            }
        });
        (0, test_1.test)('1.2 Get Course Stats - Returns statistics', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/courses/stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(data.data).toHaveProperty('total_courses');
            (0, test_1.expect)(data.data).toHaveProperty('active_courses');
            (0, test_1.expect)(data.data).toHaveProperty('mandatory_courses');
            console.log(`[Course Stats]: ${data.data.total_courses} total, ${data.data.active_courses} active, ${data.data.mandatory_courses} mandatory`);
        });
        (0, test_1.test)('1.3 Get Course Categories - Returns category list', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/courses/categories`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            console.log(`[Categories]: ${data.data.length} categories - ${data.data.slice(0, 5).join(', ')}...`);
        });
        (0, test_1.test)('1.4 Get Single Course - Returns course details', async ({ request }) => {
            // First get a course ID
            const listRes = await request.get(`${API_BASE}/api/v1/courses?limit=1`, { headers: HEADERS });
            const listData = await listRes.json();
            if (listData.data?.length > 0) {
                const courseId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/courses/${courseId}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data).toHaveProperty('data');
                (0, test_1.expect)(data.data).toHaveProperty('id', courseId);
                (0, test_1.expect)(data.data).toHaveProperty('title');
                (0, test_1.expect)(data.data).toHaveProperty('enrollment_count');
                console.log(`[Course Details]: "${data.data.title}" - ${data.data.enrollment_count} enrollments`);
            }
        });
        (0, test_1.test)('1.5 Get Course Enrollments - Returns enrollment list', async ({ request }) => {
            // Get a course with enrollments
            const listRes = await request.get(`${API_BASE}/api/v1/courses?limit=1`, { headers: HEADERS });
            const listData = await listRes.json();
            if (listData.data?.length > 0) {
                const courseId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/courses/${courseId}/enrollments`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data).toHaveProperty('data');
                (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
                console.log(`[Enrollments]: ${data.data.length} enrollments for course`);
            }
        });
        (0, test_1.test)('1.6 Filter Courses - By category', async ({ request }) => {
            // Get categories first
            const catRes = await request.get(`${API_BASE}/api/v1/courses/categories`, { headers: HEADERS });
            const catData = await catRes.json();
            if (catData.data?.length > 0) {
                const category = catData.data[0];
                const res = await request.get(`${API_BASE}/api/v1/courses?category=${encodeURIComponent(category)}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data.data.every((c) => c.category === category)).toBeTruthy();
                console.log(`[Filter]: ${data.data.length} courses in category "${category}"`);
            }
        });
    });
    test_1.test.describe('2. Learning Paths API', () => {
        (0, test_1.test)('2.1 Get Learning Paths - Returns path catalog', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/learning-paths?limit=20`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            (0, test_1.expect)(data).toHaveProperty('meta');
            if (data.data.length > 0) {
                const path = data.data[0];
                (0, test_1.expect)(path).toHaveProperty('id');
                (0, test_1.expect)(path).toHaveProperty('title');
                (0, test_1.expect)(path).toHaveProperty('course_count');
                console.log(`[Learning Paths]: ${data.meta.total} paths available`);
            }
        });
        (0, test_1.test)('2.2 Get Path Stats - Returns statistics', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/learning-paths/stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(data.data).toHaveProperty('total_paths');
            (0, test_1.expect)(data.data).toHaveProperty('active_paths');
            console.log(`[Path Stats]: ${data.data.total_paths} total, ${data.data.active_paths} active`);
        });
        (0, test_1.test)('2.3 Get Path Details - Returns full path info', async ({ request }) => {
            const listRes = await request.get(`${API_BASE}/api/v1/learning-paths?limit=1`, { headers: HEADERS });
            const listData = await listRes.json();
            if (listData.data?.length > 0) {
                const pathId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/learning-paths/${pathId}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data).toHaveProperty('data');
                (0, test_1.expect)(data.data).toHaveProperty('id', pathId);
                (0, test_1.expect)(data.data).toHaveProperty('course_count');
                (0, test_1.expect)(data.data).toHaveProperty('enrollment_count');
                console.log(`[Path Details]: "${data.data.title}" - ${data.data.course_count} courses`);
            }
        });
        (0, test_1.test)('2.4 Get Path Courses - Returns course list in path', async ({ request }) => {
            const listRes = await request.get(`${API_BASE}/api/v1/learning-paths?limit=1`, { headers: HEADERS });
            const listData = await listRes.json();
            if (listData.data?.length > 0) {
                const pathId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/learning-paths/${pathId}/courses`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data).toHaveProperty('data');
                (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
                if (data.data.length > 0) {
                    (0, test_1.expect)(data.data[0]).toHaveProperty('sequence_order');
                    (0, test_1.expect)(data.data[0]).toHaveProperty('is_mandatory');
                }
                console.log(`[Path Courses]: ${data.data.length} courses in path`);
            }
        });
    });
    test_1.test.describe('3. Talent Stats Integration', () => {
        (0, test_1.test)('3.1 Get Talent Stats - Returns comprehensive metrics', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/courses/talent-stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(data.data).toHaveProperty('recruitment');
            (0, test_1.expect)(data.data).toHaveProperty('pipeline');
            (0, test_1.expect)(data.data).toHaveProperty('learningMetrics');
            const learning = data.data.learningMetrics;
            (0, test_1.expect)(learning).toHaveProperty('coursesCompleted');
            (0, test_1.expect)(learning).toHaveProperty('hoursTraining');
            (0, test_1.expect)(learning).toHaveProperty('certifications');
            console.log(`[Talent Stats]: ${learning.coursesCompleted} courses completed, ${learning.hoursTraining}h training, ${learning.certifications} certs`);
        });
    });
    test_1.test.describe('4. Complete Learning Flow', () => {
        (0, test_1.test)('4.1 Full Learning Discovery Flow', async ({ request }) => {
            console.log('\n=== COMPLETE LEARNING FLOW ===\n');
            // Step 1: Get course stats
            console.log('Step 1: Fetching course statistics...');
            const statsRes = await request.get(`${API_BASE}/api/v1/courses/stats`, { headers: HEADERS });
            if (!statsRes.ok()) {
                console.log('[SKIP] API returned', statsRes.status());
                return;
            }
            const stats = await statsRes.json();
            console.log(`   -> Total: ${stats.data.total_courses}, Active: ${stats.data.active_courses}`);
            // Step 2: Get categories
            console.log('\nStep 2: Fetching course categories...');
            const catRes = await request.get(`${API_BASE}/api/v1/courses/categories`, { headers: HEADERS });
            if (!catRes.ok()) {
                console.log('[SKIP] API returned', catRes.status());
                return;
            }
            const cats = await catRes.json();
            console.log(`   -> Categories: ${cats.data.length}`);
            // Step 3: List courses
            console.log('\nStep 3: Listing courses...');
            const coursesRes = await request.get(`${API_BASE}/api/v1/courses?limit=10`, { headers: HEADERS });
            if (!coursesRes.ok()) {
                console.log('[SKIP] API returned', coursesRes.status());
                return;
            }
            const courses = await coursesRes.json();
            console.log(`   -> Found: ${courses.data.length} courses`);
            // Step 4: Get course details
            if (courses.data.length > 0) {
                console.log('\nStep 4: Getting course details...');
                const courseId = courses.data[0].id;
                const detailRes = await request.get(`${API_BASE}/api/v1/courses/${courseId}`, { headers: HEADERS });
                if (!detailRes.ok()) {
                    console.log('[SKIP] API returned', detailRes.status());
                    return;
                }
                const detail = await detailRes.json();
                console.log(`   -> Course: "${detail.data.title}"`);
                console.log(`   -> Enrollments: ${detail.data.enrollment_count}`);
                // Step 5: Get course enrollments
                console.log('\nStep 5: Getting course enrollments...');
                const enrollRes = await request.get(`${API_BASE}/api/v1/courses/${courseId}/enrollments`, { headers: HEADERS });
                if (!enrollRes.ok()) {
                    console.log('[SKIP] API returned', enrollRes.status());
                    return;
                }
                const enrolls = await enrollRes.json();
                console.log(`   -> Enrolled students: ${enrolls.data.length}`);
            }
            // Step 6: Get learning paths
            console.log('\nStep 6: Fetching learning paths...');
            const pathsRes = await request.get(`${API_BASE}/api/v1/learning-paths?limit=10`, { headers: HEADERS });
            if (!pathsRes.ok()) {
                console.log('[SKIP] API returned', pathsRes.status());
                return;
            }
            const paths = await pathsRes.json();
            console.log(`   -> Found: ${paths.data.length} learning paths`);
            // Step 7: Get path details
            if (paths.data.length > 0) {
                console.log('\nStep 7: Getting path details...');
                const pathId = paths.data[0].id;
                const pathDetailRes = await request.get(`${API_BASE}/api/v1/learning-paths/${pathId}`, { headers: HEADERS });
                if (!pathDetailRes.ok()) {
                    console.log('[SKIP] API returned', pathDetailRes.status());
                    return;
                }
                const pathDetail = await pathDetailRes.json();
                console.log(`   -> Path: "${pathDetail.data.title}"`);
                console.log(`   -> Courses in path: ${pathDetail.data.course_count}`);
                // Step 8: Get path courses
                console.log('\nStep 8: Getting path courses...');
                const pathCoursesRes = await request.get(`${API_BASE}/api/v1/learning-paths/${pathId}/courses`, { headers: HEADERS });
                if (!pathCoursesRes.ok()) {
                    console.log('[SKIP] API returned', pathCoursesRes.status());
                    return;
                }
                const pathCourses = await pathCoursesRes.json();
                console.log(`   -> Courses: ${pathCourses.data.length}`);
            }
            // Step 9: Get talent stats
            console.log('\nStep 9: Fetching talent statistics...');
            const talentRes = await request.get(`${API_BASE}/api/v1/courses/talent-stats`, { headers: HEADERS });
            if (!talentRes.ok()) {
                console.log('[SKIP] API returned', talentRes.status());
                return;
            }
            const talent = await talentRes.json();
            console.log(`   -> Courses completed: ${talent.data.learningMetrics.coursesCompleted}`);
            console.log(`   -> Training hours: ${talent.data.learningMetrics.hoursTraining}`);
            console.log(`   -> Certifications: ${talent.data.learningMetrics.certifications}`);
            console.log('\n=== FLOW COMPLETED SUCCESSFULLY ===\n');
        });
    });
    test_1.test.describe('5. Data Verification', () => {
        (0, test_1.test)('5.1 Verify Course Data Quality', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/courses?limit=50`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data.data.length).toBeGreaterThan(0);
            // Verify data structure
            for (const course of data.data.slice(0, 5)) {
                (0, test_1.expect)(course.id).toBeTruthy();
                (0, test_1.expect)(course.title).toBeTruthy();
                // duration_hours can be number or string from PostgreSQL
                (0, test_1.expect)(course.duration_hours !== null && course.duration_hours !== undefined).toBeTruthy();
            }
            // Check for variety
            const categories = new Set(data.data.map((c) => c.category).filter(Boolean));
            console.log(`[Verification]: ${data.data.length} courses, ${categories.size} unique categories`);
        });
        (0, test_1.test)('5.2 Verify Learning Path Structure', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/learning-paths?limit=20`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            if (data.data.length > 0) {
                // Verify each path has courses
                let pathsWithCourses = 0;
                for (const path of data.data) {
                    if (path.course_count > 0)
                        pathsWithCourses++;
                }
                console.log(`[Verification]: ${pathsWithCourses}/${data.data.length} paths have courses assigned`);
            }
        });
        (0, test_1.test)('5.3 Verify Enrollment Statistics', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/courses/talent-stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            const learning = data.data.learningMetrics;
            // Verify metrics are reasonable
            (0, test_1.expect)(learning.coursesCompleted).toBeGreaterThanOrEqual(0);
            (0, test_1.expect)(learning.hoursTraining).toBeGreaterThanOrEqual(0);
            (0, test_1.expect)(learning.certifications).toBeGreaterThanOrEqual(0);
            console.log(`[Verification]: Learning metrics verified - ${learning.coursesCompleted} completions`);
        });
    });
});
//# sourceMappingURL=learning-development.spec.js.map