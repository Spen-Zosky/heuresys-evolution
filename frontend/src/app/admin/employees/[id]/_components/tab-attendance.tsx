'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Calendar, Timer } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useStatusConfig } from '@/lib/hooks/use-entity-config';

interface TabProps {
  employeeId: string;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('it-IT');
}

function formatTime(t: string | null | undefined): string {
  if (!t) return '-';
  // Handle ISO datetime or time-only strings
  if (t.includes('T')) {
    return new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  return t.slice(0, 5);
}

function normalizeArray(response: unknown): any[] {
  if (!response || typeof response !== 'object') return [];
  const resp = response as Record<string, unknown>;
  const data = resp.data ?? resp;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'items' in (data as object)) {
    return ((data as Record<string, unknown>).items as any[]) || [];
  }
  return [];
}

export function TabAttendance({ employeeId }: TabProps) {
  const { getStatusConfig: getAttendanceStatus } = useStatusConfig('attendance');
  const { getStatusConfig: getTimeOffStatus } = useStatusConfig('time_off');
  const { getStatusConfig: getOvertimeStatus } = useStatusConfig('overtime');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [timeOff, setTimeOff] = useState<any[]>([]);
  const [overtime, setOvertime] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchAll = async () => {
      const errs: Record<string, string> = {};

      // Attendance
      try {
        const result = await apiClient.get(`/api/v1/attendance?employee_id=${employeeId}&limit=50`);
        setAttendance(normalizeArray(result));
      } catch {
        errs.attendance = 'Dati non disponibili';
      }

      // Time off — try admin filter first, then fall back to /my for self-service
      try {
        let result;
        try {
          result = await apiClient.get(`/api/v1/time-off/requests?employee_id=${employeeId}`);
        } catch {
          result = await apiClient.get('/api/v1/time-off/my/requests');
        }
        setTimeOff(normalizeArray(result));
      } catch {
        errs.timeOff = 'Dati non disponibili';
      }

      // Overtime
      try {
        const result = await apiClient.get(`/api/v1/overtime?employee_id=${employeeId}`);
        setOvertime(normalizeArray(result));
      } catch {
        errs.overtime = 'Dati non disponibili';
      }

      setErrors(errs);
      setLoading(false);
    };
    fetchAll();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Presenze Recenti */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Presenze Recenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.attendance ? (
            <p className="text-sm text-muted-foreground">{errors.attendance}</p>
          ) : attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun dato di presenza trovato</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Data</th>
                    <th className="pb-2 pr-4 font-medium">Ingresso</th>
                    <th className="pb-2 pr-4 font-medium">Uscita</th>
                    <th className="pb-2 pr-4 font-medium">Ore</th>
                    <th className="pb-2 font-medium">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a, idx) => {
                    const status = String(a.status || '-');
                    const rawHours = a.hours_total ?? a.hours_regular ?? a.hours_worked;
                    const hours = rawHours != null ? parseFloat(String(rawHours)).toFixed(1) : '-';
                    return (
                      <tr key={String(a.id || idx)} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          {formatDate((a.date as string) || (a.attendance_date as string))}
                        </td>
                        <td className="py-2 pr-4">
                          {formatTime((a.check_in as string) || (a.clock_in as string))}
                        </td>
                        <td className="py-2 pr-4">
                          {formatTime((a.check_out as string) || (a.clock_out as string))}
                        </td>
                        <td className="py-2 pr-4">{hours}</td>
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getAttendanceStatus(status).className}`}
                          >
                            {getAttendanceStatus(status).label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Richieste Ferie/Permessi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Richieste Ferie/Permessi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.timeOff ? (
            <p className="text-sm text-muted-foreground">{errors.timeOff}</p>
          ) : timeOff.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna richiesta trovata</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Tipo</th>
                    <th className="pb-2 pr-4 font-medium">Dal</th>
                    <th className="pb-2 pr-4 font-medium">Al</th>
                    <th className="pb-2 pr-4 font-medium">Giorni</th>
                    <th className="pb-2 font-medium">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {timeOff.map((t, idx) => {
                    const status = String(t.status || 'pending');
                    const days =
                      t.days != null
                        ? String(t.days)
                        : t.total_days != null
                          ? String(t.total_days)
                          : t.days_requested != null
                            ? String(t.days_requested)
                            : '-';
                    return (
                      <tr key={String(t.id || idx)} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          {String(t.type || t.leave_type || t.request_type || '-')}
                        </td>
                        <td className="py-2 pr-4">{formatDate(t.start_date as string)}</td>
                        <td className="py-2 pr-4">{formatDate(t.end_date as string)}</td>
                        <td className="py-2 pr-4">{days}</td>
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getTimeOffStatus(status).className}`}
                          >
                            {getTimeOffStatus(status).label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Straordinari */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-4 w-4" />
            Straordinari
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.overtime ? (
            <p className="text-sm text-muted-foreground">{errors.overtime}</p>
          ) : overtime.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuno straordinario registrato</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Data</th>
                    <th className="pb-2 pr-4 font-medium">Ore</th>
                    <th className="pb-2 pr-4 font-medium">Motivo</th>
                    <th className="pb-2 font-medium">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {overtime.map((o, idx) => {
                    const status = String(o.status || 'pending');
                    return (
                      <tr key={String(o.id || idx)} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          {formatDate((o.date as string) || (o.overtime_date as string))}
                        </td>
                        <td className="py-2 pr-4">
                          {o.hours != null ? parseFloat(String(o.hours)).toFixed(1) : '-'}
                        </td>
                        <td className="py-2 pr-4 max-w-xs truncate">
                          {String(o.reason || o.description || '-')}
                        </td>
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getOvertimeStatus(status).className}`}
                          >
                            {getOvertimeStatus(status).label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
