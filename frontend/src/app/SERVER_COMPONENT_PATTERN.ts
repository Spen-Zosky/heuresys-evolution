/**
 * SERVER COMPONENT PATTERN — Template
 *
 * This file demonstrates the recommended Next.js App Router pattern
 * for data-fetching pages in Heuresys:
 *
 *   page.tsx (Server Component) → fetches data server-side
 *   PageClient.tsx (Client Component) → handles interactivity
 *
 * Benefits:
 * - No client-side loading spinners for initial data
 * - Better SEO (HTML rendered server-side)
 * - Smaller client JS bundle
 * - Automatic request deduplication
 *
 * Usage:
 *   1. Copy this pattern for new pages
 *   2. Gradually migrate existing 'use client' pages
 *   3. Keep PageClient.tsx focused on interactivity (filters, sort, modals)
 *
 * @example
 * // page.tsx (Server Component — NO 'use client')
 * import { PageClient } from './PageClient';
 *
 * async function fetchEmployees(params: SearchParams) {
 *   const res = await fetch(`${API_URL}/api/v1/employees?${qs}`, {
 *     headers: { Authorization: `Bearer ${token}` },
 *     next: { revalidate: 60 }, // ISR: revalidate every 60s
 *   });
 *   if (!res.ok) throw new Error('Failed to fetch');
 *   return res.json();
 * }
 *
 * export default async function EmployeesPage({ searchParams }: Props) {
 *   const data = await fetchEmployees(searchParams);
 *   return <PageClient initialData={data} />;
 * }
 *
 * // PageClient.tsx ('use client')
 * 'use client';
 * import { useState } from 'react';
 *
 * interface PageClientProps {
 *   initialData: EmployeeListResponse;
 * }
 *
 * export function PageClient({ initialData }: PageClientProps) {
 *   const [data, setData] = useState(initialData);
 *   const [filters, setFilters] = useState({});
 *   // ... interactive UI with client-side state
 * }
 */

export {};
