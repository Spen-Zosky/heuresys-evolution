'use client';

import { useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TabOverviewProps {
  employee: any;
}

const I18N: Record<string, { it: string; en: string }> = {
  identity: { it: 'Identità', en: 'Identity' },
  identityDocs: { it: 'Documenti Identità', en: 'Identity Documents' },
  permanentAddr: { it: 'Indirizzo Permanente', en: 'Permanent Address' },
  temporaryAddr: { it: 'Indirizzo Temporaneo', en: 'Temporary Address' },
  personalContacts: { it: 'Contatti Personali', en: 'Personal Contacts' },
  firstName: { it: 'Nome', en: 'First Name' },
  lastName: { it: 'Cognome', en: 'Last Name' },
  middleName: { it: 'Secondo nome', en: 'Middle Name' },
  birthDate: { it: 'Data di nascita', en: 'Date of Birth' },
  birthPlace: { it: 'Luogo di nascita', en: 'Place of Birth' },
  gender: { it: 'Genere', en: 'Gender' },
  nationality: { it: 'Nazionalità', en: 'Nationality' },
  maritalStatus: { it: 'Stato civile', en: 'Marital Status' },
  taxId: { it: 'Codice Fiscale', en: 'Tax ID' },
  nationalId: { it: 'Documento Identità', en: 'National ID' },
  nationalIdExpiry: { it: 'Scadenza Doc. Identità', en: 'National ID Expiry' },
  passport: { it: 'Passaporto', en: 'Passport' },
  passportExpiry: { it: 'Scadenza Passaporto', en: 'Passport Expiry' },
  driverLicense: { it: 'Patente', en: 'Driver License' },
  driverLicenseExpiry: { it: 'Scadenza Patente', en: 'Driver License Expiry' },
  street: { it: 'Via', en: 'Street' },
  city: { it: 'Città', en: 'City' },
  postalCode: { it: 'CAP', en: 'Postal Code' },
  country: { it: 'Paese', en: 'Country' },
  region: { it: 'Regione', en: 'Region' },
};

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

function renderJsonArray(data: unknown, emptyLabel: string, fieldOrder?: string[]): React.ReactNode {
  if (!data) return <p className="text-muted-foreground">{emptyLabel}</p>;
  const items = Array.isArray(data)
    ? data
    : typeof data === 'string'
      ? (() => {
          try {
            return JSON.parse(data);
          } catch {
            return null;
          }
        })()
      : null;
  if (!items || items.length === 0) return <p className="text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="space-y-2">
      {items.map((item: Record<string, unknown>, i: number) => {
        const keys = fieldOrder
          ? [
              ...fieldOrder.filter((k) => Object.prototype.hasOwnProperty.call(item, k)),
              ...Object.keys(item).filter((k) => !fieldOrder.includes(k)),
            ]
          : Object.keys(item);
        return (
          <div key={i} className="border rounded-md p-3 text-sm">
            {keys.map((k) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                <span>{val(item[k])}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function TabOverview({ employee }: TabOverviewProps) {
  const locale = useLocale();
  const L = (k: string) => I18N[k]?.[locale === 'en' ? 'en' : 'it'] || k;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{L('identity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field label={L('firstName')} value={val(employee.first_name)} />
            <Field label={L('lastName')} value={val(employee.last_name)} />
            <Field label={L('middleName')} value={val(employee.middle_name)} />
            <Field label={L('birthDate')} value={formatDate(employee.birth_date)} />
            <Field label={L('birthPlace')} value={val(employee.birth_place)} />
            <Field label={L('gender')} value={val(employee.gender)} />
            <Field label={L('nationality')} value={val(employee.nationality)} />
            <Field label={L('maritalStatus')} value={val(employee.marital_status)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{L('identityDocs')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field label={L('taxId')} value={val(employee.tax_id)} />
            <Field label={L('nationalId')} value={val(employee.national_id)} />
            <Field label={L('nationalIdExpiry')} value={formatDate(employee.national_id_expiry)} />
            <Field label={L('passport')} value={val(employee.passport_number)} />
            <Field label={L('passportExpiry')} value={formatDate(employee.passport_expiry)} />
            <Field label={L('driverLicense')} value={val(employee.driver_license)} />
            <Field
              label={L('driverLicenseExpiry')}
              value={formatDate(employee.driver_license_expiry)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{L('permanentAddr')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field label={L('street')} value={val(employee.address_street)} />
            <Field label={L('city')} value={val(employee.address_city)} />
            <Field label={L('postalCode')} value={val(employee.address_postal_code)} />
            <Field label={L('country')} value={val(employee.address_country)} />
            <Field label={L('region')} value={val(employee.address_region)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{L('temporaryAddr')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field label={L('street')} value={val(employee.temp_address_street)} />
            <Field label={L('city')} value={val(employee.temp_address_city)} />
            <Field label={L('postalCode')} value={val(employee.temp_address_postal_code)} />
            <Field label={L('country')} value={val(employee.temp_address_country)} />
          </div>
        </CardContent>
      </Card>

      {/* Contatti Personali */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contatti Personali</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cellulare" value={val(employee.phone_mobile)} />
            <Field label="Telefono casa" value={val(employee.phone_home)} />
            <Field label="Email personale" value={val(employee.personal_email)} />
          </div>
        </CardContent>
      </Card>

      {/* Emergenza & Famiglia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emergenza & Famiglia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Contatto di emergenza</p>
            {employee.emergency_contact_name ? (
              <div className="border rounded-md p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span>{val(employee.emergency_contact_name)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefono</span>
                  <span>{val(employee.emergency_contact_phone)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Relazione</span>
                  <span>{val(employee.emergency_contact_relationship)}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Nessun contatto di emergenza</p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Membri della famiglia</p>
            {renderJsonArray(employee.family_members, 'Nessun membro registrato', ['first_name','last_name','birth_date','gender','type','is_dependent'])}
          </div>
        </CardContent>
      </Card>

      {/* Istruzione */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Istruzione</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Livello di istruzione" value={val(employee.highest_education_level)} />
            <Field label="Istituto" value={val(employee.highest_education_institution)} />
            <Field label="Campo di studio" value={val(employee.highest_education_field)} />
            <Field label="Anno di laurea" value={val(employee.highest_education_year)} />
          </div>
          {employee.education_history && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Percorso formativo</p>
              {renderJsonArray(employee.education_history, 'Nessun percorso registrato', ['year','degree','field','grade','institution'])}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dati Bancari */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dati Bancari</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field label="IBAN" value={val(employee.iban)} />
            <Field label="SWIFT/BIC" value={val(employee.swift_bic)} />
            <Field label="Banca" value={val(employee.bank_name)} />
            <Field label="Numero conto" value={val(employee.bank_account_number)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
