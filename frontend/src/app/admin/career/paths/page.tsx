'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Target,
  ChevronDown,
  Clock,
  Sparkles,
  TrendingUp,
  Award,
  Briefcase,
  LayoutGrid,
  List,
  Star,
  CheckCircle2,
  Circle,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

/** Shape returned by GET /api/v1/career-coach/paths */
interface ApiCareerPath {
  id: string;
  name: string;
  description: string;
  from_role: string;
  to_role: string;
  estimated_months: number;
  required_skills: string[];
  success_rate: number | null;
}

interface ApiPathsResponse {
  current_role: string;
  paths: ApiCareerPath[];
}

// ============================================
// (data fetched from API)
// ============================================

// ============================================
// PAGE COMPONENT
// ============================================

export default function CareerPathsPage() {
  const t = useTranslations('admin.career.paths');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [paths, setPaths] = useState<ApiCareerPath[]>([]);
  const [currentRole, setCurrentRole] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await apiClient
          .get<{ success: boolean; data: ApiPathsResponse }>('/api/v1/career-coach/paths')
          .catch(() => ({ data: null }));
        if (resp?.data) {
          // API returns { current_role, paths: [...] }
          const apiData = resp.data as ApiPathsResponse;
          if (apiData.paths && Array.isArray(apiData.paths)) {
            setPaths(apiData.paths);
            setCurrentRole(apiData.current_role || '');
          } else if (Array.isArray(resp.data)) {
            // Fallback: direct array
            setPaths(resp.data as unknown as ApiCareerPath[]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch career paths:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const stats = useMemo(
    () => ({
      totalPaths: paths.length,
      avgMonths:
        paths.length > 0
          ? Math.round(paths.reduce((s, p) => s + (p.estimated_months || 0), 0) / paths.length)
          : 0,
      totalSkills: new Set(paths.flatMap((p) => p.required_skills || [])).size,
    }),
    [paths]
  );

  const formatMonths = (months: number) => {
    if (months >= 12) {
      const y = Math.floor(months / 12);
      const m = months % 12;
      return m > 0 ? `${y}a ${m}m` : `${y} ann${y > 1 ? 'i' : 'o'}`;
    }
    return `${months} mesi`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" aria-label="Go back" asChild>
            <Link href="/admin/career">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Target className="h-6 w-6 text-green-500" />
              Career Paths
            </h1>
            <p className="text-muted-foreground">
              {t('description')}
              {currentRole && currentRole !== 'Unknown' && (
                <span className="ml-1">
                  — Ruolo attuale: <strong>{currentRole}</strong>
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              aria-label="Grid view"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              aria-label="List view"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">Percorsi Disponibili</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalPaths}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Durata Media</span>
            </div>
            <p className="text-2xl font-bold">
              {stats.avgMonths > 0 ? formatMonths(stats.avgMonths) : 'N/D'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">Competenze Richieste</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">{stats.totalSkills}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Career Path Flow Visualization */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Percorsi di Crescita</CardTitle>
            <CardDescription>
              Transizioni di ruolo disponibili nella tua organizzazione
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paths.length > 0 ? (
              <div className="flex items-center justify-between overflow-x-auto pb-4 gap-2">
                {paths.slice(0, 4).map((path, idx, arr) => (
                  <div key={path.id} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[120px]">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                      >
                        {idx === 0 ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <Circle className="h-6 w-6" />
                        )}
                      </div>
                      <span className="text-sm font-medium mt-2 text-center">{path.from_role}</span>
                      <ArrowRight className="h-4 w-4 text-primary my-1" />
                      <span className="text-sm font-medium text-center text-primary">
                        {path.to_role}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {formatMonths(path.estimated_months)}
                      </span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="w-8 border-t border-dashed border-muted-foreground mx-1" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t('noResults')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Completa il tuo profilo per ricevere suggerimenti personalizzati
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Paths List/Grid */}
      <motion.div variants={staggerItem}>
        <div
          className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3' : 'space-y-4'}
        >
          <AnimatePresence>
            {paths.map((path) => (
              <motion.div
                key={path.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${expandedPath === path.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setExpandedPath(expandedPath === path.id ? null : path.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{path.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {path.from_role} <ArrowRight className="inline h-3 w-3 mx-1" />{' '}
                          {path.to_role}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatMonths(path.estimated_months)}
                        </Badge>
                        {path.success_rate != null && (
                          <div className="text-sm font-medium text-green-600 mt-1">
                            {Math.round(path.success_rate * 100)}% successo
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {path.description}
                    </p>

                    {/* Skills Preview */}
                    {path.required_skills && path.required_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {path.required_skills.slice(0, 3).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {path.required_skills.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{path.required_skills.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <AnimatePresence>
                      {expandedPath === path.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="pt-3 border-t"
                        >
                          {/* All Skills */}
                          {path.required_skills && path.required_skills.length > 0 && (
                            <div className="mb-4">
                              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                Competenze Richieste
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {path.required_skills.map((skill) => (
                                  <Badge key={skill} variant="secondary" className="text-xs">
                                    <Award className="h-3 w-3 mr-1" />
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Path Details */}
                          <div className="mb-4 space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Da:</span>
                              <span className="font-medium">{path.from_role}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">A:</span>
                              <span className="font-medium">{path.to_role}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Durata stimata:</span>
                              <span className="font-medium">
                                {formatMonths(path.estimated_months)}
                              </span>
                            </div>
                            {path.success_rate != null && (
                              <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Tasso di successo:</span>
                                <span className="font-medium">
                                  {Math.round(path.success_rate * 100)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedPath(expandedPath === path.id ? null : path.id);
                      }}
                    >
                      {expandedPath === path.id ? (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1 rotate-180" />
                          Chiudi
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Dettagli
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
