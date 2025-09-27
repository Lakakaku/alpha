'use client';

import React from 'react';
import { ContextCompleteness } from '@vocilia/types/src/context';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon,
  ChartBarIcon,
  UserGroupIcon,
  MapIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline';

interface CompletenessScoreProps {
  completeness: ContextCompleteness;
  showDetails?: boolean;
  className?: string;
}

const STATUS_CONFIG = {
  incomplete: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: ExclamationTriangleIcon,
    label: 'Incomplete',
    description: 'Missing essential information'
  },
  basic: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: InformationCircleIcon,
    label: 'Basic',
    description: 'Core information present'
  },
  good: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: ChartBarIcon,
    label: 'Good',
    description: 'Well-detailed context'
  },
  excellent: {
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: CheckCircleIcon,
    label: 'Excellent',
    description: 'Comprehensive information'
  }
};

const SECTION_CONFIG = {
  profile: {
    icon: InformationCircleIcon,
    label: 'Store Profile',
    description: 'Basic business information'
  },
  personnel: {
    icon: UserGroupIcon,
    label: 'Team & Personnel',
    description: 'Staff information and roles'
  },
  layout: {
    icon: MapIcon,
    label: 'Store Layout',
    description: 'Physical store arrangement'
  },
  inventory: {
    icon: ArchiveBoxIcon,
    label: 'Product Inventory',
    description: 'Product categories and strategy'
  }
};

export function CompletenessScore({ 
  completeness, 
  showDetails = true, 
  className = '' 
}: CompletenessScoreProps) {
  const statusConfig = STATUS_CONFIG[completeness.status];
  const StatusIcon = statusConfig.icon;

  const getScoreColor = (score: number): string => {
    if (score >= 85) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressBarColor = (score: number): string => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const renderProgressBar = (score: number, label: string) => (
    <div className="flex items-center gap-3">
      <div className="w-16 text-sm font-medium text-gray-700">{label}</div>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className={`w-8 text-sm font-medium ${getScoreColor(score)}`}>
        {score}%
      </div>
    </div>
  );

  const renderSectionScore = (
    sectionKey: keyof typeof SECTION_CONFIG,
    score: number
  ) => {
    const config = SECTION_CONFIG[sectionKey];
    const SectionIcon = config.icon;
    
    return (
      <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
        <div className={`p-2 rounded-lg ${getScoreColor(score)} bg-opacity-10`}>
          <SectionIcon className={`w-5 h-5 ${getScoreColor(score)}`} />
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900">{config.label}</div>
          <div className="text-sm text-gray-500">{config.description}</div>
        </div>
        <div className={`text-lg font-bold ${getScoreColor(score)}`}>
          {score}%
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Score */}
      <div className={`p-4 rounded-lg border ${statusConfig.bgColor} ${statusConfig.borderColor}`}>
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-8 h-8 ${statusConfig.color}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Context Completeness
              </h3>
              <span className={`text-2xl font-bold ${getScoreColor(completeness.overall_score)}`}>
                {completeness.overall_score}%
              </span>
            </div>
            <div className={`text-sm ${statusConfig.color} font-medium`}>
              {statusConfig.label} - {statusConfig.description}
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mt-3">
          <div className="bg-white bg-opacity-50 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${getProgressBarColor(completeness.overall_score)}`}
              style={{ width: `${completeness.overall_score}%` }}
            />
          </div>
        </div>
      </div>

      {showDetails && (
        <>
          {/* Section Breakdown */}
          <div className="space-y-3">
            <h4 className="text-md font-medium text-gray-900">Section Breakdown</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {renderSectionScore('profile', completeness.profile_score)}
              {renderSectionScore('personnel', completeness.personnel_score)}
              {renderSectionScore('layout', completeness.layout_score)}
              {renderSectionScore('inventory', completeness.inventory_score)}
            </div>
          </div>

          {/* Detailed Progress Bars */}
          <div className="space-y-3">
            <h4 className="text-md font-medium text-gray-900">Progress Details</h4>
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              {renderProgressBar(completeness.profile_score, 'Profile')}
              {renderProgressBar(completeness.personnel_score, 'Personnel')}
              {renderProgressBar(completeness.layout_score, 'Layout')}
              {renderProgressBar(completeness.inventory_score, 'Inventory')}
            </div>
          </div>

          {/* Missing Sections */}
          {completeness.missing_sections.length > 0 && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <h4 className="text-md font-medium text-orange-900 mb-2">
                Missing Sections
              </h4>
              <div className="space-y-1">
                {completeness.missing_sections.map(section => {
                  const config = SECTION_CONFIG[section as keyof typeof SECTION_CONFIG];
                  return config ? (
                    <div key={section} className="text-sm text-orange-800">
                      • {config.label}: {config.description}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {completeness.recommendations.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-md font-medium text-blue-900 mb-2">
                Recommendations to Improve
              </h4>
              <div className="space-y-1">
                {completeness.recommendations.slice(0, 5).map((recommendation, index) => (
                  <div key={index} className="text-sm text-blue-800">
                    • {recommendation}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Readiness Indicator */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="text-md font-medium text-gray-900 mb-2">
              AI Integration Readiness
            </h4>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                completeness.overall_score >= 50 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {completeness.overall_score >= 50 ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                ) : (
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div>
                <div className={`font-medium ${
                  completeness.overall_score >= 50 ? 'text-green-900' : 'text-red-900'
                }`}>
                  {completeness.overall_score >= 85 ? 'Excellent AI Context' :
                   completeness.overall_score >= 60 ? 'Good AI Context' :
                   completeness.overall_score >= 30 ? 'Basic AI Context' :
                   'Insufficient AI Context'}
                </div>
                <div className="text-sm text-gray-600">
                  {completeness.overall_score >= 50 
                    ? 'Your context is ready for AI-powered customer interactions'
                    : 'Complete more sections to enable AI features'
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Last Updated */}
          <div className="text-xs text-gray-500 text-center">
            Last updated: {new Date(completeness.last_updated).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}

// Compact version for dashboards
export function CompletenessIndicator({ 
  completeness, 
  size = 'md' 
}: { 
  completeness: ContextCompleteness; 
  size?: 'sm' | 'md' | 'lg' 
}) {
  const statusConfig = STATUS_CONFIG[completeness.status];
  const StatusIcon = statusConfig.icon;
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg'
  };

  return (
    <div 
      className={`relative ${sizeClasses[size]} ${statusConfig.bgColor} ${statusConfig.borderColor} border rounded-full flex items-center justify-center`}
      title={`${completeness.overall_score}% complete - ${statusConfig.label}`}
    >
      <span className={`font-bold ${statusConfig.color}`}>
        {completeness.overall_score}%
      </span>
      
      {/* Status Icon Overlay */}
      <div className={`absolute -top-1 -right-1 ${
        size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'
      } ${statusConfig.bgColor} rounded-full border-2 border-white flex items-center justify-center`}>
        <StatusIcon className={`${
          size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
        } ${statusConfig.color}`} />
      </div>
    </div>
  );
}

// Progress ring component
export function CompletenessRing({ 
  completeness, 
  size = 120 
}: { 
  completeness: ContextCompleteness; 
  size?: number 
}) {
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (completeness.overall_score / 100) * circumference;

  return (
    <div className="relative">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#E5E7EB"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={getProgressBarColor(completeness.overall_score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`text-2xl font-bold ${getScoreColor(completeness.overall_score)}`}>
          {completeness.overall_score}%
        </div>
        <div className="text-xs text-gray-500 text-center">
          {STATUS_CONFIG[completeness.status].label}
        </div>
      </div>
    </div>
  );
}

function getProgressBarColor(score: number): string {
  if (score >= 85) return '#10B981';
  if (score >= 60) return '#3B82F6';
  if (score >= 30) return '#F59E0B';
  return '#EF4444';
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 30) return 'text-yellow-600';
  return 'text-red-600';
}