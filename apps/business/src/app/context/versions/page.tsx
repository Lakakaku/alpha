'use client';

import React, { useState } from 'react';
import { ContextBreadcrumb } from '@/components/context/ContextTabs';
import { 
  ClockIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  UserIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

interface ContextVersion {
  id: string;
  version: number;
  created_at: string;
  created_by: string;
  description: string;
  changes: {
    section: string;
    change_type: 'created' | 'updated' | 'deleted';
    summary: string;
    details?: string;
  }[];
  completeness_score: number;
  ai_export_size: number; // in KB
}

// Mock data - in real implementation, this would come from API
const MOCK_VERSIONS: ContextVersion[] = [
  {
    id: 'v1.3',
    version: 3,
    created_at: '2024-01-15T14:30:00Z',
    created_by: 'John Smith',
    description: 'Added inventory categories and updated team schedule',
    changes: [
      {
        section: 'inventory',
        change_type: 'created',
        summary: 'Added 8 product categories',
        details: 'Electronics, Clothing, Home Goods, Books, Sports, Health & Beauty, Automotive, Office Supplies'
      },
      {
        section: 'personnel',
        change_type: 'updated',
        summary: 'Updated Sarah Johnson\'s schedule',
        details: 'Changed Monday hours from 9-5 to 10-6'
      }
    ],
    completeness_score: 85,
    ai_export_size: 124
  },
  {
    id: 'v1.2',
    version: 2,
    created_at: '2024-01-10T09:15:00Z',
    created_by: 'Sarah Johnson',
    description: 'Completed store layout design',
    changes: [
      {
        section: 'layout',
        change_type: 'created',
        summary: 'Designed main store layout',
        details: 'Added 6 departments: Entrance, Sales Floor, Checkout, Storage, Office, Restrooms'
      },
      {
        section: 'layout',
        change_type: 'updated',
        summary: 'Added layout description and total area'
      }
    ],
    completeness_score: 72,
    ai_export_size: 98
  },
  {
    id: 'v1.1',
    version: 1,
    created_at: '2024-01-05T16:45:00Z',
    created_by: 'John Smith',
    description: 'Added team members and updated store profile',
    changes: [
      {
        section: 'profile',
        change_type: 'updated',
        summary: 'Completed operating hours for all days'
      },
      {
        section: 'personnel',
        change_type: 'created',
        summary: 'Added 4 team members',
        details: 'Manager, 2 Sales Associates, 1 Cashier'
      }
    ],
    completeness_score: 58,
    ai_export_size: 67
  },
  {
    id: 'v1.0',
    version: 0,
    created_at: '2024-01-01T12:00:00Z',
    created_by: 'John Smith',
    description: 'Initial context setup',
    changes: [
      {
        section: 'profile',
        change_type: 'created',
        summary: 'Created basic store profile',
        details: 'Business name, store type, address, and basic information'
      }
    ],
    completeness_score: 25,
    ai_export_size: 34
  }
];

export default function ContextVersionsPage() {
  const [versions] = useState<ContextVersion[]>(MOCK_VERSIONS);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const toggleExpanded = (versionId: string) => {
    setExpandedVersions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(versionId)) {
        newSet.delete(versionId);
      } else {
        newSet.add(versionId);
      }
      return newSet;
    });
  };

  const handleExportVersion = (version: ContextVersion) => {
    // In real implementation, this would trigger a download
    console.log('Exporting version:', version.id);
  };

  const handlePreviewVersion = (version: ContextVersion) => {
    setSelectedVersion(version.id);
    // In real implementation, this would show a preview modal or navigate to preview
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'created':
        return 'text-green-600 bg-green-100';
      case 'updated':
        return 'text-blue-600 bg-blue-100';
      case 'deleted':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getCompletenessColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <ContextBreadcrumb current="Version History" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Context Version History</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track changes to your business context over time
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            {versions.length} versions
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-900">Total Versions</h3>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{versions.length}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-900">Contributors</h3>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {new Set(versions.map(v => v.created_by)).size}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-900">Current Score</h3>
          </div>
          <div className={`text-2xl font-bold mt-1 ${getCompletenessColor(versions[0]?.completeness_score || 0)}`}>
            {versions[0]?.completeness_score || 0}%
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2">
            <ArrowDownTrayIcon className="w-5 h-5 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-900">Latest Export</h3>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {versions[0]?.ai_export_size || 0}KB
          </div>
        </div>
      </div>

      {/* Version Timeline */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Version Timeline</h2>
          <p className="text-sm text-gray-600 mt-1">
            Chronological history of context changes
          </p>
        </div>
        
        <div className="p-6">
          <div className="flow-root">
            <ul className="-mb-8">
              {versions.map((version, versionIndex) => {
                const isExpanded = expandedVersions.has(version.id);
                const isLast = versionIndex === versions.length - 1;
                
                return (
                  <li key={version.id}>
                    <div className="relative pb-8">
                      {!isLast && (
                        <span 
                          className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" 
                          aria-hidden="true" 
                        />
                      )}
                      
                      <div className="relative flex items-start space-x-3">
                        {/* Timeline Icon */}
                        <div className="relative">
                          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                            <span className="text-white text-sm font-medium">
                              v{version.version}
                            </span>
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="border border-gray-200 rounded-lg p-4">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleExpanded(version.id)}
                                  className="flex items-center gap-2 text-left"
                                >
                                  {isExpanded ? (
                                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                  )}
                                  <h3 className="text-sm font-medium text-gray-900">
                                    Version {version.version} - {version.description}
                                  </h3>
                                </button>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCompletenessColor(version.completeness_score)} bg-opacity-10`}>
                                  {version.completeness_score}% complete
                                </span>
                                
                                <button
                                  onClick={() => handlePreviewVersion(version)}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                  title="Preview version"
                                >
                                  <EyeIcon className="w-4 h-4" />
                                </button>
                                
                                <button
                                  onClick={() => handleExportVersion(version)}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                  title="Export version"
                                >
                                  <ArrowDownTrayIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            
                            {/* Metadata */}
                            <div className="mt-2 text-sm text-gray-500 flex items-center gap-4">
                              <span>
                                By {version.created_by}
                              </span>
                              <span>
                                {new Date(version.created_at).toLocaleString()}
                              </span>
                              <span>
                                {version.ai_export_size}KB export
                              </span>
                            </div>
                            
                            {/* Changes Summary */}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {version.changes.map((change, changeIndex) => (
                                <span
                                  key={changeIndex}
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getChangeTypeColor(change.change_type)}`}
                                >
                                  {change.section}: {change.change_type}
                                </span>
                              ))}
                            </div>
                            
                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <h4 className="text-sm font-medium text-gray-900 mb-3">
                                  Detailed Changes
                                </h4>
                                <div className="space-y-3">
                                  {version.changes.map((change, changeIndex) => (
                                    <div
                                      key={changeIndex}
                                      className="bg-gray-50 rounded-lg p-3"
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getChangeTypeColor(change.change_type)}`}>
                                              {change.change_type}
                                            </span>
                                            <span className="text-sm font-medium text-gray-900 capitalize">
                                              {change.section}
                                            </span>
                                          </div>
                                          <p className="text-sm text-gray-700">
                                            {change.summary}
                                          </p>
                                          {change.details && (
                                            <p className="text-xs text-gray-500 mt-1">
                                              {change.details}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* Export Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-2">
          About Context Versions
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            <strong>Automatic Versioning:</strong> A new version is created every time you make significant changes to your business context.
          </p>
          <p>
            <strong>AI Export:</strong> Each version includes an AI-ready export that can be used for customer interactions.
          </p>
          <p>
            <strong>Version History:</strong> You can view, compare, and export any previous version of your context.
          </p>
          <p>
            <strong>Rollback:</strong> Contact support if you need to restore a previous version.
          </p>
        </div>
      </div>
    </div>
  );
}