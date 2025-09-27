'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { StoreContextProfile, OperatingHours } from '@vocilia/types/src/context';

interface StoreProfileFormProps {
  initialData?: Partial<StoreContextProfile>;
  onSave: (data: StoreContextProfile) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

const STORE_TYPES = [
  'Retail Store',
  'Restaurant',
  'Cafe',
  'Grocery Store',
  'Pharmacy',
  'Electronics Store',
  'Clothing Store',
  'Home Goods',
  'Automotive',
  'Services',
  'Other'
];

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday', 
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

const StoreProfileFormComponent = ({ 
  initialData, 
  onSave, 
  onCancel, 
  isLoading = false 
}: StoreProfileFormProps) => {
  const [formData, setFormData] = useState<StoreContextProfile>({
    business_name: '',
    store_name: '',
    store_type: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    size_sqft: undefined,
    capacity: undefined,
    target_demographics: '',
    operating_hours: DAYS_OF_WEEK.map((_, index) => ({
      day_of_week: index,
      open_time: '09:00',
      close_time: '17:00',
      is_closed: index === 0 // Sunday closed by default
    })),
    ...initialData
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'business_name':
        return !value || value.trim().length === 0 ? 'Business name is required' : '';
      case 'store_name':
        return !value || value.trim().length === 0 ? 'Store name is required' : '';
      case 'store_type':
        return !value || value.trim().length === 0 ? 'Store type is required' : '';
      case 'address':
        return !value || value.trim().length === 0 ? 'Address is required' : '';
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Invalid email format';
        }
        return '';
      case 'website':
        if (value && !/^https?:\/\/.+/.test(value)) {
          return 'Website must start with http:// or https://';
        }
        return '';
      case 'phone':
        if (value && !/^[\+]?[\d\s\-\(\)\.]{10,20}$/.test(value)) {
          return 'Invalid phone number format';
        }
        return '';
      case 'size_sqft':
      case 'capacity':
        if (value && (isNaN(value) || value <= 0)) {
          return 'Must be a positive number';
        }
        return '';
      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validate basic fields
    Object.keys(formData).forEach(key => {
      if (key !== 'operating_hours') {
        const error = validateField(key, (formData as any)[key]);
        if (error) {
          newErrors[key] = error;
        }
      }
    });

    // Validate operating hours
    formData.operating_hours.forEach((hours, index) => {
      if (!hours.is_closed) {
        if (!hours.open_time) {
          newErrors[`operating_hours_${index}_open`] = 'Open time is required';
        }
        if (!hours.close_time) {
          newErrors[`operating_hours_${index}_close`] = 'Close time is required';
        }
        if (hours.open_time && hours.close_time && hours.open_time >= hours.close_time) {
          newErrors[`operating_hours_${index}`] = 'Open time must be before close time';
        }
      }
    });

    // Check if store is open at least one day
    const openDays = formData.operating_hours.filter(h => !h.is_closed);
    if (openDays.length === 0) {
      newErrors.operating_hours_general = 'Store must be open at least one day per week';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setTouched(prev => ({ ...prev, [name]: true }));
    
    // Clear error if field becomes valid
    const error = validateField(name, value);
    if (!error && errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleOperatingHoursChange = (dayIndex: number, field: keyof OperatingHours, value: any) => {
    setFormData(prev => ({
      ...prev,
      operating_hours: prev.operating_hours.map((hours, index) => 
        index === dayIndex ? { ...hours, [field]: value } : hours
      )
    }));
    setTouched(prev => ({ ...prev, [`operating_hours_${dayIndex}`]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSave(formData);
    } catch (error) {
      console.error('Error saving store profile:', error);
    }
  };

  const renderOperatingHours = () => (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Operating Hours
      </label>
      {errors.operating_hours_general && (
        <p className="text-sm text-red-600">{errors.operating_hours_general}</p>
      )}
      
      <div className="grid gap-3">
        {formData.operating_hours.map((hours, index) => (
          <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="w-24 text-sm font-medium text-gray-700">
              {DAYS_OF_WEEK[index]}
            </div>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hours.is_closed}
                onChange={(e) => handleOperatingHoursChange(index, 'is_closed', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Closed</span>
            </label>
            
            {!hours.is_closed && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Open</label>
                  <input
                    type="time"
                    value={hours.open_time}
                    onChange={(e) => handleOperatingHoursChange(index, 'open_time', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  {errors[`operating_hours_${index}_open`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`operating_hours_${index}_open`]}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Close</label>
                  <input
                    type="time"
                    value={hours.close_time}
                    onChange={(e) => handleOperatingHoursChange(index, 'close_time', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  {errors[`operating_hours_${index}_close`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`operating_hours_${index}_close`]}</p>
                  )}
                </div>
              </>
            )}
            
            {errors[`operating_hours_${index}`] && (
              <p className="text-xs text-red-600">{errors[`operating_hours_${index}`]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="business_name" className="block text-sm font-medium text-gray-700">
            Business Name *
          </label>
          <input
            type="text"
            id="business_name"
            value={formData.business_name}
            onChange={(e) => handleFieldChange('business_name', e.target.value)}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm ${
              errors.business_name ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="Your Business Name"
          />
          {errors.business_name && (
            <p className="mt-1 text-sm text-red-600">{errors.business_name}</p>
          )}
        </div>

        <div>
          <label htmlFor="store_name" className="block text-sm font-medium text-gray-700">
            Store Name *
          </label>
          <input
            type="text"
            id="store_name"
            value={formData.store_name}
            onChange={(e) => handleFieldChange('store_name', e.target.value)}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm ${
              errors.store_name ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="Store Location Name"
          />
          {errors.store_name && (
            <p className="mt-1 text-sm text-red-600">{errors.store_name}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="store_type" className="block text-sm font-medium text-gray-700">
          Store Type *
        </label>
        <select
          id="store_type"
          value={formData.store_type}
          onChange={(e) => handleFieldChange('store_type', e.target.value)}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm ${
            errors.store_type ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
          }`}
        >
          <option value="">Select store type</option>
          {STORE_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        {errors.store_type && (
          <p className="mt-1 text-sm text-red-600">{errors.store_type}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          value={formData.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="Describe your business, what makes it unique..."
        />
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
          Address *
        </label>
        <textarea
          id="address"
          rows={2}
          value={formData.address}
          onChange={(e) => handleFieldChange('address', e.target.value)}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm ${
            errors.address ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
          }`}
          placeholder="Street address, city, state, zip code"
        />
        {errors.address && (
          <p className="mt-1 text-sm text-red-600">{errors.address}</p>
        )}
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => handleFieldChange('phone', e.target.value)}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm ${
              errors.phone ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="(555) 123-4567"
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => handleFieldChange('email', e.target.value)}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm ${
              errors.email ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="store@business.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700">
            Website
          </label>
          <input
            type="url"
            id="website"
            value={formData.website}
            onChange={(e) => handleFieldChange('website', e.target.value)}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm ${
              errors.website ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="https://www.business.com"
          />
          {errors.website && (
            <p className="mt-1 text-sm text-red-600">{errors.website}</p>
          )}
        </div>
      </div>

      {/* Store Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="size_sqft" className="block text-sm font-medium text-gray-700">
            Store Size (sq ft)
          </label>
          <input
            type="number"
            id="size_sqft"
            min="1"
            value={formData.size_sqft || ''}
            onChange={(e) => handleFieldChange('size_sqft', e.target.value ? parseInt(e.target.value) : undefined)}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm ${
              errors.size_sqft ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="1200"
          />
          {errors.size_sqft && (
            <p className="mt-1 text-sm text-red-600">{errors.size_sqft}</p>
          )}
        </div>

        <div>
          <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">
            Customer Capacity
          </label>
          <input
            type="number"
            id="capacity"
            min="1"
            value={formData.capacity || ''}
            onChange={(e) => handleFieldChange('capacity', e.target.value ? parseInt(e.target.value) : undefined)}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm ${
              errors.capacity ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="50"
          />
          {errors.capacity && (
            <p className="mt-1 text-sm text-red-600">{errors.capacity}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="target_demographics" className="block text-sm font-medium text-gray-700">
          Target Demographics
        </label>
        <textarea
          id="target_demographics"
          rows={2}
          value={formData.target_demographics}
          onChange={(e) => handleFieldChange('target_demographics', e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="Families with children, young professionals, local residents..."
        />
      </div>

      {/* Operating Hours */}
      {renderOperatingHours()}

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-6 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
};

// Memoized component with custom comparison for better performance
export const StoreProfileForm = memo(StoreProfileFormComponent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.initialData === nextProps.initialData &&
    prevProps.onSave === nextProps.onSave &&
    prevProps.onCancel === nextProps.onCancel
  );
});

StoreProfileForm.displayName = 'StoreProfileForm';

export default StoreProfileForm;