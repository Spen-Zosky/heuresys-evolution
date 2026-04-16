'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api/client';

interface TabContractsProps {
  employeeId: string;
}

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('it-IT') : '—';

const formatCurrency = (v: number | string | null | undefined) => {
  if (v == null) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(
    typeof v === 'string' ? parseFloat(v) : v
  );
};

export function TabContracts({ employeeId }: TabContractsProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get<any>(`/api/v1/contracts/employee/${employeeId}`);
        const d = response?.data;
        const items = Array.isArray(d)
          ? d
          : Array.isArray(d?.contracts)
            ? d.contracts
            : Array.isArray(d?.items)
              ? d.items
              : [];
        setData(items);
      } catch {
        setError('Impossibile caricare i contratti');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [employeeId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contratti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contratti</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contratti</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nessun contratto trovato</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contratti</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo Contratto</TableHead>
              <TableHead>CCNL</TableHead>
              <TableHead>Data Inizio</TableHead>
              <TableHead>Data Fine</TableHead>
              <TableHead className="text-right">RAL</TableHead>
              <TableHead className="text-right">FTE</TableHead>
              <TableHead>Stato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c: any) => {
              const ccnl = [c.ccnl_type || c.ccnl_code || c.ccnl, c.ccnl_level || c.level]
                .filter(Boolean)
                .join(' · ');
              const fte =
                c.part_time_percentage != null
                  ? parseFloat(c.part_time_percentage)
                  : c.fte_percentage != null
                    ? parseFloat(c.fte_percentage)
                    : c.work_schedule_type === 'full_time'
                      ? 100
                      : null;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.contract_type || c.type || '—'}</TableCell>
                  <TableCell>{ccnl || '—'}</TableCell>
                  <TableCell>{formatDate(c.start_date)}</TableCell>
                  <TableCell>
                    {c.end_date ? (
                      formatDate(c.end_date)
                    ) : c.expected_retirement_date ? (
                      <span
                        className="text-xs text-muted-foreground"
                        title="Scadenza naturale per raggiungimento requisiti pensionistici"
                      >
                        {formatDate(c.expected_retirement_date)}
                        <span className="block text-[10px] opacity-70">pensionamento</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(c.gross_annual_salary || c.ral || c.annual_salary)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fte != null ? `${fte.toFixed(0)}%` : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                      {c.status === 'active'
                        ? 'Attivo'
                        : c.status === 'expired'
                          ? 'Scaduto'
                          : c.status || '—'}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
