'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Loader2, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { PluginCategory, CreatePluginRequest, PricingModel } from '@/lib/api/types';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';

// ============================================
// CONSTANTS
// ============================================

const PRICING_OPTIONS: { value: PricingModel; label: string }[] = [
  { value: 'free', label: 'Gratuito' },
  { value: 'freemium', label: 'Freemium' },
  { value: 'paid', label: 'A pagamento' },
  { value: 'subscription', label: 'Abbonamento' },
  { value: 'contact', label: 'Su richiesta' },
];

const LICENSE_OPTIONS = [
  { value: 'proprietary', label: 'Proprietaria' },
  { value: 'MIT', label: 'MIT' },
  { value: 'Apache-2.0', label: 'Apache 2.0' },
  { value: 'GPL-3.0', label: 'GPL 3.0' },
  { value: 'BSD-3-Clause', label: 'BSD 3-Clause' },
  { value: 'custom', label: 'Personalizzata' },
];

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
];

// ============================================
// PAGE COMPONENT
// ============================================

export default function NewPluginPage() {
  const t = useTranslations('admin.marketplace.developer');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [categories, setCategories] = useState<PluginCategory[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  const [form, setForm] = useState<CreatePluginRequest>({
    name: '',
    slug: '',
    short_description: '',
    description: '',
    category_id: undefined,
    pricing_model: 'free',
    price_cents: 0,
    currency: 'EUR',
    tags: [],
    icon_url: '',
    homepage_url: '',
    repository_url: '',
    license: 'proprietary',
    screenshot_urls: [],
    banner_url: '',
  });

  // Fetch categories
  useEffect(() => {
    api.marketplace
      .getCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setForm((prev) => ({ ...prev, name, slug }));
  };

  // Add tag
  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !(form.tags || []).includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...(prev.tags || []), tag] }));
      setTagInput('');
    }
  };

  // Remove tag
  const handleRemoveTag = (tag: string) => {
    setForm((prev) => ({ ...prev, tags: (prev.tags || []).filter((t) => t !== tag) }));
  };

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!form.name || !form.slug) return;

    setCreating(true);
    setError(null);
    try {
      const plugin = await api.marketplace.createPlugin(form);
      router.push(`/admin/marketplace/developer/${plugin.id}`);
    } catch (err) {
      console.error('Create failed:', err);
      setError(err instanceof Error ? err.message : 'Errore durante la creazione del plugin');
    } finally {
      setCreating(false);
    }
  }, [form, router]);

  const showPriceFields = form.pricing_model === 'paid' || form.pricing_model === 'subscription';

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Back navigation */}
      <motion.div variants={staggerItem}>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/marketplace/developer">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna al Portale Developer
          </Link>
        </Button>
      </motion.div>

      {/* Page Header */}
      <motion.div variants={staggerItem}>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Nuovo Plugin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compila i dettagli per creare un nuovo plugin
        </p>
      </motion.div>

      {/* Form */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informazioni Base</CardTitle>
            <CardDescription>Nome, descrizione e identificazione del plugin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome *</label>
              <Input
                placeholder="Il Mio Plugin"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug *</label>
              <Input
                placeholder="il-mio-plugin"
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Identificatore univoco, usato negli URL
              </p>
            </div>

            {/* Short Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Descrizione breve</label>
                <span className="text-xs text-muted-foreground">
                  {(form.short_description || '').length}/500
                </span>
              </div>
              <Textarea
                placeholder="Breve descrizione del plugin (max 500 caratteri)..."
                value={form.short_description || ''}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setForm((prev) => ({ ...prev, short_description: e.target.value }));
                  }
                }}
                rows={2}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrizione completa</label>
              <Textarea
                placeholder="Descrizione dettagliata del plugin, funzionalita, requisiti..."
                value={form.description || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={6}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select
                value={form.category_id || 'none'}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, category_id: v === 'none' ? undefined : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pricing */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modello di Prezzo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Modello</label>
              <Select
                value={form.pricing_model || 'free'}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, pricing_model: v as PricingModel }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showPriceFields && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prezzo (centesimi)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.price_cents || 0}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, price_cents: parseInt(e.target.value) || 0 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Es: 999 = {((form.price_cents || 0) / 100).toFixed(2)} {form.currency}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valuta</label>
                  <Select
                    value={form.currency || 'EUR'}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, currency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Tags */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tag</CardTitle>
            <CardDescription>Aggiungi tag per migliorare la ricercabilita</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Aggiungi un tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button variant="outline" onClick={handleAddTag} disabled={!tagInput.trim()}>
                <Tag className="h-4 w-4" />
              </Button>
            </div>
            {(form.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(form.tags || []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Links & License */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Link e Licenza</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">URL Icona</label>
              <Input
                placeholder="https://example.com/icon.png"
                value={form.icon_url || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, icon_url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sito Web</label>
              <Input
                placeholder="https://example.com"
                value={form.homepage_url || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, homepage_url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Repository</label>
              <Input
                placeholder="https://github.com/org/repo"
                value={form.repository_url || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, repository_url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Licenza</label>
              <Select
                value={form.license || 'proprietary'}
                onValueChange={(v) => setForm((prev) => ({ ...prev, license: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LICENSE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div variants={staggerItem}>
          <Card className="border-destructive">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Submit */}
      <motion.div variants={staggerItem} className="flex justify-end gap-4">
        <Button variant="outline" asChild>
          <Link href="/admin/marketplace/developer">Annulla</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={creating || !form.name || !form.slug}>
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creazione...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Crea Plugin
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
