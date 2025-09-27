'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Input } from '@vocilia/ui';
import { Alert, AlertDescription } from '@vocilia/ui';
// TODO: Add missing UI components to @vocilia/ui
// import { Label } from '@vocilia/ui';
// import { Switch } from '@vocilia/ui';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vocilia/ui';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
import { 
  Settings, 
  ArrowLeft, 
  Save, 
  RefreshCw,
  Shield,
  Clock,
  Download,
  Palette,
  Bell,
  Database,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { useBusinessAuth } from '@/hooks/use-business-auth';
import { useQRService } from '@/services/qr/qr-client.service';
import { toast } from '@/hooks/use-toast';

interface QRSettings {
  // Global Settings
  autoRegenerate: boolean;
  regenerateInterval: number; // hours
  transitionPeriod: number; // hours
  maxConcurrentScans: number;
  
  // Security Settings
  enableFraudDetection: boolean;
  maxScansPerSession: number;
  maxScansPerIP: number;
  blockSuspiciousActivity: boolean;
  
  // Analytics Settings
  enableAnalytics: boolean;
  retentionPeriod: number; // days
  aggregationInterval: number; // minutes
  enableRealTimeTracking: boolean;
  
  // Download Settings
  defaultFormat: 'pdf' | 'png' | 'svg';
  pdfPageSize: 'A4' | 'Letter' | 'A5' | 'A6';
  imageQuality: 'low' | 'medium' | 'high';
  includeAnalytics: boolean;
  
  // Notification Settings
  enableNotifications: boolean;
  notifyOnHighActivity: boolean;
  notifyOnErrors: boolean;
  notifyOnRegeneration: boolean;
  emailAlerts: boolean;
}

/**
 * QR Settings Page
 * 
 * Comprehensive settings interface for QR code management system.
 * Allows configuration of global preferences, security, analytics, and notifications.
 * 
 * Features:
 * - Global QR code settings
 * - Security and fraud detection
 * - Analytics configuration
 * - Download preferences
 * - Notification settings
 * - Backup and restore
 */
export default function QRSettingsPage() {
  const router = useRouter();
  const { business } = useBusinessAuth();
  const { loading } = useQRService();

  const [settings, setSettings] = useState<QRSettings>({
    // Default values
    autoRegenerate: false,
    regenerateInterval: 720, // 30 days
    transitionPeriod: 24,
    maxConcurrentScans: 100,
    
    enableFraudDetection: true,
    maxScansPerSession: 10,
    maxScansPerIP: 50,
    blockSuspiciousActivity: true,
    
    enableAnalytics: true,
    retentionPeriod: 365,
    aggregationInterval: 5,
    enableRealTimeTracking: true,
    
    defaultFormat: 'pdf',
    pdfPageSize: 'A4',
    imageQuality: 'high',
    includeAnalytics: false,
    
    enableNotifications: true,
    notifyOnHighActivity: true,
    notifyOnErrors: true,
    notifyOnRegeneration: false,
    emailAlerts: true
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Track changes
  const updateSetting = <K extends keyof QRSettings>(key: K, value: QRSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // TODO: Implement save settings API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setHasChanges(false);
      toast({
        title: "Settings Saved",
        description: "Your QR code settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettings = () => {
    setSettings({
      autoRegenerate: false,
      regenerateInterval: 720,
      transitionPeriod: 24,
      maxConcurrentScans: 100,
      
      enableFraudDetection: true,
      maxScansPerSession: 10,
      maxScansPerIP: 50,
      blockSuspiciousActivity: true,
      
      enableAnalytics: true,
      retentionPeriod: 365,
      aggregationInterval: 5,
      enableRealTimeTracking: true,
      
      defaultFormat: 'pdf',
      pdfPageSize: 'A4',
      imageQuality: 'high',
      includeAnalytics: false,
      
      enableNotifications: true,
      notifyOnHighActivity: true,
      notifyOnErrors: true,
      notifyOnRegeneration: false,
      emailAlerts: true
    });
    setHasChanges(true);
  };

  if (!business) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Business authentication required. Please log in to access settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">QR Code Settings</h1>
            <p className="text-gray-600">Configure your QR code management preferences</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleResetSettings}
            disabled={saving}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={!hasChanges || saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Alert */}
      {hasChanges && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Don't forget to save your settings.
          </AlertDescription>
        </Alert>
      )}

      {/* Settings Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Automatic Regeneration</Label>
                    <p className="text-sm text-gray-600">
                      Automatically regenerate QR codes at regular intervals
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoRegenerate}
                    onCheckedChange={(checked) => updateSetting('autoRegenerate', checked)}
                  />
                </div>

                {settings.autoRegenerate && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                    <div>
                      <Label htmlFor="regenerateInterval">Regeneration Interval (hours)</Label>
                      <Input
                        id="regenerateInterval"
                        type="number"
                        min="24"
                        max="8760"
                        value={settings.regenerateInterval}
                        onChange={(e) => updateSetting('regenerateInterval', parseInt(e.target.value))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {Math.round(settings.regenerateInterval / 24)} days
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="transitionPeriod">Transition Period (hours)</Label>
                      <Input
                        id="transitionPeriod"
                        type="number"
                        min="1"
                        max="168"
                        value={settings.transitionPeriod}
                        onChange={(e) => updateSetting('transitionPeriod', parseInt(e.target.value))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Grace period for old QR codes
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="maxConcurrentScans">Max Concurrent Scans</Label>
                  <Input
                    id="maxConcurrentScans"
                    type="number"
                    min="10"
                    max="1000"
                    value={settings.maxConcurrentScans}
                    onChange={(e) => updateSetting('maxConcurrentScans', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum simultaneous scan processing
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security & Fraud Detection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Enable Fraud Detection</Label>
                    <p className="text-sm text-gray-600">
                      Detect and prevent suspicious scanning activity
                    </p>
                  </div>
                  <Switch
                    checked={settings.enableFraudDetection}
                    onCheckedChange={(checked) => updateSetting('enableFraudDetection', checked)}
                  />
                </div>

                {settings.enableFraudDetection && (
                  <div className="space-y-4 ml-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="maxScansPerSession">Max Scans per Session</Label>
                        <Input
                          id="maxScansPerSession"
                          type="number"
                          min="1"
                          max="100"
                          value={settings.maxScansPerSession}
                          onChange={(e) => updateSetting('maxScansPerSession', parseInt(e.target.value))}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="maxScansPerIP">Max Scans per IP (hourly)</Label>
                        <Input
                          id="maxScansPerIP"
                          type="number"
                          min="1"
                          max="500"
                          value={settings.maxScansPerIP}
                          onChange={(e) => updateSetting('maxScansPerIP', parseInt(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Block Suspicious Activity</Label>
                        <p className="text-sm text-gray-600">
                          Automatically block IPs with suspicious patterns
                        </p>
                      </div>
                      <Switch
                        checked={settings.blockSuspiciousActivity}
                        onCheckedChange={(checked) => updateSetting('blockSuspiciousActivity', checked)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Settings */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Analytics Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Enable Analytics</Label>
                    <p className="text-sm text-gray-600">
                      Collect and analyze QR code usage data
                    </p>
                  </div>
                  <Switch
                    checked={settings.enableAnalytics}
                    onCheckedChange={(checked) => updateSetting('enableAnalytics', checked)}
                  />
                </div>

                {settings.enableAnalytics && (
                  <div className="space-y-4 ml-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="retentionPeriod">Data Retention (days)</Label>
                        <Input
                          id="retentionPeriod"
                          type="number"
                          min="30"
                          max="2555" // 7 years
                          value={settings.retentionPeriod}
                          onChange={(e) => updateSetting('retentionPeriod', parseInt(e.target.value))}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {Math.round(settings.retentionPeriod / 365)} years
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="aggregationInterval">Aggregation Interval (minutes)</Label>
                        <Select
                          value={settings.aggregationInterval.toString()}
                          onValueChange={(value) => updateSetting('aggregationInterval', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 minute</SelectItem>
                            <SelectItem value="5">5 minutes</SelectItem>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="60">1 hour</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Real-time Tracking</Label>
                        <p className="text-sm text-gray-600">
                          Enable real-time scan tracking and live updates
                        </p>
                      </div>
                      <Switch
                        checked={settings.enableRealTimeTracking}
                        onCheckedChange={(checked) => updateSetting('enableRealTimeTracking', checked)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Download Settings */}
        <TabsContent value="downloads">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Download Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="defaultFormat">Default Format</Label>
                  <Select
                    value={settings.defaultFormat}
                    onValueChange={(value: 'pdf' | 'png' | 'svg') => updateSetting('defaultFormat', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="svg">SVG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="pdfPageSize">PDF Page Size</Label>
                  <Select
                    value={settings.pdfPageSize}
                    onValueChange={(value: 'A4' | 'Letter' | 'A5' | 'A6') => updateSetting('pdfPageSize', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="Letter">Letter</SelectItem>
                      <SelectItem value="A5">A5</SelectItem>
                      <SelectItem value="A6">A6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="imageQuality">Image Quality</Label>
                  <Select
                    value={settings.imageQuality}
                    onValueChange={(value: 'low' | 'medium' | 'high') => updateSetting('imageQuality', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (faster)</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High (slower)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="includeAnalytics"
                    checked={settings.includeAnalytics}
                    onCheckedChange={(checked) => updateSetting('includeAnalytics', checked)}
                  />
                  <Label htmlFor="includeAnalytics">Include Analytics Data</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Enable Notifications</Label>
                    <p className="text-sm text-gray-600">
                      Receive notifications about QR code activity
                    </p>
                  </div>
                  <Switch
                    checked={settings.enableNotifications}
                    onCheckedChange={(checked) => updateSetting('enableNotifications', checked)}
                  />
                </div>

                {settings.enableNotifications && (
                  <div className="space-y-4 ml-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>High Activity Alerts</Label>
                          <p className="text-sm text-gray-600">
                            Notify when scan volume exceeds normal levels
                          </p>
                        </div>
                        <Switch
                          checked={settings.notifyOnHighActivity}
                          onCheckedChange={(checked) => updateSetting('notifyOnHighActivity', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Error Notifications</Label>
                          <p className="text-sm text-gray-600">
                            Alert on QR code errors and failures
                          </p>
                        </div>
                        <Switch
                          checked={settings.notifyOnErrors}
                          onCheckedChange={(checked) => updateSetting('notifyOnErrors', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Regeneration Alerts</Label>
                          <p className="text-sm text-gray-600">
                            Notify when QR codes are regenerated
                          </p>
                        </div>
                        <Switch
                          checked={settings.notifyOnRegeneration}
                          onCheckedChange={(checked) => updateSetting('notifyOnRegeneration', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Email Alerts</Label>
                          <p className="text-sm text-gray-600">
                            Send notifications via email
                          </p>
                        </div>
                        <Switch
                          checked={settings.emailAlerts}
                          onCheckedChange={(checked) => updateSetting('emailAlerts', checked)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}