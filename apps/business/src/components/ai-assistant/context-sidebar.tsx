'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@vocilia/ui';

interface ContextEntry {
  id: string;
  category: string;
  type: string;
  content: string;
  confidence: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface CategoryScore {
  score: number;
  maxScore: number;
  percentage: number;
}

interface ContextSidebarProps {
  entries: ContextEntry[];
  categoryScores: Record<string, CategoryScore>;
  overallScore: number;
  completionLevel: 'incomplete' | 'basic' | 'good' | 'excellent';
  onEditEntry?: (entry: ContextEntry) => void;
  onDeleteEntry?: (entryId: string) => void;
  onAddEntry?: (category: string) => void;
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  business_info: 'Business Information',
  products_services: 'Products & Services',
  customer_demographics: 'Customer Demographics',
  store_environment: 'Store Environment',
  operational_details: 'Operational Details',
  goals_challenges: 'Goals & Challenges',
  quality_standards: 'Quality Standards'
};

const COMPLETION_COLORS = {
  incomplete: 'text-red-600 bg-red-50',
  basic: 'text-yellow-600 bg-yellow-50',
  good: 'text-blue-600 bg-blue-50',
  excellent: 'text-green-600 bg-green-50'
};

export function ContextSidebar({
  entries,
  categoryScores,
  overallScore,
  completionLevel,
  onEditEntry,
  onDeleteEntry,
  onAddEntry,
  className = ''
}: ContextSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(CATEGORY_LABELS))
  );

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.category]) {
      acc[entry.category] = [];
    }
    acc[entry.category].push(entry);
    return acc;
  }, {} as Record<string, ContextEntry[]>);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-blue-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = (percentage: number) => {
    if (percentage >= 80) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (percentage >= 40) return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    return <AlertCircle className="w-4 h-4 text-red-600" />;
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Store Context</h3>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${COMPLETION_COLORS[completionLevel]}`}>
            {completionLevel}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Overall Score</span>
            <span className={`font-semibold ${getScoreColor(overallScore)}`}>
              {overallScore}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                overallScore >= 80 ? 'bg-green-600' :
                overallScore >= 60 ? 'bg-blue-600' :
                overallScore >= 40 ? 'bg-yellow-600' : 'bg-red-600'
              }`}
              style={{ width: `${Math.max(overallScore, 5)}%` }}
            />
          </div>
          
          <div className="text-xs text-gray-500">
            {entries.length} context {entries.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
          const categoryEntries = groupedEntries[category] || [];
          const categoryScore = categoryScores[category];
          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="border-b border-gray-100 last:border-b-0">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900 text-sm">{label}</span>
                      {categoryScore && getScoreIcon(categoryScore.percentage)}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {categoryEntries.length} {categoryEntries.length === 1 ? 'entry' : 'entries'}
                      </span>
                      {categoryScore && (
                        <span className={`text-xs font-medium ${getScoreColor(categoryScore.percentage)}`}>
                          {categoryScore.percentage}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {onAddEntry && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddEntry(category);
                    }}
                    className="p-1 h-6 w-6"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                )}
              </button>

              {isExpanded && (
                <div className="pb-2">
                  {categoryEntries.length === 0 ? (
                    <div className="px-6 py-3 text-sm text-gray-500 italic">
                      No entries yet. Add context to improve your score.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {categoryEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="mx-3 p-2 bg-gray-50 rounded border group hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                  {entry.type}
                                </span>
                                {entry.confidence < 0.8 && (
                                  <Info className="w-3 h-3 text-yellow-500" title="Low confidence" />
                                )}
                              </div>
                              <p className="text-sm text-gray-900 line-clamp-2">
                                {entry.content}
                              </p>
                              <div className="mt-1 text-xs text-gray-500">
                                {new Date(entry.created_at).toLocaleDateString()}
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                              {onEditEntry && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onEditEntry(entry)}
                                  className="p-1 h-6 w-6"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              )}
                              {onDeleteEntry && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onDeleteEntry(entry.id)}
                                  className="p-1 h-6 w-6 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600 text-center">
          Context automatically updates as you chat with the AI assistant
        </div>
      </div>
    </div>
  );
}