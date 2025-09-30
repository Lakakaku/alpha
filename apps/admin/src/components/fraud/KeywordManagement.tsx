'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Alert, AlertDescription } from '@vocilia/ui';
import { Input } from '@vocilia/ui';
import { Checkbox } from '@vocilia/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vocilia/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
import { 
  AlertTriangle, 
  Plus, 
  Search,
  Filter,
  Download,
  RefreshCw,
  Edit2,
  Trash2,
  Save,
  X,
  Hash,
  Shield
} from 'lucide-react';

// Types for red flag keywords
interface RedFlagKeyword {
  id: string;
  keyword: string;
  category: 'profanity' | 'threats' | 'nonsensical' | 'impossible';
  severity_level: number;
  language_code: string;
  detection_pattern?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface KeywordStats {
  total_keywords: number;
  active_keywords: number;
  category_distribution: Record<string, number>;
  severity_distribution: Record<string, number>;
  language_distribution: Record<string, number>;
  recent_additions: number;
}

interface KeywordFilters {
  category: string;
  severityLevel: string;
  language: string;
  isActive: string;
  search: string;
}

interface KeywordFormData {
  keyword: string;
  category: 'profanity' | 'threats' | 'nonsensical' | 'impossible';
  severity_level: number;
  language_code: string;
  detection_pattern: string;
  is_active: boolean;
}

const KeywordManagement: React.FC = () => {
  const [keywords, setKeywords] = useState<RedFlagKeyword[]>([]);
  const [stats, setStats] = useState<KeywordStats | null>(null);
  const [filters, setFilters] = useState<KeywordFilters>({
    category: 'all',
    severityLevel: 'all',
    language: 'all',
    isActive: 'all',
    search: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKeyword, setEditingKeyword] = useState<RedFlagKeyword | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<KeywordFormData>({
    keyword: '',
    category: 'profanity',
    severity_level: 1,
    language_code: 'sv',
    detection_pattern: '',
    is_active: true
  });

  // Fetch keywords and statistics
  const fetchKeywordData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.category !== 'all') params.set('category', filters.category);
      if (filters.severityLevel !== 'all') params.set('severity_level', filters.severityLevel);
      if (filters.language !== 'all') params.set('language_code', filters.language);
      if (filters.isActive !== 'all') params.set('is_active', filters.isActive);
      if (filters.search) params.set('search', filters.search);

      // Fetch keywords
      const keywordsResponse = await fetch(`/api/fraud/keywords?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!keywordsResponse.ok) {
        throw new Error(`Failed to fetch keywords: ${keywordsResponse.status}`);
      }

      const keywordsData = await keywordsResponse.json();

      // Fetch keyword statistics
      const statsResponse = await fetch(`/api/fraud/keywords/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch keyword statistics: ${statsResponse.status}`);
      }

      const statsData = await statsResponse.json();

      setKeywords(keywordsData.data || []);
      setStats(statsData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch keyword data');
      console.error('Error fetching keyword data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeywordData();
  }, [filters]);

  // Get category info
  const getCategoryInfo = (category: string) => {
    switch (category) {
      case 'profanity':
        return { label: 'Profanity', color: 'destructive', icon: '🚫' };
      case 'threats':
        return { label: 'Threats', color: 'destructive', icon: '⚠️' };
      case 'nonsensical':
        return { label: 'Nonsensical', color: 'secondary', icon: '🤔' };
      case 'impossible':
        return { label: 'Impossible', color: 'warning', icon: '❌' };
      default:
        return { label: 'Unknown', color: 'outline', icon: '❓' };
    }
  };

  // Get severity color
  const getSeverityColor = (level: number): string => {
    if (level >= 8) return 'text-red-600';
    if (level >= 4) return 'text-orange-600';
    return 'text-yellow-600';
  };

  // Save keyword (create or update)
  const saveKeyword = async (keyword?: RedFlagKeyword) => {
    try {
      const data = keyword ? { ...keyword } : formData;
      const url = keyword ? `/api/fraud/keywords/${keyword.id}` : '/api/fraud/keywords';
      const method = keyword ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Failed to save keyword: ${response.status}`);
      }

      await fetchKeywordData();
      setEditingKeyword(null);
      setShowAddForm(false);
      setFormData({
        keyword: '',
        category: 'profanity',
        severity_level: 1,
        language_code: 'sv',
        detection_pattern: '',
        is_active: true
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save keyword');
    }
  };

  // Delete keyword
  const deleteKeyword = async (keywordId: string) => {
    if (!confirm('Are you sure you want to delete this keyword?')) return;

    try {
      const response = await fetch(`/api/fraud/keywords/${keywordId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete keyword: ${response.status}`);
      }

      await fetchKeywordData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete keyword');
    }
  };

  // Export keywords data
  const exportData = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const params = new URLSearchParams(filters as any);
      params.set('export_format', format);
      
      const response = await fetch(`/api/fraud/keywords/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `red-flag-keywords-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading keywords...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button variant="outline" size="sm" className="ml-2" onClick={fetchKeywordData}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Red Flag Keyword Management</h2>
          <p className="text-muted-foreground">
            Manage fraud detection keywords and patterns
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Keyword
          </Button>
          <Button variant="outline" onClick={fetchKeywordData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Select onValueChange={(value) => exportData(value as any)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Keywords</CardTitle>
              <Hash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_keywords.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Active: {stats.active_keywords}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(stats.category_distribution).length}</div>
              <p className="text-xs text-muted-foreground">
                Types available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Languages</CardTitle>
              <Hash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(stats.language_distribution).length}</div>
              <p className="text-xs text-muted-foreground">
                Languages supported
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Additions</CardTitle>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recent_additions}</div>
              <p className="text-xs text-muted-foreground">
                Added this week
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select 
                value={filters.category} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="profanity">Profanity</SelectItem>
                  <SelectItem value="threats">Threats</SelectItem>
                  <SelectItem value="nonsensical">Nonsensical</SelectItem>
                  <SelectItem value="impossible">Impossible</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Severity</label>
              <Select 
                value={filters.severityLevel} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, severityLevel: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="low">Low (1-3)</SelectItem>
                  <SelectItem value="medium">Medium (4-7)</SelectItem>
                  <SelectItem value="high">High (8-10)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Language</label>
              <Select 
                value={filters.language} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, language: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All languages</SelectItem>
                  <SelectItem value="sv">Swedish</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="no">Norwegian</SelectItem>
                  <SelectItem value="da">Danish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Status</label>
              <Select 
                value={filters.isActive} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, isActive: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All keywords</SelectItem>
                  <SelectItem value="true">Active only</SelectItem>
                  <SelectItem value="false">Inactive only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search keywords..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Keyword Form */}
      {(showAddForm || editingKeyword) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingKeyword ? 'Edit Keyword' : 'Add New Keyword'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium">Keyword</label>
                <Input
                  value={editingKeyword ? editingKeyword.keyword : formData.keyword}
                  onChange={(e) => {
                    if (editingKeyword) {
                      setEditingKeyword({ ...editingKeyword, keyword: e.target.value });
                    } else {
                      setFormData({ ...formData, keyword: e.target.value });
                    }
                  }}
                  placeholder="Enter keyword or phrase..."
                />
              </div>

              <div>
                <label className="text-sm font-medium">Category</label>
                <Select 
                  value={editingKeyword ? editingKeyword.category : formData.category}
                  onValueChange={(value: any) => {
                    if (editingKeyword) {
                      setEditingKeyword({ ...editingKeyword, category: value });
                    } else {
                      setFormData({ ...formData, category: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profanity">Profanity</SelectItem>
                    <SelectItem value="threats">Threats</SelectItem>
                    <SelectItem value="nonsensical">Nonsensical</SelectItem>
                    <SelectItem value="impossible">Impossible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Severity Level (1-10)</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={editingKeyword ? editingKeyword.severity_level : formData.severity_level}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (editingKeyword) {
                      setEditingKeyword({ ...editingKeyword, severity_level: value });
                    } else {
                      setFormData({ ...formData, severity_level: value });
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Language</label>
                <Select 
                  value={editingKeyword ? editingKeyword.language_code : formData.language_code}
                  onValueChange={(value) => {
                    if (editingKeyword) {
                      setEditingKeyword({ ...editingKeyword, language_code: value });
                    } else {
                      setFormData({ ...formData, language_code: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sv">Swedish</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="no">Norwegian</SelectItem>
                    <SelectItem value="da">Danish</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Detection Pattern (Optional)</label>
                <Input
                  value={editingKeyword ? (editingKeyword.detection_pattern || '') : formData.detection_pattern}
                  onChange={(e) => {
                    if (editingKeyword) {
                      setEditingKeyword({ ...editingKeyword, detection_pattern: e.target.value });
                    } else {
                      setFormData({ ...formData, detection_pattern: e.target.value });
                    }
                  }}
                  placeholder="Regular expression pattern for advanced matching..."
                />
              </div>

              <div className="col-span-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={editingKeyword ? editingKeyword.is_active : formData.is_active}
                    onCheckedChange={(checked) => {
                      if (editingKeyword) {
                        setEditingKeyword({ ...editingKeyword, is_active: checked as boolean });
                      } else {
                        setFormData({ ...formData, is_active: checked as boolean });
                      }
                    }}
                  />
                  <label className="text-sm font-medium">Active</label>
                </div>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button onClick={() => saveKeyword(editingKeyword || undefined)}>
                <Save className="w-4 h-4 mr-2" />
                {editingKeyword ? 'Update' : 'Save'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setEditingKeyword(null);
                  setShowAddForm(false);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keywords Table */}
      <Card>
        <CardHeader>
          <CardTitle>Red Flag Keywords</CardTitle>
          <CardDescription>
            Manage fraud detection keywords and their patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keywords.length === 0 ? (
            <div className="text-center py-8">
              <Hash className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No keywords found with current filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keywords.map((keyword) => {
                const categoryInfo = getCategoryInfo(keyword.category);
                return (
                  <div
                    key={keyword.id}
                    className="border rounded-lg p-4 hover:bg-muted/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-medium text-lg">
                          {keyword.keyword}
                        </span>
                        <Badge variant={categoryInfo.color as any}>
                          {categoryInfo.icon} {categoryInfo.label}
                        </Badge>
                        <Badge variant={keyword.is_active ? 'default' : 'secondary'}>
                          {keyword.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingKeyword(keyword)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteKeyword(keyword.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Severity:</span>
                        <span className={`ml-2 font-medium ${getSeverityColor(keyword.severity_level)}`}>
                          {keyword.severity_level}/10
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Language:</span>
                        <span className="ml-2 font-medium uppercase">
                          {keyword.language_code}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pattern:</span>
                        <span className="ml-2 font-medium">
                          {keyword.detection_pattern ? 'Custom' : 'Exact match'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created:</span>
                        <span className="ml-2 font-medium">
                          {new Date(keyword.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {keyword.detection_pattern && (
                      <div className="mt-2">
                        <span className="text-muted-foreground text-sm">Pattern:</span>
                        <code className="ml-2 text-sm bg-muted px-2 py-1 rounded">
                          {keyword.detection_pattern}
                        </code>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KeywordManagement;