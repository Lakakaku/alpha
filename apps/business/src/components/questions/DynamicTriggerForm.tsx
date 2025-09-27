'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Plus, X, Clock, ShoppingCart, DollarSign } from 'lucide-react';

interface DynamicTrigger {
  id?: string;
  business_context_id: string;
  trigger_name: string;
  trigger_type: 'purchase_based' | 'time_based' | 'amount_based';
  priority_level: number;
  sensitivity_threshold: number;
  is_active: boolean;
  trigger_config: PurchaseConfig | TimeConfig | AmountConfig;
  effectiveness_score?: number;
}

interface PurchaseConfig {
  categories: string[];
  required_items?: string[];
  minimum_items?: number;
}

interface TimeConfig {
  time_windows: Array<{
    start_time: string;
    end_time: string;
    days_of_week: number[];
  }>;
}

interface AmountConfig {
  currency: string;
  minimum_amount: number;
  maximum_amount?: number;
  comparison_operator: '>=' | '<=' | '==' | 'between';
}

interface DynamicTriggerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessContextId: string;
  trigger?: DynamicTrigger;
  onSuccess?: () => void;
}

const TRIGGER_TYPES = [
  { value: 'purchase_based' as const, label: 'Purchase Based', icon: ShoppingCart },
  { value: 'time_based' as const, label: 'Time Based', icon: Clock },
  { value: 'amount_based' as const, label: 'Amount Based', icon: DollarSign },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const COMPARISON_OPERATORS = [
  { value: '>=' as const, label: 'Greater than or equal' },
  { value: '<=' as const, label: 'Less than or equal' },
  { value: '==' as const, label: 'Equal to' },
  { value: 'between' as const, label: 'Between' },
];

export function DynamicTriggerForm({ 
  open, 
  onOpenChange, 
  businessContextId, 
  trigger, 
  onSuccess 
}: DynamicTriggerFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<DynamicTrigger>>(() => ({
    business_context_id: businessContextId,
    trigger_name: trigger?.trigger_name || '',
    trigger_type: trigger?.trigger_type || 'purchase_based',
    priority_level: trigger?.priority_level || 3,
    sensitivity_threshold: trigger?.sensitivity_threshold || 10,
    is_active: trigger?.is_active ?? true,
    trigger_config: trigger?.trigger_config || {
      categories: [],
    } as PurchaseConfig,
  }));

  // Purchase config state
  const [newCategory, setNewCategory] = useState('');
  const [newItem, setNewItem] = useState('');

  // Time config state
  const [newTimeWindow, setNewTimeWindow] = useState({
    start_time: '09:00',
    end_time: '17:00',
    days_of_week: [] as number[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = trigger 
        ? `/api/questions/triggers/${trigger.id}`
        : '/api/questions/triggers';
      
      const method = trigger ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save trigger');
      }

      toast.success(`Trigger ${trigger ? 'updated' : 'created'} successfully`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving trigger:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save trigger');
    } finally {
      setLoading(false);
    }
  };

  const updateTriggerConfig = (updates: Partial<PurchaseConfig | TimeConfig | AmountConfig>) => {
    setFormData(prev => ({
      ...prev,
      trigger_config: {
        ...prev.trigger_config,
        ...updates,
      } as any,
    }));
  };

  const addCategory = () => {
    if (!newCategory.trim()) return;
    
    const config = formData.trigger_config as PurchaseConfig;
    updateTriggerConfig({
      categories: [...(config.categories || []), newCategory.trim()],
    });
    setNewCategory('');
  };

  const removeCategory = (index: number) => {
    const config = formData.trigger_config as PurchaseConfig;
    updateTriggerConfig({
      categories: config.categories?.filter((_, i) => i !== index) || [],
    });
  };

  const addRequiredItem = () => {
    if (!newItem.trim()) return;
    
    const config = formData.trigger_config as PurchaseConfig;
    updateTriggerConfig({
      required_items: [...(config.required_items || []), newItem.trim()],
    });
    setNewItem('');
  };

  const removeRequiredItem = (index: number) => {
    const config = formData.trigger_config as PurchaseConfig;
    updateTriggerConfig({
      required_items: config.required_items?.filter((_, i) => i !== index) || [],
    });
  };

  const addTimeWindow = () => {
    if (newTimeWindow.days_of_week.length === 0) {
      toast.error('Please select at least one day of the week');
      return;
    }

    const config = formData.trigger_config as TimeConfig;
    updateTriggerConfig({
      time_windows: [...(config.time_windows || []), { ...newTimeWindow }],
    });
    setNewTimeWindow({
      start_time: '09:00',
      end_time: '17:00',
      days_of_week: [],
    });
  };

  const removeTimeWindow = (index: number) => {
    const config = formData.trigger_config as TimeConfig;
    updateTriggerConfig({
      time_windows: config.time_windows?.filter((_, i) => i !== index) || [],
    });
  };

  const toggleDay = (day: number) => {
    setNewTimeWindow(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  };

  const renderPurchaseConfig = () => {
    const config = formData.trigger_config as PurchaseConfig;

    return (
      <div className="space-y-6">
        <div>
          <Label htmlFor="categories">Product Categories</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="categories"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g., meat, produce, bakery"
              onKeyPress={(e) => e.key === 'Enter' && addCategory()}
            />
            <Button type="button" onClick={addCategory} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {config.categories?.map((category, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                {category}
                <button onClick={() => removeCategory(index)} className="ml-1">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="required-items">Required Items (Optional)</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="required-items"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="e.g., ground_beef, chicken_breast"
              onKeyPress={(e) => e.key === 'Enter' && addRequiredItem()}
            />
            <Button type="button" onClick={addRequiredItem} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {config.required_items?.map((item, index) => (
              <Badge key={index} variant="outline" className="flex items-center gap-1">
                {item}
                <button onClick={() => removeRequiredItem(index)} className="ml-1">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="minimum-items">Minimum Items from Category</Label>
          <Input
            id="minimum-items"
            type="number"
            min={1}
            value={config.minimum_items || 1}
            onChange={(e) => updateTriggerConfig({ minimum_items: parseInt(e.target.value) || 1 })}
            className="mt-1"
          />
        </div>
      </div>
    );
  };

  const renderTimeConfig = () => {
    const config = formData.trigger_config as TimeConfig;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add Time Window</CardTitle>
            <CardDescription>Define when this trigger should be active</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={newTimeWindow.start_time}
                  onChange={(e) => setNewTimeWindow(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={newTimeWindow.end_time}
                  onChange={(e) => setNewTimeWindow(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Days of Week</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Badge
                    key={day.value}
                    variant={newTimeWindow.days_of_week.includes(day.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleDay(day.value)}
                  >
                    {day.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Button type="button" onClick={addTimeWindow} size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Time Window
            </Button>
          </CardContent>
        </Card>

        <div>
          <Label>Active Time Windows</Label>
          <div className="space-y-2 mt-2">
            {config.time_windows?.map((window, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {window.start_time} - {window.end_time}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {window.days_of_week.map(day => DAYS_OF_WEEK[day]?.label).join(', ')}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTimeWindow(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )) || []}
          </div>
        </div>
      </div>
    );
  };

  const renderAmountConfig = () => {
    const config = formData.trigger_config as AmountConfig;

    return (
      <div className="space-y-6">
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Select
            value={config.currency || 'SEK'}
            onValueChange={(value) => updateTriggerConfig({ currency: value })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SEK">SEK (Swedish Krona)</SelectItem>
              <SelectItem value="EUR">EUR (Euro)</SelectItem>
              <SelectItem value="USD">USD (US Dollar)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="comparison-operator">Comparison</Label>
          <Select
            value={config.comparison_operator || '>='}
            onValueChange={(value) => updateTriggerConfig({ comparison_operator: value as any })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPARISON_OPERATORS.map(op => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="minimum-amount">
            {config.comparison_operator === 'between' ? 'Minimum Amount' : 'Amount'}
          </Label>
          <Input
            id="minimum-amount"
            type="number"
            min={0}
            step={0.01}
            value={config.minimum_amount || 0}
            onChange={(e) => updateTriggerConfig({ minimum_amount: parseFloat(e.target.value) || 0 })}
            className="mt-1"
          />
        </div>

        {config.comparison_operator === 'between' && (
          <div>
            <Label htmlFor="maximum-amount">Maximum Amount</Label>
            <Input
              id="maximum-amount"
              type="number"
              min={0}
              step={0.01}
              value={config.maximum_amount || 0}
              onChange={(e) => updateTriggerConfig({ maximum_amount: parseFloat(e.target.value) || 0 })}
              className="mt-1"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {trigger ? 'Edit Trigger' : 'Create Dynamic Trigger'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="trigger-name">Trigger Name</Label>
              <Input
                id="trigger-name"
                value={formData.trigger_name}
                onChange={(e) => setFormData(prev => ({ ...prev, trigger_name: e.target.value }))}
                placeholder="Descriptive trigger name"
                required
              />
            </div>

            <div>
              <Label htmlFor="trigger-type">Trigger Type</Label>
              <Select
                value={formData.trigger_type}
                onValueChange={(value) => {
                  const newType = value as 'purchase_based' | 'time_based' | 'amount_based';
                  let newConfig: any = {};
                  
                  if (newType === 'purchase_based') {
                    newConfig = { categories: [] };
                  } else if (newType === 'time_based') {
                    newConfig = { time_windows: [] };
                  } else {
                    newConfig = { currency: 'SEK', minimum_amount: 0, comparison_operator: '>=' };
                  }
                  
                  setFormData(prev => ({
                    ...prev,
                    trigger_type: newType,
                    trigger_config: newConfig,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center">
                        <type.icon className="h-4 w-4 mr-2" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority-level">Priority Level: {formData.priority_level}</Label>
              <div className="mt-2">
                <Slider
                  value={[formData.priority_level || 3]}
                  onValueChange={([value]) => setFormData(prev => ({ ...prev, priority_level: value }))}
                  min={1}
                  max={5}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Optional</span>
                  <span>Critical</span>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="sensitivity-threshold">Sensitivity: Every {formData.sensitivity_threshold}th customer</Label>
              <div className="mt-2">
                <Slider
                  value={[formData.sensitivity_threshold || 10]}
                  onValueChange={([value]) => setFormData(prev => ({ ...prev, sensitivity_threshold: value }))}
                  min={1}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Every customer</span>
                  <span>Rarely</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is-active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is-active">Trigger is active</Label>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                {TRIGGER_TYPES.find(t => t.value === formData.trigger_type)?.icon && (
                  <TRIGGER_TYPES.find(t => t.value === formData.trigger_type)!.icon className="h-5 w-5 mr-2" />
                )}
                {TRIGGER_TYPES.find(t => t.value === formData.trigger_type)?.label} Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              {formData.trigger_type === 'purchase_based' && renderPurchaseConfig()}
              {formData.trigger_type === 'time_based' && renderTimeConfig()}
              {formData.trigger_type === 'amount_based' && renderAmountConfig()}
            </CardContent>
          </Card>

          {trigger?.effectiveness_score !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Effectiveness Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span>Current Performance</span>
                  <Badge variant={trigger.effectiveness_score > 0.7 ? "default" : trigger.effectiveness_score > 0.4 ? "secondary" : "destructive"}>
                    {(trigger.effectiveness_score * 100).toFixed(1)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {trigger ? 'Update Trigger' : 'Create Trigger'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}