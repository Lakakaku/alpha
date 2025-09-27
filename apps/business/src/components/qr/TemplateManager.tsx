'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Input } from '@vocilia/ui';
import { Alert, AlertDescription } from '@vocilia/ui';
// TODO: Add missing UI components to @vocilia/ui
// import { Label } from '@vocilia/ui';
// import { Textarea } from '@vocilia/ui';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vocilia/ui';
// import { Switch } from '@vocilia/ui';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@vocilia/ui';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Eye, 
  Download,
  Upload,
  Palette,
  Settings,
  Search,
  Filter,
  Grid3X3,
  FileImage,
  Type,
  Save,
  X
} from 'lucide-react';
import { QRTemplate, QRTemplateConfig } from '@vocilia/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface TemplateManagerProps {
  templates: QRTemplate[];
  className?: string;
  onCreateTemplate?: (template: Partial<QRTemplate>) => Promise<QRTemplate>;
  onUpdateTemplate?: (id: string, updates: Partial<QRTemplate>) => Promise<QRTemplate>;
  onDeleteTemplate?: (id: string) => Promise<void>;
  onDuplicateTemplate?: (id: string, name?: string) => Promise<QRTemplate>;
  onPreviewTemplate?: (id: string, storeId?: string) => Promise<string>;
  onExportTemplate?: (id: string) => Promise<void>;
  onImportTemplate?: (data: any) => Promise<QRTemplate>;
}

/**
 * Template Manager Component
 * 
 * Comprehensive interface for managing QR code print templates.
 * Provides CRUD operations, visual editor, and template sharing.
 * 
 * Features:
 * - Template library management
 * - Visual template editor
 * - Real-time preview
 * - Template import/export
 * - Sharing and collaboration
 * - Custom branding options
 */
export function TemplateManager({
  templates = [],
  className,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onPreviewTemplate,
  onExportTemplate,
  onImportTemplate
}: TemplateManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<QRTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<QRTemplate>>({});
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Get unique tags for filtering
  const allTags = Array.from(new Set(templates.flatMap(t => t.tags || [])));

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = filterTag === 'all' || template.tags?.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  // Initialize edit form when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setEditForm(selectedTemplate);
    }
  }, [selectedTemplate]);

  const handleCreateNew = () => {
    const newTemplate: Partial<QRTemplate> = {
      name: 'New Template',
      description: '',
      config: getDefaultConfig(),
      isPublic: false,
      tags: []
    };
    setEditForm(newTemplate);
    setSelectedTemplate(null);
    setIsEditing(true);
  };

  const handleSaveTemplate = async () => {
    try {
      if (selectedTemplate) {
        // Update existing
        if (onUpdateTemplate) {
          const updated = await onUpdateTemplate(selectedTemplate.id, editForm);
          setSelectedTemplate(updated);
        }
      } else {
        // Create new
        if (onCreateTemplate) {
          const created = await onCreateTemplate(editForm);
          setSelectedTemplate(created);
        }
      }
      setIsEditing(false);
      toast({
        title: "Template Saved",
        description: `Template "${editForm.name}" has been saved successfully.`,
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (template: QRTemplate) => {
    if (!onDeleteTemplate) return;
    
    try {
      await onDeleteTemplate(template.id);
      if (selectedTemplate?.id === template.id) {
        setSelectedTemplate(null);
      }
      toast({
        title: "Template Deleted",
        description: `Template "${template.name}" has been deleted.`,
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateTemplate = async (template: QRTemplate) => {
    if (!onDuplicateTemplate) return;
    
    try {
      const duplicated = await onDuplicateTemplate(template.id, `${template.name} (Copy)`);
      setSelectedTemplate(duplicated);
      toast({
        title: "Template Duplicated",
        description: `Created copy of "${template.name}".`,
      });
    } catch (error) {
      toast({
        title: "Duplicate Failed",
        description: "Failed to duplicate template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePreviewTemplate = async (template: QRTemplate) => {
    if (!onPreviewTemplate) return;
    
    try {
      const url = await onPreviewTemplate(template.id);
      setPreviewUrl(url);
    } catch (error) {
      toast({
        title: "Preview Failed",
        description: "Failed to generate preview. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getDefaultConfig = (): QRTemplateConfig => ({
    pageSize: 'A4',
    qrSize: 200,
    qrPosition: { x: 50, y: 50 },
    showStoreName: true,
    showInstructions: true,
    showLogo: false,
    customText: '',
    colors: {
      background: '#ffffff',
      qr: '#000000',
      text: '#333333'
    },
    fonts: {
      storeName: { family: 'Arial', size: 24, weight: 'bold' },
      instructions: { family: 'Arial', size: 14, weight: 'normal' },
      customText: { family: 'Arial', size: 12, weight: 'normal' }
    },
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    layout: 'single',
    logoUrl: undefined
  });

  const updateConfig = (path: string, value: any) => {
    setEditForm(prev => {
      const newConfig = { ...prev.config };
      const keys = path.split('.');
      let current: any = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      
      return { ...prev, config: newConfig };
    });
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Template Manager</h2>
          <p className="text-gray-600">Create and manage custom QR code templates</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Library */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Templates</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedTemplate?.id === template.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium truncate">{template.name}</h4>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewTemplate(template);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateTemplate(template);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(template);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {template.tags?.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {template.tags && template.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                      {template.isPublic && (
                        <Badge variant="outline" className="text-xs">Public</Badge>
                      )}
                    </div>
                  </div>
                ))}
                
                {filteredTemplates.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileImage className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No templates found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Template Editor/Viewer */}
        <div className="lg:col-span-2">
          {selectedTemplate || isEditing ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {isEditing ? <Edit className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  {isEditing ? 'Edit Template' : 'Template Details'}
                </CardTitle>
                <div className="flex gap-2">
                  {!isEditing && selectedTemplate && (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  {isEditing && (
                    <>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button onClick={handleSaveTemplate}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                {isEditing ? (
                  <Tabs defaultValue="basic" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="basic">Basic</TabsTrigger>
                      <TabsTrigger value="layout">Layout</TabsTrigger>
                      <TabsTrigger value="styling">Styling</TabsTrigger>
                      <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>

                    {/* Basic Settings */}
                    <TabsContent value="basic" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name">Template Name</Label>
                          <Input
                            id="name"
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="pageSize">Page Size</Label>
                          <Select
                            value={editForm.config?.pageSize}
                            onValueChange={(value) => updateConfig('pageSize', value)}
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
                      </div>

                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="isPublic"
                          checked={editForm.isPublic || false}
                          onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isPublic: checked }))}
                        />
                        <Label htmlFor="isPublic">Make template public</Label>
                      </div>
                    </TabsContent>

                    {/* Layout Settings */}
                    <TabsContent value="layout" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>QR Code Size</Label>
                          <Input
                            type="number"
                            min="50"
                            max="500"
                            value={editForm.config?.qrSize || 200}
                            onChange={(e) => updateConfig('qrSize', parseInt(e.target.value))}
                          />
                        </div>
                        
                        <div>
                          <Label>Layout Type</Label>
                          <Select
                            value={editForm.config?.layout}
                            onValueChange={(value) => updateConfig('layout', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">Single QR</SelectItem>
                              <SelectItem value="grid-2x2">2x2 Grid</SelectItem>
                              <SelectItem value="grid-3x3">3x3 Grid</SelectItem>
                              <SelectItem value="strip">Strip Layout</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Content Options</Label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={editForm.config?.showStoreName || false}
                              onCheckedChange={(checked) => updateConfig('showStoreName', checked)}
                            />
                            <Label>Show Store Name</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={editForm.config?.showInstructions || false}
                              onCheckedChange={(checked) => updateConfig('showInstructions', checked)}
                            />
                            <Label>Show Instructions</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={editForm.config?.showLogo || false}
                              onCheckedChange={(checked) => updateConfig('showLogo', checked)}
                            />
                            <Label>Show Logo</Label>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Styling Settings */}
                    <TabsContent value="styling" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Background Color</Label>
                          <Input
                            type="color"
                            value={editForm.config?.colors?.background || '#ffffff'}
                            onChange={(e) => updateConfig('colors.background', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>QR Code Color</Label>
                          <Input
                            type="color"
                            value={editForm.config?.colors?.qr || '#000000'}
                            onChange={(e) => updateConfig('colors.qr', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Text Color</Label>
                          <Input
                            type="color"
                            value={editForm.config?.colors?.text || '#333333'}
                            onChange={(e) => updateConfig('colors.text', e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Custom Text</Label>
                        <Textarea
                          value={editForm.config?.customText || ''}
                          onChange={(e) => updateConfig('customText', e.target.value)}
                          placeholder="Add custom text to appear on the template..."
                          rows={3}
                        />
                      </div>
                    </TabsContent>

                    {/* Advanced Settings */}
                    <TabsContent value="advanced" className="space-y-4">
                      <div>
                        <Label>Margins (px)</Label>
                        <div className="grid grid-cols-4 gap-2 mt-1">
                          <Input
                            placeholder="Top"
                            type="number"
                            value={editForm.config?.margins?.top || 20}
                            onChange={(e) => updateConfig('margins.top', parseInt(e.target.value))}
                          />
                          <Input
                            placeholder="Right"
                            type="number"
                            value={editForm.config?.margins?.right || 20}
                            onChange={(e) => updateConfig('margins.right', parseInt(e.target.value))}
                          />
                          <Input
                            placeholder="Bottom"
                            type="number"
                            value={editForm.config?.margins?.bottom || 20}
                            onChange={(e) => updateConfig('margins.bottom', parseInt(e.target.value))}
                          />
                          <Input
                            placeholder="Left"
                            type="number"
                            value={editForm.config?.margins?.left || 20}
                            onChange={(e) => updateConfig('margins.left', parseInt(e.target.value))}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Tags</Label>
                        <Input
                          value={editForm.tags?.join(', ') || ''}
                          onChange={(e) => setEditForm(prev => ({ 
                            ...prev, 
                            tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) 
                          }))}
                          placeholder="Enter tags separated by commas"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  /* Template Details View */
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{selectedTemplate?.name}</h3>
                      {selectedTemplate?.description && (
                        <p className="text-gray-600">{selectedTemplate.description}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-3">Configuration</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Page Size:</span>
                            <span>{selectedTemplate?.config.pageSize}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>QR Size:</span>
                            <span>{selectedTemplate?.config.qrSize}px</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Layout:</span>
                            <span>{selectedTemplate?.config.layout}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3">Metadata</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Public:</span>
                            <span>{selectedTemplate?.isPublic ? 'Yes' : 'No'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Created:</span>
                            <span>{new Date(selectedTemplate?.createdAt || '').toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Usage Count:</span>
                            <span>{selectedTemplate?.usageCount || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedTemplate?.tags && selectedTemplate.tags.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-1">
                          {selectedTemplate.tags.map(tag => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center text-gray-500">
                  <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Template Selected</h3>
                  <p>Select a template from the library or create a new one to get started.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      {previewUrl && (
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl('')}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Template Preview</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img src={previewUrl} alt="Template Preview" className="max-w-full h-auto" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default TemplateManager;