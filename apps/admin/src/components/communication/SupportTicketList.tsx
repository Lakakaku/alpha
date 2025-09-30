'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Input } from '@vocilia/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vocilia/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@vocilia/ui';
import { Textarea } from '@vocilia/ui';
import { Label } from '@vocilia/ui';
import { AlertCircle, Clock, CheckCircle, XCircle, Phone, Mail, MessageSquare, User, Building, Calendar, ArrowUpDown, Filter, MessageCircle, Eye, Edit, Archive } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channel: 'phone' | 'email' | 'chat';
  category: 'payment' | 'technical' | 'verification' | 'general' | 'feedback';
  submitter_type: 'customer' | 'business';
  submitter_id: string;
  submitter_name: string;
  submitter_contact: string;
  assigned_admin_id?: string;
  assigned_admin_name?: string;
  created_at: string;
  updated_at: string;
  response_due_at: string;
  first_response_at?: string;
  resolved_at?: string;
  sla_breached: boolean;
  message_count: number;
  tags: string[];
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: 'customer' | 'business' | 'admin';
  sender_name: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  attachments?: string[];
}

interface SupportStats {
  total_tickets: number;
  open_tickets: number;
  overdue_tickets: number;
  avg_response_time: number;
  resolution_rate: number;
  sla_compliance: number;
  tickets_by_channel: Record<string, number>;
  tickets_by_priority: Record<string, number>;
  tickets_by_category: Record<string, number>;
}

const priorityConfig = {
  low: { label: 'Låg', color: 'bg-green-100 text-green-800', icon: '●' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800', icon: '●' },
  high: { label: 'Hög', color: 'bg-orange-100 text-orange-800', icon: '●' },
  urgent: { label: 'Brådskande', color: 'bg-red-100 text-red-800', icon: '●' }
};

const statusConfig = {
  open: { label: 'Öppen', color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
  in_progress: { label: 'Pågående', color: 'bg-purple-100 text-purple-800', icon: Clock },
  pending_customer: { label: 'Väntar på kund', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  resolved: { label: 'Löst', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  closed: { label: 'Stängt', color: 'bg-gray-100 text-gray-800', icon: XCircle }
};

const channelConfig = {
  phone: { label: 'Telefon', icon: Phone, color: 'text-blue-600' },
  email: { label: 'E-post', icon: Mail, color: 'text-green-600' },
  chat: { label: 'Chatt', icon: MessageSquare, color: 'text-purple-600' }
};

const categoryConfig = {
  payment: { label: 'Betalning', color: 'bg-green-50 border-green-200' },
  technical: { label: 'Teknisk', color: 'bg-blue-50 border-blue-200' },
  verification: { label: 'Verifiering', color: 'bg-purple-50 border-purple-200' },
  general: { label: 'Allmänt', color: 'bg-gray-50 border-gray-200' },
  feedback: { label: 'Feedback', color: 'bg-yellow-50 border-yellow-200' }
};

export default function SupportTicketList() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [submitterTypeFilter, setSubmitterTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'priority' | 'response_due_at'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [responseMessage, setResponseMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  useEffect(() => {
    loadTickets();
    loadStats();
  }, [statusFilter, priorityFilter, channelFilter, categoryFilter, submitterTypeFilter, sortBy, sortOrder]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search: searchTerm,
        status: statusFilter !== 'all' ? statusFilter : '',
        priority: priorityFilter !== 'all' ? priorityFilter : '',
        channel: channelFilter !== 'all' ? channelFilter : '',
        category: categoryFilter !== 'all' ? categoryFilter : '',
        submitter_type: submitterTypeFilter !== 'all' ? submitterTypeFilter : '',
        sort_by: sortBy,
        sort_order: sortOrder,
        limit: '50'
      });

      const response = await fetch(`/api/admin/support?${params}`);
      if (!response.ok) throw new Error('Failed to load tickets');
      
      const data = await response.json();
      setTickets(data.tickets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/support/stats');
      if (!response.ok) throw new Error('Failed to load stats');
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadTicketMessages = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/admin/support/${ticketId}/messages`);
      if (!response.ok) throw new Error('Failed to load messages');
      
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleTicketClick = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    await loadTicketMessages(ticket.id);
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/support/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update status');
      
      await loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus as any });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleAssignTicket = async (ticketId: string, adminId: string) => {
    try {
      const response = await fetch(`/api/admin/support/${ticketId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: adminId })
      });

      if (!response.ok) throw new Error('Failed to assign ticket');
      
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign ticket');
    }
  };

  const handleSendResponse = async () => {
    if (!selectedTicket || !responseMessage.trim()) return;

    try {
      const response = await fetch(`/api/admin/support/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: responseMessage,
          is_internal: isInternal
        })
      });

      if (!response.ok) throw new Error('Failed to send response');
      
      setResponseMessage('');
      setIsInternal(false);
      await loadTicketMessages(selectedTicket.id);
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send response');
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (searchTerm && !ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !ticket.submitter_name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const formatResponseTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
  };

  if (loading && tickets.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Laddar supportärenden...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Totalt ärenden</p>
                  <p className="text-2xl font-bold">{stats.total_tickets}</p>
                </div>
                <MessageCircle className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Öppna ärenden</p>
                  <p className="text-2xl font-bold">{stats.open_tickets}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Försenade</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue_tickets}</p>
                </div>
                <Clock className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">SLA-efterlevnad</p>
                  <p className="text-2xl font-bold text-green-600">{Math.round(stats.sla_compliance)}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Sök och filtrera ärenden</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Sök</Label>
              <Input
                id="search"
                placeholder="Sök i titel, beskrivning, namn..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla statusar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla statusar</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority-filter">Prioritet</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla prioriteter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla prioriteter</SelectItem>
                  {Object.entries(priorityConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="channel-filter">Kanal</Label>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla kanaler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla kanaler</SelectItem>
                  {Object.entries(channelConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-4 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setPriorityFilter('all');
                setChannelFilter('all');
                setCategoryFilter('all');
                setSubmitterTypeFilter('all');
              }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Rensa filter
            </Button>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Sortera:</span>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_at">Senast uppdaterad</SelectItem>
                  <SelectItem value="created_at">Skapad</SelectItem>
                  <SelectItem value="priority">Prioritet</SelectItem>
                  <SelectItem value="response_due_at">Svarstid</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle>Supportärenden ({filteredTickets.length})</CardTitle>
          <CardDescription>
            Hantera kundsupport och företagssupport
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredTickets.map((ticket) => {
              const StatusIcon = statusConfig[ticket.status].icon;
              const ChannelIcon = channelConfig[ticket.channel].icon;
              const isOverdue = new Date(ticket.response_due_at) < new Date() && !ticket.first_response_at;

              return (
                <div
                  key={ticket.id}
                  className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                    isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  }`}
                  onClick={() => handleTicketClick(ticket)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {ticket.title}
                        </h3>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-xs">
                            Försenat
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {ticket.description}
                      </p>

                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          {ticket.submitter_type === 'customer' ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Building className="h-3 w-3" />
                          )}
                          <span>{ticket.submitter_name}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <ChannelIcon className={`h-3 w-3 ${channelConfig[ticket.channel].color}`} />
                          <span>{channelConfig[ticket.channel].label}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: sv })}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <MessageCircle className="h-3 w-3" />
                          <span>{ticket.message_count} meddelanden</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-4">
                      <Badge className={priorityConfig[ticket.priority].color}>
                        {priorityConfig[ticket.priority].label}
                      </Badge>

                      <Badge className={statusConfig[ticket.status].color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[ticket.status].label}
                      </Badge>

                      <Badge variant="outline" className={categoryConfig[ticket.category].color}>
                        {categoryConfig[ticket.category].label}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTickets.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Inga ärenden hittades med aktuella filter.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <span>{selectedTicket.title}</span>
                  <Badge className={statusConfig[selectedTicket.status].color}>
                    {statusConfig[selectedTicket.status].label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Ärende #{selectedTicket.id} • {channelConfig[selectedTicket.channel].label} • 
                  {formatDistanceToNow(new Date(selectedTicket.created_at), { addSuffix: true, locale: sv })}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-4">
                <TabsList>
                  <TabsTrigger value="details">Detaljer</TabsTrigger>
                  <TabsTrigger value="messages">Konversation ({messages.length})</TabsTrigger>
                  <TabsTrigger value="actions">Åtgärder</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Beskrivning</Label>
                      <p className="text-sm text-gray-700 mt-1">{selectedTicket.description}</p>
                    </div>

                    <div>
                      <Label>Kontaktinformation</Label>
                      <p className="text-sm text-gray-700 mt-1">
                        {selectedTicket.submitter_name} ({selectedTicket.submitter_contact})
                      </p>
                    </div>

                    <div>
                      <Label>Prioritet</Label>
                      <Badge className={priorityConfig[selectedTicket.priority].color}>
                        {priorityConfig[selectedTicket.priority].label}
                      </Badge>
                    </div>

                    <div>
                      <Label>Kategori</Label>
                      <Badge variant="outline" className={categoryConfig[selectedTicket.category].color}>
                        {categoryConfig[selectedTicket.category].label}
                      </Badge>
                    </div>

                    <div>
                      <Label>Tilldelad</Label>
                      <p className="text-sm text-gray-700 mt-1">
                        {selectedTicket.assigned_admin_name || 'Ej tilldelad'}
                      </p>
                    </div>

                    <div>
                      <Label>Svarstid</Label>
                      <p className="text-sm text-gray-700 mt-1">
                        {format(new Date(selectedTicket.response_due_at), 'PPp', { locale: sv })}
                      </p>
                    </div>
                  </div>

                  {selectedTicket.tags.length > 0 && (
                    <div>
                      <Label>Taggar</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedTicket.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="messages" className="space-y-4">
                  <div className="max-h-96 overflow-y-auto space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`p-3 rounded-lg ${
                          message.sender_type === 'admin'
                            ? 'bg-blue-50 border-l-4 border-blue-400'
                            : message.is_internal
                            ? 'bg-yellow-50 border-l-4 border-yellow-400'
                            : 'bg-gray-50 border-l-4 border-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{message.sender_name}</span>
                            {message.is_internal && (
                              <Badge variant="outline" className="text-xs">Internt</Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {format(new Date(message.created_at), 'PPp', { locale: sv })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.message}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4">
                    <Label htmlFor="response">Nytt svar</Label>
                    <Textarea
                      id="response"
                      placeholder="Skriv ditt svar här..."
                      value={responseMessage}
                      onChange={(e) => setResponseMessage(e.target.value)}
                      className="mt-2"
                      rows={4}
                    />
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="internal"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded"
                        />
                        <Label htmlFor="internal" className="text-sm">Internt meddelande</Label>
                      </div>
                      
                      <Button onClick={handleSendResponse} disabled={!responseMessage.trim()}>
                        Skicka svar
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="actions" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Ändra status</Label>
                      <Select
                        value={selectedTicket.status}
                        onValueChange={(value) => handleStatusChange(selectedTicket.id, value)}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Tilldela administratör</Label>
                      <Select
                        value={selectedTicket.assigned_admin_id || ''}
                        onValueChange={(value) => handleAssignTicket(selectedTicket.id, value)}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Välj administratör" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Ingen tilldelning</SelectItem>
                          <SelectItem value="admin1">Admin 1</SelectItem>
                          <SelectItem value="admin2">Admin 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button variant="outline" className="flex-1">
                      <Edit className="h-4 w-4 mr-2" />
                      Redigera ärende
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <Archive className="h-4 w-4 mr-2" />
                      Arkivera
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}