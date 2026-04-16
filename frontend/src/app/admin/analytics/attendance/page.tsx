'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Calendar,
  ArrowLeft,
  Download,
  RefreshCw,
  Users,
  Timer,
  CalendarCheck,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BaseBarChart, BaseLineChart, HeatmapChart, BasePieChart } from '@/components/charts';
import { api, apiClient } from '@/lib/api';
import type { OrgUnit } from '@/lib/api/types';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface AttendanceData {
  absenceRate: number;
  avgSickDays: number;
  avgVacationDays: number;
  overtimeHours: number;
  overtimeCost: number;
  [key: string]: string | number | undefined;
}

interface MonthlyAttendance {
  month: string;
  absenceRate: number;
  sickDays: number;
  vacationDays: number;
  overtimeHours: number;
  [key: string]: string | number;
}

interface LeaveBalance {
  type: string;
  entitled: number;
  used: number;
  remaining: number;
  utilizationRate: number;
  [key: string]: string | number;
}

// ============================================
// ANIMATION VARIANTS
// ============================================

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// ============================================
// API RESPONSE TYPE
// ============================================

interface AttendanceApiResponse {
  summary: AttendanceData;
  monthly: MonthlyAttendance[];
  heatmap: { x: string; y: string; value: number }[];
  leaveBalances: LeaveBalance[];
  overtimeByDepartment: {
    name: string;
    hours: number;
    cost: number;
    [key: string]: string | number;
  }[];
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  hours_regular?: string | number;
  hours_overtime?: string | number;
  hours_total?: string | number;
  status?: string;
  [key: string]: unknown;
}

// ============================================
// ATTENDANCE ANALYTICS PAGE
// ============================================

export default function AttendanceAnalyticsPage() {
  const t = useTranslations('admin.analytics.attendance');
  const [isLoading, setIsLoading] = useState(true);
  const [departments, setDepartments] = useState<OrgUnit[]>([]);
  const [timeRange, setTimeRange] = useState<string>('12');
  const [attendanceData, setAttendanceData] = useState<AttendanceData>({
    absenceRate: 0,
    avgSickDays: 0,
    avgVacationDays: 0,
    overtimeHours: 0,
    overtimeCost: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyAttendance[]>([]);
  const [heatmapData, setHeatmapData] = useState<{ x: string; y: string; value: number }[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [overtimeByDept, setOvertimeByDept] = useState<
    { name: string; hours: number; cost: number; [key: string]: string | number }[]
  >([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [attendanceResp, depts] = await Promise.all([
          apiClient
            .get<{
              success: boolean;
              data: AttendanceApiResponse | AttendanceRecord[];
            }>('/api/v1/analytics/attendance')
            .catch(() => ({ data: null })),
          api.orgUnits.getOrgUnits(),
        ]);
        setDepartments(depts);
        if (attendanceResp?.data) {
          const d = attendanceResp.data as AttendanceApiResponse & { summary?: AttendanceData };
          if (d.summary && !Array.isArray(attendanceResp.data)) {
            // Already in analytics shape
            setAttendanceData(
              d.summary || {
                absenceRate: 0,
                avgSickDays: 0,
                avgVacationDays: 0,
                overtimeHours: 0,
                overtimeCost: 0,
              }
            );
            setMonthlyData(d.monthly || []);
            setHeatmapData(d.heatmap || []);
            setLeaveBalances(d.leaveBalances || []);
            setOvertimeByDept(d.overtimeByDepartment || []);
          } else if (Array.isArray(attendanceResp.data)) {
            // Raw CRUD records — derive summary from available data
            const records = attendanceResp.data as AttendanceRecord[];
            const totalOvertimeHours = records.reduce(
              (sum, r) => sum + Number(r.hours_overtime ?? 0),
              0
            );
            setAttendanceData({
              absenceRate: 0,
              avgSickDays: 0,
              avgVacationDays: 0,
              overtimeHours: Math.round(totalOvertimeHours),
              overtimeCost: 0,
            });
            setMonthlyData([]);
            setHeatmapData([]);
            setLeaveBalances([]);
            setOvertimeByDept([]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch attendance data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Chart data
  const leaveTypeData = leaveBalances
    .filter((l) => l.entitled > 0 || l.used > 0)
    .map((l) => ({
      name: l.type,
      value: l.used,
    }));

  const daysCategories = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven'];
  const deptCategories = departments.slice(0, 6).map((d) => d.name.substring(0, 12));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" aria-label="Go back" asChild>
            <Link href="/admin/analytics">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Clock className="h-6 w-6 text-orange-500" />
              Time & Attendance Analytics
            </h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Ultimi 3 mesi</SelectItem>
              <SelectItem value="6">Ultimi 6 mesi</SelectItem>
              <SelectItem value="12">Ultimi 12 mesi</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="Aggiorna dati presenze">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Esporta
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Tasso Assenza</span>
                  </div>
                  <p className="text-2xl font-bold">{attendanceData.absenceRate}%</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CalendarCheck className="h-4 w-4" />
                    <span className="text-sm">Giorni Malattia Medi</span>
                  </div>
                  <p className="text-2xl font-bold">{attendanceData.avgSickDays}</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Timer className="h-4 w-4" />
                    <span className="text-sm">Ore Straordinario</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {attendanceData.overtimeHours.toLocaleString('it-IT')}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Costo Straordinari</span>
                  </div>
                  <p className="text-2xl font-bold">
                    €{(attendanceData.overtimeCost / 1000).toFixed(0)}k
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Trend Assenze Mensile</CardTitle>
              <CardDescription>Tasso di assenza nel tempo</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <BaseLineChart
                  data={monthlyData}
                  xAxisKey="month"
                  height={280}
                  lines={[{ dataKey: 'absenceRate', name: 'Tasso Assenza %', areaFill: true }]}
                  formatYAxis={(v) => `${v}%`}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Straordinari per Dipartimento</CardTitle>
              <CardDescription>Ore di straordinario accumulate</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <BaseBarChart
                  data={overtimeByDept}
                  xAxisKey="name"
                  height={280}
                  layout="vertical"
                  bars={[{ dataKey: 'hours', name: 'Ore' }]}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Heatmap */}
      <motion.div variants={staggerItem} initial="hidden" animate="show">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Heatmap Assenze</CardTitle>
            <CardDescription>
              Tasso di assenza per giorno della settimana e dipartimento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <HeatmapChart
                data={heatmapData}
                xCategories={daysCategories}
                yCategories={deptCategories}
                height={300}
                formatValue={(v) => `${v}%`}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Distribuzione Tipologie Assenze</CardTitle>
              <CardDescription>Giorni utilizzati per tipologia</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <BasePieChart
                  data={leaveTypeData}
                  height={280}
                  innerRadius={50}
                  outerRadius={90}
                  showLegend={true}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem} initial="hidden" animate="show">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Leave Balance Summary</CardTitle>
              <CardDescription>Riepilogo saldi ferie e permessi</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium">Tipo</th>
                        <th className="text-right py-2 px-2 font-medium">Spettanti</th>
                        <th className="text-right py-2 px-2 font-medium">Usati</th>
                        <th className="text-right py-2 px-2 font-medium">Residui</th>
                        <th className="text-right py-2 px-2 font-medium">Utilizzo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveBalances.map((leave) => (
                        <tr key={leave.type} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-medium">{leave.type}</td>
                          <td className="text-right py-2 px-2">
                            {leave.entitled > 0 ? leave.entitled : '-'}
                          </td>
                          <td className="text-right py-2 px-2">{leave.used}</td>
                          <td className="text-right py-2 px-2">
                            {leave.remaining > 0 ? leave.remaining : '-'}
                          </td>
                          <td className="text-right py-2 px-2">
                            {leave.utilizationRate > 0 ? (
                              <Badge
                                variant={leave.utilizationRate >= 80 ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {leave.utilizationRate}%
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
