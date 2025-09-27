import { Metadata } from 'next';
import { ContextNavigationTabs } from '@/components/context/ContextTabs';

export const metadata: Metadata = {
  title: 'Business Context - Vocilia',
  description: 'Manage your business context for AI-powered customer interactions',
};

interface ContextLayoutProps {
  children: React.ReactNode;
}

export default function ContextLayout({ children }: ContextLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Business Context
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Configure your business information to enable AI-powered customer interactions
                </p>
              </div>
              
              {/* Context Status Indicator will go here */}
              <div className="flex items-center gap-4">
                {/* TODO: Add CompletenessIndicator component */}
              </div>
            </div>
            
            {/* Navigation Tabs */}
            <div className="mt-6">
              <ContextNavigationTabs />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}