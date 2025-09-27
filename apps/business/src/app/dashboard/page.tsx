'use client';

import { useBusinessAuth, useStoreContext } from '@vocilia/auth';
import Link from 'next/link';
import { useQuestions } from '../../hooks/useQuestions';

export default function DashboardPage() {
  const { businessAccount } = useBusinessAuth();
  const { currentStore, canAccessAnalytics, canManageQR, isAdmin } = useStoreContext();
  const { data: questions } = useQuestions({
    page: 1,
    limit: 5,
    status: 'active'
  });

  const recentQuestions = questions?.data || [];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          Welcome back, {(businessAccount as any)?.contact_person}. Here's what's happening with your feedback system.
        </p>
      </div>

      {/* Current Store Info */}
      {currentStore && (
        <div className="bg-white overflow-hidden shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-indigo-100">
                  <span className="text-lg">🏪</span>
                </span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {(currentStore as any)?.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {(currentStore as any)?.address}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Questions Management */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">❓</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Questions
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {recentQuestions.length}
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-5">
              <Link
                href="/questions"
                className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors"
              >
                Manage Questions
              </Link>
            </div>
          </div>
        </div>

        {/* Feedback Overview */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">💬</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Recent Feedback
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    View Latest
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-5">
              <Link
                href="/dashboard/feedback"
                className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
              >
                View Feedback
              </Link>
            </div>
          </div>
        </div>

        {/* QR Codes (if permitted) */}
        {(canManageQR as any)() && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">📱</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      QR Codes
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      Manage & Print
                    </dd>
                  </dl>
                </div>
              </div>
              <div className="mt-5">
                <Link
                  href="/dashboard/qr-codes"
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 transition-colors"
                >
                  Manage QR Codes
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Analytics (if permitted) */}
        {(canAccessAnalytics as any)() && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">📈</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Analytics
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      View Reports
                    </dd>
                  </dl>
                </div>
              </div>
              <div className="mt-5">
                <Link
                  href="/dashboard/analytics"
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                >
                  View Analytics
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Store Context */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">🏪</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Store Context
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    Configure Store
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-5">
              <Link
                href="/context"
                className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 transition-colors"
              >
                Manage Context
              </Link>
            </div>
          </div>
        </div>

        {/* Settings (if admin) */}
        {(isAdmin as any)() && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">⚙️</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Settings
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      Admin Panel
                    </dd>
                  </dl>
                </div>
              </div>
              <div className="mt-5">
                <Link
                  href="/dashboard/settings"
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Settings
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Questions Section */}
      {recentQuestions.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Recent Questions
              </h3>
              <Link
                href="/questions"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {recentQuestions.slice(0, 3).map((question: any) => (
                <div key={question.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{question.title}</p>
                    <p className="text-xs text-gray-500">
                      {question.category} • {question.frequency_limit ? `Max ${question.frequency_limit} times` : 'No limit'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      question.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {question.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State for Questions */}
      {recentQuestions.length === 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6 text-center">
            <span className="text-4xl mb-4 block">❓</span>
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">
              No Questions Yet
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Get started by creating your first custom feedback question.
            </p>
            <Link
              href="/questions"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              Create Your First Question
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}