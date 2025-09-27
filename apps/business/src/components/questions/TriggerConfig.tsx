'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@vocilia/ui/components/button';
import { Input } from '@vocilia/ui/components/input';
import { Label } from '@vocilia/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vocilia/ui/components/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui/components/card';
import { Badge } from '@vocilia/ui/components/badge';
import { Checkbox } from '@vocilia/ui/components/checkbox';
import { Alert, AlertDescription } from '@vocilia/ui/components/alert';
import { Separator } from '@vocilia/ui/components/separator';
import { QuestionTrigger } from '@vocilia/types';
import { PlusIcon, TrashIcon, ClockIcon, UsersIcon, MapPinIcon, TrendingUpIcon, InfoIcon } from 'lucide-react';

export interface TriggerConfigProps {
  triggers: QuestionTrigger[];
  onTriggersChange: (triggers: QuestionTrigger[]) => void;
  questionId?: string;
  className?: string;
}

interface TriggerCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
  valueType: 'string' | 'number' | 'boolean' | 'datetime' | 'select';
}

const triggerTypes = [
  {
    value: 'time_based',
    label: 'Time-Based',
    description: 'Trigger based on specific times, dates, or time ranges',
    icon: ClockIcon,
    color: 'blue',
  },
  {
    value: 'frequency_based',
    label: 'Frequency-Based',
    description: 'Trigger based on customer visit frequency or patterns',
    icon: TrendingUpIcon,
    color: 'green',
  },
  {
    value: 'customer_behavior',
    label: 'Customer Behavior',
    description: 'Trigger based on customer actions or characteristics',
    icon: UsersIcon,
    color: 'purple',
  },
  {
    value: 'store_context',
    label: 'Store Context',
    description: 'Trigger based on store-specific conditions or context',
    icon: MapPinIcon,
    color: 'orange',
  },
];

const conditionFields = {
  time_based: [
    { field: 'hour_of_day', label: 'Hour of Day', valueType: 'number', min: 0, max: 23 },
    { field: 'day_of_week', label: 'Day of Week', valueType: 'select', options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    { field: 'date_range', label: 'Date Range', valueType: 'datetime' },
    { field: 'time_since_open', label: 'Minutes Since Store Open', valueType: 'number', min: 0 },
    { field: 'time_until_close', label: 'Minutes Until Store Close', valueType: 'number', min: 0 },
  ],
  frequency_based: [
    { field: 'visit_count', label: 'Visit Count', valueType: 'number', min: 1 },
    { field: 'days_since_last_visit', label: 'Days Since Last Visit', valueType: 'number', min: 0 },
    { field: 'average_visit_duration', label: 'Average Visit Duration (minutes)', valueType: 'number', min: 1 },
    { field: 'total_visits_this_month', label: 'Total Visits This Month', valueType: 'number', min: 0 },
    { field: 'is_returning_customer', label: 'Is Returning Customer', valueType: 'boolean' },
  ],
  customer_behavior: [
    { field: 'has_provided_feedback', label: 'Has Provided Feedback Before', valueType: 'boolean' },
    { field: 'feedback_sentiment', label: 'Previous Feedback Sentiment', valueType: 'select', options: ['positive', 'neutral', 'negative'] },
    { field: 'average_rating', label: 'Average Rating Given', valueType: 'number', min: 1, max: 10 },
    { field: 'response_rate', label: 'Response Rate (%)', valueType: 'number', min: 0, max: 100 },
    { field: 'language_preference', label: 'Language Preference', valueType: 'select', options: ['en', 'sv', 'no', 'da', 'fi'] },
  ],
  store_context: [
    { field: 'store_location', label: 'Store Location', valueType: 'string' },
    { field: 'store_size', label: 'Store Size', valueType: 'select', options: ['small', 'medium', 'large'] },
    { field: 'peak_hours', label: 'During Peak Hours', valueType: 'boolean' },
    { field: 'staff_count', label: 'Staff Count on Duty', valueType: 'number', min: 1 },
    { field: 'queue_length', label: 'Queue Length', valueType: 'number', min: 0 },
  ],
};

const operators = {
  string: [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'not_equals', label: 'Not Equals' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'greater_equal', label: 'Greater Than or Equal' },
    { value: 'less_equal', label: 'Less Than or Equal' },
    { value: 'between', label: 'Between' },
  ],
  boolean: [
    { value: 'is_true', label: 'Is True' },
    { value: 'is_false', label: 'Is False' },
  ],
  datetime: [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'between', label: 'Between' },
    { value: 'on_date', label: 'On Date' },
  ],
  select: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'in', label: 'Is One Of' },
  ],
};

export function TriggerConfig({
  triggers,
  onTriggersChange,
  questionId,
  className = '',
}: TriggerConfigProps) {
  const [expandedTrigger, setExpandedTrigger] = useState<string | null>(null);

  const createNewTrigger = (type: string): QuestionTrigger => ({
    id: crypto.randomUUID(),
    questionId: questionId || '',
    type: type as QuestionTrigger['type'],
    conditions: {},
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const addTrigger = (type: string) => {
    const newTrigger = createNewTrigger(type);
    onTriggersChange([...triggers, newTrigger]);
    setExpandedTrigger(newTrigger.id);
  };

  const removeTrigger = (triggerId: string) => {
    onTriggersChange(triggers.filter(t => t.id !== triggerId));
    if (expandedTrigger === triggerId) {
      setExpandedTrigger(null);
    }
  };

  const updateTrigger = (triggerId: string, updates: Partial<QuestionTrigger>) => {
    onTriggersChange(
      triggers.map(trigger =>
        trigger.id === triggerId
          ? { ...trigger, ...updates, updatedAt: new Date() }
          : trigger
      )
    );
  };

  const addCondition = (triggerId: string) => {
    const trigger = triggers.find(t => t.id === triggerId);
    if (!trigger) return;

    const availableFields = conditionFields[trigger.type] || [];
    if (availableFields.length === 0) return;

    const firstField = availableFields[0];
    const newConditionId = crypto.randomUUID();
    const newCondition: TriggerCondition = {
      field: firstField.field,
      operator: operators[firstField.valueType]?.[0]?.value || 'equals',
      value: firstField.valueType === 'boolean' ? false : '',
      valueType: firstField.valueType,
    };

    updateTrigger(triggerId, {
      conditions: {
        ...trigger.conditions,
        [newConditionId]: newCondition,
      },
    });
  };

  const updateCondition = (triggerId: string, conditionId: string, updates: Partial<TriggerCondition>) => {
    const trigger = triggers.find(t => t.id === triggerId);
    if (!trigger) return;

    updateTrigger(triggerId, {
      conditions: {
        ...trigger.conditions,
        [conditionId]: {
          ...trigger.conditions[conditionId],
          ...updates,
        },
      },
    });
  };

  const removeCondition = (triggerId: string, conditionId: string) => {
    const trigger = triggers.find(t => t.id === triggerId);
    if (!trigger) return;

    const { [conditionId]: removed, ...remainingConditions } = trigger.conditions;
    updateTrigger(triggerId, { conditions: remainingConditions });
  };

  const getTriggerTypeConfig = (type: string) => {
    return triggerTypes.find(t => t.value === type);
  };

  const getFieldConfig = (triggerType: string, fieldName: string) => {
    const fields = conditionFields[triggerType] || [];
    return fields.find(f => f.field === fieldName);
  };

  const renderConditionValue = (
    triggerId: string,
    conditionId: string,
    condition: TriggerCondition,
    fieldConfig: any
  ) => {
    switch (condition.valueType) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={!!condition.value}
              onCheckedChange={(checked) =>
                updateCondition(triggerId, conditionId, { value: !!checked })
              }
            />
            <Label>{condition.value ? 'True' : 'False'}</Label>
          </div>
        );

      case 'select':
        return (
          <Select
            value={String(condition.value)}
            onValueChange={(value) =>
              updateCondition(triggerId, conditionId, { value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {fieldConfig?.options?.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={String(condition.value)}
            onChange={(e) =>
              updateCondition(triggerId, conditionId, { value: e.target.value })
            }
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={String(condition.value)}
            onChange={(e) =>
              updateCondition(triggerId, conditionId, { value: parseFloat(e.target.value) || 0 })
            }
            min={fieldConfig?.min}
            max={fieldConfig?.max}
            placeholder="Enter number"
          />
        );

      default:
        return (
          <Input
            value={String(condition.value)}
            onChange={(e) =>
              updateCondition(triggerId, conditionId, { value: e.target.value })
            }
            placeholder="Enter value"
          />
        );
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">Question Triggers</h3>
        <p className="text-sm text-gray-600">
          Configure when this question should be presented to customers
        </p>
      </div>

      {/* Add Trigger Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {triggerTypes.map((type) => {
          const Icon = type.icon;
          return (
            <Card key={type.value} className="cursor-pointer hover:bg-gray-50 transition-colors">
              <CardContent className="p-4">
                <button
                  type="button"
                  onClick={() => addTrigger(type.value)}
                  className="w-full text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-${type.color}-100`}>
                      <Icon className={`w-5 h-5 text-${type.color}-600`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{type.label}</h4>
                      <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                    </div>
                    <PlusIcon className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Existing Triggers */}
      {triggers.length > 0 && (
        <div className="space-y-4">
          <Separator />
          <h4 className="font-medium text-gray-900">Configured Triggers ({triggers.length})</h4>

          {triggers.map((trigger) => {
            const typeConfig = getTriggerTypeConfig(trigger.type);
            const Icon = typeConfig?.icon || InfoIcon;
            const isExpanded = expandedTrigger === trigger.id;
            const conditionEntries = Object.entries(trigger.conditions);

            return (
              <Card key={trigger.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-${typeConfig?.color || 'gray'}-100`}>
                        <Icon className={`w-4 h-4 text-${typeConfig?.color || 'gray'}-600`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{typeConfig?.label}</CardTitle>
                        <CardDescription className="text-sm">
                          {conditionEntries.length} condition{conditionEntries.length !== 1 ? 's' : ''}
                          {!trigger.isActive && ' • Inactive'}
                        </CardDescription>
                      </div>
                      {!trigger.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedTrigger(isExpanded ? null : trigger.id)}
                      >
                        {isExpanded ? 'Collapse' : 'Configure'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTrigger(trigger.id)}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 space-y-4">
                    {/* Trigger Active Toggle */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`trigger-active-${trigger.id}`}
                        checked={trigger.isActive}
                        onCheckedChange={(checked) =>
                          updateTrigger(trigger.id, { isActive: !!checked })
                        }
                      />
                      <Label htmlFor={`trigger-active-${trigger.id}`}>
                        Active trigger
                      </Label>
                    </div>

                    <Separator />

                    {/* Conditions */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Conditions</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCondition(trigger.id)}
                        >
                          <PlusIcon className="w-4 h-4 mr-2" />
                          Add Condition
                        </Button>
                      </div>

                      {conditionEntries.length === 0 ? (
                        <Alert>
                          <InfoIcon className="w-4 h-4" />
                          <AlertDescription>
                            No conditions configured. Add at least one condition to activate this trigger.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-3">
                          {conditionEntries.map(([conditionId, condition], index) => {
                            const fieldConfig = getFieldConfig(trigger.type, condition.field);
                            const availableOperators = operators[condition.valueType] || [];

                            return (
                              <div key={conditionId} className="p-4 border rounded-lg space-y-3">
                                {index > 0 && (
                                  <div className="text-center">
                                    <Badge variant="outline">AND</Badge>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                  {/* Field Selection */}
                                  <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Field</Label>
                                    <Select
                                      value={condition.field}
                                      onValueChange={(value) => {
                                        const newFieldConfig = getFieldConfig(trigger.type, value);
                                        updateCondition(conditionId, conditionId, {
                                          field: value,
                                          valueType: newFieldConfig?.valueType || 'string',
                                          operator: operators[newFieldConfig?.valueType || 'string']?.[0]?.value || 'equals',
                                          value: newFieldConfig?.valueType === 'boolean' ? false : '',
                                        });
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(conditionFields[trigger.type] || []).map((field) => (
                                          <SelectItem key={field.field} value={field.field}>
                                            {field.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Operator Selection */}
                                  <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Operator</Label>
                                    <Select
                                      value={condition.operator}
                                      onValueChange={(value) =>
                                        updateCondition(trigger.id, conditionId, { operator: value })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableOperators.map((op) => (
                                          <SelectItem key={op.value} value={op.value}>
                                            {op.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Value Input */}
                                  <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Value</Label>
                                    {renderConditionValue(trigger.id, conditionId, condition, fieldConfig)}
                                  </div>

                                  {/* Remove Button */}
                                  <div className="flex items-end">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeCondition(trigger.id, conditionId)}
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Trigger Description */}
                    {typeConfig && (
                      <Alert>
                        <InfoIcon className="w-4 h-4" />
                        <AlertDescription>
                          <strong>{typeConfig.label}:</strong> {typeConfig.description}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {triggers.length === 0 && (
        <Alert>
          <InfoIcon className="w-4 h-4" />
          <AlertDescription>
            No triggers configured. Add triggers to control when this question appears to customers.
            Without triggers, the question will be available based on frequency settings only.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}