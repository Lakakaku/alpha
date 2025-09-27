'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

// Types for support functionality
interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'verification' | 'qr' | 'calls' | 'rewards' | 'technical';
  priority: number;
}

interface SupportRequest {
  type: 'technical' | 'verification' | 'rewards' | 'general';
  subject: string;
  description: string;
  urgency: 'low' | 'medium' | 'high';
  contactMethod: 'email' | 'phone' | 'chat';
  diagnostics?: DiagnosticInfo;
}

interface DiagnosticInfo {
  userAgent: string;
  screenSize: string;
  connectionType: string;
  timestamp: string;
  currentPage: string;
  sessionId?: string;
  offlineStatus: boolean;
  supportedFeatures: string[];
}

interface SupportWidgetProps {
  className?: string;
  currentContext?: 'qr-scan' | 'verification' | 'call-waiting' | 'success' | 'error';
  sessionId?: string;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

// Contextual FAQ data
const contextualFAQ: Record<string, FAQItem[]> = {
  'qr-scan': [
    {
      id: 'qr-not-working',
      question: 'QR-koden fungerar inte',
      answer: 'Kontrollera att kameran har tillåtelse och att QR-koden är tydlig. Prova att hålla telefonen stadigt och justera belysningen.',
      category: 'qr',
      priority: 1
    },
    {
      id: 'camera-permission',
      question: 'Kameran fungerar inte',
      answer: 'Gå till webbläsarens inställningar och ge tillåtelse för kameraåtkomst. Du kan också prova att ladda om sidan.',
      category: 'technical',
      priority: 2
    }
  ],
  'verification': [
    {
      id: 'amount-incorrect',
      question: 'Beloppet stämmer inte',
      answer: 'Kontrollera att du har angett rätt belopp från kvittot. Inkludera inte moms om inte annat anges.',
      category: 'verification',
      priority: 1
    },
    {
      id: 'phone-format',
      question: 'Telefonnummerformat',
      answer: 'Ange ditt telefonnummer med landskod (+46 för Sverige) följt av numret utan inledande nolla.',
      category: 'verification',
      priority: 2
    }
  ],
  'call-waiting': [
    {
      id: 'call-delay',
      question: 'Samtalet tar lång tid',
      answer: 'Samtal kan ta 2-5 minuter att komma igång. Håll telefonen redo och kontrollera att ljudet är på.',
      category: 'calls',
      priority: 1
    },
    {
      id: 'call-quality',
      question: 'Dålig ljudkvalitet',
      answer: 'Kontrollera din internetanslutning och flytta till en plats med bättre täckning. Stäng andra appar som använder mikrofonen.',
      category: 'calls',
      priority: 2
    }
  ],
  'success': [
    {
      id: 'reward-timing',
      question: 'När får jag min belöning?',
      answer: 'Belöningar behandlas inom 24 timmar efter godkänt samtal. Du får ett SMS med bekräftelse.',
      category: 'rewards',
      priority: 1
    }
  ],
  'error': [
    {
      id: 'retry-process',
      question: 'Något gick fel, vad gör jag?',
      answer: 'Prova att ladda om sidan eller börja om från början. Om problemet kvarstår, kontakta supporten.',
      category: 'technical',
      priority: 1
    }
  ]
};

// Support contact methods
const supportChannels = {
  email: {
    label: 'E-post',
    description: 'Svar inom 24 timmar',
    action: 'mailto:support@vocilia.com',
    icon: '📧'
  },
  phone: {
    label: 'Telefon',
    description: 'Mån-Fre 9-17',
    action: 'tel:+46123456789',
    icon: '📞'
  },
  chat: {
    label: 'Live-chatt',
    description: 'Tillgänglig nu',
    action: '#chat',
    icon: '💬'
  }
};

export const SupportWidget: React.FC<SupportWidgetProps> = ({
  className,
  currentContext = 'qr-scan',
  sessionId,
  isOpen: controlledIsOpen,
  onToggle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'faq' | 'contact' | 'diagnostics'>('faq');
  const [supportRequest, setSupportRequest] = useState<Partial<SupportRequest>>({
    type: 'general',
    urgency: 'medium',
    contactMethod: 'email'
  });
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Handle controlled/uncontrolled state
  const isWidgetOpen = controlledIsOpen !== undefined ? controlledIsOpen : isOpen;

  const toggleWidget = () => {
    const newState = !isWidgetOpen;
    if (onToggle) {
      onToggle(newState);
    } else {
      setIsOpen(newState);
    }
  };

  // Collect diagnostic information
  useEffect(() => {
    const collectDiagnostics = () => {
      const nav = navigator as any;
      const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
      
      const diagnosticInfo: DiagnosticInfo = {
        userAgent: navigator.userAgent,
        screenSize: `${screen.width}x${screen.height}`,
        connectionType: connection?.effectiveType || 'unknown',
        timestamp: new Date().toISOString(),
        currentPage: window.location.pathname,
        sessionId,
        offlineStatus: !navigator.onLine,
        supportedFeatures: [
          'camera' in navigator.mediaDevices ? 'camera' : '',
          'serviceWorker' in navigator ? 'serviceWorker' : '',
          'indexedDB' in window ? 'indexedDB' : '',
          'localStorage' in window ? 'localStorage' : '',
          'geolocation' in navigator ? 'geolocation' : ''
        ].filter(Boolean)
      };
      
      setDiagnostics(diagnosticInfo);
    };

    if (isWidgetOpen) {
      collectDiagnostics();
    }
  }, [isWidgetOpen, sessionId]);

  // Get contextual FAQ items
  const getFAQItems = (): FAQItem[] => {
    return contextualFAQ[currentContext] || contextualFAQ['qr-scan'];
  };

  // Submit support request
  const handleSubmitRequest = async () => {
    if (!supportRequest.subject || !supportRequest.description) {
      return;
    }

    setIsSubmitting(true);
    try {
      const requestData: SupportRequest = {
        type: supportRequest.type || 'general',
        subject: supportRequest.subject,
        description: supportRequest.description,
        urgency: supportRequest.urgency || 'medium',
        contactMethod: supportRequest.contactMethod || 'email',
        diagnostics: diagnostics || undefined
      };

      // Submit to API
      const response = await fetch('/api/support/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        // Reset form and show success
        setSupportRequest({
          type: 'general',
          urgency: 'medium',
          contactMethod: 'email'
        });
        alert('Din supportförfrågan har skickats. Vi återkommer inom kort.');
        setActiveTab('faq');
      } else {
        throw new Error('Failed to submit request');
      }
    } catch (error) {
      console.error('Error submitting support request:', error);
      alert('Något gick fel när vi skulle skicka din förfrågan. Prova igen eller kontakta oss direkt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle external support channel
  const handleSupportChannel = (channel: keyof typeof supportChannels) => {
    const channelInfo = supportChannels[channel];
    if (channelInfo.action.startsWith('mailto:') || channelInfo.action.startsWith('tel:')) {
      window.location.href = channelInfo.action;
    } else if (channelInfo.action === '#chat') {
      // Implement chat widget opening
      console.log('Opening chat widget');
    }
  };

  // Close widget on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isWidgetOpen) {
        toggleWidget();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isWidgetOpen]);

  return (
    <div className={cn('fixed bottom-4 right-4 z-50', className)}>
      {/* Support Widget Toggle Button */}
      {!isWidgetOpen && (
        <Button
          onClick={toggleWidget}
          className="rounded-full w-14 h-14 bg-blue-600 hover:bg-blue-700 shadow-lg"
          aria-label="Öppna support"
        >
          <span className="text-xl">❓</span>
        </Button>
      )}

      {/* Support Widget Panel */}
      {isWidgetOpen && (
        <div
          ref={widgetRef}
          className="bg-white rounded-lg shadow-xl border border-gray-200 w-80 max-h-96 flex flex-col"
          role="dialog"
          aria-label="Support widget"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Hjälp & Support</h3>
            <Button
              onClick={toggleWidget}
              variant="ghost"
              size="sm"
              className="p-1"
              aria-label="Stäng support"
            >
              <span className="text-lg">✕</span>
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            {[
              { key: 'faq' as const, label: 'FAQ', icon: '❓' },
              { key: 'contact' as const, label: 'Kontakt', icon: '📞' },
              { key: 'diagnostics' as const, label: 'Info', icon: '🔧' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 px-3 py-2 text-sm font-medium text-center border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
                aria-selected={activeTab === tab.key}
                role="tab"
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* FAQ Tab */}
            {activeTab === 'faq' && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 text-sm">
                  Vanliga frågor för {currentContext === 'qr-scan' ? 'QR-skanning' : 
                                       currentContext === 'verification' ? 'verifiering' : 
                                       currentContext === 'call-waiting' ? 'samtal' : 
                                       currentContext === 'success' ? 'slutförande' : 'fel'}
                </h4>
                {getFAQItems().map((item) => (
                  <details key={item.id} className="group">
                    <summary className="cursor-pointer list-none font-medium text-sm text-gray-700 hover:text-gray-900 flex items-center justify-between">
                      {item.question}
                      <span className="ml-2 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                      {item.answer}
                    </div>
                  </details>
                ))}
              </div>
            )}

            {/* Contact Tab */}
            {activeTab === 'contact' && (
              <div className="space-y-4">
                {/* Quick Contact Channels */}
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900 text-sm">Kontakta oss direkt</h4>
                  {Object.entries(supportChannels).map(([key, channel]) => (
                    <button
                      key={key}
                      onClick={() => handleSupportChannel(key as keyof typeof supportChannels)}
                      className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center">
                        <span className="text-lg mr-3">{channel.icon}</span>
                        <div>
                          <div className="font-medium text-sm">{channel.label}</div>
                          <div className="text-xs text-gray-500">{channel.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Support Request Form */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 text-sm mb-3">Skicka supportärende</h4>
                  
                  {/* Issue Type */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Typ av problem
                    </label>
                    <select
                      value={supportRequest.type}
                      onChange={(e) => setSupportRequest(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="technical">Tekniskt problem</option>
                      <option value="verification">Verifieringsproblem</option>
                      <option value="rewards">Belöningsfråga</option>
                      <option value="general">Allmän fråga</option>
                    </select>
                  </div>

                  {/* Subject */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Ämne
                    </label>
                    <input
                      type="text"
                      value={supportRequest.subject || ''}
                      onChange={(e) => setSupportRequest(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      placeholder="Kort beskrivning av problemet"
                    />
                  </div>

                  {/* Description */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Beskrivning
                    </label>
                    <textarea
                      value={supportRequest.description || ''}
                      onChange={(e) => setSupportRequest(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm h-20 resize-none"
                      placeholder="Beskriv problemet i detalj"
                    />
                  </div>

                  {/* Contact Method */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Föredragen kontaktmetod
                    </label>
                    <select
                      value={supportRequest.contactMethod}
                      onChange={(e) => setSupportRequest(prev => ({ ...prev, contactMethod: e.target.value as any }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="email">E-post</option>
                      <option value="phone">Telefon</option>
                      <option value="chat">Chat</option>
                    </select>
                  </div>

                  <Button
                    onClick={handleSubmitRequest}
                    disabled={isSubmitting || !supportRequest.subject || !supportRequest.description}
                    className="w-full"
                    size="sm"
                  >
                    {isSubmitting ? 'Skickar...' : 'Skicka ärende'}
                  </Button>
                </div>
              </div>
            )}

            {/* Diagnostics Tab */}
            {activeTab === 'diagnostics' && diagnostics && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 text-sm">Systeminformation</h4>
                <div className="text-xs space-y-2 font-mono bg-gray-50 p-3 rounded">
                  <div><strong>Skärmstorlek:</strong> {diagnostics.screenSize}</div>
                  <div><strong>Anslutning:</strong> {diagnostics.connectionType}</div>
                  <div><strong>Offline:</strong> {diagnostics.offlineStatus ? 'Ja' : 'Nej'}</div>
                  <div><strong>Session:</strong> {diagnostics.sessionId || 'Ingen'}</div>
                  <div><strong>Funktioner:</strong> {diagnostics.supportedFeatures.join(', ')}</div>
                  <div><strong>Tidpunkt:</strong> {new Date(diagnostics.timestamp).toLocaleString('sv-SE')}</div>
                </div>
                <p className="text-xs text-gray-500">
                  Denna information hjälper oss att diagnostisera tekniska problem.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};