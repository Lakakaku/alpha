'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  Clock, 
  Bell, 
  BellOff, 
  Settings, 
  Save, 
  CheckCircle,
  AlertTriangle,
  Globe,
  Calendar,
  CreditCard,
  Shield,
  Volume2,
  VolumeX,
  Smartphone,
  Monitor
} from 'lucide-react';

interface CommunicationPreferences {
  // General Settings
  language: 'sv' | 'en';
  timezone: string;
  
  // Notification Channels
  sms_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  
  // Contact Information
  primary_contact_phone: string;
  primary_contact_email: string;
  backup_contact_phone?: string;
  backup_contact_email?: string;
  
  // Notification Types
  verification_requests: {
    enabled: boolean;
    channels: ('sms' | 'email')[];
    advance_notice_days: number;
    reminder_frequency: 'daily' | 'every_2_days' | 'weekly';
  };
  
  payment_invoices: {
    enabled: boolean;
    channels: ('sms' | 'email')[];
    due_date_reminders: boolean;
    overdue_escalation: boolean;
  };
  
  system_alerts: {
    enabled: boolean;
    channels: ('sms' | 'email')[];
    severity_threshold: 'low' | 'medium' | 'high';
  };
  
  feedback_summaries: {
    enabled: boolean;
    channels: ('email')[];
    frequency: 'daily' | 'weekly' | 'monthly';
    include_analytics: boolean;
  };
  
  // Quiet Hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  emergency_override: boolean;
  
  // Delivery Preferences
  sms_delivery_speed: 'immediate' | 'batch' | 'scheduled';
  email_format: 'text' | 'html' | 'both';
  consolidate_notifications: boolean;
}

interface NotificationTemplate {
  id: string;
  name: string;
  type: 'verification_request' | 'payment_invoice' | 'system_alert' | 'feedback_summary';
  language: 'sv' | 'en';
  is_customizable: boolean;
  preview_content: string;
}

const languageOptions = {
  sv: { label: 'Svenska', flag: '🇸🇪' },
  en: { label: 'English', flag: '🇬🇧' }
};

const timezoneOptions = [
  { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'UTC', label: 'UTC' }
];

const severityLevels = {
  low: { label: 'Låg', description: 'Informativa meddelanden och statusuppdateringar', color: 'bg-green-100 text-green-800' },
  medium: { label: 'Medium', description: 'Viktiga meddelanden som kräver uppmärksamhet', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'Hög', description: 'Kritiska varningar som kräver omedelbar åtgärd', color: 'bg-red-100 text-red-800' }
};

export default function CommunicationPreferences() {
  const [preferences, setPreferences] = useState<CommunicationPreferences | null>(null);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [testingNotifications, setTestingNotifications] = useState(false);

  useEffect(() => {
    loadPreferences();
    loadTemplates();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/business/communication/preferences');
      if (!response.ok) throw new Error('Kunde inte ladda inställningar');
      
      const data = await response.json();
      setPreferences(data.preferences || getDefaultPreferences());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda inställningar');
      setPreferences(getDefaultPreferences());
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/business/communication/templates');
      if (!response.ok) throw new Error('Kunde inte ladda mallar');
      
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const getDefaultPreferences = (): CommunicationPreferences => ({
    language: 'sv',
    timezone: 'Europe/Stockholm',
    sms_enabled: true,
    email_enabled: true,
    push_enabled: false,
    primary_contact_phone: '',
    primary_contact_email: '',
    verification_requests: {
      enabled: true,
      channels: ['sms', 'email'],
      advance_notice_days: 3,
      reminder_frequency: 'daily'
    },
    payment_invoices: {
      enabled: true,
      channels: ['email'],
      due_date_reminders: true,
      overdue_escalation: true
    },
    system_alerts: {
      enabled: true,
      channels: ['sms', 'email'],
      severity_threshold: 'medium'
    },
    feedback_summaries: {
      enabled: true,
      channels: ['email'],
      frequency: 'weekly',
      include_analytics: true
    },
    quiet_hours_enabled: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    emergency_override: true,
    sms_delivery_speed: 'immediate',
    email_format: 'html',
    consolidate_notifications: false
  });

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      setError(null);
      
      const response = await fetch('/api/business/communication/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });

      if (!response.ok) throw new Error('Kunde inte spara inställningar');
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara inställningar');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotifications = async () => {
    try {
      setTestingNotifications(true);
      setError(null);
      
      const response = await fetch('/api/business/communication/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sms_enabled: preferences?.sms_enabled,
          email_enabled: preferences?.email_enabled,
          phone: preferences?.primary_contact_phone,
          email: preferences?.primary_contact_email
        })
      });

      if (!response.ok) throw new Error('Kunde inte skicka testmeddelanden');
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte skicka testmeddelanden');
    } finally {
      setTestingNotifications(false);
    }
  };

  const updatePreferences = (updates: Partial<CommunicationPreferences>) => {
    if (!preferences) return;
    setPreferences({ ...preferences, ...updates });
  };

  const updateNotificationCategory = (category: keyof Pick<CommunicationPreferences, 'verification_requests' | 'payment_invoices' | 'system_alerts' | 'feedback_summaries'>, updates: any) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      [category]: { ...preferences[category], ...updates }
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Laddar kommunikationsinställningar...</div>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Kunde inte ladda kommunikationsinställningar. Försök igen senare.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Inställningar sparade framgångsrikt!</AlertDescription>
        </Alert>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Allmänna inställningar</span>
          </CardTitle>
          <CardDescription>
            Grundläggande inställningar för kommunikation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="language">Språk</Label>
              <Select
                value={preferences.language}
                onValueChange={(value: 'sv' | 'en') => updatePreferences({ language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(languageOptions).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.flag} {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="timezone">Tidszon</Label>
              <Select
                value={preferences.timezone}
                onValueChange={(value) => updatePreferences({ timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezoneOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-base font-medium">Kommunikationskanaler</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  <span>SMS</span>
                </div>
                <Switch
                  checked={preferences.sms_enabled}
                  onCheckedChange={(checked) => updatePreferences({ sms_enabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Mail className="h-5 w-5 text-green-600" />
                  <span>E-post</span>
                </div>
                <Switch
                  checked={preferences.email_enabled}
                  onCheckedChange={(checked) => updatePreferences({ email_enabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Bell className="h-5 w-5 text-purple-600" />
                  <span>Push</span>
                </div>
                <Switch
                  checked={preferences.push_enabled}
                  onCheckedChange={(checked) => updatePreferences({ push_enabled: checked })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Phone className="h-5 w-5" />
            <span>Kontaktinformation</span>
          </CardTitle>
          <CardDescription>
            Ange kontaktuppgifter för notifikationer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primary-phone">Primärt telefonnummer *</Label>
              <Input
                id="primary-phone"
                type="tel"
                placeholder="+46 70 123 45 67"
                value={preferences.primary_contact_phone}
                onChange={(e) => updatePreferences({ primary_contact_phone: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="primary-email">Primär e-postadress *</Label>
              <Input
                id="primary-email"
                type="email"
                placeholder="foretagskontakt@företag.se"
                value={preferences.primary_contact_email}
                onChange={(e) => updatePreferences({ primary_contact_email: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="backup-phone">Reservtelefonnummer</Label>
              <Input
                id="backup-phone"
                type="tel"
                placeholder="+46 70 987 65 43"
                value={preferences.backup_contact_phone || ''}
                onChange={(e) => updatePreferences({ backup_contact_phone: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="backup-email">Reserve-postadress</Label>
              <Input
                id="backup-email"
                type="email"
                placeholder="backup@företag.se"
                value={preferences.backup_contact_email || ''}
                onChange={(e) => updatePreferences({ backup_contact_email: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notifikationsinställningar</span>
          </CardTitle>
          <CardDescription>
            Konfigurera olika typer av meddelanden
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Verification Requests */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Verifieringsbegäranden</h4>
                <p className="text-sm text-gray-600">Meddelanden om verifiering av feedback</p>
              </div>
              <Switch
                checked={preferences.verification_requests.enabled}
                onCheckedChange={(checked) => updateNotificationCategory('verification_requests', { enabled: checked })}
              />
            </div>

            {preferences.verification_requests.enabled && (
              <div className="pl-4 space-y-4">
                <div>
                  <Label>Kanaler</Label>
                  <div className="flex space-x-4 mt-2">
                    <label className="flex items-center space-x-2">
                      <Checkbox
                        checked={preferences.verification_requests.channels.includes('sms')}
                        onCheckedChange={(checked) => {
                          const channels = checked
                            ? [...preferences.verification_requests.channels, 'sms']
                            : preferences.verification_requests.channels.filter(c => c !== 'sms');
                          updateNotificationCategory('verification_requests', { channels });
                        }}
                      />
                      <span>SMS</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <Checkbox
                        checked={preferences.verification_requests.channels.includes('email')}
                        onCheckedChange={(checked) => {
                          const channels = checked
                            ? [...preferences.verification_requests.channels, 'email']
                            : preferences.verification_requests.channels.filter(c => c !== 'email');
                          updateNotificationCategory('verification_requests', { channels });
                        }}
                      />
                      <span>E-post</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Förhandsvarning (dagar)</Label>
                    <Select
                      value={preferences.verification_requests.advance_notice_days.toString()}
                      onValueChange={(value) => updateNotificationCategory('verification_requests', { advance_notice_days: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 dag</SelectItem>
                        <SelectItem value="2">2 dagar</SelectItem>
                        <SelectItem value="3">3 dagar</SelectItem>
                        <SelectItem value="5">5 dagar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Påminnelsefrekvens</Label>
                    <Select
                      value={preferences.verification_requests.reminder_frequency}
                      onValueChange={(value: 'daily' | 'every_2_days' | 'weekly') => updateNotificationCategory('verification_requests', { reminder_frequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Dagligen</SelectItem>
                        <SelectItem value="every_2_days">Varannan dag</SelectItem>
                        <SelectItem value="weekly">Veckovis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Payment Invoices */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Betalningsfakturor</h4>
                <p className="text-sm text-gray-600">Meddelanden om fakturor och betalningar</p>
              </div>
              <Switch
                checked={preferences.payment_invoices.enabled}
                onCheckedChange={(checked) => updateNotificationCategory('payment_invoices', { enabled: checked })}
              />
            </div>

            {preferences.payment_invoices.enabled && (
              <div className="pl-4 space-y-4">
                <div>
                  <Label>Kanaler</Label>
                  <div className="flex space-x-4 mt-2">
                    <label className="flex items-center space-x-2">
                      <Checkbox
                        checked={preferences.payment_invoices.channels.includes('sms')}
                        onCheckedChange={(checked) => {
                          const channels = checked
                            ? [...preferences.payment_invoices.channels, 'sms']
                            : preferences.payment_invoices.channels.filter(c => c !== 'sms');
                          updateNotificationCategory('payment_invoices', { channels });
                        }}
                      />
                      <span>SMS</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <Checkbox
                        checked={preferences.payment_invoices.channels.includes('email')}
                        onCheckedChange={(checked) => {
                          const channels = checked
                            ? [...preferences.payment_invoices.channels, 'email']
                            : preferences.payment_invoices.channels.filter(c => c !== 'email');
                          updateNotificationCategory('payment_invoices', { channels });
                        }}
                      />
                      <span>E-post</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <Checkbox
                      checked={preferences.payment_invoices.due_date_reminders}
                      onCheckedChange={(checked) => updateNotificationCategory('payment_invoices', { due_date_reminders: checked })}
                    />
                    <span>Påminnelser om förfallodatum</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <Checkbox
                      checked={preferences.payment_invoices.overdue_escalation}
                      onCheckedChange={(checked) => updateNotificationCategory('payment_invoices', { overdue_escalation: checked })}
                    />
                    <span>Eskalering vid försenade betalningar</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* System Alerts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Systemvarningar</h4>
                <p className="text-sm text-gray-600">Meddelanden om systemstatus och problem</p>
              </div>
              <Switch
                checked={preferences.system_alerts.enabled}
                onCheckedChange={(checked) => updateNotificationCategory('system_alerts', { enabled: checked })}
              />
            </div>

            {preferences.system_alerts.enabled && (
              <div className="pl-4 space-y-4">
                <div>
                  <Label>Kanaler</Label>
                  <div className="flex space-x-4 mt-2">
                    <label className="flex items-center space-x-2">
                      <Checkbox
                        checked={preferences.system_alerts.channels.includes('sms')}
                        onCheckedChange={(checked) => {
                          const channels = checked
                            ? [...preferences.system_alerts.channels, 'sms']
                            : preferences.system_alerts.channels.filter(c => c !== 'sms');
                          updateNotificationCategory('system_alerts', { channels });
                        }}
                      />
                      <span>SMS</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <Checkbox
                        checked={preferences.system_alerts.channels.includes('email')}
                        onCheckedChange={(checked) => {
                          const channels = checked
                            ? [...preferences.system_alerts.channels, 'email']
                            : preferences.system_alerts.channels.filter(c => c !== 'email');
                          updateNotificationCategory('system_alerts', { channels });
                        }}
                      />
                      <span>E-post</span>
                    </label>
                  </div>
                </div>

                <div>
                  <Label>Allvarlighetströskel</Label>
                  <RadioGroup
                    value={preferences.system_alerts.severity_threshold}
                    onValueChange={(value: 'low' | 'medium' | 'high') => updateNotificationCategory('system_alerts', { severity_threshold: value })}
                    className="mt-2 space-y-2"
                  >
                    {Object.entries(severityLevels).map(([key, config]) => (
                      <div key={key} className="flex items-start space-x-2">
                        <RadioGroupItem value={key} id={`severity-${key}`} className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor={`severity-${key}`} className="flex items-center space-x-2">
                            <Badge className={config.color}>{config.label}</Badge>
                          </Label>
                          <p className="text-sm text-gray-600 mt-1">{config.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Feedback Summaries */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Feedbacksammanfattningar</h4>
                <p className="text-sm text-gray-600">Regelbundna rapporter om kundrespons</p>
              </div>
              <Switch
                checked={preferences.feedback_summaries.enabled}
                onCheckedChange={(checked) => updateNotificationCategory('feedback_summaries', { enabled: checked })}
              />
            </div>

            {preferences.feedback_summaries.enabled && (
              <div className="pl-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Frekvens</Label>
                    <Select
                      value={preferences.feedback_summaries.frequency}
                      onValueChange={(value: 'daily' | 'weekly' | 'monthly') => updateNotificationCategory('feedback_summaries', { frequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Dagligen</SelectItem>
                        <SelectItem value="weekly">Veckovis</SelectItem>
                        <SelectItem value="monthly">Månadsvis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2 mt-8">
                    <Checkbox
                      checked={preferences.feedback_summaries.include_analytics}
                      onCheckedChange={(checked) => updateNotificationCategory('feedback_summaries', { include_analytics: checked })}
                    />
                    <Label>Inkludera detaljerad analys</Label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Volume2 className="h-5 w-5" />
            <span>Tysta timmar</span>
          </CardTitle>
          <CardDescription>
            Konfigurera när notifikationer ska pausas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Aktivera tysta timmar</Label>
              <p className="text-sm text-gray-600">Pausa icke-kritiska notifikationer</p>
            </div>
            <Switch
              checked={preferences.quiet_hours_enabled}
              onCheckedChange={(checked) => updatePreferences({ quiet_hours_enabled: checked })}
            />
          </div>

          {preferences.quiet_hours_enabled && (
            <div className="space-y-4 pl-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quiet-start">Starttid</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={preferences.quiet_hours_start}
                    onChange={(e) => updatePreferences({ quiet_hours_start: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="quiet-end">Sluttid</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={preferences.quiet_hours_end}
                    onChange={(e) => updatePreferences({ quiet_hours_end: e.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-center space-x-2">
                <Checkbox
                  checked={preferences.emergency_override}
                  onCheckedChange={(checked) => updatePreferences({ emergency_override: checked })}
                />
                <span>Tillåt kritiska varningar under tysta timmar</span>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Avancerade inställningar</span>
          </CardTitle>
          <CardDescription>
            Leverans- och formatinställningar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>SMS-leveranshastighet</Label>
              <Select
                value={preferences.sms_delivery_speed}
                onValueChange={(value: 'immediate' | 'batch' | 'scheduled') => updatePreferences({ sms_delivery_speed: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Omedelbar</SelectItem>
                  <SelectItem value="batch">Batch (var 15:e minut)</SelectItem>
                  <SelectItem value="scheduled">Schemalagd</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>E-postformat</Label>
              <Select
                value={preferences.email_format}
                onValueChange={(value: 'text' | 'html' | 'both') => updatePreferences({ email_format: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="both">Båda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center space-x-2">
            <Checkbox
              checked={preferences.consolidate_notifications}
              onCheckedChange={(checked) => updatePreferences({ consolidate_notifications: checked })}
            />
            <span>Gruppera liknande notifikationer</span>
          </label>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={handleTestNotifications}
          disabled={testingNotifications || !preferences.primary_contact_phone || !preferences.primary_contact_email}
        >
          {testingNotifications ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Skickar test...
            </>
          ) : (
            <>
              <Bell className="h-4 w-4 mr-2" />
              Skicka testmeddelanden
            </>
          )}
        </Button>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Sparar...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Spara inställningar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}