import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { AIChat, AIChatFAB, type AIMessage } from '@/components/ai'
import { Button } from '@/components/ui/button'

const meta: Meta<typeof AIChat> = {
  title: 'AI/AIChat',
  component: AIChat,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

// Mock send message function
const mockSendMessage = async (message: string): Promise<AIMessage> => {
  await new Promise((resolve) => setTimeout(resolve, 1500))

  // Simulate different responses based on message content
  if (message.toLowerCase().includes('ferie')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content:
        'Secondo il CCNL Commercio, hai diritto a 26 giorni di ferie annuali retribuite.\n\nLe ferie maturano in ragione di 2,17 giorni al mese e devono essere godute entro 18 mesi dalla maturazione.',
      timestamp: new Date(),
      sources: [
        {
          type: 'ccnl',
          title: 'CCNL Commercio',
          reference: 'Art. 78 - Ferie',
          lastUpdated: 'Gen 2024',
          url: '#',
        },
      ],
      confidence: 95,
    }
  }

  if (message.toLowerCase().includes('rol')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content:
        'Il ROL (Riduzione Orario di Lavoro) nel CCNL Metalmeccanico prevede:\n\n• 72 ore annue di permessi retribuiti\n• Maturazione: 6 ore al mese\n• Utilizzo: entro il 31/12 dell\'anno successivo',
      timestamp: new Date(),
      sources: [
        {
          type: 'ccnl',
          title: 'CCNL Metalmeccanico',
          reference: 'Art. 8 - ROL',
          lastUpdated: 'Feb 2024',
        },
      ],
      confidence: 92,
    }
  }

  return {
    id: Date.now().toString(),
    role: 'assistant',
    content: `Ho capito la tua domanda su "${message}".\n\nPurtroppo non ho trovato informazioni specifiche nei documenti disponibili. Ti consiglio di contattare l'ufficio HR per maggiori dettagli.`,
    timestamp: new Date(),
    confidence: 45,
  }
}

// Interactive demo wrapper
function AIChatDemo({ variant }: { variant: 'floating' | 'embedded' | 'fullscreen' }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="relative h-[700px] bg-muted/30 p-4">
      {variant === 'floating' && !isOpen && (
        <div className="flex items-center justify-center h-full">
          <Button onClick={() => setIsOpen(true)}>Apri AI Chat</Button>
        </div>
      )}
      <AIChat
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSendMessage={mockSendMessage}
        variant={variant}
      />
    </div>
  )
}

export const FloatingVariant: Story = {
  render: () => <AIChatDemo variant="floating" />,
}

export const EmbeddedVariant: Story = {
  render: () => (
    <div className="w-96 h-[600px] border rounded-lg overflow-hidden">
      <AIChatDemo variant="embedded" />
    </div>
  ),
  parameters: {
    layout: 'centered',
  },
}

export const FullscreenVariant: Story = {
  render: () => <AIChatDemo variant="fullscreen" />,
}

export const FABButton: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false)
    return (
      <div className="relative h-[400px] bg-muted/30">
        <AIChatFAB onClick={() => setIsOpen(!isOpen)} />
        <AIChat
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSendMessage={mockSendMessage}
          variant="floating"
        />
      </div>
    )
  },
}

export const WithNotification: Story = {
  render: () => (
    <div className="relative h-[200px] bg-muted/30">
      <AIChatFAB onClick={() => {}} hasNotification={true} />
    </div>
  ),
}
