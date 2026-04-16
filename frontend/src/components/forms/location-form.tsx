'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { Location } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// TYPES
// ============================================

interface LocationFormProps {
  location?: Location | null;
  mode: 'create' | 'edit';
}

interface FormData {
  name: string;
  code: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  location_type: string;
  capacity_headcount: number;
  is_active: boolean;
}

const LOCATION_TYPES = [
  { value: 'HEADQUARTERS', label: 'Sede Centrale' },
  { value: 'BRANCH', label: 'Filiale' },
  { value: 'OFFICE', label: 'Ufficio' },
  { value: 'WAREHOUSE', label: 'Magazzino' },
  { value: 'FACTORY', label: 'Stabilimento' },
  { value: 'STORE', label: 'Punto Vendita' },
  { value: 'REMOTE', label: 'Remoto' },
];

// ============================================
// LOCATION FORM COMPONENT
// ============================================

export function LocationForm({ location, mode }: LocationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    code: '',
    address: '',
    city: '',
    province: '',
    postal_code: '',
    country: 'Italia',
    location_type: '',
    capacity_headcount: 0,
    is_active: true,
  });

  // Initialize form with location data
  useEffect(() => {
    if (location && mode === 'edit') {
      setFormData({
        name: location.name || '',
        code: location.code || '',
        address: location.address || '',
        city: location.city || '',
        province: location.province || '',
        postal_code: location.postal_code || '',
        country: location.country || 'Italia',
        location_type: location.location_type || '',
        capacity_headcount: location.capacity_headcount || 0,
        is_active: location.is_active,
      });
    }
  }, [location, mode]);

  // Handle input change
  const handleChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-generate code from name
  const handleNameChange = (name: string) => {
    handleChange('name', name);
    if (mode === 'create' && !formData.code) {
      const code = name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 20);
      handleChange('code', code);
    }
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        address: formData.address || undefined,
        city: formData.city || undefined,
        province: formData.province || undefined,
        postal_code: formData.postal_code || undefined,
        country: formData.country || undefined,
        location_type: formData.location_type || undefined,
        capacity_headcount: formData.capacity_headcount || undefined,
        is_active: formData.is_active,
      };

      if (mode === 'create') {
        const newLocation = await api.locations.createLocation(payload);
        router.push(`/admin/locations/${newLocation.id}`);
      } else if (location) {
        await api.locations.updateLocation(location.id, payload);
        router.push(`/admin/locations/${location.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel salvataggio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {error && (
        <motion.div variants={staggerItem}>
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Basic Info */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informazioni Base</CardTitle>
            <CardDescription>Nome e identificativo della sede</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  placeholder="Sede Milano"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Codice *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  required
                  placeholder="SEDE-MI"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location_type">Tipo Sede</Label>
                <Select
                  value={formData.location_type}
                  onValueChange={(value) => handleChange('location_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity_headcount">Capacità (persone)</Label>
                <Input
                  id="capacity_headcount"
                  type="number"
                  value={formData.capacity_headcount}
                  onChange={(e) =>
                    handleChange('capacity_headcount', parseInt(e.target.value) || 0)
                  }
                  min={0}
                  placeholder="100"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Address */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Indirizzo</CardTitle>
            <CardDescription>Posizione geografica della sede</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Indirizzo</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Via Roma, 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Città</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Milano"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Provincia</Label>
                <Input
                  id="province"
                  value={formData.province}
                  onChange={(e) => handleChange('province', e.target.value.toUpperCase())}
                  placeholder="MI"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal_code">CAP</Label>
                <Input
                  id="postal_code"
                  value={formData.postal_code}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                  placeholder="20100"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Paese</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  placeholder="Italia"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Status */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stato</CardTitle>
            <CardDescription>Impostazioni della sede</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sede Attiva</p>
                <p className="text-sm text-muted-foreground">
                  Disattivare per nascondere la sede dalle selezioni
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => handleChange('is_active', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Actions */}
      <motion.div variants={staggerItem} className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annulla
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvataggio...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {mode === 'create' ? 'Crea Sede' : 'Salva Modifiche'}
            </>
          )}
        </Button>
      </motion.div>
    </motion.form>
  );
}
