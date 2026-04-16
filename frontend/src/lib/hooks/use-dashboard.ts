'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiClientError, NetworkError } from '@/lib/api';
import type { TimeRange } from '@/components/dashboard/time-range-selector';

// ============================================================================
// Types
// ============================================================================

/** Standard API response wrapper used by dashboard endpoints */
interface DashboardApiResponse<T> {
  success: boolean;
  data: T;
}

export interface DashboardOverview {
  employees: {
    total_employees: number;
    active_employees: number;
    departments: number;
  };
  goals: {
    total_goals: number;
    completed_goals: number;
    in_progress_goals: number;
    avg_progress: number;
  };
  reviews: {
    total_reviews: number;
    completed_reviews: number;
    avg_rating: number;
  };
  learning: {
    total_courses: number;
    total_enrollments: number;
  };
  recognition: {
    total_recognitions: number;
    total_points: number;
  };
}

export interface HRMetrics {
  headcount_by_org_unit: Array<{ department: string; count: number }>;
  recruiting_pipeline: Array<{ stage: string; count: number }>;
  open_requisitions: number;
  pending_time_off: number;
}

export interface EngagementMetrics {
  survey_participation: Array<{
    title: string;
    total_invitations: number;
    responses: number;
    participation_rate: number;
  }>;
  recognition_activity: Array<{ week: string; count: number }>;
  wellbeing_trends: {
    avg_mood: number;
    avg_stress: number;
    avg_energy: number;
  };
  feedback_frequency: {
    last_7d: number;
    last_30d: number;
  };
}

export interface PerformanceMetrics {
  goal_completion: {
    completed: number;
    total: number;
    completion_rate: number;
  };
  reviews_by_type: Array<{
    review_type: string;
    total_reviews: number;
    completed: number;
  }>;
  rating_distribution: Array<{ rating_category: string; count: number }>;
  check_in_activity: {
    last_7d: number;
    last_30d: number;
    total: number;
  };
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface TrendsData {
  range: string;
  date_from: string;
  date_to: string;
  trends: {
    headcount: TrendPoint[];
    turnover_rate: TrendPoint[];
    new_hires: TrendPoint[];
    goals_completion: TrendPoint[];
    engagement: TrendPoint[];
    recognition: TrendPoint[];
  };
  summary: {
    current_headcount: number;
    new_hires_period: number;
    terminations_period: number;
  };
}

export interface TurnoverByDepartment {
  department: string;
  headcount: number;
  terminations: number;
  turnover_rate: number;
}

export interface TurnoverData {
  range: string;
  date_from: string;
  date_to: string;
  departments: TurnoverByDepartment[];
}

export interface DashboardData {
  overview: DashboardOverview | null;
  hrMetrics: HRMetrics | null;
  engagement: EngagementMetrics | null;
  performance: PerformanceMetrics | null;
  trends: TrendsData | null;
  turnover: TurnoverData | null;
}

export interface UseDashboardResult {
  data: DashboardData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Safely fetch a dashboard endpoint via apiClient.
 * Returns null on failure instead of throwing, to allow partial dashboard loads.
 * Auth errors (401) are still handled by apiClient (redirect to /login).
 */
async function safeDashboardFetch<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await apiClient.get<DashboardApiResponse<T>>(endpoint, {
      retries: 1,
    });
    return response.success ? response.data : null;
  } catch (error) {
    // Let auth errors propagate (apiClient already redirects on 401)
    if (error instanceof ApiClientError && error.status === 401) {
      throw error;
    }
    // Swallow other errors for graceful partial loading
    return null;
  }
}

// ============================================================================
// Custom Hook
// ============================================================================
export function useDashboard(timeRange: TimeRange = '30d'): UseDashboardResult {
  const [data, setData] = useState<DashboardData>({
    overview: null,
    hrMetrics: null,
    engagement: null,
    performance: null,
    trends: null,
    turnover: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all endpoints in parallel via apiClient
      const [overview, hrMetrics, engagement, performance, trends, turnover] = await Promise.all([
        safeDashboardFetch<DashboardOverview>('/api/v1/dashboard/overview'),
        safeDashboardFetch<HRMetrics>('/api/v1/dashboard/hr-metrics'),
        safeDashboardFetch<EngagementMetrics>('/api/v1/dashboard/engagement-metrics'),
        safeDashboardFetch<PerformanceMetrics>('/api/v1/dashboard/performance-metrics'),
        safeDashboardFetch<TrendsData>(`/api/v1/dashboard/trends?range=${timeRange}`),
        safeDashboardFetch<TurnoverData>(
          `/api/v1/dashboard/turnover-by-department?range=${timeRange}`
        ),
      ]);

      const newData: DashboardData = {
        overview,
        hrMetrics,
        engagement,
        performance,
        trends,
        turnover,
      };

      // Check if at least overview was successful
      if (!newData.overview) {
        setError('Impossibile caricare i dati della dashboard');
      }

      setData(newData);
    } catch (err) {
      // Auth errors are already handled by apiClient (redirect to /login)
      if (err instanceof ApiClientError && err.status === 401) {
        return;
      }
      console.error('Dashboard fetch error:', err);
      if (err instanceof NetworkError) {
        setError('Errore di connessione. Verifica la rete e riprova.');
      } else {
        setError('Errore di connessione. Verifica la rete e riprova.');
      }
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    data,
    loading,
    error,
    refetch: fetchDashboard,
  };
}

// ============================================================================
// Helper: Calculate trend from sparkline data
// ============================================================================
export function calculateTrendFromSparkline(data: TrendPoint[]): {
  change: number;
  trend: 'up' | 'down' | 'flat';
} {
  if (!data || data.length < 2) {
    return { change: 0, trend: 'flat' };
  }

  const recent = data.slice(-3).reduce((sum, p) => sum + p.value, 0) / 3;
  const earlier = data.slice(0, 3).reduce((sum, p) => sum + p.value, 0) / 3;

  if (earlier === 0) {
    return { change: 0, trend: 'flat' };
  }

  const change = ((recent - earlier) / earlier) * 100;

  return {
    change: Number(change.toFixed(1)),
    trend: change > 1 ? 'up' : change < -1 ? 'down' : 'flat',
  };
}

// ============================================================================
// Helper: Get last N values from trend for sparkline
// ============================================================================
export function getSparklineValues(data: TrendPoint[] | undefined, n: number = 7): number[] {
  if (!data || data.length === 0) {
    return [];
  }
  return data.slice(-n).map((p) => p.value);
}

// ============================================================================
// Legacy helper (kept for backwards compatibility)
// ============================================================================
export function calculateTrend(
  current: number,
  previous: number
): { change: number; trend: 'up' | 'down' | 'flat' } {
  if (previous === 0) {
    return { change: 0, trend: 'flat' };
  }
  const change = ((current - previous) / previous) * 100;
  return {
    change,
    trend: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'flat',
  };
}

export default useDashboard;
