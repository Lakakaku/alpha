'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Plus, Merge, Trash2, Edit, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FrequencyHarmonizerConfig } from '@/components/questions/FrequencyHarmonizerConfig';
import { useToast } from '@/hooks/use-toast';

interface FrequencyHarmonizer {
  id: string;
  rule_id: string;
  question_pair_hash: string;
  question_id_1: string;
  question_id_2: string;
  resolution_strategy: 'combine' | 'priority' | 'alternate' | 'custom';
  custom_frequency?: number;
  priority_question_id?: string;
  created_at: string;
  updated_at: string;
  _meta: {
    question_1_text: string;
    question_2_text: string;
    question_1_frequency: number;
    question_2_frequency: number;
    lcm_frequency: number;
    conflict_detected: boolean;
    last_resolution_applied: string | null;
  };
}

interface QuestionCombinationRule {
  id: string;
  rule_name: string;
  is_active: boolean;
}

interface FrequencyConflict {
  question_id_1: string;
  question_id_2: string;
  question_1_text: string;
  question_2_text: string;
  frequency_1: number;
  frequency_2: number;
  lcm_frequency: number;
  conflict_severity: 'low' | 'medium' | 'high';
}

const RESOLUTION_STRATEGIES = [
  { value: 'combine', label: 'Combine (LCM)', description: 'Ask both questions at their least common multiple interval' },
  { value: 'priority', label: 'Priority', description: 'Prioritize one question over the other' },
  { value: 'alternate', label: 'Alternate', description: 'Alternate between questions at their individual frequencies' },
  { value: 'custom', label: 'Custom', description: 'Define a custom frequency for both questions' }
];

function getConflictSeverityBadge(severity: string) {
  switch (severity) {
    case 'high':
      return <Badge className="bg-red-500 text-white">High Conflict</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-500 text-white">Medium Conflict</Badge>;
    case 'low':
      return <Badge className="bg-blue-500 text-white">Low Conflict</Badge>;
    default:
      return <Badge variant="outline">No Conflict</Badge>;
  }
}

export default function HarmonizationPage() {
  const [harmonizers, setHarmonizers] = useState<FrequencyHarmonizer[]>([]);
  const [rules, setRules] = useState<QuestionCombinationRule[]>([]);
  const [conflicts, setConflicts] = useState<FrequencyConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingHarmonizer, setEditingHarmonizer] = useState<FrequencyHarmonizer | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedRuleId && selectedRuleId !== 'all') {
      loadHarmonizers(selectedRuleId);
    } else {
      setHarmonizers([]);
    }
  }, [selectedRuleId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load combination rules
      const rulesResponse = await fetch('/api/questions/combinations/rules', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setRules(rulesData);
      }

      // Load frequency conflicts
      const conflictsResponse = await fetch('/api/questions/frequency-conflicts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (conflictsResponse.ok) {
        const conflictsData = await conflictsResponse.json();
        setConflicts(conflictsData);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadHarmonizers = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/questions/harmonizers/${ruleId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load harmonizers');
      }

      const data = await response.json();
      setHarmonizers(data);
    } catch (error) {
      console.error('Error loading harmonizers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load frequency harmonizers',
        variant: 'destructive'
      });
    }
  };

  const handleCreateHarmonizer = async (ruleId: string, harmonizerData: Partial<FrequencyHarmonizer>) => {
    try {
      const response = await fetch(`/api/questions/harmonizers/${ruleId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(harmonizerData)
      });

      if (!response.ok) {
        throw new Error('Failed to create harmonizer');
      }

      const newHarmonizer = await response.json();
      setHarmonizers(prev => [...prev, newHarmonizer]);
      setShowCreateForm(false);
      
      toast({
        title: 'Success',
        description: 'Frequency harmonizer created successfully'
      });

      // Refresh conflicts
      loadData();
    } catch (error) {
      console.error('Error creating harmonizer:', error);
      toast({
        title: 'Error',
        description: 'Failed to create frequency harmonizer',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateHarmonizer = async (ruleId: string, harmonizerId: string, harmonizerData: Partial<FrequencyHarmonizer>) => {
    try {
      const response = await fetch(`/api/questions/harmonizers/${ruleId}/${harmonizerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(harmonizerData)
      });

      if (!response.ok) {
        throw new Error('Failed to update harmonizer');
      }

      const updatedHarmonizer = await response.json();
      setHarmonizers(prev => prev.map(harmonizer => 
        harmonizer.id === harmonizerId ? updatedHarmonizer : harmonizer
      ));
      setEditingHarmonizer(null);
      
      toast({
        title: 'Success',
        description: 'Frequency harmonizer updated successfully'
      });
    } catch (error) {
      console.error('Error updating harmonizer:', error);
      toast({
        title: 'Error',
        description: 'Failed to update frequency harmonizer',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteHarmonizer = async (ruleId: string, harmonizerId: string) => {
    if (!confirm('Are you sure you want to delete this harmonizer?')) {
      return;
    }

    try {
      const response = await fetch(`/api/questions/harmonizers/${ruleId}/${harmonizerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete harmonizer');
      }

      setHarmonizers(prev => prev.filter(harmonizer => harmonizer.id !== harmonizerId));
      
      toast({
        title: 'Success',
        description: 'Frequency harmonizer deleted successfully'
      });

      // Refresh conflicts
      loadData();
    } catch (error) {
      console.error('Error deleting harmonizer:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete frequency harmonizer',
        variant: 'destructive'
      });
    }
  };

  const handleResolveConflict = (conflict: FrequencyConflict) => {
    if (selectedRuleId === 'all') {
      toast({
        title: 'Select Rule',
        description: 'Please select a combination rule first',
        variant: 'destructive'
      });
      return;
    }

    setShowCreateForm(true);
    // Pre-populate form with conflict data
    // This would be handled by the FrequencyHarmonizerConfig component
  };

  const filteredHarmonizers = harmonizers.filter(harmonizer => {
    const matchesSearch = 
      harmonizer._meta.question_1_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      harmonizer._meta.question_2_text.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const filteredConflicts = conflicts.filter(conflict => {
    const matchesSearch = 
      conflict.question_1_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conflict.question_2_text.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
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
          <h1 className="text-3xl font-bold tracking-tight">Frequency Harmonization</h1>
          <p className="text-muted-foreground mt-2">
            Resolve conflicts between different question scheduling frequencies
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)} 
          disabled={selectedRuleId === 'all'}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Harmonizer
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-4 mb-6">
        <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select combination rule" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rules</SelectItem>
            {rules.map(rule => (
              <SelectItem key={rule.id} value={rule.id}>
                {rule.rule_name} {!rule.is_active && '(Inactive)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1">
          <Input
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      {/* Frequency Conflicts Section */}
      {filteredConflicts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-semibold">Detected Frequency Conflicts</h2>
            <Badge variant="destructive">{filteredConflicts.length}</Badge>
          </div>
          
          <div className="grid gap-4">
            {filteredConflicts.map((conflict, index) => (
              <Alert key={index} variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium mb-1">Frequency conflict detected</p>
                      <p className="text-sm">
                        <strong>"{conflict.question_1_text}"</strong> (every {conflict.frequency_1}) conflicts with{' '}
                        <strong>"{conflict.question_2_text}"</strong> (every {conflict.frequency_2})
                      </p>
                      <p className="text-xs mt-2 opacity-75">
                        Recommended LCM: every {conflict.lcm_frequency} customers
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getConflictSeverityBadge(conflict.conflict_severity)}
                      <Button 
                        size="sm" 
                        onClick={() => handleResolveConflict(conflict)}
                        disabled={selectedRuleId === 'all'}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Active Harmonizers Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Active Harmonizers</h2>
        
        {selectedRuleId === 'all' ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Select a specific combination rule to view and manage its frequency harmonizers.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-6">
            {filteredHarmonizers.map((harmonizer) => (
              <Card key={harmonizer.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Merge className="h-4 w-4" />
                      Question Pair Harmonizer
                      <Badge variant="outline">
                        {RESOLUTION_STRATEGIES.find(s => s.value === harmonizer.resolution_strategy)?.label}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Resolving frequency conflict between two questions
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingHarmonizer(harmonizer)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteHarmonizer(harmonizer.rule_id, harmonizer.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Question 1</Label>
                      <div className="text-sm bg-muted p-3 rounded">
                        <p className="font-medium">{harmonizer._meta.question_1_text}</p>
                        <p className="text-muted-foreground">Every {harmonizer._meta.question_1_frequency} customers</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Question 2</Label>
                      <div className="text-sm bg-muted p-3 rounded">
                        <p className="font-medium">{harmonizer._meta.question_2_text}</p>
                        <p className="text-muted-foreground">Every {harmonizer._meta.question_2_frequency} customers</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Resolution Strategy</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{harmonizer.resolution_strategy}</Badge>
                        {harmonizer.resolution_strategy === 'custom' && harmonizer.custom_frequency && (
                          <Badge>Every {harmonizer.custom_frequency} customers</Badge>
                        )}
                        {harmonizer.resolution_strategy === 'combine' && (
                          <Badge>Every {harmonizer._meta.lcm_frequency} customers (LCM)</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Created: {new Date(harmonizer.created_at).toLocaleDateString()}</p>
                      {harmonizer._meta.last_resolution_applied && (
                        <p>Last applied: {new Date(harmonizer._meta.last_resolution_applied).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredHarmonizers.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Merge className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No harmonizers found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm 
                      ? 'No harmonizers match your search criteria.' 
                      : 'No frequency harmonizers configured for this rule.'
                    }
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create Harmonizer
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {(showCreateForm || editingHarmonizer) && selectedRuleId !== 'all' && (
        <FrequencyHarmonizerConfig
          ruleId={selectedRuleId}
          harmonizer={editingHarmonizer}
          onSubmit={editingHarmonizer 
            ? (data) => handleUpdateHarmonizer(selectedRuleId, editingHarmonizer.id, data)
            : (data) => handleCreateHarmonizer(selectedRuleId, data)
          }
          onCancel={() => {
            setShowCreateForm(false);
            setEditingHarmonizer(null);
          }}
        />
      )}
    </div>
  );
}