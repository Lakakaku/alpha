'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
// Temporary mock hook for demo purposes
const useBusinessAuth = () => ({
  resetPassword: async (email: string) => ({ success: true }),
  loading: false
});

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword, loading } = useBusinessAuth();
  
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Check if this is a password update (user clicked link in email)
  const isPasswordUpdate = searchParams.has('token');
  const token = searchParams.get('token');

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) {
      setEmailError('');
    }
    if (resetError) {
      setResetError(null);
    }
  };

  const validateEmail = () => {
    if (!email) {
      setEmailError('Email is required');
      return false;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Invalid email format');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (!validateEmail()) {
      return;
    }

    try {
      const result = await resetPassword(email);
      
      if (result.success) {
        setIsSubmitted(true);
      } else {
        setResetError((result as any).error || 'Failed to send reset email');
      }
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  if (isPasswordUpdate) {
    // This would be handled by a separate component/page for updating password
    // For now, redirect to login with a message
    router.push('/login?message=Please check your email for password reset instructions&type=info');
    return null;
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="text-2xl font-bold text-indigo-600">Vocilia</div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Check your email
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Reset link sent!
              </h3>
              
              <p className="text-sm text-gray-600 mb-6">
                We've sent a password reset link to{' '}
                <span className="font-medium text-gray-900">{email}</span>
              </p>

              <div className="bg-gray-50 rounded-md p-4 mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Next steps:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>1. Check your email inbox (and spam folder)</li>
                  <li>2. Click the reset link in the email</li>
                  <li>3. Create a new password</li>
                  <li>4. Sign in with your new password</li>
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleBackToLogin}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Back to Sign In
                </button>
                
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Use different email
                </button>
              </div>

              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500">
                  Didn't receive the email? Check your spam folder or{' '}
                  <a
                    href="mailto:support@vocilia.com"
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    contact support
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="text-2xl font-bold text-indigo-600">Vocilia</div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Remember your password?{' '}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in here
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Enter your business email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {resetError && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{resetError}</div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={handleEmailChange}
                  className={`appearance-none block w-full px-3 py-2 border ${
                    emailError ? 'border-red-300' : 'border-gray-300'
                  } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                  placeholder="business@example.com"
                />
                {emailError && (
                  <p className="mt-1 text-sm text-red-600">{emailError}</p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Sending reset link...
                  </div>
                ) : (
                  'Send reset link'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/login"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Back to Sign In
              </Link>
            </div>
          </div>

          <div className="mt-6 bg-gray-50 rounded-md p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Security Notice</h3>
            <p className="text-xs text-gray-600">
              For security reasons, we'll only send password reset links to verified business email addresses.
              If you don't receive an email, please contact our support team.
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Need help?{' '}
              <a
                href="mailto:support@vocilia.com"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}