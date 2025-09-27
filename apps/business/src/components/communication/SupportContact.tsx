'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  DollarSign, 
  Shield, 
  Upload,
  X,
  Star,
  Calendar,
  Users
} from 'lucide-react';

interface SupportCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  priority: 'normal' | 'high' | 'urgent';
  sla_hours: number;
  available_channels: ('phone' | 'email' | 'chat')[];
}

interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'pending_response' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  sla_deadline: string;
  messages: SupportMessage[];
}

interface SupportMessage {
  id: string;
  content: string;
  from_support: boolean;
  created_at: string;
  attachments?: string[];
}

interface ContactInfo {
  business_name: string;
  contact_person: string;
  email: string;
  phone: string;
  organization_number: string;
}

const supportCategories: SupportCategory[] = [
  {
    id: 'verification',
    name: 'Verifiering & Granskning',
    description: 'Hjälp med verifieringsprocesser och databasretur',
    icon: Shield,
    priority: 'high',
    sla_hours: 2,
    available_channels: ['phone', 'email', 'chat']
  },
  {
    id: 'payment',
    name: 'Betalningar & Fakturering',
    description: 'Frågor om fakturor, betalningar och avgifter',
    icon: DollarSign,
    priority: 'high',
    sla_hours: 4,
    available_channels: ['phone', 'email', 'chat']
  },
  {
    id: 'technical',
    name: 'Teknisk Support',
    description: 'QR-koder, integration och systemfrågor',
    icon: FileText,
    priority: 'normal',
    sla_hours: 8,
    available_channels: ['email', 'chat']
  },
  {
    id: 'account',
    name: 'Kontoadministration',
    description: 'Kontoinställningar och användarhantering',
    icon: Users,
    priority: 'normal',
    sla_hours: 24,
    available_channels: ['email', 'chat']
  }
];

const priorityConfig = {
  low: { label: 'Låg', color: 'bg-gray-100 text-gray-700', textColor: 'text-gray-600' },
  medium: { label: 'Medel', color: 'bg-blue-100 text-blue-700', textColor: 'text-blue-600' },
  high: { label: 'Hög', color: 'bg-orange-100 text-orange-700', textColor: 'text-orange-600' },
  urgent: { label: 'Akut', color: 'bg-red-100 text-red-700', textColor: 'text-red-600' }
};

const statusConfig = {
  open: { label: 'Öppen', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Pågående', color: 'bg-yellow-100 text-yellow-700' },
  pending_response: { label: 'Väntar svar', color: 'bg-orange-100 text-orange-700' },
  resolved: { label: 'Löst', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Stängt', color: 'bg-gray-100 text-gray-700' }
};

export default function SupportContact() {
  const [activeTab, setActiveTab] = useState('create');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    business_name: '',
    contact_person: '',
    email: '',
    phone: '',
    organization_number: ''
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    files: [] as File[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  useEffect(() => {
    fetchContactInfo();
    fetchTickets();
  }, []);

  const fetchContactInfo = async () => {
    try {
      const response = await fetch('/api/business/contact-info');
      if (response.ok) {
        const data = await response.json();
        setContactInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch contact info:', error);
    }
  };

  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/business/support/tickets');
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files) {
      const fileArray = Array.from(files);
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['image/', 'application/pdf', 'text/', '.doc', '.docx'];
      
      const validFiles = fileArray.filter(file => {
        if (file.size > maxSize) {
          setSubmitMessage({ type: 'error', text: `Filen ${file.name} är för stor (max 10MB)` });
          return false;
        }
        
        const isValidType = allowedTypes.some(type => 
          file.type.startsWith(type) || file.name.toLowerCase().endsWith(type)
        );
        
        if (!isValidType) {
          setSubmitMessage({ type: 'error', text: `Filtypen för ${file.name} stöds inte` });
          return false;
        }
        
        return true;
      });
      
      setNewTicket(prev => ({ ...prev, files: [...prev.files, ...validFiles] }));
    }
  };

  const removeFile = (index: number) => {
    setNewTicket(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const handleSubmitTicket = async () => {
    if (!selectedCategory || !newTicket.subject.trim() || !newTicket.description.trim()) {
      setSubmitMessage({ type: 'error', text: 'Fyll i alla obligatoriska fält' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const formData = new FormData();
      formData.append('category', selectedCategory);
      formData.append('subject', newTicket.subject);
      formData.append('description', newTicket.description);
      
      newTicket.files.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      const response = await fetch('/api/business/support/tickets', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const ticket = await response.json();
        setSubmitMessage({ 
          type: 'success', 
          text: `Ärendet har skapats! Referensnummer: ${ticket.id}` 
        });
        setNewTicket({ subject: '', description: '', files: [] });
        setSelectedCategory('');
        fetchTickets();
      } else {
        const error = await response.json();
        setSubmitMessage({ type: 'error', text: error.message || 'Ett fel uppstod' });
      }
    } catch (error) {
      setSubmitMessage({ type: 'error', text: 'Nätverksfel - försök igen' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;

    setIsSendingMessage(true);
    try {
      const response = await fetch(`/api/business/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage })
      });

      if (response.ok) {
        const message = await response.json();
        setSelectedTicket(prev => prev ? {
          ...prev,
          messages: [...prev.messages, message]
        } : null);
        setNewMessage('');
        fetchTickets();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTimeLeft = (deadline: string) => {
    const now = new Date().getTime();
    const deadlineTime = new Date(deadline).getTime();
    const diff = deadlineTime - now;
    
    if (diff <= 0) return 'Försenad';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes} min kvar`;
    }
    if (hours < 24) return `${hours}h kvar`;
    
    const days = Math.floor(hours / 24);
    return `${days} dagar kvar`;
  };

  const selectedCategoryData = supportCategories.find(cat => cat.id === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Företagssupport</h2>
          <p className="text-gray-600">Få hjälp med verifiering, betalningar och tekniska frågor</p>
        </div>
      </div>

      {/* Quick Contact Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Phone className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Telefonsupport</p>
                <p className="text-sm text-gray-600">08-123 45 67</p>
                <p className="text-xs text-gray-500">Vardagar 08:00-17:00</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">E-postsupport</p>
                <p className="text-sm text-gray-600">support@vocilia.se</p>
                <p className="text-xs text-gray-500">Svar inom 2 timmar</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MessageCircle className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Livechatt</p>
                <p className="text-sm text-gray-600">Direkt kontakt</p>
                <p className="text-xs text-gray-500">Vardagar 08:00-17:00</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create">Skapa ärende</TabsTrigger>
          <TabsTrigger value="tickets">Mina ärenden ({tickets.length})</TabsTrigger>
          <TabsTrigger value="faq">Vanliga frågor</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Skapa nytt supportärende</CardTitle>
              <CardDescription>
                Välj ärendekategori för snabbare hantering och bättre support
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Ärendekategori *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {supportCategories.map((category) => {
                    const Icon = category.icon;
                    const isSelected = selectedCategory === category.id;
                    
                    return (
                      <div
                        key={category.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedCategory(category.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <Icon className={`h-5 w-5 mt-0.5 ${
                            isSelected ? 'text-blue-600' : 'text-gray-400'
                          }`} />
                          <div className="flex-1">
                            <h4 className={`font-medium ${
                              isSelected ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                              {category.name}
                            </h4>
                            <p className={`text-sm mt-1 ${
                              isSelected ? 'text-blue-700' : 'text-gray-600'
                            }`}>
                              {category.description}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${priorityConfig[category.priority].color}`}
                              >
                                {priorityConfig[category.priority].label} prioritet
                              </Badge>
                              <span className="text-xs text-gray-500">
                                SLA: {category.sla_hours}h
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedCategoryData && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{selectedCategoryData.name}</strong> - Förväntad svarstid: {selectedCategoryData.sla_hours} timmar. 
                    Tillgängliga kanaler: {selectedCategoryData.available_channels.map(ch => 
                      ch === 'phone' ? 'telefon' : ch === 'email' ? 'e-post' : 'chatt'
                    ).join(', ')}.
                  </AlertDescription>
                </Alert>
              )}

              {/* Ticket Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ämne *
                  </label>
                  <Input
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Kort beskrivning av ditt ärende"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beskrivning *
                  </label>
                  <Textarea
                    value={newTicket.description}
                    onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Beskriv ditt ärende i detalj..."
                    rows={5}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bifogade filer
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      Dra och släpp filer här eller klicka för att välja
                    </p>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => handleFileSelect(e.target.files)}
                      className="hidden"
                      id="file-upload"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt"
                    />
                    <label htmlFor="file-upload">
                      <Button variant="outline" className="cursor-pointer">
                        Välj filer
                      </Button>
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      Max 10MB per fil. Tillåtna format: PDF, DOC, DOCX, JPG, PNG, GIF, TXT
                    </p>
                  </div>

                  {newTicket.files.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {newTicket.files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm text-gray-700">{file.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {submitMessage && (
                <Alert className={submitMessage.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
                  {submitMessage.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                  <AlertDescription>{submitMessage.text}</AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleSubmitTicket}
                disabled={isSubmitting || !selectedCategory || !newTicket.subject.trim() || !newTicket.description.trim()}
                className="w-full"
              >
                {isSubmitting ? 'Skickar...' : 'Skapa ärende'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          {tickets.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Inga ärenden</h3>
                <p className="text-gray-600">Du har inga aktiva supportärenden</p>
              </CardContent>
            </Card>
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900">{ticket.subject}</h4>
                        <Badge className={statusConfig[ticket.status].color}>
                          {statusConfig[ticket.status].label}
                        </Badge>
                        <Badge variant="outline" className={priorityConfig[ticket.priority].color}>
                          {priorityConfig[ticket.priority].label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">#{ticket.id}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Skapad: {formatDate(ticket.created_at)}</span>
                        <span>Uppdaterad: {formatDate(ticket.updated_at)}</span>
                        {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                          <span className="text-orange-600">
                            SLA: {calculateTimeLeft(ticket.sla_deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setIsTicketDialogOpen(true);
                      }}
                    >
                      Visa detaljer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="faq" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Verifiering & Granskning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Hur lång tid tar verifieringsprocessen?</h4>
                  <p className="text-sm text-gray-600">
                    Verifiering sker veckovis. Ni får 5 arbetsdagar på er att granska och returnera databasen. 
                    Påminnelser skickas 3 dagar och 1 dag före deadline.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Vad händer om vi missar deadline?</h4>
                  <p className="text-sm text-gray-600">
                    Vid försenad verifiering kan belöningar annulleras och administrativa avgifter tillkomma. 
                    Kontakta oss omedelbart om ni behöver förlängning.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Betalningar & Fakturering</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">När skickas fakturor?</h4>
                  <p className="text-sm text-gray-600">
                    Fakturor skickas måndag efter avslutad verifieringsvecka. Betalningsvillkor är 30 dagar netto.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Vilka avgifter tillkommer?</h4>
                  <p className="text-sm text-gray-600">
                    20% administrativ avgift på totala belöningsutbetalningar. Inga dolda kostnader eller startavgifter.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Teknisk Support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Var hittar jag QR-koder för min butik?</h4>
                  <p className="text-sm text-gray-600">
                    QR-koder finns tillgängliga i företagsdashboarden under "Butiker". Ladda ned och skriv ut i A4-format.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Kan jag integrera med mitt kassasystem?</h4>
                  <p className="text-sm text-gray-600">
                    API-integration är tillgänglig för större företag. Kontakta teknisk support för mer information.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Ticket Detail Dialog */}
      <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <span>{selectedTicket.subject}</span>
                  <Badge className={statusConfig[selectedTicket.status].color}>
                    {statusConfig[selectedTicket.status].label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Ärende #{selectedTicket.id} • Skapad {formatDate(selectedTicket.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Messages */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedTicket.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg ${
                        message.from_support 
                          ? 'bg-blue-50 border-l-4 border-blue-400' 
                          : 'bg-gray-50 border-l-4 border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {message.from_support ? 'Vocilia Support' : contactInfo.contact_person || 'Du'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(message.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ))}
                </div>

                {/* Reply Form */}
                {selectedTicket.status !== 'closed' && (
                  <div className="space-y-3 border-t pt-4">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Skriv ditt svar här..."
                      rows={3}
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || isSendingMessage}
                      className="w-full"
                    >
                      {isSendingMessage ? 'Skickar...' : 'Skicka svar'}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}