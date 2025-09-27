'use client';

import React, { useState, memo, useCallback, useMemo } from 'react';
import { StoreContextPersonnel, PersonnelShift } from '@vocilia/types/src/context';
import { PlusIcon, TrashIcon, UserIcon } from '@heroicons/react/24/outline';

interface PersonnelFormProps {
  personnel: StoreContextPersonnel[];
  onChange: (personnel: StoreContextPersonnel[]) => void;
  onSave: () => Promise<void>;
  isLoading?: boolean;
  errors?: Record<string, string>;
}

const SENIORITY_LEVELS = [
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'manager', label: 'Manager' },
  { value: 'director', label: 'Director' }
] as const;

const INTERACTION_LEVELS = [
  { value: 'none', label: 'None - Backend/Support' },
  { value: 'minimal', label: 'Minimal - Occasional' },
  { value: 'moderate', label: 'Moderate - Regular' },
  { value: 'high', label: 'High - Primary Customer-Facing' }
] as const;

const COMMON_ROLES = [
  'Manager',
  'Assistant Manager',
  'Sales Associate',
  'Cashier',
  'Customer Service',
  'Stock Associate',
  'Visual Merchandiser',
  'Security',
  'Cleaner',
  'Maintenance'
];

const COMMON_DEPARTMENTS = [
  'Management',
  'Sales',
  'Customer Service',
  'Operations',
  'Inventory',
  'Security',
  'Maintenance'
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

const PersonnelFormComponent = ({ 
  personnel, 
  onChange, 
  onSave, 
  isLoading = false, 
  errors = {} 
}: PersonnelFormProps) {
  const [expandedPersonIndex, setExpandedPersonIndex] = useState<number | null>(null);

  const addNewPerson = () => {
    const newPerson: StoreContextPersonnel = {
      name: '',
      role: '',
      department: '',
      seniority_level: 'entry',
      customer_interaction: 'moderate',
      specializations: [],
      shifts: []
    };
    
    onChange([...personnel, newPerson]);
    setExpandedPersonIndex(personnel.length);
  };

  const updatePerson = (index: number, updates: Partial<StoreContextPersonnel>) => {
    const updatedPersonnel = personnel.map((person, i) => 
      i === index ? { ...person, ...updates } : person
    );
    onChange(updatedPersonnel);
  };

  const removePerson = (index: number) => {
    const updatedPersonnel = personnel.filter((_, i) => i !== index);
    onChange(updatedPersonnel);
    if (expandedPersonIndex === index) {
      setExpandedPersonIndex(null);
    } else if (expandedPersonIndex !== null && expandedPersonIndex > index) {
      setExpandedPersonIndex(expandedPersonIndex - 1);
    }
  };

  const addShift = (personIndex: number) => {
    const person = personnel[personIndex];
    const newShift: PersonnelShift = {
      day_of_week: 1, // Monday
      start_time: '09:00',
      end_time: '17:00',
      break_duration: 30
    };
    
    updatePerson(personIndex, {
      shifts: [...person.shifts, newShift]
    });
  };

  const updateShift = (personIndex: number, shiftIndex: number, updates: Partial<PersonnelShift>) => {
    const person = personnel[personIndex];
    const updatedShifts = person.shifts.map((shift, i) => 
      i === shiftIndex ? { ...shift, ...updates } : shift
    );
    updatePerson(personIndex, { shifts: updatedShifts });
  };

  const removeShift = (personIndex: number, shiftIndex: number) => {
    const person = personnel[personIndex];
    const updatedShifts = person.shifts.filter((_, i) => i !== shiftIndex);
    updatePerson(personIndex, { shifts: updatedShifts });
  };

  const addSpecialization = (personIndex: number, specialization: string) => {
    const person = personnel[personIndex];
    if (specialization.trim() && !person.specializations?.includes(specialization.trim())) {
      updatePerson(personIndex, {
        specializations: [...(person.specializations || []), specialization.trim()]
      });
    }
  };

  const removeSpecialization = (personIndex: number, specializationIndex: number) => {
    const person = personnel[personIndex];
    const updatedSpecializations = person.specializations?.filter((_, i) => i !== specializationIndex) || [];
    updatePerson(personIndex, { specializations: updatedSpecializations });
  };

  const renderPersonCard = (person: StoreContextPersonnel, index: number) => {
    const isExpanded = expandedPersonIndex === index;
    const personErrors = Object.keys(errors).filter(key => key.startsWith(`personnel_${index}`));

    return (
      <div key={index} className="border rounded-lg bg-white shadow-sm">
        {/* Person Header */}
        <div 
          className="p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setExpandedPersonIndex(isExpanded ? null : index)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {person.name || `Team Member ${index + 1}`}
                </h3>
                <p className="text-sm text-gray-500">
                  {person.role} {person.department && `• ${person.department}`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {personErrors.length > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {personErrors.length} error{personErrors.length > 1 ? 's' : ''}
                </span>
              )}
              
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                person.customer_interaction === 'high' ? 'bg-green-100 text-green-800' :
                person.customer_interaction === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                person.customer_interaction === 'minimal' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {INTERACTION_LEVELS.find(l => l.value === person.customer_interaction)?.label || person.customer_interaction}
              </span>
              
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePerson(index);
                }}
                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
              
              <div className={`w-6 h-6 flex items-center justify-center text-gray-400 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}>
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Person Details */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              {/* Basic Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={person.name}
                  onChange={(e) => updatePerson(index, { name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={person.role}
                  onChange={(e) => updatePerson(index, { role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select role</option>
                  {COMMON_ROLES.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                  <option value="custom">Other (specify below)</option>
                </select>
                {person.role === 'custom' && (
                  <input
                    type="text"
                    placeholder="Specify role"
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    onChange={(e) => updatePerson(index, { role: e.target.value })}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department *
                </label>
                <select
                  value={person.department}
                  onChange={(e) => updatePerson(index, { department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select department</option>
                  {COMMON_DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                  <option value="custom">Other (specify below)</option>
                </select>
                {person.department === 'custom' && (
                  <input
                    type="text"
                    placeholder="Specify department"
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    onChange={(e) => updatePerson(index, { department: e.target.value })}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seniority Level *
                </label>
                <select
                  value={person.seniority_level}
                  onChange={(e) => updatePerson(index, { seniority_level: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {SENIORITY_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Interaction Level *
                </label>
                <select
                  value={person.customer_interaction}
                  onChange={(e) => updatePerson(index, { customer_interaction: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {INTERACTION_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Specializations */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specializations & Skills
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {person.specializations?.map((spec, specIndex) => (
                  <span
                    key={specIndex}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                  >
                    {spec}
                    <button
                      type="button"
                      onClick={() => removeSpecialization(index, specIndex)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add specialization (e.g., 'Product Knowledge', 'Bilingual')"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.target as HTMLInputElement;
                      addSpecialization(index, input.value);
                      input.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                    addSpecialization(index, input.value);
                    input.value = '';
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Work Shifts */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Work Schedule
                </label>
                <button
                  type="button"
                  onClick={() => addShift(index)}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Shift
                </button>
              </div>

              <div className="space-y-2">
                {person.shifts.map((shift, shiftIndex) => (
                  <div key={shiftIndex} className="flex items-center gap-3 p-3 bg-white border rounded-md">
                    <select
                      value={shift.day_of_week}
                      onChange={(e) => updateShift(index, shiftIndex, { day_of_week: parseInt(e.target.value) })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      {DAYS_OF_WEEK.map((day, dayIndex) => (
                        <option key={dayIndex} value={dayIndex}>{day}</option>
                      ))}
                    </select>

                    <input
                      type="time"
                      value={shift.start_time}
                      onChange={(e) => updateShift(index, shiftIndex, { start_time: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />

                    <span className="text-gray-500">to</span>

                    <input
                      type="time"
                      value={shift.end_time}
                      onChange={(e) => updateShift(index, shiftIndex, { end_time: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />

                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Break (min):</label>
                      <input
                        type="number"
                        min="0"
                        max="480"
                        value={shift.break_duration || 0}
                        onChange={(e) => updateShift(index, shiftIndex, { 
                          break_duration: e.target.value ? parseInt(e.target.value) : 0 
                        })}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeShift(index, shiftIndex)}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {person.shifts.length === 0 && (
                <p className="text-sm text-gray-500 italic">No shifts added yet</p>
              )}
            </div>

            {/* Error Messages */}
            {personErrors.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <h4 className="text-sm font-medium text-red-800 mb-1">Please fix the following errors:</h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {personErrors.map(errorKey => (
                    <li key={errorKey}>• {errors[errorKey]}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          <p className="text-sm text-gray-600">
            Add your team members to help AI understand service capabilities and staff availability.
          </p>
        </div>
        
        <button
          type="button"
          onClick={addNewPerson}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      {/* Personnel List */}
      <div className="space-y-4">
        {personnel.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No team members added yet</p>
            <p className="text-sm text-gray-400">Click "Add Team Member" to get started</p>
          </div>
        ) : (
          personnel.map((person, index) => renderPersonCard(person, index))
        )}
      </div>

      {/* Summary Stats */}
      {personnel.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Team Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-blue-600 font-semibold">{personnel.length}</div>
              <div className="text-blue-800">Total Members</div>
            </div>
            <div>
              <div className="text-blue-600 font-semibold">
                {new Set(personnel.map(p => p.department)).size}
              </div>
              <div className="text-blue-800">Departments</div>
            </div>
            <div>
              <div className="text-blue-600 font-semibold">
                {personnel.filter(p => p.customer_interaction === 'high').length}
              </div>
              <div className="text-blue-800">Customer-Facing</div>
            </div>
            <div>
              <div className="text-blue-600 font-semibold">
                {personnel.filter(p => p.shifts.length > 0).length}
              </div>
              <div className="text-blue-800">With Schedules</div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <button
          onClick={onSave}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save Personnel'}
        </button>
      </div>
    </div>
  );
};

export const PersonnelForm = memo(PersonnelFormComponent);
PersonnelForm.displayName = 'PersonnelForm';

export default PersonnelForm;