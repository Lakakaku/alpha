'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { X, Plus, AlertCircle, Clock, Target, Zap, Settings } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { QuestionCombinationRule, QuestionGroup, PriorityLevel } from '@vocilia/types'

interface CombinationRuleFormProps {
  rule?: Partial<QuestionCombinationRule>
  availableQuestions: Array<{
    id: string
    question_text: string
    topic_category: string
    estimated_tokens: number
    default_priority_level: PriorityLevel
  }>
  onSubmit: (rule: Partial<QuestionCombinationRule>) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function CombinationRuleForm({ 
  rule = {}, 
  availableQuestions, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: CombinationRuleFormProps) {
  const [formData, setFormData] = useState<Partial<QuestionCombinationRule>>({
    rule_name: '',
    max_call_duration_seconds: 120,
    priority_threshold_critical: 0,
    priority_threshold_high: 30,
    priority_threshold_medium: 60,
    priority_threshold_low: 90,
    is_active: true,
    ...rule
  })

  const [questionGroups, setQuestionGroups] = useState<Partial<QuestionGroup>[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [estimatedDuration, setEstimatedDuration] = useState(0)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Calculate estimated duration when questions change
  useEffect(() => {
    const totalTokens = selectedQuestions.reduce((sum, questionId) => {
      const question = availableQuestions.find(q => q.id === questionId)
      return sum + (question?.estimated_tokens || 30)
    }, 0)
    
    // Rough estimation: 1 token ≈ 0.75 words, average speaking rate ~150 words/minute
    // Add buffer for customer responses and AI processing
    const estimatedSeconds = Math.ceil((totalTokens * 0.75 * 60) / 150) + (selectedQuestions.length * 10)
    setEstimatedDuration(estimatedSeconds)
  }, [selectedQuestions, availableQuestions])

  // Validate priority thresholds
  useEffect(() => {
    const errors: string[] = []
    const { priority_threshold_critical, priority_threshold_high, priority_threshold_medium, priority_threshold_low, max_call_duration_seconds } = formData

    if (priority_threshold_critical! > priority_threshold_high!) {
      errors.push('Critical threshold must be ≤ High threshold')
    }
    if (priority_threshold_high! > priority_threshold_medium!) {
      errors.push('High threshold must be ≤ Medium threshold')
    }
    if (priority_threshold_medium! > priority_threshold_low!) {
      errors.push('Medium threshold must be ≤ Low threshold')
    }
    if (priority_threshold_low! > max_call_duration_seconds!) {
      errors.push('Low threshold must be ≤ Max call duration')
    }
    if (estimatedDuration > max_call_duration_seconds!) {
      errors.push(`Estimated duration (${estimatedDuration}s) exceeds max call duration (${max_call_duration_seconds}s)`)
    }

    setValidationErrors(errors)
  }, [formData, estimatedDuration])

  const handleInputChange = (field: keyof QuestionCombinationRule, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleQuestionToggle = (questionId: string) => {
    setSelectedQuestions(prev => 
      prev.includes(questionId) 
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    )
  }

  const createQuestionGroup = () => {
    const groupsByCategory = selectedQuestions.reduce((acc, questionId) => {
      const question = availableQuestions.find(q => q.id === questionId)
      if (question) {
        if (!acc[question.topic_category]) {
          acc[question.topic_category] = []
        }
        acc[question.topic_category].push(question)
      }
      return acc
    }, {} as Record<string, typeof availableQuestions>)

    const groups = Object.entries(groupsByCategory).map(([category, questions], index) => ({
      group_name: `${category.charAt(0).toUpperCase() + category.slice(1)} Questions`,
      topic_category: category,
      estimated_tokens: questions.reduce((sum, q) => sum + q.estimated_tokens, 0),
      display_order: index,
      is_active: true
    }))

    setQuestionGroups(groups)
  }

  useEffect(() => {
    createQuestionGroup()
  }, [selectedQuestions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (validationErrors.length > 0) {
      return
    }

    if (selectedQuestions.length === 0) {
      setValidationErrors(['At least one question must be selected'])
      return
    }

    try {
      await onSubmit({
        ...formData,
        question_groups: questionGroups
      })
    } catch (error) {
      console.error('Failed to save combination rule:', error)
    }
  }

  const getPriorityColor = (level: PriorityLevel) => {
    switch (level) {
      case 5: return 'bg-red-100 text-red-800 border-red-200'
      case 4: return 'bg-orange-100 text-orange-800 border-orange-200'
      case 3: return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 2: return 'bg-green-100 text-green-800 border-green-200'
      case 1: return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityLabel = (level: PriorityLevel) => {
    switch (level) {
      case 5: return 'Critical'
      case 4: return 'High'
      case 3: return 'Medium'
      case 2: return 'Low'
      case 1: return 'Optional'
      default: return 'Unknown'
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Rule Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Rule Configuration
          </CardTitle>
          <CardDescription>
            Define the basic settings for your question combination rule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ruleName">Rule Name</Label>
            <Input
              id="ruleName"
              value={formData.rule_name}
              onChange={(e) => handleInputChange('rule_name', e.target.value)}
              placeholder="e.g., Peak Hours Customer Feedback"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxDuration">Max Call Duration (seconds)</Label>
              <Input
                id="maxDuration"
                type="number"
                min={60}
                max={180}
                value={formData.max_call_duration_seconds}
                onChange={(e) => handleInputChange('max_call_duration_seconds', parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">
                Current estimate: {estimatedDuration}s
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <Switch
                id="isActive"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="isActive">Active Rule</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Priority Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Priority Thresholds
          </CardTitle>
          <CardDescription>
            Set time remaining thresholds for different priority levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Critical Priority (seconds remaining)</Label>
              <Slider
                value={[formData.priority_threshold_critical!]}
                onValueChange={([value]) => handleInputChange('priority_threshold_critical', value)}
                max={formData.max_call_duration_seconds}
                step={5}
                className="w-full"
              />
              <span className="text-sm text-muted-foreground">
                {formData.priority_threshold_critical}s
              </span>
            </div>

            <div className="space-y-2">
              <Label>High Priority (seconds remaining)</Label>
              <Slider
                value={[formData.priority_threshold_high!]}
                onValueChange={([value]) => handleInputChange('priority_threshold_high', value)}
                max={formData.max_call_duration_seconds}
                step={5}
                className="w-full"
              />
              <span className="text-sm text-muted-foreground">
                {formData.priority_threshold_high}s
              </span>
            </div>

            <div className="space-y-2">
              <Label>Medium Priority (seconds remaining)</Label>
              <Slider
                value={[formData.priority_threshold_medium!]}
                onValueChange={([value]) => handleInputChange('priority_threshold_medium', value)}
                max={formData.max_call_duration_seconds}
                step={5}
                className="w-full"
              />
              <span className="text-sm text-muted-foreground">
                {formData.priority_threshold_medium}s
              </span>
            </div>

            <div className="space-y-2">
              <Label>Low Priority (seconds remaining)</Label>
              <Slider
                value={[formData.priority_threshold_low!]}
                onValueChange={([value]) => handleInputChange('priority_threshold_low', value)}
                max={formData.max_call_duration_seconds}
                step={5}
                className="w-full"
              />
              <span className="text-sm text-muted-foreground">
                {formData.priority_threshold_low}s
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Question Selection
          </CardTitle>
          <CardDescription>
            Choose questions to include in this combination rule
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 max-h-96 overflow-y-auto">
              {availableQuestions.map((question) => (
                <div
                  key={question.id}
                  className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedQuestions.includes(question.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleQuestionToggle(question.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedQuestions.includes(question.id)}
                    onChange={() => {}} // Handled by parent click
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {question.question_text}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {question.topic_category}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getPriorityColor(question.default_priority_level)}`}
                      >
                        {getPriorityLabel(question.default_priority_level)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ~{question.estimated_tokens} tokens
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedQuestions.length > 0 && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Selected Questions ({selectedQuestions.length})</h4>
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Estimated: {estimatedDuration}s
                    </span>
                    <span>
                      Groups: {questionGroups.length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Question Groups Preview */}
      {questionGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Generated Question Groups
            </CardTitle>
            <CardDescription>
              Automatically grouped by topic category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {questionGroups.map((group, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{group.group_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Category: {group.topic_category} • ~{group.estimated_tokens} tokens
                    </p>
                  </div>
                  <Badge variant="outline">
                    Order: {group.display_order! + 1}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || validationErrors.length > 0}
          className="min-w-[100px]"
        >
          {isLoading ? 'Saving...' : rule?.id ? 'Update Rule' : 'Create Rule'}
        </Button>
      </div>
    </form>
  )
}