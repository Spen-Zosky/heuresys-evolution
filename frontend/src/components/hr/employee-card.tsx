'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, Mail, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: string;
  department: string;
  location?: string;
  status: 'active' | 'inactive' | 'on_leave';
}

const statusLabels: Record<Employee['status'], string> = {
  active: 'Attivo',
  inactive: 'Non attivo',
  on_leave: 'In congedo',
};

const statusColors: Record<Employee['status'], string> = {
  active: 'border-success text-success bg-success/10',
  inactive: 'border-muted-foreground text-muted-foreground',
  on_leave: 'border-warning text-warning bg-warning/10',
};

interface EmployeeCardProps {
  employee: Employee;
  variant?: 'card' | 'row' | 'compact';
  onViewProfile?: (id: string) => void;
  onSendMessage?: (id: string) => void;
  onEditEmployee?: (id: string) => void;
  className?: string;
}

export function EmployeeCard({
  employee,
  variant = 'card',
  onViewProfile,
  onSendMessage,
  onEditEmployee,
  className,
}: EmployeeCardProps) {
  const fullName = `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`;

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors',
          className
        )}
        onClick={() => onViewProfile?.(employee.id)}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={employee.avatar} alt={fullName} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{fullName}</p>
          <p className="text-xs text-muted-foreground truncate">{employee.role}</p>
        </div>
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div
        className={cn(
          'flex items-center gap-4 p-3 border-b hover:bg-muted/50 transition-colors',
          className
        )}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={employee.avatar} alt={fullName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
          <div>
            <p className="font-medium truncate">{fullName}</p>
            <p className="text-sm text-muted-foreground truncate">{employee.email}</p>
          </div>
          <div className="text-sm">
            <p className="truncate">{employee.role}</p>
          </div>
          <div className="text-sm">
            <p className="truncate">{employee.department}</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Badge variant="outline" className={statusColors[employee.status]}>
              {statusLabels[employee.status]}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More options" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewProfile?.(employee.id)}>
                  Visualizza profilo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSendMessage?.(employee.id)}>
                  Invia messaggio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEditEmployee?.(employee.id)}>
                  Modifica
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card
      className={cn('card-hover cursor-pointer', className)}
      onClick={() => onViewProfile?.(employee.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={employee.avatar} alt={fullName} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold">{fullName}</h4>
                <p className="text-sm text-muted-foreground">{employee.role}</p>
              </div>
              <Badge variant="outline" className={statusColors[employee.status]}>
                {statusLabels[employee.status]}
              </Badge>
            </div>

            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{employee.department}</span>
              </div>
              {employee.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">{employee.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{employee.email}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
