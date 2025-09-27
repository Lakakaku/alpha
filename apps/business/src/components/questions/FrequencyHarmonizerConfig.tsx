'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, Zap, Settings, X, Plus } from 'lucide-react';

interface ContextQuestion {
  id: string;
  text: string;
  frequency: number;
  category: string;
  priority_level: number;
}

interface FrequencyConflict {
  question_1: ContextQuestion;
  question_2: ContextQuestion;
  lcm_frequency: number;
  conflict_customers: number[];
}

interface FrequencyHarmonizer {
  id?: string;
  rule_id: string;
  question_pair_hash: string;
  question_id_1: string;
  question_id_2: string;
  resolution_strategy: 'combine' | 'priority' | 'alternate' | 'custom';
  custom_frequency?: number;
  priority_question_id?: string;
}

interface FrequencyHarmonizerConfigProps {
  businessContextId: string;
  ruleId: string;
  onConfigChange?: (hasUnresolvedConflicts: boolean) => void;
}

const RESOLUTION_STRATEGIES = [
  {
    value: 'combine' as const,
    label: 'Combine Questions',
    description: 'Ask both questions together when both are due',
  },
  {
    value: 'priority' as const,
    label: 'Priority Based',
    description: 'Only ask the higher priority question',
  },
  {
    value: 'alternate' as const,
    label: 'Alternate',
    description: 'Take turns asking each question',
  },
  {
    value: 'custom' as const,
    label: 'Custom Frequency',
    description: 'Define a custom schedule for this pair',
  },
];

// Calculate LCM (Least Common Multiple)
function lcm(a: number, b: number): number {
  const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y);
  return (a * b) / gcd(a, b);
}

// Generate hash for question pair (ensures consistent ordering)
function generateQuestionPairHash(id1: string, id2: string): string {
  const sorted = [id1, id2].sort();
  return btoa(sorted.join('|')).substring(0, 12);
}

// Find customers where both questions would be triggered
function findConflictCustomers(freq1: number, freq2: number, maxCustomers = 100): number[] {
  const conflicts: number[] = [];
  const lcmFreq = lcm(freq1, freq2);
  
  for (let customer = 1; customer <= maxCustomers; customer++) {
    if (customer % freq1 === 0 && customer % freq2 === 0) {
      conflicts.push(customer);
    }
  }
  
  return conflicts;
}

export function FrequencyHarmonizerConfig({
  businessContextId,
  ruleId,
  onConfigChange,
}: FrequencyHarmonizerConfigProps) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<ContextQuestion[]>([]);
  const [conflicts, setConflicts] = useState<FrequencyConflict[]>([]);
  const [harmonizers, setHarmonizers] = useState<FrequencyHarmonizer[]>([]);
  const [savingHarmonizers, setSavingHarmonizers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [businessContextId, ruleId]);

  useEffect(() => {
    detectConflicts();
  }, [questions]);

  useEffect(() => {
    const unresolved = conflicts.some(conflict => 
      !harmonizers.find(h => 
        (h.question_id_1 === conflict.question_1.id && h.question_id_2 === conflict.question_2.id) ||
        (h.question_id_1 === conflict.question_2.id && h.question_id_2 === conflict.question_1.id)
      )
    );
    onConfigChange?.(unresolved);
  }, [conflicts, harmonizers, onConfigChange]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load questions for this business context
      const questionsResponse = await fetch(
        `/api/questions?business_context_id=${businessContextId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );

      if (!questionsResponse.ok) {
        throw new Error('Failed to load questions');
      }

      const questionsData = await questionsResponse.json();
      setQuestions(questionsData.data || []);

      // Load existing harmonizers for this rule
      const harmonizersResponse = await fetch(
        `/api/questions/frequency-harmonizers/${ruleId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );

      if (harmonizersResponse.ok) {
        const harmonizersData = await harmonizersResponse.json();
        setHarmonizers(harmonizersData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load frequency configuration');
    } finally {
      setLoading(false);
    }
  };

  const detectConflicts = () => {
    if (questions.length < 2) {
      setConflicts([]);
      return;
    }

    const detectedConflicts: FrequencyConflict[] = [];

    // Check each pair of questions for frequency conflicts
    for (let i = 0; i < questions.length; i++) {
      for (let j = i + 1; j < questions.length; j++) {
        const q1 = questions[i];
        const q2 = questions[j];

        // Skip if frequencies are very different (no meaningful conflict)
        const maxFreq = Math.max(q1.frequency, q2.frequency);
        const minFreq = Math.min(q1.frequency, q2.frequency);
        if (maxFreq / minFreq > 10) continue;

        const lcmFreq = lcm(q1.frequency, q2.frequency);
        const conflictCustomers = findConflictCustomers(q1.frequency, q2.frequency, 50);

        if (conflictCustomers.length > 0) {
          detectedConflicts.push({
            question_1: q1,
            question_2: q2,
            lcm_frequency: lcmFreq,
            conflict_customers: conflictCustomers,
          });
        }
      }
    }

    setConflicts(detectedConflicts);
  };

  const saveHarmonizer = async (
    conflict: FrequencyConflict,
    strategy: FrequencyHarmonizer['resolution_strategy'],
    customFrequency?: number,
    priorityQuestionId?: string
  ) => {
    const conflictKey = `${conflict.question_1.id}-${conflict.question_2.id}`;
    setSavingHarmonizers(prev => new Set([...prev, conflictKey]));

    try {
      const harmonizer: Omit<FrequencyHarmonizer, 'id'> = {
        rule_id: ruleId,
        question_pair_hash: generateQuestionPairHash(conflict.question_1.id, conflict.question_2.id),
        question_id_1: conflict.question_1.id,
        question_id_2: conflict.question_2.id,
        resolution_strategy: strategy,
        custom_frequency: strategy === 'custom' ? customFrequency : undefined,
        priority_question_id: strategy === 'priority' ? priorityQuestionId : undefined,
      };

      const response = await fetch('/api/questions/frequency-harmonizers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(harmonizer),
      });

      if (!response.ok) {
        throw new Error('Failed to save harmonizer');
      }

      const savedHarmonizer = await response.json();
      setHarmonizers(prev => [...prev, savedHarmonizer.data]);
      toast.success('Frequency conflict resolved');
    } catch (error) {
      console.error('Error saving harmonizer:', error);
      toast.error('Failed to resolve conflict');
    } finally {
      setSavingHarmonizers(prev => {
        const newSet = new Set(prev);
        newSet.delete(conflictKey);
        return newSet;
      });
    }
  };

  const removeHarmonizer = async (harmonizer: FrequencyHarmonizer) => {
    if (!harmonizer.id) return;

    try {
      const response = await fetch(`/api/questions/frequency-harmonizers/${harmonizer.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to remove harmonizer');
      }

      setHarmonizers(prev => prev.filter(h => h.id !== harmonizer.id));
      toast.success('Harmonizer removed');
    } catch (error) {
      console.error('Error removing harmonizer:', error);
      toast.error('Failed to remove harmonizer');
    }
  };

  const getHarmonizerForConflict = (conflict: FrequencyConflict): FrequencyHarmonizer | undefined => {
    return harmonizers.find(h => 
      (h.question_id_1 === conflict.question_1.id && h.question_id_2 === conflict.question_2.id) ||
      (h.question_id_1 === conflict.question_2.id && h.question_id_2 === conflict.question_1.id)
    );
  };

  const ConflictResolutionForm = ({ 
    conflict, 
    existingHarmonizer 
  }: { 
    conflict: FrequencyConflict;
    existingHarmonizer?: FrequencyHarmonizer;
  }) => {
    const [strategy, setStrategy] = useState<FrequencyHarmonizer['resolution_strategy']>(
      existingHarmonizer?.resolution_strategy || 'combine'
    );
    const [customFrequency, setCustomFrequency] = useState(
      existingHarmonizer?.custom_frequency?.toString() || conflict.lcm_frequency.toString()
    );
    const [priorityQuestionId, setPriorityQuestionId] = useState(
      existingHarmonizer?.priority_question_id || conflict.question_1.id
    );

    const handleSave = () => {
      saveHarmonizer(
        conflict,
        strategy,
        strategy === 'custom' ? parseInt(customFrequency) : undefined,
        strategy === 'priority' ? priorityQuestionId : undefined
      );
    };

    const conflictKey = `${conflict.question_1.id}-${conflict.question_2.id}`;
    const isSaving = savingHarmonizers.has(conflictKey);

    return (
      <div className="space-y-4 p-4 border rounded-lg">
        <div>
          <Label>Resolution Strategy</Label>
          <Select value={strategy} onValueChange={(value: any) => setStrategy(value)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTION_STRATEGIES.map(strat => (
                <SelectItem key={strat.value} value={strat.value}>
                  <div>
                    <div className="font-medium">{strat.label}</div>
                    <div className="text-sm text-muted-foreground">{strat.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {strategy === 'custom' && (
          <div>
            <Label htmlFor={`custom-freq-${conflictKey}`}>Custom Frequency (every N customers)</Label>
            <Input
              id={`custom-freq-${conflictKey}`}
              type="number"
              min={1}
              value={customFrequency}
              onChange={(e) => setCustomFrequency(e.target.value)}
              className="mt-1"
            />
          </div>
        )}

        {strategy === 'priority' && (
          <div>
            <Label>Priority Question</Label>
            <Select value={priorityQuestionId} onValueChange={setPriorityQuestionId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={conflict.question_1.id}>
                  {conflict.question_1.text} (Priority: {conflict.question_1.priority_level})
                </SelectItem>
                <SelectItem value={conflict.question_2.id}>
                  {conflict.question_2.text} (Priority: {conflict.question_2.priority_level})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex justify-between">
          {existingHarmonizer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeHarmonizer(existingHarmonizer)}
            >
              <X className="h-4 w-4 mr-2" />
              Remove
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="ml-auto"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existingHarmonizer ? 'Update' : 'Resolve'}
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading frequency analysis...
        </CardContent>
      </Card>
    );
  }

  const unresolvedConflicts = conflicts.filter(conflict => !getHarmonizerForConflict(conflict));
  const resolvedConflicts = conflicts.filter(conflict => getHarmonizerForConflict(conflict));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Frequency Harmonization
              </CardTitle>
              <CardDescription>
                Resolve conflicts when multiple questions are scheduled for the same customers
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={unresolvedConflicts.length === 0 ? "default" : "destructive"}>
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
              </Badge>
              {unresolvedConflicts.length > 0 && (
                <Badge variant="outline">
                  {unresolvedConflicts.length} unresolved
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        {conflicts.length === 0 ? (
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No frequency conflicts detected</p>
              <p className="text-sm">Your question frequencies work well together</p>
            </div>
          </CardContent>
        ) : (
          <CardContent className="space-y-6">
            {unresolvedConflicts.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {unresolvedConflicts.length} frequency conflict{unresolvedConflicts.length !== 1 ? 's need' : ' needs'} resolution.
                  Without resolution, both questions may be asked to the same customers.
                </AlertDescription>
              </Alert>
            )}

            {unresolvedConflicts.map((conflict, index) => (
              <Card key={`unresolved-${index}`} className="border-orange-200 bg-orange-50/50">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base text-orange-900">
                        Frequency Conflict #{index + 1}
                      </CardTitle>
                      <CardDescription className="text-orange-700">
                        Questions will both trigger for customers: {conflict.conflict_customers.slice(0, 5).join(', ')}
                        {conflict.conflict_customers.length > 5 && ` (+${conflict.conflict_customers.length - 5} more)`}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-orange-300 text-orange-700">
                      LCM: {conflict.lcm_frequency}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white rounded border">
                      <div className="font-medium text-sm">{conflict.question_1.text}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Every {conflict.question_1.frequency} customer{conflict.question_1.frequency !== 1 ? 's' : ''} • 
                        Priority: {conflict.question_1.priority_level}/5 • 
                        Category: {conflict.question_1.category}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-white rounded border">
                      <div className="font-medium text-sm">{conflict.question_2.text}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Every {conflict.question_2.frequency} customer{conflict.question_2.frequency !== 1 ? 's' : ''} • 
                        Priority: {conflict.question_2.priority_level}/5 • 
                        Category: {conflict.question_2.category}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <ConflictResolutionForm conflict={conflict} />
                </CardContent>
              </Card>
            ))}

            {resolvedConflicts.length > 0 && (
              <>
                {unresolvedConflicts.length > 0 && <Separator />}
                
                <div>
                  <h3 className="font-medium text-sm text-green-900 mb-4">
                    ✓ Resolved Conflicts ({resolvedConflicts.length})
                  </h3>
                  
                  <div className="space-y-3">
                    {resolvedConflicts.map((conflict, index) => {
                      const harmonizer = getHarmonizerForConflict(conflict)!;
                      const strategy = RESOLUTION_STRATEGIES.find(s => s.value === harmonizer.resolution_strategy);
                      
                      return (
                        <Card key={`resolved-${index}`} className="border-green-200 bg-green-50/50">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-green-900">
                                  {conflict.question_1.text} + {conflict.question_2.text}
                                </div>
                                <div className="text-xs text-green-700 mt-1">
                                  Strategy: {strategy?.label}
                                  {harmonizer.custom_frequency && ` (Every ${harmonizer.custom_frequency} customers)`}
                                  {harmonizer.priority_question_id && ` (Priority to: ${
                                    harmonizer.priority_question_id === conflict.question_1.id 
                                      ? conflict.question_1.text 
                                      : conflict.question_2.text
                                  })`}
                                </div>
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeHarmonizer(harmonizer)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}