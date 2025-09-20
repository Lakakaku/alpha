'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Temporary mock hooks and functions for demo purposes
interface BusinessRegistrationData {
  email: string;
  password: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  address: string;
  businessType: string;
  estimatedMonthlyCustomers: number;
}

const useBusinessAuth = () => ({
  signUp: async (data: BusinessRegistrationData) => ({ success: true }),
  loading: false
});

const validateBusinessRegistration = (data: BusinessRegistrationData) => ({
  isValid: true,
  errors: []
});

const checkEmailAvailability = async (email: string) => ({ available: true });
const checkBusinessNameAvailability = async (name: string) => ({ available: true });

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, loading } = useBusinessAuth();
  
  const [formData, setFormData] = useState<BusinessRegistrationData>({
    email: '',
    password: '',
    businessName: '',
    contactPerson: '',
    phone: '',
    address: '',
    businessType: 'restaurant',
    estimatedMonthlyCustomers: 0
  });

  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const businessTypes = [
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'retail', label: 'Retail Store' },
    { value: 'services', label: 'Services' },
    { value: 'hospitality', label: 'Hospitality' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'other', label: 'Other' }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'estimatedMonthlyCustomers' ? parseInt(value) || 0 : value
    }));

    // Clear field-specific error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateField = async (fieldName: string) => {
    const newErrors: Record<string, string> = {};

    if (fieldName === 'email' || fieldName === 'all') {
      if (formData.email) {
        const emailCheck = await checkEmailAvailability(formData.email);
        if (!emailCheck.available) {
          newErrors.email = (emailCheck as any).error || 'Email is already registered';
        }
      }
    }

    if (fieldName === 'businessName' || fieldName === 'all') {
      if (formData.businessName) {
        const nameCheck = await checkBusinessNameAvailability(formData.businessName);
        if (!nameCheck.available) {
          newErrors.businessName = (nameCheck as any).error || 'Business name is already taken';
        }
      }
    }

    if (fieldName === 'confirmPassword' || fieldName === 'all') {
      if (confirmPassword && confirmPassword !== formData.password) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const fieldName = e.target.name;
    if (fieldName === 'email' || fieldName === 'businessName') {
      setIsValidating(true);
      await validateField(fieldName);
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate form data
    const validation = validateBusinessRegistration(formData);
    if (!validation.isValid) {
      const fieldErrors: Record<string, string> = {};
      validation.errors.forEach((error: any) => {
        fieldErrors[error.field] = error.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // Check password confirmation
    if (formData.password !== confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      return;
    }

    // Validate email and business name availability
    setIsValidating(true);
    const isValid = await validateField('all');
    setIsValidating(false);

    if (!isValid) {
      return;
    }

    try {
      const result = await signUp(formData);
      
      if (result.success) {
        router.push('/pending-approval');
      } else {
        setSubmitError((result as any).error || 'Registration failed');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="text-2xl font-bold text-indigo-600">Vocilia</div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Register your business
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in here
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {submitError && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{submitError}</div>
              </div>
            )}

            {/* Business Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Business Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
                    Business Name
                  </label>
                  <input
                    id="businessName"
                    name="businessName"
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                      errors.businessName ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                    placeholder="Your business name"
                  />
                  {errors.businessName && (
                    <p className="mt-1 text-sm text-red-600">{errors.businessName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="businessType" className="block text-sm font-medium text-gray-700">
                    Business Type
                  </label>
                  <select
                    id="businessType"
                    name="businessType"
                    value={formData.businessType}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    {businessTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="estimatedMonthlyCustomers" className="block text-sm font-medium text-gray-700">
                    Estimated Monthly Customers
                  </label>
                  <input
                    id="estimatedMonthlyCustomers"
                    name="estimatedMonthlyCustomers"
                    type="number"
                    min="1"
                    max="100000"
                    required
                    value={formData.estimatedMonthlyCustomers || ''}
                    onChange={handleInputChange}
                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                      errors.estimatedMonthlyCustomers ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                    placeholder="e.g., 500"
                  />
                  {errors.estimatedMonthlyCustomers && (
                    <p className="mt-1 text-sm text-red-600">{errors.estimatedMonthlyCustomers}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Business Address
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={3}
                    required
                    value={formData.address}
                    onChange={handleInputChange}
                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                      errors.address ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                    placeholder="Full business address"
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">{errors.address}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700">
                    Contact Person
                  </label>
                  <input
                    id="contactPerson"
                    name="contactPerson"
                    type="text"
                    required
                    value={formData.contactPerson}
                    onChange={handleInputChange}
                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                      errors.contactPerson ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                    placeholder="Full name"
                  />
                  {errors.contactPerson && (
                    <p className="mt-1 text-sm text-red-600">{errors.contactPerson}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                      errors.email ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                    placeholder="business@example.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                      errors.phone ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                    placeholder="+1 (555) 123-4567"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Account Security */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Account Security</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`appearance-none relative block w-full px-3 py-2 pr-10 border ${
                        errors.password ? 'border-red-300' : 'border-gray-300'
                      } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <span className="text-gray-400 text-sm">
                        {showPassword ? 'Hide' : 'Show'}
                      </span>
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Must be at least 8 characters with uppercase, lowercase, and number
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => validateField('confirmPassword')}
                    className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                      errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                    } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                    placeholder="Confirm password"
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || isValidating}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading || isValidating ? 'Processing...' : 'Register Business'}
              </button>
            </div>

            <div className="text-xs text-gray-500 text-center">
              By registering, you agree to our Terms of Service and Privacy Policy.
              Your account will be reviewed by our team before activation.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}