'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@vocilia/ui';
import { Clock, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  messages_count: number;
}

const mockTickets: Ticket[] = [
  {
    id: 'TKT-001',
    subject: 'Problem med Swish-betalning',
    category: 'payment',
    status: 'resolved',
    priority: 'high',
    created_at: '2024-09-25T10:30:00Z',
    updated_at: '2024-09-25T14:15:00Z',
    messages_count: 3
  },
  {
    id: 'TKT-002', 
    subject: 'QR-kod fungerar inte',
    category: 'technical',
    status: 'in_progress',
    priority: 'medium',
    created_at: '2024-09-26T09:15:00Z',
    updated_at: '2024-09-26T16:45:00Z',
    messages_count: 5
  }
];

const statusColors = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800'
};

const statusLabels = {
  open: 'Öppet',
  in_progress: 'Pågående',
  resolved: 'Löst',
  closed: 'Stängt'
};

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800'
};

const priorityLabels = {
  low: 'Låg',
  medium: 'Medium',
  high: 'Hög',
  urgent: 'Brådskande'
};

const categoryLabels = {
  payment: 'Betalning',
  technical: 'Teknisk',
  account: 'Konto',
  rewards: 'Belöningar',
  other: 'Övrigt'
};

export default function TicketHistory() {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: Ticket['status']) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-4 w-4" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'resolved':
      case 'closed':
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  if (mockTickets.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Inga ärenden än</h3>
          <p className="text-gray-600">Du har inte skickat några supportärenden ännu.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {mockTickets.map((ticket) => (
        <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg mb-2">{ticket.subject}</CardTitle>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="font-medium">#{ticket.id}</span>
                  <span>•</span>
                  <span>{categoryLabels[ticket.category as keyof typeof categoryLabels]}</span>
                  <span>•</span>
                  <span>Skapad {formatDate(ticket.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className={statusColors[ticket.status]}>
                  {getStatusIcon(ticket.status)}
                  <span className="ml-1">{statusLabels[ticket.status]}</span>
                </Badge>
                <Badge className={priorityColors[ticket.priority]}>
                  {priorityLabels[ticket.priority]}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <MessageSquare className="h-4 w-4" />
                  <span>{ticket.messages_count} meddelanden</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>Uppdaterad {formatDate(ticket.updated_at)}</span>
                </div>
              </div>
              {ticket.status === 'in_progress' && (
                <span className="text-blue-600 font-medium">Väntar på svar</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}