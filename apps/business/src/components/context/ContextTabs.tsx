'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  InformationCircleIcon,
  UserGroupIcon,
  MapIcon,
  ArchiveBoxIcon,
  ClockIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const CONTEXT_TABS = [
  {
    key: 'overview',
    label: 'Overview',
    href: '/context',
    icon: ChartBarIcon,
    description: 'Context summary and completeness'
  },
  {
    key: 'profile',
    label: 'Store Profile',
    href: '/context/profile',
    icon: InformationCircleIcon,
    description: 'Business information and operating hours'
  },
  {
    key: 'personnel',
    label: 'Team & Personnel',
    href: '/context/personnel',
    icon: UserGroupIcon,
    description: 'Staff roles and schedules'
  },
  {
    key: 'layout',
    label: 'Store Layout',
    href: '/context/layout',
    icon: MapIcon,
    description: 'Physical store arrangement'
  },
  {
    key: 'inventory',
    label: 'Product Inventory',
    href: '/context/inventory',
    icon: ArchiveBoxIcon,
    description: 'Product categories and strategy'
  },
  {
    key: 'versions',
    label: 'History',
    href: '/context/versions',
    icon: ClockIcon,
    description: 'Version history and changes'
  }
];

export function ContextNavigationTabs() {
  const pathname = usePathname();

  const getActiveTab = () => {
    if (pathname === '/context') return 'overview';
    if (pathname.includes('/context/profile')) return 'profile';
    if (pathname.includes('/context/personnel')) return 'personnel';
    if (pathname.includes('/context/layout')) return 'layout';
    if (pathname.includes('/context/inventory')) return 'inventory';
    if (pathname.includes('/context/versions')) return 'versions';
    return 'overview';
  };

  const activeTab = getActiveTab();

  return (
    <div className="border-b border-gray-200">
      <nav className="flex space-x-8" aria-label="Context sections">
        {CONTEXT_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const TabIcon = tab.icon;
          
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TabIcon 
                className={`w-5 h-5 ${
                  isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
                }`} 
              />
              <span>{tab.label}</span>
              
              {/* Mobile description tooltip */}
              <div className="hidden sm:block">
                <div className={`absolute z-10 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap transform -translate-x-1/2 left-1/2 mt-2 ${
                  isActive ? 'hidden' : ''
                }`}>
                  {tab.description}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// Breadcrumb component for deeper navigation
export function ContextBreadcrumb({ 
  current, 
  parent 
}: { 
  current: string; 
  parent?: { label: string; href: string } 
}) {
  return (
    <nav className="flex mb-6" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        <li className="inline-flex items-center">
          <Link
            href="/context"
            className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"
          >
            <ChartBarIcon className="w-4 h-4 mr-2" />
            Context
          </Link>
        </li>
        
        {parent && (
          <>
            <li>
              <div className="flex items-center">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <Link
                  href={parent.href}
                  className="ml-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ml-2"
                >
                  {parent.label}
                </Link>
              </div>
            </li>
          </>
        )}
        
        <li aria-current="page">
          <div className="flex items-center">
            <svg
              className="w-6 h-6 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
              {current}
            </span>
          </div>
        </li>
      </ol>
    </nav>
  );
}

// Progress indicator for context sections
export function ContextProgress({ 
  currentSection,
  completedSections = []
}: {
  currentSection: string;
  completedSections?: string[];
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">Context Setup Progress</h3>
        <span className="text-sm text-gray-500">
          {completedSections.length} of {CONTEXT_TABS.length - 2} sections complete
        </span>
      </div>
      
      <div className="flex items-center space-x-2">
        {CONTEXT_TABS.filter(tab => !['overview', 'versions'].includes(tab.key)).map((tab, index) => {
          const isCompleted = completedSections.includes(tab.key);
          const isCurrent = currentSection === tab.key;
          const TabIcon = tab.icon;
          
          return (
            <div key={tab.key} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  isCompleted
                    ? 'bg-green-600 border-green-600 text-white'
                    : isCurrent
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                <TabIcon className="w-4 h-4" />
              </div>
              
              {index < CONTEXT_TABS.filter(t => !['overview', 'versions'].includes(t.key)).length - 1 && (
                <div
                  className={`w-8 h-0.5 ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Quick navigation component
export function QuickContextActions() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/context/profile"
          className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <InformationCircleIcon className="w-6 h-6 text-blue-600" />
          <div>
            <div className="font-medium text-gray-900">Update Store Profile</div>
            <div className="text-sm text-gray-500">Basic business information</div>
          </div>
        </Link>
        
        <Link
          href="/context/personnel"
          className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <UserGroupIcon className="w-6 h-6 text-green-600" />
          <div>
            <div className="font-medium text-gray-900">Manage Team</div>
            <div className="text-sm text-gray-500">Staff roles and schedules</div>
          </div>
        </Link>
        
        <Link
          href="/context/layout"
          className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <MapIcon className="w-6 h-6 text-purple-600" />
          <div>
            <div className="font-medium text-gray-900">Design Layout</div>
            <div className="text-sm text-gray-500">Store spatial arrangement</div>
          </div>
        </Link>
        
        <Link
          href="/context/inventory"
          className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArchiveBoxIcon className="w-6 h-6 text-orange-600" />
          <div>
            <div className="font-medium text-gray-900">Configure Inventory</div>
            <div className="text-sm text-gray-500">Product categories</div>
          </div>
        </Link>
      </div>
    </div>
  );
}