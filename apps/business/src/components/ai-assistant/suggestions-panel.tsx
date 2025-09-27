'use client';

import { useState } from 'react';
import { 
  Lightbulb, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  X, 
  AlertTriangle, 
  Target, 
  TrendingUp,
  RefreshCw,
  Filter
} from 'lucide-react';
import { Button } from '@vocilia/ui';

interface AISuggestion {
  id: string;
  type: 'context_addition' | 'context_improvement' | 'question_suggestion' | 'process_optimization';
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface SuggestionsPanelProps {
  suggestions: AISuggestion[];
  isGenerating: boolean;
  onAcceptSuggestion: (suggestionId: string, notes?: string) => void;
  onRejectSuggestion: (suggestionId: string, reason?: string) => void;
  onGenerateMore: () => void;
  className?: string;
}

const SUGGESTION_TYPE_LABELS: Record<string, string> = {
  context_addition: 'Add Context',
  context_improvement: 'Improve Context',
  question_suggestion: 'Question Ideas',
  process_optimization: 'Process Optimization'
};

const SUGGESTION_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  context_addition: Target,
  context_improvement: TrendingUp,
  question_suggestion: Lightbulb,
  process_optimization: RefreshCw
};

const PRIORITY_COLORS = {
  high: 'text-red-600 bg-red-50 border-red-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  low: 'text-blue-600 bg-blue-50 border-blue-200'
};

export function SuggestionsPanel({
  suggestions,
  isGenerating,
  onAcceptSuggestion,
  onRejectSuggestion,
  onGenerateMore,
  className = ''
}: SuggestionsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set());
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});

  const filteredSuggestions = suggestions.filter(suggestion => {
    if (filter === 'all') return true;
    return suggestion.status === filter;
  });

  const groupedSuggestions = filteredSuggestions.reduce((acc, suggestion) => {
    if (!acc[suggestion.priority]) {
      acc[suggestion.priority] = [];
    }
    acc[suggestion.priority].push(suggestion);
    return acc;
  }, {} as Record<string, AISuggestion[]>);

  const toggleExpanded = (suggestionId: string) => {
    const newExpanded = new Set(expandedSuggestions);
    if (newExpanded.has(suggestionId)) {
      newExpanded.delete(suggestionId);
    } else {
      newExpanded.add(suggestionId);
    }
    setExpandedSuggestions(newExpanded);
  };

  const handleAccept = (suggestion: AISuggestion) => {
    const notes = actionNotes[suggestion.id];
    onAcceptSuggestion(suggestion.id, notes);
    setActionNotes(prev => ({ ...prev, [suggestion.id]: '' }));
  };

  const handleReject = (suggestion: AISuggestion) => {
    const reason = actionNotes[suggestion.id];
    onRejectSuggestion(suggestion.id, reason);
    setActionNotes(prev => ({ ...prev, [suggestion.id]: '' }));
  };

  const updateNotes = (suggestionId: string, notes: string) => {
    setActionNotes(prev => ({ ...prev, [suggestionId]: notes }));
  };

  const SuggestionCard = ({ suggestion }: { suggestion: AISuggestion }) => {
    const isExpanded = expandedSuggestions.has(suggestion.id);
    const IconComponent = SUGGESTION_TYPE_ICONS[suggestion.type];
    const notes = actionNotes[suggestion.id] || '';

    return (
      <div className="border border-gray-200 rounded-lg bg-white">
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className="mt-1">
                <IconComponent className="w-5 h-5 text-gray-600" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${PRIORITY_COLORS[suggestion.priority]}`}>
                    {suggestion.priority}
                  </span>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">
                    {SUGGESTION_TYPE_LABELS[suggestion.type]}
                  </span>
                  {suggestion.status !== 'pending' && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      suggestion.status === 'accepted' 
                        ? 'text-green-600 bg-green-50' 
                        : 'text-red-600 bg-red-50'
                    }`}>
                      {suggestion.status}
                    </span>
                  )}
                </div>
                
                <h4 className="font-medium text-gray-900 mb-1">
                  {suggestion.title}
                </h4>
                
                <p className="text-sm text-gray-600 mb-2">
                  {suggestion.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Impact: {suggestion.impact}
                  </div>
                  
                  <button
                    onClick={() => toggleExpanded(suggestion.id)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
                  >
                    <span>{isExpanded ? 'Less' : 'More'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="space-y-3">
                <div>
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Category</h5>
                  <span className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-700">
                    {suggestion.category.replace('_', ' ')}
                  </span>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium text-gray-900 mb-2">
                    Expected Impact
                  </h5>
                  <p className="text-sm text-gray-600">
                    {suggestion.impact}
                  </p>
                </div>

                {suggestion.status === 'pending' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes (optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => updateNotes(suggestion.id, e.target.value)}
                        placeholder="Add any notes about this suggestion..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={2}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => handleAccept(suggestion)}
                        className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Check className="w-4 h-4" />
                        <span>Accept</span>
                      </Button>
                      
                      <Button
                        onClick={() => handleReject(suggestion)}
                        variant="outline"
                        className="flex items-center space-x-2 text-red-600 border-red-300 hover:bg-red-50"
                        size="sm"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </Button>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  Created: {new Date(suggestion.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h3 className="font-semibold text-gray-900">AI Suggestions</h3>
          </div>
          
          <Button
            onClick={onGenerateMore}
            disabled={isGenerating}
            size="sm"
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Generating...' : 'Generate More'}</span>
          </Button>
        </div>

        {/* Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Suggestions</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredSuggestions.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              {filter === 'pending' ? 'No pending suggestions' : 'No suggestions yet'}
            </h4>
            <p className="text-gray-500 max-w-sm mx-auto mb-4">
              {filter === 'pending' 
                ? 'Generate AI suggestions to get personalized recommendations for improving your store context.'
                : 'Click "Generate More" to get AI-powered suggestions for improving your store context.'
              }
            </p>
            {filter === 'pending' && (
              <Button
                onClick={onGenerateMore}
                disabled={isGenerating}
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Generate Suggestions</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {(['high', 'medium', 'low'] as const).map(priority => {
              const prioritySuggestions = groupedSuggestions[priority] || [];
              if (prioritySuggestions.length === 0) return null;

              return (
                <div key={priority}>
                  <div className="flex items-center space-x-2 mb-3">
                    <AlertTriangle className={`w-4 h-4 ${
                      priority === 'high' ? 'text-red-500' :
                      priority === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                    }`} />
                    <h4 className="font-medium text-gray-900 capitalize">
                      {priority} Priority
                    </h4>
                    <span className="text-sm text-gray-500">
                      ({prioritySuggestions.length})
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {prioritySuggestions.map(suggestion => (
                      <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}