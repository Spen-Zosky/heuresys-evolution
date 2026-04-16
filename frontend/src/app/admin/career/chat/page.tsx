'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Sparkles,
  Target,
  TrendingUp,
  GraduationCap,
  Briefcase,
  Lightbulb,
  Clock,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  feedback?: 'positive' | 'negative';
}

interface QuickAction {
  id: string;
  icon: React.ElementType;
  label: string;
  prompt: string;
}

const quickActions: QuickAction[] = [
  {
    id: '1',
    icon: Target,
    label: 'Percorso Carriera',
    prompt: 'Quali percorsi di carriera sono adatti alle mie competenze?',
  },
  {
    id: '2',
    icon: TrendingUp,
    label: 'Gap Competenze',
    prompt: 'Analizza i miei gap di competenze e suggerisci aree di miglioramento',
  },
  {
    id: '3',
    icon: GraduationCap,
    label: 'Piano Formativo',
    prompt: 'Crea un piano formativo personalizzato per i prossimi 6 mesi',
  },
  {
    id: '4',
    icon: Briefcase,
    label: 'Preparazione Promozione',
    prompt: 'Sono pronto per una promozione? Su cosa dovrei concentrarmi?',
  },
  {
    id: '5',
    icon: Lightbulb,
    label: 'Obiettivi SMART',
    prompt: 'Aiutami a definire obiettivi SMART di carriera per il prossimo anno',
  },
];

export default function CareerChatPage() {
  const t = useTranslations('admin.career.chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch profile to detect admin mode
  useEffect(() => {
    async function checkProfile() {
      try {
        const resp = await apiClient.get<{ data: { is_admin?: boolean } }>(
          '/api/v1/career-coach/profile'
        );
        if (resp?.data?.is_admin) {
          setIsAdmin(true);
        }
      } catch {
        // Profile fetch failed — non-blocking, chat still usable
      }
    }
    checkProfile();
  }, []);

  const handleSendMessage = useCallback(
    async (messageText?: string) => {
      const text = messageText || input.trim();
      if (!text || isTyping) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsTyping(true);

      try {
        // Create session on first message if needed
        let sid = sessionId;
        if (!sid) {
          const sessResp = await apiClient.post<{ data: { id: string } }>(
            '/api/v1/ai-chat/sessions',
            { title: text.slice(0, 100) }
          );
          sid = sessResp.data?.id;
          if (sid) setSessionId(sid);
        }

        if (!sid) throw new Error('Impossibile creare una sessione di chat');

        const response = await apiClient.post<{
          data?: { message?: string; response?: string; content?: string; ai_response?: string };
          message?: string;
          response?: string;
        }>(`/api/v1/ai-chat/sessions/${sid}/messages`, { message: text });

        const aiText =
          response.data?.ai_response ||
          response.data?.message ||
          response.data?.response ||
          response.data?.content ||
          response.message ||
          response.response ||
          'Risposta ricevuta dal servizio AI.';

        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: aiText,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } catch (err) {
        const errorText =
          err instanceof Error
            ? `Non sono riuscito a connettermi al servizio AI: ${err.message}`
            : 'Errore nella comunicazione con il servizio AI.';
        const errorMessage: Message = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: errorText,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
      }
    },
    [input, isTyping, sessionId]
  );

  const handleFeedback = useCallback((messageId: string, feedback: 'positive' | 'negative') => {
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, feedback } : msg)));
  }, []);

  const handleCopy = useCallback((messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              {isAdmin ? 'AI HR Assistant' : 'AI Career Coach'}
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                AI
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? 'Assistente AI per amministratori HR — modalita cross-tenant'
                : 'Il tuo assistente personale per lo sviluppo di carriera'}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="p-4 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full mb-4">
                  <MessageSquare className="h-10 w-10 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{t('welcome')}</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Chiedimi informazioni su percorsi di carriera, competenze, formazione o obiettivi
                  professionali.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-2xl">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleSendMessage(action.prompt)}
                        className="p-4 rounded-xl border hover:shadow-md transition-all text-left bg-muted/50 hover:bg-muted"
                      >
                        <Icon className="h-5 w-5 mb-2 text-indigo-600" />
                        <span className="text-sm font-medium">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-4">
                <AnimatePresence>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
                    >
                      {message.role === 'assistant' && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}
                      >
                        <div
                          className={`rounded-2xl px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground ml-auto'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {message.content}
                          </div>
                        </div>

                        <div
                          className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${
                            message.role === 'user' ? 'justify-end' : ''
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}

                          {message.role === 'assistant' && (
                            <>
                              <button
                                onClick={() => handleCopy(message.id, message.content)}
                                className="p-1 hover:bg-muted rounded"
                              >
                                {copiedId === message.id ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                              <button
                                onClick={() => handleFeedback(message.id, 'positive')}
                                className={`p-1 hover:bg-muted rounded ${
                                  message.feedback === 'positive' ? 'text-green-500' : ''
                                }`}
                              >
                                <ThumbsUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleFeedback(message.id, 'negative')}
                                className={`p-1 hover:bg-muted rounded ${
                                  message.feedback === 'negative' ? 'text-red-500' : ''
                                }`}
                              >
                                <ThumbsDown className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {message.role === 'user' && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <span
                          className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        />
                        <span
                          className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="{t('inputPlaceholder')}"
                disabled={isTyping}
                className="flex-1"
              />
              <Button type="submit" disabled={!input.trim() || isTyping}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Le risposte AI sono generate in base ai dati del tuo profilo. Per decisioni
              importanti, consulta il tuo responsabile o HR.
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block w-64 border-l p-4">
          <h3 className="font-semibold mb-4">{t('quickTopics')}</h3>
          <div className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleSendMessage(action.prompt)}
                  className="w-full p-3 rounded-lg border hover:shadow-sm transition-all text-left flex items-center gap-3"
                >
                  <div className="p-1.5 rounded bg-muted">
                    <Icon className="h-4 w-4 text-indigo-600" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>

          {messages.length > 0 && (
            <Button variant="outline" className="w-full mt-4" onClick={() => setMessages([])}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Nuova Conversazione
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
