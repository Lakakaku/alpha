'use client';

import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Target, 
  AlertCircle, 
  CheckCircle,
  Info,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  BarChart3
} from 'lucide-react';
import { Button } from '@vocilia/ui';

interface CategoryScore {
  score: number;
  maxScore: number;
  percentage: number;
}

interface MissingField {
  category: string;
  field: string;
  priority: 'high' | 'medium' | 'low';
}

interface ValidationScoreProps {
  overallScore: number;
  categoryScores: Record<string, CategoryScore>;
  missingFields: MissingField[];
  recommendations: string[];
  completionLevel: 'incomplete' | 'basic' | 'good' | 'excellent';
  lastUpdated: string;
  isRecalculating?: boolean;
  onRecalculate?: () => void;
  showDetails?: boolean;
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  business_info: 'Business Info',
  products_services: 'Products & Services',
  customer_demographics: 'Demographics',
  store_environment: 'Environment',
  operational_details: 'Operations',
  goals_challenges: 'Goals & Challenges',
  quality_standards: 'Quality Standards'
};

const COMPLETION_CONFIG = {
  incomplete: {
    label: 'Incomplete',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: AlertCircle,
    description: 'Your context needs significant improvement'
  },
  basic: {
    label: 'Basic',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: Info,
    description: 'Good foundation, but room for enhancement'
  },
  good: {
    label: 'Good',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: CheckCircle,
    description: 'Well-developed context with minor gaps'
  },
  excellent: {
    label: 'Excellent',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: Award,
    description: 'Comprehensive context for optimal feedback'
  }
};

export function ValidationScore({
  overallScore,
  categoryScores,
  missingFields,
  recommendations,
  completionLevel,
  lastUpdated,
  isRecalculating = false,
  onRecalculate,
  showDetails = true,
  className = ''
}: ValidationScoreProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const config = COMPLETION_CONFIG[completionLevel];
  const IconComponent = config.icon;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-600';
    if (score >= 60) return 'bg-blue-600';
    if (score >= 40) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const formatLastUpdated = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just updated';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const highPriorityMissing = missingFields.filter(field => field.priority === 'high');
  const sortedCategories = Object.entries(categoryScores).sort(([,a], [,b]) => a.percentage - b.percentage);

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Context Score</h3>
          </div>
          
          {onRecalculate && (
            <Button
              onClick={onRecalculate}
              disabled={isRecalculating}
              size="sm"
              variant="outline"
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{isRecalculating ? 'Calculating...' : 'Recalculate'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Overview Section */}
      <div className="p-4">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('overview')}
        >
          <h4 className="font-medium text-gray-900">Overview</h4>
          {expandedSections.has('overview') ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>

        {expandedSections.has('overview') && (
          <div className="mt-4 space-y-4">
            {/* Overall Score */}
            <div className="text-center">
              <div className={`text-4xl font-bold ${getScoreColor(overallScore)} mb-2`}>
                {overallScore}%
              </div>
              
              <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border ${config.bgColor} ${config.borderColor}`}>
                <IconComponent className={`w-4 h-4 ${config.color}`} />
                <span className={`font-medium ${config.color}`}>{config.label}</span>
              </div>
              
              <p className="text-sm text-gray-600 mt-2">
                {config.description}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Context Completeness</span>
                <span className={`font-medium ${getScoreColor(overallScore)}`}>
                  {overallScore}/100
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${getProgressBarColor(overallScore)}`}
                  style={{ width: `${Math.max(overallScore, 3)}%` }}
                />
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {Object.keys(categoryScores).length}
                </div>
                <div className="text-sm text-gray-600">Categories</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">
                  {highPriorityMissing.length}
                </div>
                <div className="text-sm text-gray-600">High Priority Gaps</div>
              </div>
            </div>

            <div className="text-xs text-gray-500 text-center">
              Last updated: {formatLastUpdated(lastUpdated)}
            </div>
          </div>
        )}
      </div>

      {showDetails && (
        <>
          {/* Category Breakdown */}
          <div className="border-t border-gray-100">
            <div className="p-4">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('categories')}
              >
                <h4 className="font-medium text-gray-900">Category Breakdown</h4>
                {expandedSections.has('categories') ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>

              {expandedSections.has('categories') && (
                <div className="mt-4 space-y-3">
                  {sortedCategories.map(([category, score]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">
                          {CATEGORY_LABELS[category] || category}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${getScoreColor(score.percentage)}`}>
                            {score.percentage}%
                          </span>
                          {score.percentage >= 80 ? (
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          ) : score.percentage < 40 ? (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          ) : (
                            <Target className="w-4 h-4 text-yellow-600" />
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(score.percentage)}`}
                          style={{ width: `${Math.max(score.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="border-t border-gray-100">
              <div className="p-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('recommendations')}
                >
                  <h4 className="font-medium text-gray-900">Recommendations</h4>
                  {expandedSections.has('recommendations') ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {expandedSections.has('recommendations') && (
                  <div className="mt-4 space-y-2">
                    {recommendations.slice(0, 3).map((recommendation, index) => (
                      <div key={index} className="flex items-start space-x-2 p-2 bg-blue-50 rounded">
                        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-800">{recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Missing Fields */}
          {highPriorityMissing.length > 0 && (
            <div className="border-t border-gray-100">
              <div className="p-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('missing')}
                >
                  <h4 className="font-medium text-gray-900">Priority Gaps</h4>
                  {expandedSections.has('missing') ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {expandedSections.has('missing') && (
                  <div className="mt-4 space-y-2">
                    {highPriorityMissing.slice(0, 5).map((missing, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-red-800">
                            {missing.field.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                          {CATEGORY_LABELS[missing.category] || missing.category}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}