'use client';

import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';

function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SessionTimeoutWarning() {
  const { showWarning, secondsRemaining, extendSession, logout } = useSessionTimeout();

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Sessione in scadenza
          </DialogTitle>
          <DialogDescription>
            La tua sessione scadrà tra poco. Vuoi rimanere connesso?
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-4">
          <div className="text-center">
            <div className="text-4xl font-mono font-bold tabular-nums text-foreground">
              {formatTime(Math.max(0, secondsRemaining))}
            </div>
            <p className="text-sm text-muted-foreground mt-1">tempo rimanente</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Esci ora
          </Button>
          <Button onClick={extendSession}>Rimani connesso</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
