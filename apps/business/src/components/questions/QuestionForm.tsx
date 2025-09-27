'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@vocilia/ui/components/button';
import { Input } from '@vocilia/ui/components/input';
import { Label } from '@vocilia/ui/components/label';
import { Textarea } from '@vocilia/ui/components/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vocilia/ui/components/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui/components/card';
import { Badge } from '@vocilia/ui/components/badge';
import { Checkbox } from '@vocilia/ui/components/checkbox';
import { Alert, AlertDescription } from '@vocilia/ui/components/alert';
import { Progress } from '@vocilia/ui/components/progress';
import { CustomQuestion, QuestionCategory, QuestionTrigger } from '@vocilia/types';
import { PlusIcon, TrashIcon, EyeIcon } from 'lucide-react';

export interface QuestionFormProps {
  question?: CustomQuestion;
  onSubmit: (question: Partial<CustomQuestion>) => Promise<void>;
  onCancel: () => void;
  onPreview?: (question: Partial<CustomQuestion>) => void;
  categories: QuestionCategory[];
  loading?: boolean;
  error?: string | null;
}

interface QuestionFormData {
  title: string;
  content: string;
  type: 'text' | 'rating' | 'multiple_choice' | 'yes_no';
  categoryId: string;
  priority: number;
  isRequired: boolean;
  maxLength?: number;
  options?: string[];
  ratingScale?: number;
  validFrom?: string;
  validUntil?: string;
  frequency: {
    window: 'hourly' | 'daily' | 'weekly';
    maxPresentations: number;
    cooldownMinutes: number;
  };
  triggers: QuestionTrigger[];
  tags: string[];
  isActive: boolean;
}

const initialFormData: QuestionFormData = {
  title: '',
  content: '',
  type: 'text',
  categoryId: '',
  priority: 5,
  isRequired: false,
  frequency: {
    window: 'daily',
    maxPresentations: 1,
    cooldownMinutes: 60,
  },
  triggers: [],
  tags: [],
  isActive: true,
};

const questionTypes = [
  { value: 'text', label: 'Text Response', description: 'Open-ended text input' },
  { value: 'rating', label: 'Rating Scale', description: 'Numerical rating (1-10)' },
  { value: 'multiple_choice', label: 'Multiple Choice', description: 'Select from options' },
  { value: 'yes_no', label: 'Yes/No', description: 'Binary choice' },
];

const triggerTypes = [
  { value: 'time_based', label: 'Time-Based', description: 'Specific times or date ranges' },
  { value: 'frequency_based', label: 'Frequency-Based', description: 'Based on visit frequency' },
  { value: 'customer_behavior', label: 'Customer Behavior', description: 'Based on customer actions' },
  { value: 'store_context', label: 'Store Context', description: 'Store-specific conditions' },
];

export function QuestionForm({
  question,
  onSubmit,
  onCancel,
  onPreview,
  categories,
  loading = false,
  error = null,
}: QuestionFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<QuestionFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [optionInput, setOptionInput] = useState('');

  // Initialize form data from existing question
  useEffect(() => {
    if (question) {
      setFormData({
        title: question.title || '',
        content: question.content || '',
        type: question.type || 'text',
        categoryId: question.categoryId || '',
        priority: question.priority || 5,
        isRequired: question.isRequired || false,
        maxLength: question.maxLength,
        options: question.options || [],
        ratingScale: question.ratingScale,
        validFrom: question.validFrom ? new Date(question.validFrom).toISOString().slice(0, 16) : '',
        validUntil: question.validUntil ? new Date(question.validUntil).toISOString().slice(0, 16) : '',
        frequency: question.frequency || initialFormData.frequency,
        triggers: question.triggers || [],
        tags: question.tags || [],
        isActive: question.isActive !== false,
      });
    }
  }, [question]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }

    if (!formData.content.trim()) {
      errors.content = 'Question content is required';
    }

    if (!formData.categoryId) {
      errors.categoryId = 'Category is required';
    }

    if (formData.type === 'multiple_choice' && (!formData.options || formData.options.length < 2)) {
      errors.options = 'Multiple choice questions need at least 2 options';
    }

    if (formData.type === 'rating' && (!formData.ratingScale || formData.ratingScale < 2 || formData.ratingScale > 10)) {
      errors.ratingScale = 'Rating scale must be between 2 and 10';
    }

    if (formData.type === 'text' && formData.maxLength && formData.maxLength < 1) {
      errors.maxLength = 'Max length must be positive';
    }

    if (formData.validFrom && formData.validUntil && new Date(formData.validFrom) >= new Date(formData.validUntil)) {
      errors.validUntil = 'End date must be after start date';
    }

    if (formData.frequency.maxPresentations < 1) {
      errors.frequency = 'Max presentations must be at least 1';
    }

    if (formData.frequency.cooldownMinutes < 0) {
      errors.cooldown = 'Cooldown cannot be negative';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const questionData: Partial<CustomQuestion> = {
        ...formData,
        validFrom: formData.validFrom ? new Date(formData.validFrom) : undefined,
        validUntil: formData.validUntil ? new Date(formData.validUntil) : undefined,
      };

      await onSubmit(questionData);
    } catch (err) {
      console.error('Error submitting question:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = () => {
    if (onPreview && validateForm()) {
      const questionData: Partial<CustomQuestion> = {
        ...formData,
        validFrom: formData.validFrom ? new Date(formData.validFrom) : undefined,
        validUntil: formData.validUntil ? new Date(formData.validUntil) : undefined,
      };
      onPreview(questionData);
    }
  };

  const addOption = () => {
    if (optionInput.trim() && !formData.options?.includes(optionInput.trim())) {
      setFormData(prev => ({
        ...prev,
        options: [...(prev.options || []), optionInput.trim()],
      }));
      setOptionInput('');
    }
  };

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index) || [],
    }));
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  const addTrigger = () => {
    const newTrigger: QuestionTrigger = {
      id: crypto.randomUUID(),
      questionId: question?.id || '',
      type: 'time_based',
      conditions: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setFormData(prev => ({
      ...prev,
      triggers: [...prev.triggers, newTrigger],
    }));
  };

  const removeTrigger = (index: number) => {
    setFormData(prev => ({
      ...prev,
      triggers: prev.triggers.filter((_, i) => i !== index),
    }));
  };

  const updateTrigger = (index: number, updates: Partial<QuestionTrigger>) => {
    setFormData(prev => ({
      ...prev,
      triggers: prev.triggers.map((trigger, i) => 
        i === index ? { ...trigger, ...updates } : trigger
      ),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Essential details about your question
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Question Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter question title"
                className={formErrors.title ? 'border-red-500' : ''}
              />
              {formErrors.title && (
                <p className="text-sm text-red-600">{formErrors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value }))}
              >
                <SelectTrigger className={formErrors.categoryId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.categoryId && (
                <p className="text-sm text-red-600">{formErrors.categoryId}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Question Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Enter the question you want to ask customers"
              rows={3}
              className={formErrors.content ? 'border-red-500' : ''}
            />
            {formErrors.content && (
              <p className="text-sm text-red-600">{formErrors.content}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Question Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {questionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-gray-500">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority (1-10)</Label>
              <Input
                id="priority"
                type="number"
                min={1}
                max={10}
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 5 }))}
              />
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="required"
                checked={formData.isRequired}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRequired: !!checked }))}
              />
              <Label htmlFor="required">Required question</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Type Specific Options */}
      {formData.type === 'multiple_choice' && (
        <Card>
          <CardHeader>
            <CardTitle>Multiple Choice Options</CardTitle>
            <CardDescription>
              Add options for customers to choose from
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={optionInput}
                onChange={(e) => setOptionInput(e.target.value)}
                placeholder="Enter an option"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
              />
              <Button type="button" onClick={addOption} disabled={!optionInput.trim()}>
                <PlusIcon className="w-4 h-4" />
              </Button>
            </div>

            {formData.options && formData.options.length > 0 && (
              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <span className="flex-1">{option}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(index)}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {formErrors.options && (
              <p className="text-sm text-red-600">{formErrors.options}</p>
            )}
          </CardContent>
        </Card>
      )}

      {formData.type === 'rating' && (
        <Card>
          <CardHeader>
            <CardTitle>Rating Scale Configuration</CardTitle>
            <CardDescription>
              Configure the rating scale for this question
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="ratingScale">Rating Scale (2-10)</Label>
              <Input
                id="ratingScale"
                type="number"
                min={2}
                max={10}
                value={formData.ratingScale || 5}
                onChange={(e) => setFormData(prev => ({ ...prev, ratingScale: parseInt(e.target.value) || 5 }))}
                className={formErrors.ratingScale ? 'border-red-500' : ''}
              />
              {formErrors.ratingScale && (
                <p className="text-sm text-red-600">{formErrors.ratingScale}</p>
              )}
              <p className="text-sm text-gray-500">
                Customers will rate from 1 to {formData.ratingScale || 5}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {formData.type === 'text' && (
        <Card>
          <CardHeader>
            <CardTitle>Text Response Configuration</CardTitle>
            <CardDescription>
              Configure text input constraints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="maxLength">Maximum Length (optional)</Label>
              <Input
                id="maxLength"
                type="number"
                min={1}
                value={formData.maxLength || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, maxLength: e.target.value ? parseInt(e.target.value) : undefined }))}
                placeholder="No limit"
                className={formErrors.maxLength ? 'border-red-500' : ''}
              />
              {formErrors.maxLength && (
                <p className="text-sm text-red-600">{formErrors.maxLength}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Frequency & Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle>Frequency & Scheduling</CardTitle>
          <CardDescription>
            Control when and how often this question appears
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency-window">Frequency Window</Label>
              <Select
                value={formData.frequency.window}
                onValueChange={(value: any) => setFormData(prev => ({
                  ...prev,
                  frequency: { ...prev.frequency, window: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-presentations">Max Presentations</Label>
              <Input
                id="max-presentations"
                type="number"
                min={1}
                value={formData.frequency.maxPresentations}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  frequency: { ...prev.frequency, maxPresentations: parseInt(e.target.value) || 1 }
                }))}
                className={formErrors.frequency ? 'border-red-500' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown (minutes)</Label>
              <Input
                id="cooldown"
                type="number"
                min={0}
                value={formData.frequency.cooldownMinutes}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  frequency: { ...prev.frequency, cooldownMinutes: parseInt(e.target.value) || 0 }
                }))}
                className={formErrors.cooldown ? 'border-red-500' : ''}
              />
            </div>
          </div>

          {(formErrors.frequency || formErrors.cooldown) && (
            <div className="text-sm text-red-600">
              {formErrors.frequency || formErrors.cooldown}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valid-from">Valid From (optional)</Label>
              <Input
                id="valid-from"
                type="datetime-local"
                value={formData.validFrom}
                onChange={(e) => setFormData(prev => ({ ...prev, validFrom: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valid-until">Valid Until (optional)</Label>
              <Input
                id="valid-until"
                type="datetime-local"
                value={formData.validUntil}
                onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                className={formErrors.validUntil ? 'border-red-500' : ''}
              />
              {formErrors.validUntil && (
                <p className="text-sm text-red-600">{formErrors.validUntil}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Add tags to organize and filter questions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Enter a tag"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            />
            <Button type="button" onClick={addTag} disabled={!tagInput.trim()}>
              <PlusIcon className="w-4 h-4" />
            </Button>
          </div>

          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:text-red-600"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Triggers */}
      <Card>
        <CardHeader>
          <CardTitle>Triggers</CardTitle>
          <CardDescription>
            Configure when this question should be presented
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" onClick={addTrigger} variant="outline">
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Trigger
          </Button>

          {formData.triggers.length > 0 && (
            <div className="space-y-4">
              {formData.triggers.map((trigger, index) => (
                <div key={trigger.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Select
                      value={trigger.type}
                      onValueChange={(value: any) => updateTrigger(index, { type: value })}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {triggerTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTrigger(index)}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>

                  <p className="text-sm text-gray-600">
                    {triggerTypes.find(t => t.value === trigger.type)?.description}
                  </p>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`trigger-active-${index}`}
                      checked={trigger.isActive}
                      onCheckedChange={(checked) => updateTrigger(index, { isActive: !!checked })}
                    />
                    <Label htmlFor={`trigger-active-${index}`}>Active trigger</Label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            Control the active state of this question
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-active"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: !!checked }))}
            />
            <Label htmlFor="is-active">Active question</Label>
            <p className="text-sm text-gray-500 ml-2">
              {formData.isActive ? 'Question will be available for presentation' : 'Question will be hidden from customers'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {onPreview && (
            <Button type="button" variant="outline" onClick={handlePreview}>
              <EyeIcon className="w-4 h-4 mr-2" />
              Preview
            </Button>
          )}
        </div>

        <Button 
          type="submit" 
          disabled={isSubmitting || loading}
          className="min-w-24"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <Progress value={66} className="w-16 h-2" />
              <span>Saving...</span>
            </div>
          ) : (
            question ? 'Update Question' : 'Create Question'
          )}
        </Button>
      </div>
    </form>
  );
}