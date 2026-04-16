'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TabOrganizationProps {
  employee: any;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '\u2014';
  try {
    return new Date(value).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '\u2014';
  }
}

function formatCurrency(value: unknown, currency?: string): string {
  if (value === null || value === undefined || value === '') return '\u2014';
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num)) return '\u2014';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(num);
}

function val(v: unknown): string {
  if (v === null || v === undefined || v === '') return '\u2014';
  return String(v);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export default function TabOrganization({ employee }: TabOrganizationProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      {/* Ruolo & Posizione */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ruolo & Posizione</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mansione" value={val(employee.job_title)} />
            <Field label="Dipartimento" value={val(employee.department_name)} />
            <Field label="Unità organizzativa" value={val(employee.org_unit_name)} />
            <Field label="Sede" value={val(employee.location_name)} />
            <Field label="Centro di costo" value={val(employee.cost_center_name)} />
            <div>
              <p className="text-sm text-muted-foreground">Manager</p>
              <p className="font-medium">
                {employee.manager_first_name
                  ? `${employee.manager_first_name} ${employee.manager_last_name || ''}`.trim()
                  : 'Non assegnato'}
              </p>
            </div>
            <Field label="Posizione" value={val(employee.position_id)} />
          </div>
        </CardContent>
      </Card>

      {/* Ciclo di Vita */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ciclo di Vita</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data assunzione" value={formatDate(employee.hire_date)} />
            <Field label="Data anzianità" value={formatDate(employee.seniority_date)} />
            <Field label="Fine periodo di prova" value={formatDate(employee.probation_end_date)} />
            <Field
              label="Scadenza contratto"
              value={
                employee.contract_end_date
                  ? formatDate(employee.contract_end_date)
                  : employee.expected_retirement_date
                    ? `${formatDate(employee.expected_retirement_date)} (pensionamento)`
                    : '\u2014'
              }
            />
            <div>
              <p className="text-sm text-muted-foreground">Stato</p>
              <div className="mt-1">
                <Badge
                  variant={
                    employee.employment_status === 'active'
                      ? 'default'
                      : employee.employment_status === 'terminated'
                        ? 'destructive'
                        : 'secondary'
                  }
                  className={employee.employment_status === 'active' ? 'bg-green-500' : ''}
                >
                  {employee.employment_status === 'active' && 'Attivo'}
                  {employee.employment_status === 'on_leave' && 'In congedo'}
                  {employee.employment_status === 'terminated' && 'Terminato'}
                  {!['active', 'on_leave', 'terminated'].includes(employee.employment_status) &&
                    val(employee.employment_status)}
                </Badge>
              </div>
            </div>
            <Field label="Data cessazione" value={formatDate(employee.termination_date)} />
            <Field label="Motivo cessazione" value={val(employee.termination_reason)} />
          </div>
        </CardContent>
      </Card>

      {/* Retribuzione */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retribuzione</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Retribuzione"
              value={formatCurrency(employee.salary, employee.currency)}
            />
            <Field label="Valuta" value={val(employee.currency)} />
            <Field label="Area contrattuale" value={val(employee.pay_scale_area)} />
            <Field label="Tipo inquadramento" value={val(employee.pay_scale_type)} />
            <Field label="Gruppo retributivo" value={val(employee.pay_scale_group)} />
            <Field label="Livello retributivo" value={val(employee.pay_scale_level)} />
            <Field
              label="Percentuale orario"
              value={
                employee.work_schedule_percentage
                  ? `${employee.work_schedule_percentage}%`
                  : '\u2014'
              }
            />
            <Field label="Mensilita annue" value={val(employee.pay_periods_per_year)} />
          </div>
        </CardContent>
      </Card>

      {/* SAP */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SAP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field label="PERNR" value={val(employee.pernr)} />
            <Field label="Company Code" value={val(employee.company_code)} />
            <Field label="Personnel Area" value={val(employee.personnel_area)} />
            <Field label="Personnel Subarea" value={val(employee.personnel_subarea)} />
          </div>
        </CardContent>
      </Card>

      {/* Autenticazione */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Autenticazione</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Username" value={val(employee.auth_username)} />
            <div>
              <p className="text-sm text-muted-foreground">Ruolo</p>
              <div className="mt-1">
                {employee.auth_role ? (
                  <Badge variant="outline">{employee.auth_role}</Badge>
                ) : (
                  <p className="font-medium">{'\u2014'}</p>
                )}
              </div>
            </div>
            <Field label="Permessi" value={val(employee.auth_permissions)} />
            <Field label="Ultimo accesso" value={formatDate(employee.auth_last_login)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
