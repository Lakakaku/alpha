'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Plus, Edit, Trash2, Copy, Eye, FileText, Globe, Calendar, CheckCircle, XCircle, MessageSquare, Code, Save, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface CommunicationTemplate {
  id: string;
  name: string;
  description: string;
  template_type: 'sms' | 'email' | 'push';
  category: 'reward_notification' | 'payment_confirmation' | 'verification_request' | 'payment_reminder' | 'support_response' | 'system_alert';
  language: 'sv' | 'en';
  subject?: string;
  content: string;
  variables: string[];
  is_active: boolean;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  usage_count: number;
  character_count: number;
  estimated_cost: number;
}

interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  content: string;
  subject?: string;
  created_by: string;
  created_at: string;
  is_current: boolean;
  change_notes?: string;
}

interface TemplateStats {
  total_templates: number;
  active_templates: number;
  sms_templates: number;
  email_templates: number;
  total_usage: number;
  avg_character_count: number;
  templates_by_language: Record<string, number>;
  templates_by_category: Record<string, number>;
}

interface TemplateValidation {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  variables_found: string[];
  character_count: number;
  estimated_sms_parts: number;
  estimated_cost_sek: number;
}

const templateTypes = {
  sms: { label: 'SMS', icon: MessageSquare, color: 'bg-blue-100 text-blue-800' },
  email: { label: 'E-post', icon: FileText, color: 'bg-green-100 text-green-800' },
  push: { label: 'Push', icon: Globe, color: 'bg-purple-100 text-purple-800' }
};

const templateCategories = {
  reward_notification: { label: 'Belöningsnotifiering', color: 'bg-green-50 border-green-200' },
  payment_confirmation: { label: 'Betalningsbekräftelse', color: 'bg-blue-50 border-blue-200' },
  verification_request: { label: 'Verifieringsbegäran', color: 'bg-purple-50 border-purple-200' },
  payment_reminder: { label: 'Betalningspåminnelse', color: 'bg-orange-50 border-orange-200' },
  support_response: { label: 'Supportsvar', color: 'bg-yellow-50 border-yellow-200' },
  system_alert: { label: 'Systemvarning', color: 'bg-red-50 border-red-200' }
};

const languages = {
  sv: { label: 'Svenska', flag: '🇸🇪' },
  en: { label: 'English', flag: '🇬🇧' }
};

const commonVariables = [
  '{{customer_name}}',
  '{{business_name}}',
  '{{reward_amount}}',
  '{{payment_date}}',
  '{{verification_deadline}}',
  '{{support_ticket_id}}',
  '{{store_name}}',
  '{{transaction_amount}}',
  '{{feedback_score}}',
  '{{contact_phone}}',
  '{{contact_email}}'
];

export default function TemplateManager() {
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CommunicationTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<CommunicationTemplate> | null>(null);
  const [validation, setValidation] = useState<TemplateValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTemplates();
    loadStats();
  }, [typeFilter, categoryFilter, languageFilter, statusFilter]);

  useEffect(() => {
    if (editingTemplate?.content) {
      validateTemplate(editingTemplate.content, editingTemplate.template_type || 'sms');
    }
  }, [editingTemplate?.content, editingTemplate?.template_type]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search: searchTerm,
        type: typeFilter !== 'all' ? typeFilter : '',
        category: categoryFilter !== 'all' ? categoryFilter : '',
        language: languageFilter !== 'all' ? languageFilter : '',
        status: statusFilter !== 'all' ? statusFilter : '',
        include_usage: 'true'
      });

      const response = await fetch(`/api/admin/templates?${params}`);
      if (!response.ok) throw new Error('Failed to load templates');
      
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/templates/stats');
      if (!response.ok) throw new Error('Failed to load stats');
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadTemplateVersions = async (templateId: string) => {
    try {
      const response = await fetch(`/api/admin/templates/${templateId}/versions`);
      if (!response.ok) throw new Error('Failed to load versions');
      
      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  };

  const validateTemplate = async (content: string, type: string) => {
    try {
      const response = await fetch('/api/admin/templates/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type })
      });

      if (!response.ok) throw new Error('Failed to validate template');
      
      const data = await response.json();
      setValidation(data);
    } catch (err) {
      console.error('Failed to validate template:', err);
    }
  };

  const handleCreateTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const response = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingTemplate,
          variables: validation?.variables_found || []
        })
      });

      if (!response.ok) throw new Error('Failed to create template');
      
      setShowCreateDialog(false);
      setEditingTemplate(null);
      setValidation(null);
      await loadTemplates();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate?.id) return;

    try {
      const response = await fetch(`/api/admin/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingTemplate,
          variables: validation?.variables_found || []
        })
      });

      if (!response.ok) throw new Error('Failed to update template');
      
      setShowEditDialog(false);
      setEditingTemplate(null);
      setValidation(null);
      await loadTemplates();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna mall?')) return;

    try {
      const response = await fetch(`/api/admin/templates/${templateId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete template');
      
      await loadTemplates();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  const handleDuplicateTemplate = async (template: CommunicationTemplate) => {
    setEditingTemplate({
      name: `${template.name} (kopia)`,
      description: template.description,
      template_type: template.template_type,
      category: template.category,
      language: template.language,
      subject: template.subject,
      content: template.content,
      is_active: false
    });
    setShowCreateDialog(true);
  };

  const handleToggleActive = async (templateId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      });

      if (!response.ok) throw new Error('Failed to update template status');
      
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template status');
    }
  };

  const renderPreview = (content: string, variables: Record<string, string>) => {
    let preview = content;
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      preview = preview.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });
    return preview;
  };

  const filteredTemplates = templates.filter(template => {
    if (searchTerm && !template.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !template.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !template.content.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  if (loading && templates.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Laddar mallar...</div>
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
                  <p className="text-sm font-medium text-gray-600">Totalt mallar</p>
                  <p className="text-2xl font-bold">{stats.total_templates}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Aktiva mallar</p>
                  <p className="text-2xl font-bold">{stats.active_templates}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">SMS-mallar</p>
                  <p className="text-2xl font-bold">{stats.sms_templates}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total användning</p>
                  <p className="text-2xl font-bold">{stats.total_usage.toLocaleString()}</p>
                </div>
                <Globe className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mallhantering</CardTitle>
              <CardDescription>Hantera SMS- och e-postmallar för kommunikation</CardDescription>
            </div>
            <Button onClick={() => {
              setEditingTemplate({
                name: '',
                description: '',
                template_type: 'sms',
                category: 'reward_notification',
                language: 'sv',
                content: '',
                is_active: true
              });
              setShowCreateDialog(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Ny mall
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="search">Sök</Label>
              <Input
                id="search"
                placeholder="Sök mallar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="type-filter">Typ</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla typer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla typer</SelectItem>
                  {Object.entries(templateTypes).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category-filter">Kategori</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla kategorier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla kategorier</SelectItem>
                  {Object.entries(templateCategories).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="language-filter">Språk</Label>
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla språk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla språk</SelectItem>
                  {Object.entries(languages).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.flag} {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla statusar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla statusar</SelectItem>
                  <SelectItem value="active">Aktiva</SelectItem>
                  <SelectItem value="inactive">Inaktiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => {
          const TypeIcon = templateTypes[template.template_type].icon;
          const categoryConfig = templateCategories[template.category];
          const languageConfig = languages[template.language];

          return (
            <Card key={template.id} className={`cursor-pointer hover:shadow-md transition-shadow ${!template.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge className={templateTypes[template.template_type].color}>
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {templateTypes[template.template_type].label}
                      </Badge>
                      <Badge variant="outline">
                        {languageConfig.flag} {languageConfig.label}
                      </Badge>
                      {!template.is_active && (
                        <Badge variant="secondary">Inaktiv</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                    <CardDescription className="line-clamp-2">{template.description}</CardDescription>
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2">
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={(checked) => handleToggleActive(template.id, checked)}
                      size="sm"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-3">
                  <Badge variant="outline" className={categoryConfig.color}>
                    {categoryConfig.label}
                  </Badge>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="line-clamp-3">{template.content}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{template.character_count} tecken</span>
                    <span>v{template.version}</span>
                    <span>{template.usage_count} användningar</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedTemplate(template);
                        loadTemplateVersions(template.id);
                        setShowVersionDialog(true);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Visa
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingTemplate(template);
                        setShowEditDialog(true);
                      }}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Redigera
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDuplicateTemplate(template)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Kopiera
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-500">
            Inga mallar hittades med aktuella filter.
          </div>
        )}
      </div>

      {/* Create/Edit Template Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={() => {
        setShowCreateDialog(false);
        setShowEditDialog(false);
        setEditingTemplate(null);
        setValidation(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showCreateDialog ? 'Skapa ny mall' : 'Redigera mall'}
            </DialogTitle>
            <DialogDescription>
              Konfigurera mall för kommunikation med kunder och företag
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <Tabs defaultValue="content" className="mt-4">
              <TabsList>
                <TabsTrigger value="content">Innehåll</TabsTrigger>
                <TabsTrigger value="settings">Inställningar</TabsTrigger>
                <TabsTrigger value="preview">Förhandsvisning</TabsTrigger>
                <TabsTrigger value="validation">Validering</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-name">Mallnamn</Label>
                    <Input
                      id="template-name"
                      value={editingTemplate.name || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      placeholder="T.ex. Belöningsnotifiering SMS"
                    />
                  </div>

                  <div>
                    <Label htmlFor="template-type">Typ</Label>
                    <Select
                      value={editingTemplate.template_type || 'sms'}
                      onValueChange={(value: any) => setEditingTemplate({ ...editingTemplate, template_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(templateTypes).map(([key, config]) => (
                          <SelectItem key={key} value={key}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="template-description">Beskrivning</Label>
                  <Input
                    id="template-description"
                    value={editingTemplate.description || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                    placeholder="Kort beskrivning av mallens syfte"
                  />
                </div>

                {editingTemplate.template_type === 'email' && (
                  <div>
                    <Label htmlFor="template-subject">Ämnesrad</Label>
                    <Input
                      id="template-subject"
                      value={editingTemplate.subject || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                      placeholder="E-postens ämnesrad"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="template-content">Mallinnehåll</Label>
                  <Textarea
                    id="template-content"
                    value={editingTemplate.content || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                    placeholder="Använd {{variable_name}} för dynamiskt innehåll"
                    rows={8}
                    className="font-mono"
                  />
                  <div className="mt-2 text-sm text-gray-600">
                    Tillgängliga variabler: {commonVariables.join(', ')}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {commonVariables.map((variable) => (
                    <Button
                      key={variable}
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const content = editingTemplate.content || '';
                        const newContent = content + (content.endsWith(' ') ? '' : ' ') + variable;
                        setEditingTemplate({ ...editingTemplate, content: newContent });
                      }}
                    >
                      <Code className="h-3 w-3 mr-1" />
                      {variable}
                    </Button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-category">Kategori</Label>
                    <Select
                      value={editingTemplate.category || 'reward_notification'}
                      onValueChange={(value: any) => setEditingTemplate({ ...editingTemplate, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(templateCategories).map(([key, config]) => (
                          <SelectItem key={key} value={key}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="template-language">Språk</Label>
                    <Select
                      value={editingTemplate.language || 'sv'}
                      onValueChange={(value: any) => setEditingTemplate({ ...editingTemplate, language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(languages).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.flag} {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="template-active"
                    checked={editingTemplate.is_active ?? true}
                    onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, is_active: checked })}
                  />
                  <Label htmlFor="template-active">Aktivera mall</Label>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="space-y-4">
                <div>
                  <Label>Testdata för förhandsvisning</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {commonVariables.map((variable) => {
                      const varName = variable.replace(/[{}]/g, '');
                      return (
                        <div key={variable}>
                          <Label htmlFor={`preview-${varName}`}>{variable}</Label>
                          <Input
                            id={`preview-${varName}`}
                            value={previewVariables[varName] || ''}
                            onChange={(e) => setPreviewVariables({
                              ...previewVariables,
                              [varName]: e.target.value
                            })}
                            placeholder={`Exempelvärde för ${variable}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label>Förhandsvisning</Label>
                  <div className="mt-2 p-4 border rounded-lg bg-gray-50">
                    {editingTemplate.template_type === 'email' && editingTemplate.subject && (
                      <div className="mb-3">
                        <strong>Ämne:</strong> {renderPreview(editingTemplate.subject, previewVariables)}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">
                      {renderPreview(editingTemplate.content || '', previewVariables)}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="validation" className="space-y-4">
                {validation && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      {validation.is_valid ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={validation.is_valid ? 'text-green-600' : 'text-red-600'}>
                        {validation.is_valid ? 'Mall är giltig' : 'Mall har valideringsfel'}
                      </span>
                    </div>

                    {validation.errors.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <h4 className="font-medium text-red-800 mb-2">Fel:</h4>
                        <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                          {validation.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {validation.warnings.length > 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="font-medium text-yellow-800 mb-2">Varningar:</h4>
                        <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                          {validation.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm text-gray-600">Teckenantal</div>
                          <div className="text-lg font-semibold">{validation.character_count}</div>
                        </CardContent>
                      </Card>

                      {editingTemplate.template_type === 'sms' && (
                        <>
                          <Card>
                            <CardContent className="p-4">
                              <div className="text-sm text-gray-600">SMS-delar</div>
                              <div className="text-lg font-semibold">{validation.estimated_sms_parts}</div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-4">
                              <div className="text-sm text-gray-600">Uppskattad kostnad</div>
                              <div className="text-lg font-semibold">{validation.estimated_cost_sek.toFixed(2)} SEK</div>
                            </CardContent>
                          </Card>
                        </>
                      )}
                    </div>

                    {validation.variables_found.length > 0 && (
                      <div>
                        <Label>Hittade variabler</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {validation.variables_found.map((variable) => (
                            <Badge key={variable} variant="outline">
                              {`{{${variable}}}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!validation && editingTemplate.content && (
                  <div className="text-center text-gray-500">
                    Validering pågår...
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setShowEditDialog(false);
                setEditingTemplate(null);
                setValidation(null);
              }}
            >
              Avbryt
            </Button>
            <Button
              onClick={showCreateDialog ? handleCreateTemplate : handleUpdateTemplate}
              disabled={!validation?.is_valid}
            >
              <Save className="h-4 w-4 mr-2" />
              {showCreateDialog ? 'Skapa mall' : 'Spara ändringar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Versions Dialog */}
      <Dialog open={showVersionDialog} onOpenChange={() => {
        setShowVersionDialog(false);
        setSelectedTemplate(null);
        setVersions([]);
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTemplate.name} - Versionshistorik</DialogTitle>
                <DialogDescription>
                  Visa och hantera olika versioner av mallen
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {versions.map((version) => (
                  <Card key={version.id} className={version.is_current ? 'border-blue-200 bg-blue-50' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">Version {version.version}</CardTitle>
                          <CardDescription>
                            {format(new Date(version.created_at), 'PPp', { locale: sv })} av {version.created_by}
                          </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          {version.is_current && (
                            <Badge className="bg-blue-100 text-blue-800">Aktuell</Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingTemplate({
                                ...selectedTemplate,
                                content: version.content,
                                subject: version.subject
                              });
                              setShowVersionDialog(false);
                              setShowEditDialog(true);
                            }}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Återställ
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {version.change_notes && (
                        <div className="mb-3">
                          <Label>Ändringsnotering</Label>
                          <p className="text-sm text-gray-600 mt-1">{version.change_notes}</p>
                        </div>
                      )}
                      
                      {version.subject && (
                        <div className="mb-3">
                          <Label>Ämne</Label>
                          <p className="text-sm text-gray-700 mt-1">{version.subject}</p>
                        </div>
                      )}
                      
                      <div>
                        <Label>Innehåll</Label>
                        <div className="mt-1 p-3 bg-gray-50 rounded border text-sm whitespace-pre-wrap font-mono">
                          {version.content}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {versions.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Ingen versionshistorik tillgänglig.
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