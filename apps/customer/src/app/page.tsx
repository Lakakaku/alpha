export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          {/* Logo */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-blue-600 mb-2">Vocilia</h1>
            <p className="text-gray-600">Customer Feedback Rewards</p>
          </div>

          {/* Welcome Message */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Welcome to Vocilia
            </h2>
            <p className="text-gray-600 mb-4">
              Scan a QR code at participating Swedish businesses to share your feedback via AI-powered phone calls and earn rewards.
            </p>
          </div>

          {/* Demo Access */}
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Demo Access</h3>
              <p className="text-sm text-blue-700 mb-3">
                Test the verification flow with a demo store
              </p>
              <a
                href="/qr/550e8400-e29b-41d4-a716-446655440000?v=1&t=1758632844"
                className="inline-block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Demo Verification
              </a>
            </div>

            {/* Features */}
            <div className="text-left space-y-3 mt-6">
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                Mobile-optimized interface
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                Progressive Web App support
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                Offline capability with sync
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                WCAG 2.1 AA accessibility compliance
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400">
              Secure feedback verification • Swedish businesses
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}