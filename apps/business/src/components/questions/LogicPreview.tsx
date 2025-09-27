'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Play, RotateCcw, Clock, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface CustomerTestData {
  verification_id: string;
  transaction_time: string;
  transaction_amount: number;
  transaction_currency: string;
  purchase_categories: string[];
  purchase_items: string[];
  customer_sequence: number;
}

interface QuestionEvaluationResult {
  selected_questions: Array<{
    question_id: string;
    question_text: string;
    priority_level: number;
    estimated_tokens: number;
    trigger_source?: string;
    skip_reason?: string;
  }>;
  triggered_rules: string[];
  total_estimated_duration: number;
  optimization_metadata: {
    algorithm_version: number;
    total_evaluated_questions: number;
    triggers_activated: number;
    time_constraint_applied: boolean;
    cache_hit: boolean;
  };
  performance_metadata: {
    total_duration_ms: number;
    sub_timings_ms: {
      [key: string]: number;
    };
    threshold_ms: number;
    threshold_exceeded: boolean;
    timestamp: string;
  };
}

interface LogicPreviewProps {
  businessContextId: string;
  ruleId?: string;
  className?: string;
}

const SAMPLE_SCENARIOS = [
  {
    name: 'Lunch Hour Grocery Shopping',
    data: {
      transaction_time: '2025-09-24T12:30:00Z',
      transaction_amount: 450.50,
      transaction_currency: 'SEK',
      purchase_categories: ['produce', 'meat', 'bakery'],
      purchase_items: ['apples', 'ground_beef', 'bread'],
      customer_sequence: 15
    }
  },
  {
    name: 'High-Value Evening Purchase',
    data: {
      transaction_time: '2025-09-24T18:45:00Z',
      transaction_amount: 890.75,
      transaction_currency: 'SEK',
      purchase_categories: ['meat', 'seafood', 'wine'],
      purchase_items: ['salmon', 'shrimp', 'wine_red'],
      customer_sequence: 8
    }
  },
  {
    name: 'Quick Morning Coffee Run',
    data: {
      transaction_time: '2025-09-24T08:15:00Z',
      transaction_amount: 45.00,
      transaction_currency: 'SEK',
      purchase_categories: ['beverages'],
      purchase_items: ['coffee', 'pastry'],
      customer_sequence: 3
    }
  }
];

export function LogicPreview({ businessContextId, ruleId, className }: LogicPreviewProps) {
  const [testData, setTestData] = useState<CustomerTestData>({
    verification_id: crypto.randomUUID(),
    transaction_time: new Date().toISOString(),
    transaction_amount: 100,
    transaction_currency: 'SEK',
    purchase_categories: [],
    purchase_items: [],
    customer_sequence: 1
  });

  const [result, setResult] = useState<QuestionEvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [includeDebugInfo, setIncludeDebugInfo] = useState(true);
  const [maxCallDuration, setMaxCallDuration] = useState(120);
  const [targetQuestionCount, setTargetQuestionCount] = useState(5);
  const [purchaseCategory, setPurchaseCategory] = useState('');
  const [purchaseItem, setPurchaseItem] = useState('');
  
  const { toast } = useToast();

  const handleLoadScenario = (scenarioName: string) => {
    const scenario = SAMPLE_SCENARIOS.find(s => s.name === scenarioName);
    if (scenario) {
      setTestData(prev => ({
        ...prev,
        ...scenario.data,
        verification_id: crypto.randomUUID(),
        transaction_time: new Date(scenario.data.transaction_time).toISOString()
      }));
      setSelectedScenario(scenarioName);
    }
  };

  const handleRunPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      const requestData = {
        business_context_id: businessContextId,
        customer_data: testData,
        time_constraints: {
          max_call_duration_seconds: maxCallDuration,
          target_question_count: targetQuestionCount
        },
        options: {
          include_debug_info: includeDebugInfo,
          force_triggers: ruleId ? [ruleId] : undefined
        }
      };

      const response = await fetch('/api/questions/combinations/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to evaluate question logic');
      }

      const evaluationResult = await response.json();
      setResult(evaluationResult);

      toast({
        title: 'Preview Complete',
        description: `Found ${evaluationResult.selected_questions.length} questions in ${evaluationResult.performance_metadata.total_duration_ms.toFixed(1)}ms`
      });
    } catch (error) {
      console.error('Error running preview:', error);
      setError(error instanceof Error ? error.message : 'Failed to run preview');
      toast({
        title: 'Preview Failed',
        description: 'Failed to evaluate question logic',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTestData({
      verification_id: crypto.randomUUID(),
      transaction_time: new Date().toISOString(),
      transaction_amount: 100,
      transaction_currency: 'SEK',
      purchase_categories: [],
      purchase_items: [],
      customer_sequence: 1
    });
    setResult(null);
    setError(null);
    setSelectedScenario('');
  };

  const addPurchaseCategory = () => {
    if (purchaseCategory && !testData.purchase_categories.includes(purchaseCategory)) {
      setTestData(prev => ({
        ...prev,
        purchase_categories: [...prev.purchase_categories, purchaseCategory]
      }));
      setPurchaseCategory('');
    }
  };

  const removePurchaseCategory = (category: string) => {
    setTestData(prev => ({
      ...prev,
      purchase_categories: prev.purchase_categories.filter(c => c !== category)
    }));
  };

  const addPurchaseItem = () => {
    if (purchaseItem && !testData.purchase_items.includes(purchaseItem)) {
      setTestData(prev => ({
        ...prev,
        purchase_items: [...prev.purchase_items, purchaseItem]
      }));
      setPurchaseItem('');
    }
  };

  const removePurchaseItem = (item: string) => {
    setTestData(prev => ({
      ...prev,
      purchase_items: prev.purchase_items.filter(i => i !== item)
    }));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Question Logic Preview & Testing
          </CardTitle>
          <CardDescription>
            Test your question combination logic with different customer scenarios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scenario Selection */}
          <div className="space-y-2">
            <Label>Quick Test Scenarios</Label>
            <div className="flex gap-2 flex-wrap">
              {SAMPLE_SCENARIOS.map((scenario) => (
                <Button
                  key={scenario.name}
                  variant={selectedScenario === scenario.name ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleLoadScenario(scenario.name)}
                >
                  {scenario.name}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          <Separator />

          {/* Customer Test Data Configuration */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Customer Data</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Transaction Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={testData.transaction_amount}
                    onChange={(e) => setTestData(prev => ({
                      ...prev,
                      transaction_amount: parseFloat(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={testData.transaction_currency}
                    onValueChange={(value) => setTestData(prev => ({
                      ...prev,
                      transaction_currency: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEK">SEK</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Transaction Time</Label>
                <Input
                  type="datetime-local"
                  value={new Date(testData.transaction_time).toISOString().slice(0, 16)}
                  onChange={(e) => setTestData(prev => ({
                    ...prev,
                    transaction_time: new Date(e.target.value).toISOString()
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Customer Sequence Number</Label>
                <Input
                  type="number"
                  min="1"
                  value={testData.customer_sequence}
                  onChange={(e) => setTestData(prev => ({
                    ...prev,
                    customer_sequence: parseInt(e.target.value) || 1
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Purchase Categories</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. meat, produce, bakery"
                    value={purchaseCategory}
                    onChange={(e) => setPurchaseCategory(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPurchaseCategory()}
                  />
                  <Button type="button" onClick={addPurchaseCategory}>Add</Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {testData.purchase_categories.map((category) => (
                    <Badge key={category} variant="secondary" className="cursor-pointer" onClick={() => removePurchaseCategory(category)}>
                      {category} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Purchase Items</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. ground_beef, apples, bread"
                    value={purchaseItem}
                    onChange={(e) => setPurchaseItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPurchaseItem()}
                  />
                  <Button type="button" onClick={addPurchaseItem}>Add</Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {testData.purchase_items.map((item) => (
                    <Badge key={item} variant="secondary" className="cursor-pointer" onClick={() => removePurchaseItem(item)}>
                      {item} ×
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Test Configuration</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Call Duration (seconds)</Label>
                  <Input
                    type="number"
                    min="60"
                    max="180"
                    value={maxCallDuration}
                    onChange={(e) => setMaxCallDuration(parseInt(e.target.value) || 120)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Question Count</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={targetQuestionCount}
                    onChange={(e) => setTargetQuestionCount(parseInt(e.target.value) || 5)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="debug-info">Include Debug Information</Label>
                <Switch
                  id="debug-info"
                  checked={includeDebugInfo}
                  onCheckedChange={setIncludeDebugInfo}
                />
              </div>

              <Button
                onClick={handleRunPreview}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Running Preview...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Preview
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Display */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Preview Results
              {result.performance_metadata.threshold_exceeded && (
                <Badge variant="destructive">Performance Warning</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Evaluation completed in {result.performance_metadata.total_duration_ms.toFixed(1)}ms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Performance Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.selected_questions.length}</div>
                <div className="text-sm text-muted-foreground">Questions Selected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{result.total_estimated_duration}s</div>
                <div className="text-sm text-muted-foreground">Estimated Duration</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{result.optimization_metadata.triggers_activated}</div>
                <div className="text-sm text-muted-foreground">Triggers Activated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{result.performance_metadata.total_duration_ms.toFixed(1)}ms</div>
                <div className="text-sm text-muted-foreground">Processing Time</div>
              </div>
            </div>

            {/* Selected Questions */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Selected Questions</h3>
              {result.selected_questions.map((question, index) => (
                <Card key={question.question_id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="font-medium">{question.question_text}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Priority {question.priority_level}</Badge>
                          <Badge variant="outline">{question.estimated_tokens} tokens</Badge>
                          {question.trigger_source && (
                            <Badge className="bg-green-500 text-white">
                              <Zap className="h-3 w-3 mr-1" />
                              {question.trigger_source}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        #{index + 1}
                      </div>
                    </div>
                    {question.skip_reason && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                        <div className="flex items-center gap-2 text-yellow-700">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">Skip Reason: {question.skip_reason}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {result.selected_questions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>No questions were selected based on the current logic and customer data.</p>
                </div>
              )}
            </div>

            {/* Debug Information */}
            {includeDebugInfo && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Debug Information</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Optimization Metadata</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Algorithm Version:</span>
                        <span>{result.optimization_metadata.algorithm_version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Questions Evaluated:</span>
                        <span>{result.optimization_metadata.total_evaluated_questions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Time Constraint Applied:</span>
                        <span>{result.optimization_metadata.time_constraint_applied ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cache Hit:</span>
                        <span>{result.optimization_metadata.cache_hit ? 'Yes' : 'No'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Performance Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {Object.entries(result.performance_metadata.sub_timings_ms).map(([operation, duration]) => (
                        <div key={operation} className="flex justify-between">
                          <span className="capitalize">{operation.replace('_', ' ')}:</span>
                          <span>{duration.toFixed(1)}ms</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {result.triggered_rules.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Triggered Rules</h4>
                    <div className="flex gap-2 flex-wrap">
                      {result.triggered_rules.map((ruleId) => (
                        <Badge key={ruleId} className="bg-green-500 text-white">
                          {ruleId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}