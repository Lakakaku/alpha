'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Plus, Zap, Trash2, Edit, Clock, ShoppingCart, DollarSign } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DynamicTriggerForm } from '@/components/questions/DynamicTriggerForm';
import { useToast } from '@/hooks/use-toast';

interface DynamicTrigger {
  id: string;
  trigger_name: string;
  trigger_type: 'purchase_based' | 'time_based' | 'amount_based';
  priority_level: number;
  sensitivity_threshold: number;
  is_active: boolean;
  trigger_config: any;
  effectiveness_score: number;
  created_at: string;
  updated_at: string;
  _meta: {
    activation_count_24h: number;
    questions_triggered: number;
    success_rate: number;
  };
}

const TRIGGER_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'purchase_based', label: 'Purchase Based' },
  { value: 'time_based', label: 'Time Based' },
  { value: 'amount_based', label: 'Amount Based' }
];

const PRIORITY_LEVELS = [
  { value: 1, label: 'Optional', color: 'bg-gray-500' },
  { value: 2, label: 'Low', color: 'bg-blue-500' },
  { value: 3, label: 'Medium', color: 'bg-yellow-500' },
  { value: 4, label: 'High', color: 'bg-orange-500' },
  { value: 5, label: 'Critical', color: 'bg-red-500' }
];

function getTriggerIcon(type: string) {
  switch (type) {
    case 'purchase_based': return <ShoppingCart className="h-4 w-4" />;
    case 'time_based': return <Clock className="h-4 w-4" />;
    case 'amount_based': return <DollarSign className="h-4 w-4" />;
    default: return <Zap className="h-4 w-4" />;
  }
}

function getPriorityBadge(level: number) {
  const priority = PRIORITY_LEVELS.find(p => p.value === level);
  return priority ? (
    <Badge className={`${priority.color} text-white`}>
      {priority.label}
    </Badge>
  ) : null;
}

function formatTriggerConfig(type: string, config: any) {
  switch (type) {
    case 'purchase_based':
      return `Categories: ${config.categories?.join(', ') || 'None'}`;
    case 'time_based':
      const windows = config.time_windows || [];
      return `${windows.length} time window${windows.length !== 1 ? 's' : ''}`;
    case 'amount_based':
      return `${config.comparison_operator} ${config.minimum_amount} ${config.currency}`;
    default:
      return 'Configuration available';
  }
}

export default function TriggersPage() {
  const [triggers, setTriggers] = useState<DynamicTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<DynamicTrigger | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    loadTriggers();
  }, []);

  const loadTriggers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/questions/triggers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load dynamic triggers');
      }

      const data = await response.json();
      setTriggers(data);
    } catch (error) {
      console.error('Error loading triggers:', error);
      setError(error instanceof Error ? error.message : 'Failed to load triggers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrigger = async (triggerData: Partial<DynamicTrigger>) => {
    try {
      const response = await fetch('/api/questions/triggers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(triggerData)
      });

      if (!response.ok) {
        throw new Error('Failed to create trigger');
      }

      const newTrigger = await response.json();
      setTriggers(prev => [...prev, newTrigger]);
      setShowCreateForm(false);
      
      toast({
        title: 'Success',
        description: 'Dynamic trigger created successfully'
      });
    } catch (error) {
      console.error('Error creating trigger:', error);
      toast({
        title: 'Error',
        description: 'Failed to create dynamic trigger',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateTrigger = async (triggerId: string, triggerData: Partial<DynamicTrigger>) => {
    try {
      const response = await fetch(`/api/questions/triggers/${triggerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(triggerData)
      });

      if (!response.ok) {
        throw new Error('Failed to update trigger');
      }

      const updatedTrigger = await response.json();
      setTriggers(prev => prev.map(trigger => 
        trigger.id === triggerId ? updatedTrigger : trigger
      ));
      setEditingTrigger(null);
      
      toast({
        title: 'Success',
        description: 'Dynamic trigger updated successfully'
      });
    } catch (error) {
      console.error('Error updating trigger:', error);
      toast({
        title: 'Error',
        description: 'Failed to update dynamic trigger',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteTrigger = async (triggerId: string) => {
    if (!confirm('Are you sure you want to delete this trigger?')) {
      return;
    }

    try {
      const response = await fetch(`/api/questions/triggers/${triggerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete trigger');
      }

      setTriggers(prev => prev.filter(trigger => trigger.id !== triggerId));
      
      toast({
        title: 'Success',
        description: 'Dynamic trigger deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting trigger:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete dynamic trigger',
        variant: 'destructive'
      });
    }
  };

  const handleToggleActive = async (triggerId: string, isActive: boolean) => {
    await handleUpdateTrigger(triggerId, { is_active: isActive });
  };

  const filteredTriggers = triggers.filter(trigger => {
    const matchesSearch = trigger.trigger_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || trigger.trigger_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && trigger.is_active) ||
      (statusFilter === 'inactive' && !trigger.is_active);

    return matchesSearch && matchesType && matchesStatus;
  });

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
          <h1 className="text-3xl font-bold tracking-tight">Dynamic Triggers</h1>
          <p className="text-muted-foreground mt-2">
            Configure automatic question activation based on customer behavior
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Trigger
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
            placeholder="Search triggers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6">
        {filteredTriggers.map((trigger) => (
          <Card key={trigger.id} className="relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  {getTriggerIcon(trigger.trigger_type)}
                  {trigger.trigger_name}
                  <Badge variant={trigger.is_active ? "default" : "secondary"}>
                    {trigger.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {getPriorityBadge(trigger.priority_level)}
                </CardTitle>
                <CardDescription>
                  {trigger.trigger_type.replace('_', ' ')} • 
                  Sensitivity: 1/{trigger.sensitivity_threshold} • 
                  {formatTriggerConfig(trigger.trigger_type, trigger.trigger_config)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={trigger.is_active}
                  onCheckedChange={(checked) => handleToggleActive(trigger.id, checked)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTrigger(trigger)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteTrigger(trigger.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Activations (24h)</Label>
                  <div className="text-2xl font-bold">{trigger._meta.activation_count_24h}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Questions Triggered</Label>
                  <div className="text-2xl font-bold">{trigger._meta.questions_triggered}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Success Rate</Label>
                  <div className="text-2xl font-bold">{(trigger._meta.success_rate * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Effectiveness</Label>
                  <div className="text-2xl font-bold">{(trigger.effectiveness_score * 100).toFixed(1)}%</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">
                  {trigger.trigger_type.replace('_', ' ')}
                </Badge>
                <span>Created: {new Date(trigger.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>Updated: {new Date(trigger.updated_at).toLocaleDateString()}</span>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/questions/triggers/${trigger.id}/analytics`)}
                >
                  View Analytics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/questions/triggers/${trigger.id}/test`)}
                >
                  Test Trigger
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredTriggers.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No triggers found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || typeFilter !== 'all' || statusFilter !== 'all' 
                  ? 'No triggers match your search criteria.' 
                  : 'Create your first dynamic trigger to get started.'
                }
              </p>
              {!searchTerm && typeFilter === 'all' && statusFilter === 'all' && (
                <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Trigger
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {(showCreateForm || editingTrigger) && (
        <DynamicTriggerForm
          trigger={editingTrigger}
          onSubmit={editingTrigger 
            ? (data) => handleUpdateTrigger(editingTrigger.id, data)
            : handleCreateTrigger
          }
          onCancel={() => {
            setShowCreateForm(false);
            setEditingTrigger(null);
          }}
        />
      )}
    </div>
  );
}