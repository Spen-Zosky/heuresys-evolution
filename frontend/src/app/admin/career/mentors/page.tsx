'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  Search,
  Star,
  MessageSquare,
  Calendar,
  Clock,
  Briefcase,
  MapPin,
  Filter,
  Heart,
  CheckCircle2,
  Sparkles,
  Brain,
  TrendingUp,
  Mail,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { useTranslations } from 'next-intl';

// ============================================
// TYPES
// ============================================

interface Mentor {
  id: string;
  name: string;
  title: string;
  department: string;
  avatar?: string;
  matchScore: number;
  expertise: string[];
  yearsExperience: number;
  location: string;
  availability: 'available' | 'limited' | 'unavailable';
  menteeCount: number;
  maxMentees: number;
  rating: number;
  reviewCount: number;
  bio: string;
  achievements: string[];
  preferredTopics: string[];
  nextAvailable?: string;
  languages: string[];
}

interface MentorshipSession {
  id: string;
  mentorId: string;
  mentorName: string;
  date: string;
  topic: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

// ============================================
// API RESPONSE TYPE
// ============================================

interface MentorsApiResponse {
  mentors: Mentor[];
  sessions: MentorshipSession[];
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function MentorMatchingPage() {
  const t = useTranslations('admin.career.mentors');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [orgUnitFilter, setDepartmentFilter] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [sessions, setSessions] = useState<MentorshipSession[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const resp = await apiClient
          .get<{ success: boolean; data: MentorsApiResponse }>('/api/v1/career-coach/mentors')
          .catch(() => ({ data: null }));
        if (resp?.data) {
          setMentors(resp.data.mentors || []);
          setSessions(resp.data.sessions || []);
        }
      } catch (error) {
        console.error('Failed to fetch mentors data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredMentors = useMemo(() => {
    return mentors
      .filter((m) => {
        if (
          searchQuery &&
          !m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !m.expertise.some((e) => e.toLowerCase().includes(searchQuery.toLowerCase()))
        )
          return false;
        if (orgUnitFilter !== 'all' && m.department !== orgUnitFilter) return false;
        if (availabilityFilter !== 'all' && m.availability !== availabilityFilter) return false;
        return true;
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [mentors, searchQuery, orgUnitFilter, availabilityFilter]);

  const departments = useMemo(() => [...new Set(mentors.map((m) => m.department))], [mentors]);

  const stats = useMemo(
    () => ({
      totalMentors: mentors.length,
      available: mentors.filter((m) => m.availability === 'available').length,
      sessions: sessions.length,
      upcomingSessions: sessions.filter((s) => s.status === 'scheduled').length,
    }),
    [mentors, sessions]
  );

  const getAvailabilityBadge = (availability: Mentor['availability']) => {
    switch (availability) {
      case 'available':
        return <Badge className="bg-green-100 text-green-700">Disponibile</Badge>;
      case 'limited':
        return <Badge className="bg-yellow-100 text-yellow-700">Limitato</Badge>;
      case 'unavailable':
        return <Badge className="bg-red-100 text-red-700">Non disponibile</Badge>;
    }
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
              <Users className="h-6 w-6 text-orange-500" />
              Mentor Matching
            </h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/career/mentors/become">
            <Heart className="h-4 w-4 mr-2" />
            Diventa Mentor
          </Link>
        </Button>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Mentor Totali</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalMentors}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Disponibili</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{stats.available}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Le Mie Sessioni</span>
            </div>
            <p className="text-2xl font-bold">{stats.sessions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Prossime</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">{stats.upcomingSessions}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* AI Match Banner */}
      <motion.div variants={staggerItem}>
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">AI Mentor Match</p>
                <p className="text-sm text-muted-foreground">
                  Abbiamo trovato {filteredMentors.filter((m) => m.matchScore >= 80).length} mentor
                  con compatibilita superiore all&apos;80% basata sui tuoi obiettivi e skill gaps.
                </p>
              </div>
              <Button>
                <Brain className="h-4 w-4 mr-2" />
                Trova Match
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="{t('searchPlaceholder')}"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={orgUnitFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Dipartimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Disponibilita" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            <SelectItem value="available">Disponibile</SelectItem>
            <SelectItem value="limited">Limitato</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mentor List */}
        <motion.div variants={staggerItem} className="lg:col-span-2 space-y-4">
          {filteredMentors.map((mentor) => (
            <Card key={mentor.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={mentor.avatar} />
                    <AvatarFallback className="text-lg">
                      {mentor.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-lg">{mentor.name}</span>
                      {getAvailabilityBadge(mentor.availability)}
                    </div>
                    <p className="text-muted-foreground">{mentor.title}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {mentor.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {mentor.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {mentor.yearsExperience} anni exp.
                      </span>
                    </div>

                    <p className="text-sm mt-2 line-clamp-2">{mentor.bio}</p>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {mentor.expertise.slice(0, 4).map((exp) => (
                        <Badge key={exp} variant="outline" className="text-xs">
                          {exp}
                        </Badge>
                      ))}
                      {mentor.expertise.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{mentor.expertise.length - 4}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {mentor.rating} ({mentor.reviewCount})
                      </span>
                      <span className="text-muted-foreground">
                        {mentor.menteeCount}/{mentor.maxMentees} mentee
                      </span>
                      {mentor.nextAvailable && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Disp. dal {new Date(mentor.nextAvailable).toLocaleDateString('it-IT')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-primary">{mentor.matchScore}%</div>
                    <span className="text-xs text-muted-foreground">match</span>
                    <div className="flex flex-col gap-2 mt-3">
                      <Button size="sm">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Richiedi
                      </Button>
                      <Button size="sm" variant="outline">
                        <Mail className="h-3 w-3 mr-1" />
                        Contatta
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Sidebar - My Sessions */}
        <motion.div variants={staggerItem} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Le Mie Sessioni
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{session.mentorName}</span>
                    <Badge
                      variant={
                        session.status === 'scheduled'
                          ? 'default'
                          : session.status === 'completed'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {session.status === 'scheduled'
                        ? 'Programmata'
                        : session.status === 'completed'
                          ? 'Completata'
                          : 'Annullata'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{session.topic}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(session.date).toLocaleDateString('it-IT', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                  {session.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      &quot;{session.notes}&quot;
                    </p>
                  )}
                </div>
              ))}

              <Button variant="outline" className="w-full">
                <Calendar className="h-4 w-4 mr-2" />
                Vedi Tutte
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Progresso Mentorship
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Sessioni completate</span>
                    <span className="font-medium">
                      {sessions.filter((s) => s.status === 'completed').length}/
                      {sessions.length || 'N/D'}
                    </span>
                  </div>
                  <Progress
                    value={
                      sessions.length > 0
                        ? (sessions.filter((s) => s.status === 'completed').length /
                            sessions.length) *
                          100
                        : 0
                    }
                    className="h-2"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Obiettivi raggiunti</span>
                    <span className="font-medium">N/D</span>
                  </div>
                  <Progress value={0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Feedback ricevuti</span>
                    <span className="font-medium">N/D</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
