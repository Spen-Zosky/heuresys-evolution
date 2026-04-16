'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Send,
  X,
  ThumbsUp,
  ThumbsDown,
  Copy,
  ExternalLink,
  User,
  Bot,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SourceCitation {
  type: 'ccnl' | 'law' | 'policy' | 'internal';
  title: string;
  reference: string;
  lastUpdated?: string;
  url?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: SourceCitation[];
  confidence?: number;
  feedbackGiven?: 'positive' | 'negative';
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (message: string) => Promise<AIMessage>;
  initialContext?: string;
  variant?: 'floating' | 'embedded' | 'fullscreen';
  className?: string;
}

export function AIChat({
  isOpen,
  onClose,
  onSendMessage,
  variant = 'floating',
  className,
}: AIChatProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await onSendMessage(input.trim());
      setMessages((prev) => [...prev, response]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Mi dispiace, si è verificato un errore. Riprova o contatta l'ufficio HR.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = (messageId: string, feedback: 'positive' | 'negative') => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, feedbackGiven: feedback } : msg))
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  const containerClasses = cn(
    'flex flex-col bg-background border shadow-xl',
    {
      'fixed bottom-4 right-4 w-96 h-[600px] rounded-lg z-50': variant === 'floating',
      'w-full h-full': variant === 'embedded',
      'fixed inset-0 z-50': variant === 'fullscreen',
    },
    className
  );

  return (
    <div className={containerClasses} role="dialog" aria-label="Assistente AI Chat">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" aria-hidden="true" />
          <span className="font-semibold">Assistente AI</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-primary-foreground hover:bg-primary/80 h-8 w-8"
          aria-label="Chiudi chat"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4" aria-live="polite" aria-busy={isLoading}>
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Ciao! Come posso aiutarti?</p>
              <p className="text-sm mt-2">
                Puoi chiedermi informazioni su CCNL, ferie, ROL, permessi e policy aziendali.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 bg-primary shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}

              <div
                className={cn(
                  'max-w-[80%] space-y-2',
                  message.role === 'user' ? 'order-first' : ''
                )}
              >
                <div
                  className={cn(
                    'rounded-lg p-3',
                    message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* Source Citations */}
                {message.sources && message.sources.length > 0 && (
                  <div className="space-y-1">
                    {message.sources.map((source, idx) => (
                      <SourceCitationCard key={idx} source={source} />
                    ))}
                  </div>
                )}

                {/* Confidence Indicator */}
                {message.confidence !== undefined && (
                  <ConfidenceIndicator confidence={message.confidence} />
                )}

                {/* Feedback & Actions */}
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleFeedback(message.id, 'positive')}
                      disabled={!!message.feedbackGiven}
                      aria-label="Risposta utile"
                    >
                      <ThumbsUp
                        className={cn(
                          'h-3 w-3',
                          message.feedbackGiven === 'positive' && 'fill-current text-success'
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleFeedback(message.id, 'negative')}
                      disabled={!!message.feedbackGiven}
                      aria-label="Risposta non utile"
                    >
                      <ThumbsDown
                        className={cn(
                          'h-3 w-3',
                          message.feedbackGiven === 'negative' && 'fill-current text-destructive'
                        )}
                        aria-hidden="true"
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => copyToClipboard(message.content)}
                      aria-label="Copia risposta"
                    >
                      <Copy className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 bg-primary shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sto cercando nei documenti...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Human Escalation */}
      <div className="px-4 py-2 border-t bg-muted/50">
        <Button variant="link" size="sm" className="text-xs text-muted-foreground p-0 h-auto">
          Preferisci parlare con HR? →
        </Button>
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi la tua domanda..."
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={isLoading}
            className="flex-1"
            aria-label="Messaggio per assistente AI"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            aria-label="Invia messaggio"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Source Citation Sub-component
function SourceCitationCard({ source }: { source: SourceCitation }) {
  const typeIcons: Record<SourceCitation['type'], string> = {
    ccnl: '📚',
    law: '⚖️',
    policy: '📋',
    internal: '🏢',
  };

  return (
    <Card className="p-2 bg-background">
      <div className="flex items-start gap-2 text-xs">
        <span>{typeIcons[source.type]}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{source.title}</p>
          <p className="text-muted-foreground">{source.reference}</p>
          {source.lastUpdated && (
            <p className="text-muted-foreground">Aggiornato: {source.lastUpdated}</p>
          )}
        </div>
        {source.url && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" asChild>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
}

// Confidence Indicator Sub-component
function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const getLevel = () => {
    if (confidence >= 85)
      return { label: 'Alta confidenza', className: 'border-success text-success bg-success/10' };
    if (confidence >= 60)
      return {
        label: 'Verifica consigliata',
        className: 'border-warning text-warning bg-warning/10',
      };
    return {
      label: 'Richiedi conferma HR',
      className: 'border-destructive text-destructive bg-destructive/10',
    };
  };

  const { label, className } = getLevel();

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={cn('text-xs', className)}>
        {confidence}% - {label}
      </Badge>
    </div>
  );
}

// Floating Action Button for AI Chat
export function AIChatFAB({
  onClick,
  hasNotification = false,
}: {
  onClick: () => void;
  hasNotification?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
      aria-label={hasNotification ? 'Apri assistente AI (nuovi messaggi)' : 'Apri assistente AI'}
    >
      <MessageSquare className="h-6 w-6" aria-hidden="true" />
      {hasNotification && (
        <span
          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive"
          aria-hidden="true"
        />
      )}
    </Button>
  );
}
