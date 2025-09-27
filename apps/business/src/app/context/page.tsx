'use client';

import React, { useState, useEffect } from 'react';
import { CompletenessScore, CompletenessIndicator } from '@/components/context/CompletenessScore';
import { QuickContextActions } from '@/components/context/ContextTabs';
import { ContextCompleteness } from '@vocilia/types/src/context';
import { 
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CogIcon
} from '@heroicons/react/24/outline';

// Mock data - in real implementation, this would come from API
const MOCK_COMPLETENESS: ContextCompleteness = {
  overall_score: 45,
  status: 'basic',
  profile_score: 80,
  personnel_score: 30,
  layout_score: 25,
  inventory_score: 40,
  missing_sections: ['layout'],
  recommendations: [
    'Complete store layout to help AI understand spatial context',
    'Add more team members for comprehensive service understanding',
    'Define product categories for better recommendations',
    'Add operating hours for all days of the week',
    'Include target demographics in store profile'
  ],
  last_updated: new Date().toISOString()
};

export default function ContextOverviewPage() {
  const [completeness, setCompleteness] = useState<ContextCompleteness>(MOCK_COMPLETENESS);
  const [isLoading, setIsLoading] = useState(false);

  // In real implementation, fetch completeness data
  useEffect(() => {
    // fetchCompletenessData();
  }, []);

  const getNextRecommendedAction = () => {
    if (completeness.profile_score < 80) {
      return {
        title: 'Complete Store Profile',
        description: 'Add basic business information to get started',
        href: '/context/profile',
        priority: 'high'
      };
    }
    if (completeness.personnel_score < 50) {
      return {
        title: 'Add Team Members',
        description: 'Help AI understand your service capabilities',
        href: '/context/personnel',
        priority: 'medium'
      };
    }
    if (completeness.layout_score < 40) {
      return {
        title: 'Design Store Layout',
        description: 'Map out your store for spatial context',
        href: '/context/layout',
        priority: 'medium'
      };
    }
    if (completeness.inventory_score < 60) {
      return {
        title: 'Configure Inventory',
        description: 'Define product categories and strategy',
        href: '/context/inventory',
        priority: 'low'
      };
    }
    return {
      title: 'Review and Update',
      description: 'Keep your context information current',
      href: '/context/versions',
      priority: 'low'
    };
  };

  const nextAction = getNextRecommendedAction();

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Business Context Overview</h1>
            <p className="text-blue-100 text-lg">
              Configure your business information to enable AI-powered customer interactions
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">{completeness.overall_score}%</div>
              <div className="text-blue-100 text-sm">Complete</div>
            </div>
            <CompletenessIndicator completeness={completeness} size="lg" />
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* AI Readiness */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${
              completeness.overall_score >= 50 ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {completeness.overall_score >= 50 ? (
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              ) : (
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">AI Readiness</h3>
          </div>
          
          <div className={`text-2xl font-bold mb-2 ${
            completeness.overall_score >= 50 ? 'text-green-600' : 'text-red-600'
          }`}>
            {completeness.overall_score >= 50 ? 'Ready' : 'Not Ready'}
          </div>
          
          <p className="text-gray-600 text-sm">
            {completeness.overall_score >= 50 
              ? 'Your context is sufficient for AI-powered interactions'
              : 'More information needed for AI features'
            }
          </p>
        </div>

        {/* Progress Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ChartBarIcon className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Progress</h3>
          </div>
          
          <div className="text-2xl font-bold text-blue-600 mb-2">
            {4 - completeness.missing_sections.length} / 4
          </div>
          
          <p className="text-gray-600 text-sm">
            Sections completed
          </p>
          
          <div className="mt-3 text-xs text-gray-500">
            Last updated: {new Date(completeness.last_updated).toLocaleDateString()}
          </div>
        </div>

        {/* Next Action */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${
              nextAction.priority === 'high' ? 'bg-red-100' :
              nextAction.priority === 'medium' ? 'bg-yellow-100' : 'bg-green-100'
            }`}>
              <CogIcon className={`w-6 h-6 ${
                nextAction.priority === 'high' ? 'text-red-600' :
                nextAction.priority === 'medium' ? 'text-yellow-600' : 'text-green-600'
              }`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Next Step</h3>
          </div>
          
          <div className="font-semibold text-gray-900 mb-1">
            {nextAction.title}
          </div>
          
          <p className="text-gray-600 text-sm mb-3">
            {nextAction.description}
          </p>
          
          <a
            href={nextAction.href}
            className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white ${
              nextAction.priority === 'high' ? 'bg-red-600 hover:bg-red-700' :
              nextAction.priority === 'medium' ? 'bg-yellow-600 hover:bg-yellow-700' :
              'bg-green-600 hover:bg-green-700'
            }`}
          >
            Get Started
          </a>
        </div>
      </div>

      {/* Detailed Completeness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow p-6">
          <CompletenessScore completeness={completeness} showDetails={true} />
        </div>
        
        <div className="space-y-6">
          <QuickContextActions />
          
          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <ClockIcon className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    Profile information updated
                  </div>
                  <div className="text-xs text-gray-500">2 hours ago</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    Team member added
                  </div>
                  <div className="text-xs text-gray-500">1 day ago</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    Context setup started
                  </div>
                  <div className="text-xs text-gray-500">3 days ago</div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <a
                href="/context/versions"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View full history →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Tips and Best Practices */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-4">
          💡 Tips for Better AI Performance
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <h4 className="font-medium mb-2">Complete Information</h4>
            <p>
              The more detailed your business context, the better AI can understand 
              and respond to customer needs.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Keep It Current</h4>
            <p>
              Regularly update your context as your business changes - new products, 
              staff changes, or seasonal adjustments.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Be Specific</h4>
            <p>
              Detailed descriptions help AI provide more accurate and helpful 
              responses to customers.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Think Customer-First</h4>
            <p>
              Focus on information that would help customers understand your 
              business and make informed decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}