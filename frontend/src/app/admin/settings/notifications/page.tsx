'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Save, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { staggerContainer, staggerItem } from '@/lib/motion-presets';
import { toast } from 'sonner';

interface NotificationChannel {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  icon: typeof Mail;
}

interface NotificationRule {
  id: string;
  event: string;
  description: string;
  channels: string[];
  enabled: boolean;
}

const defaultChannels: NotificationChannel[] = [
  { id: '1', name: 'Email', type: 'email', enabled: true, icon: Mail },
  { id: '2', name: 'In-App', type: 'in_app', enabled: true, icon: MessageSquare },
  { id: '3', name: 'Push Mobile', type: 'push', enabled: false, icon: Smartphone },
];

const defaultRules: NotificationRule[] = [
  {
    id: '1',
    event: 'employee_onboarding',
    description: 'Nuovo dipendente in onboarding',
    channels: ['email', 'in_app'],
    enabled: true,
  },
  {
    id: '2',
    event: 'goal_deadline',
    description: 'Scadenza obiettivo imminente',
    channels: ['email', 'in_app'],
    enabled: true,
  },
  {
    id: '3',
    event: 'review_reminder',
    description: 'Promemoria revisione performance',
    channels: ['email'],
    enabled: true,
  },
  {
    id: '4',
    event: 'leave_request',
    description: 'Richiesta ferie/permessi',
    channels: ['email', 'in_app'],
    enabled: true,
  },
  {
    id: '5',
    event: 'training_enrollment',
    description: 'Iscrizione a corso formativo',
    channels: ['in_app'],
    enabled: true,
  },
  {
    id: '6',
    event: 'document_expiry',
    description: 'Scadenza documento',
    channels: ['email'],
    enabled: true,
  },
  {
    id: '7',
    event: 'payslip_ready',
    description: 'Cedolino disponibile',
    channels: ['email', 'in_app'],
    enabled: false,
  },
  {
    id: '8',
    event: 'feedback_received',
    description: 'Feedback ricevuto',
    channels: ['in_app'],
    enabled: true,
  },
];

export default function NotificationSettingsPage() {
  const t = useTranslations('admin.settings.notifications');
  const tCommon = useTranslations('common');
  const [channels, setChannels] = useState(defaultChannels);
  const [rules, setRules] = useState(defaultRules);
  const [smtpHost, setSmtpHost] = useState('smtp.heuresys.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [fromEmail, setFromEmail] = useState('noreply@heuresys.com');
  const [saved, setSaved] = useState(false);

  const toggleChannel = (id: string) => {
    setChannels(channels.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
    setSaved(false);
  };

  const toggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    setSaved(false);
  };

  const handleSave = () => {
    // TODO: Wire to backend API when tenant-level notification config endpoint is implemented.
    // The per-user preferences endpoint is PUT /api/v1/notifications/my/preferences
    // but this page manages system-wide notification configuration (channels, SMTP, rules)
    // which requires a dedicated tenant_notification_config table and endpoint.
    setSaved(true);
    toast.success('Configurazione notifiche salvata');
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div
        variants={staggerItem}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Impostazioni Notifiche
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configurazione canali e regole di notifica
          </p>
        </div>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          {saved ? 'Salvato!' : 'Salva Configurazione'}
        </Button>
      </motion.div>

      {/* Channels */}
      <motion.div variants={staggerItem}>
        <h2 className="text-lg font-semibold mb-3">Canali di Notifica</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <Card
                key={channel.id}
                className={`cursor-pointer transition-all ${channel.enabled ? 'ring-2 ring-primary' : 'opacity-60'}`}
                onClick={() => toggleChannel(channel.id)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{channel.name}</p>
                      <p className="text-sm text-muted-foreground">{channel.type}</p>
                    </div>
                  </div>
                  <Badge
                    className={
                      channel.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }
                  >
                    {channel.enabled ? 'Attivo' : 'Disattivo'}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>

      {/* SMTP Settings */}
      <motion.div variants={staggerItem}>
        <h2 className="text-lg font-semibold mb-3">Configurazione Email (SMTP)</h2>
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Host SMTP</label>
                <Input
                  value={smtpHost}
                  onChange={(e) => {
                    setSmtpHost(e.target.value);
                    setSaved(false);
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Porta</label>
                <Input
                  value={smtpPort}
                  onChange={(e) => {
                    setSmtpPort(e.target.value);
                    setSaved(false);
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email Mittente</label>
                <Input
                  value={fromEmail}
                  onChange={(e) => {
                    setFromEmail(e.target.value);
                    setSaved(false);
                  }}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notification Rules */}
      <motion.div variants={staggerItem}>
        <h2 className="text-lg font-semibold mb-3">Regole di Notifica</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Canali</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow
                    key={rule.id}
                    className="cursor-pointer"
                    onClick={() => toggleRule(rule.id)}
                  >
                    <TableCell className="font-medium font-mono text-sm">{rule.event}</TableCell>
                    <TableCell>{rule.description}</TableCell>
                    <TableCell>
                      {rule.channels.map((ch) => (
                        <Badge key={ch} variant="outline" className="mr-1">
                          {ch}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {rule.enabled ? 'Attivo' : 'Disattivo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
