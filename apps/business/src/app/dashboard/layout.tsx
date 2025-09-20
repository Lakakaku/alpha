'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBusinessAuth, StoreProvider, useStoreContext } from '@vocilia/auth';

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardContent({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, businessAccount, signOut, loading } = useBusinessAuth();
  const { currentStore, availableStores, switchStore, canAccessAnalytics, canManageQR, isAdmin } = useStoreContext();

  // Optimized: Early redirect check with minimal re-renders
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login'); // Use replace for better performance
    } else if (!loading && (businessAccount as any)?.verification_status !== 'approved') {
      router.replace('/pending-approval');
    }
  }, [loading, user, (businessAccount as any)?.verification_status, router]);

  // Optimized: Minimal loading state with faster exit condition
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Early return for unauthenticated states
  if (!user || (businessAccount as any)?.verification_status !== 'approved') {
    return null; // Let useEffect handle redirect
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleStoreSwitch = async (storeId: string) => {
    const result = await (switchStore as any)(storeId);
    if (result.success) {
      // Optimized: Use Next.js router refresh instead of full page reload
      router.refresh();
    }
  };

  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: '📊' },
    { name: 'Feedback', href: '/dashboard/feedback', icon: '💬' },
    ...((canAccessAnalytics as any)() ? [{ name: 'Analytics', href: '/dashboard/analytics', icon: '📈' }] : []),
    ...((canManageQR as any)() ? [{ name: 'QR Codes', href: '/dashboard/qr-codes', icon: '📱' }] : []),
    ...((isAdmin as any)() ? [{ name: 'Settings', href: '/dashboard/settings', icon: '⚙️' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
                  Vocilia
                </Link>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Store Selector */}
              {(availableStores as any)?.length > 1 && (
                <div className="relative">
                  <select
                    value={(currentStore as any)?.id || ''}
                    onChange={(e) => handleStoreSwitch(e.target.value)}
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    {(availableStores as any)?.map((store: any) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Current Store Display */}
              {currentStore && (
                <div className="text-sm text-gray-600">
                  <span className="hidden sm:inline">Current store: </span>
                  <span className="font-medium">{(currentStore as any)?.name}</span>
                </div>
              )}

              {/* User Menu */}
              <div className="relative">
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-700">
                    <div className="font-medium">{(businessAccount as any)?.contact_person}</div>
                    <div className="text-xs text-gray-500">{(businessAccount as any)?.business_name}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="hidden md:flex md:flex-shrink-0">
          <div className="flex flex-col w-64">
            <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200">
              <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                <nav className="mt-5 flex-1 px-2 space-y-1">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                      <span className="mr-3 text-lg">{item.icon}</span>
                      {item.name}
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Store Information */}
              {currentStore && (
                <div className="flex-shrink-0 p-4 border-t border-gray-200">
                  <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
                    Current Store
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{(currentStore as any)?.name}</div>
                    <div className="text-gray-500 text-xs truncate">{(currentStore as any)?.address}</div>
                    {(currentStore as any)?.qr_code && (
                      <div className="text-gray-400 text-xs mt-1">
                        QR: {(currentStore as any)?.qr_code}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <div className="bg-white border-b border-gray-200 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-900">Menu</div>
              {/* Mobile menu would go here */}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            {children}
          </main>
        </div>
      </div>

      {/* No Stores Message */}
      {(availableStores as any)?.length === 0 && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Stores Available</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your business account doesn't have access to any stores yet. 
                Please contact support to set up your store locations.
              </p>
              <div className="space-y-2">
                <a
                  href="mailto:support@vocilia.com"
                  className="w-full inline-flex justify-center px-4 py-2 bg-indigo-600 border border-transparent rounded-md font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Contact Support
                </a>
                <button
                  onClick={handleSignOut}
                  className="w-full inline-flex justify-center px-4 py-2 bg-white border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, businessAccount } = useBusinessAuth();

  return (
    <StoreProvider
      businessAccountId={(businessAccount as any)?.id || null}
      userId={(user as any)?.id || null}
    >
      <DashboardContent>{children}</DashboardContent>
    </StoreProvider>
  );
}