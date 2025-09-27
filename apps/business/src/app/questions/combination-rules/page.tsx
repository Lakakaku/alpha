'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Settings, Trash2, Edit } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CombinationRuleForm } from '@/components/questions/CombinationRuleForm';
import { useToast } from '@/hooks/use-toast';

interface QuestionCombinationRule {
  id: string;
  rule_name: string;
  max_call_duration_seconds: number;
  priority_threshold_critical: number;
  priority_threshold_high: number;
  priority_threshold_medium: number;
  priority_threshold_low: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  _meta: {
    question_groups_count: number;
    active_triggers_count: number;
    effectiveness_score: number;
  };
}

export default function CombinationRulesPage() {
  const [rules, setRules] = useState<QuestionCombinationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRule, setEditingRule] = useState<QuestionCombinationRule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/questions/combinations/rules', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load combination rules');
      }

      const data = await response.json();
      setRules(data);
    } catch (error) {
      console.error('Error loading rules:', error);
      setError(error instanceof Error ? error.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (ruleData: Partial<QuestionCombinationRule>) => {
    try {
      const response = await fetch('/api/questions/combinations/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(ruleData)
      });

      if (!response.ok) {
        throw new Error('Failed to create rule');
      }

      const newRule = await response.json();
      setRules(prev => [...prev, newRule]);
      setShowCreateForm(false);
      
      toast({
        title: 'Success',
        description: 'Question combination rule created successfully'
      });
    } catch (error) {
      console.error('Error creating rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to create question combination rule',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateRule = async (ruleId: string, ruleData: Partial<QuestionCombinationRule>) => {
    try {
      const response = await fetch(`/api/questions/combinations/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(ruleData)
      });

      if (!response.ok) {
        throw new Error('Failed to update rule');
      }

      const updatedRule = await response.json();
      setRules(prev => prev.map(rule => 
        rule.id === ruleId ? updatedRule : rule
      ));
      setEditingRule(null);
      
      toast({
        title: 'Success',
        description: 'Question combination rule updated successfully'
      });
    } catch (error) {
      console.error('Error updating rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to update question combination rule',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/questions/combinations/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete rule');
      }

      setRules(prev => prev.filter(rule => rule.id !== ruleId));
      
      toast({
        title: 'Success',
        description: 'Question combination rule deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete question combination rule',
        variant: 'destructive'
      });
    }
  };

  const handleToggleActive = async (ruleId: string, isActive: boolean) => {
    await handleUpdateRule(ruleId, { is_active: isActive });
  };

  const filteredRules = rules.filter(rule =>
    rule.rule_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Question Combination Rules</h1>
          <p className="text-muted-foreground mt-2">
            Configure how questions are intelligently grouped for optimal call flow
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Rule
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search rules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      <div className="grid gap-6">
        {filteredRules.map((rule) => (
          <Card key={rule.id} className="relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  {rule.rule_name}
                  <Badge variant={rule.is_active ? "default" : "secondary"}>
                    {rule.is_active ? "Active" : "Inactive"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Max call duration: {rule.max_call_duration_seconds}s • 
                  Question groups: {rule._meta.question_groups_count} • 
                  Active triggers: {rule._meta.active_triggers_count}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rule.is_active}
                  onCheckedChange={(checked) => handleToggleActive(rule.id, checked)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingRule(rule)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Critical Priority</Label>
                  <div className="text-2xl font-bold">{rule.priority_threshold_critical}s</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">High Priority</Label>
                  <div className="text-2xl font-bold">{rule.priority_threshold_high}s</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Medium Priority</Label>
                  <div className="text-2xl font-bold">{rule.priority_threshold_medium}s</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Low Priority</Label>
                  <div className="text-2xl font-bold">{rule.priority_threshold_low}s</div>
                </div>
              </div>

              {rule._meta.effectiveness_score > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">
                    Effectiveness: {(rule._meta.effectiveness_score * 100).toFixed(1)}%
                  </Badge>
                  <span>Last updated: {new Date(rule.updated_at).toLocaleDateString()}</span>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/questions/combination-rules/${rule.id}/groups`)}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Configure Groups
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/questions/combination-rules/${rule.id}/preview`)}
                >
                  Preview Logic
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredRules.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No combination rules found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'No rules match your search criteria.' : 'Create your first question combination rule to get started.'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Rule
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {(showCreateForm || editingRule) && (
        <CombinationRuleForm
          rule={editingRule}
          onSubmit={editingRule 
            ? (data) => handleUpdateRule(editingRule.id, data)
            : handleCreateRule
          }
          onCancel={() => {
            setShowCreateForm(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}