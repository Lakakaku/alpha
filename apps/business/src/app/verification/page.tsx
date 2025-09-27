import { Metadata } from 'next';
import VerificationDashboard from '../../components/verification/VerificationDashboard';

export const metadata: Metadata = {
  title: 'Verification Dashboard | Vocilia Business',
  description: 'Review and verify transaction data for your stores',
};

export default function VerificationPage() {
  // In a real app, you'd get this from auth context or session
  const businessId = 'placeholder-business-id';

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Verification Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Review and verify transaction data for your stores to ensure reward accuracy.
        </p>
      </div>

      <VerificationDashboard businessId={businessId} />
    </div>
  );
}