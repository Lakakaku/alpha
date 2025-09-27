'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Tabs, TabsContent, TabsList, TabsTrigger, Badge, Alert, AlertDescription } from '@vocilia/ui';
import { 
  Plus, 
  MessageSquare, 
  Phone, 
  Mail, 
  Clock, 
  CheckCircle, 
  HelpCircle,
  ArrowRight,
  ExternalLink,
  Search,
  BookOpen,
  Zap,
  Shield
} from 'lucide-react';
import TicketCreationForm from '@/components/support/TicketCreationForm';
import TicketHistory from '@/components/support/TicketHistory';

interface SupportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  availability: string;
  sla: string;
  action: () => void;
  color: string;
}

interface QuickHelp {
  id: string;
  question: string;
  answer: string;
  category: 'payment' | 'technical' | 'account' | 'rewards';
  helpful_count: number;
}

const supportOptions: SupportOption[] = [
  {
    id: 'phone',
    title: 'Ring oss',
    description: 'Direkt hjälp via telefon för brådskande frågor',
    icon: Phone,
    availability: 'Vardagar 08:00-17:00',
    sla: 'Genomsnittlig väntetid < 30 sekunder',
    action: () => window.open('tel:+46850551000'),
    color: 'bg-green-50 border-green-200 hover:bg-green-100'
  },
  {
    id: 'email',
    title: 'E-post support',
    description: 'Skriftlig hjälp med dokumentation och uppföljning',
    icon: Mail,
    availability: '24/7 - vi svarar inom 2 timmar',
    sla: 'Svar inom 2 timmar (vardagar)',
    action: () => window.open('mailto:support@vocilia.se'),
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
  },
  {
    id: 'chat',
    title: 'Live chatt',
    description: 'Snabb hjälp online med vårt supportteam',
    icon: MessageSquare,
    availability: 'Vardagar 08:00-17:00',
    sla: 'Svar inom 2 timmar',
    action: () => {
      // Initialize chat widget
      console.log('Opening chat...');
    },
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
  }
];

const quickHelpItems: QuickHelp[] = [
  {
    id: '1',
    question: 'Hur fungerar belöningssystemet?',
    answer: 'Du får belöningar (2-15% av köpet) när du lämnar feedback via QR-koden efter köp. Belöningen beror på feedbackens kvalitet och betalas ut via Swish varje söndag.',
    category: 'rewards',
    helpful_count: 145
  },
  {
    id: '2',
    question: 'När får jag min Swish-betalning?',
    answer: 'Swish-betalningar skickas automatiskt varje söndag för föregående veckas verifierade belöningar. Du får SMS-bekräftelse när betalningen är skickad.',
    category: 'payment',
    helpful_count: 238
  },
  {
    id: '3',
    question: 'Varför fungerar inte QR-koden?',
    answer: 'Kontrollera att du har godkänt kamerarelatled för appen och att QR-koden är tydlig. Prova också att starta om appen. Koden är giltig i 30 minuter efter köp.',
    category: 'technical',
    helpful_count: 89
  },
  {
    id: '4',
    question: 'Kan jag ändra mitt telefonnummer?',
    answer: 'Ja, gå till Inställningar > Profil för att uppdatera ditt telefonnummer. Detta påverkar hur du får Swish-betalningar och SMS-notifikationer.',
    category: 'account',
    helpful_count: 76
  },
  {
    id: '5',
    question: 'Vad händer om min feedback inte godkänns?',
    answer: 'Om feedback inte uppfyller kvalitetskraven (för kort, irrelevant etc.) får du ingen belöning för det köpet. Du får en notifikation med förklaring.',
    category: 'rewards',
    helpful_count: 112
  },
  {
    id: '6',
    question: 'Hur säker är mina personuppgifter?',
    answer: 'Vi följer GDPR och använder bankgrads säkerhet. Dina uppgifter är krypterade och delas aldrig med tredje part utan ditt medgivande.',
    category: 'account',
    helpful_count: 67
  }
];

const categoryColors = {
  payment: 'bg-green-100 text-green-800',
  technical: 'bg-blue-100 text-blue-800',
  account: 'bg-purple-100 text-purple-800',
  rewards: 'bg-yellow-100 text-yellow-800'
};

const categoryLabels = {
  payment: 'Betalning',
  technical: 'Teknisk',
  account: 'Konto',
  rewards: 'Belöningar'
};

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState('help');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredQuickHelp = quickHelpItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Kundsupport</h1>
            <p className="text-gray-600">
              Vi hjälper dig med frågor om belöningar, betalningar och teknisk support
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="help" className="flex items-center space-x-2">
              <HelpCircle className="h-4 w-4" />
              <span>Snabbhjälp</span>
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Nytt ärende</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>Mina ärenden</span>
            </TabsTrigger>
          </TabsList>

          {/* Quick Help Tab */}
          <TabsContent value="help" className="space-y-6">
            {/* Contact Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {supportOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <Card key={option.id} className={`cursor-pointer transition-colors ${option.color}`}>
                    <CardContent className="p-6" onClick={option.action}>
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div className="p-3 rounded-full bg-white">
                          <Icon className="h-8 w-8 text-gray-700" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{option.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                        </div>
                        <div className="space-y-1 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{option.availability}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Zap className="h-3 w-3" />
                            <span>{option.sla}</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="w-full">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Kontakta nu
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Quick Help Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5" />
                  <span>Vanliga frågor</span>
                </CardTitle>
                <CardDescription>
                  Hitta snabba svar på de vanligaste frågorna
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search and Filter */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        placeholder="Sök i vanliga frågor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant={selectedCategory === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory('all')}
                    >
                      Alla
                    </Button>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <Button
                        key={key}
                        variant={selectedCategory === key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* FAQ List */}
                <div className="space-y-4">
                  {filteredQuickHelp.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-gray-900 flex-1">{item.question}</h3>
                        <div className="flex items-center space-x-2 ml-4">
                          <Badge className={categoryColors[item.category]}>
                            {categoryLabels[item.category]}
                          </Badge>
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <CheckCircle className="h-3 w-3" />
                            <span>{item.helpful_count}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">{item.answer}</p>
                    </div>
                  ))}

                  {filteredQuickHelp.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Inga frågor hittades som matchar din sökning.</p>
                      <p className="text-sm mt-1">Prova att söka på något annat eller skapa ett supportärende.</p>
                    </div>
                  )}
                </div>

                {/* Help Footer */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="text-center">
                    <p className="text-gray-600 mb-4">Hittade du inte svar på din fråga?</p>
                    <div className="flex justify-center space-x-4">
                      <Button onClick={() => setActiveTab('create')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Skapa supportärende
                      </Button>
                      <Button variant="outline" onClick={() => window.open('mailto:support@vocilia.se')}>
                        <Mail className="h-4 w-4 mr-2" />
                        E-posta oss
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Alert */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Systemstatus:</strong> Alla tjänster fungerar normalt. 
                Senast uppdaterad: {new Date().toLocaleString('sv-SE')}
                <Button variant="link" className="p-0 h-auto ml-2" asChild>
                  <a href="/status" target="_blank">
                    Visa detaljerad status <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Create Ticket Tab */}
          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Skapa supportärende</CardTitle>
                <CardDescription>
                  Beskriv ditt problem så hjälper vi dig så snart som möjligt
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TicketCreationForm />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ticket History Tab */}
          <TabsContent value="history" className="space-y-6">
            <TicketHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}