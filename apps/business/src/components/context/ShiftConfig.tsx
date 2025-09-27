'use client';

import React, { useState } from 'react';
import { PersonnelShift } from '@vocilia/types/src/context';
import { PlusIcon, TrashIcon, ClockIcon, CalendarIcon } from '@heroicons/react/24/outline';

interface ShiftConfigProps {
  shifts: PersonnelShift[];
  onChange: (shifts: PersonnelShift[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday', 
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

const SHIFT_PRESETS = {
  morning: { start: '06:00', end: '14:00', break: 30 },
  day: { start: '09:00', end: '17:00', break: 60 },
  evening: { start: '14:00', end: '22:00', break: 30 },
  night: { start: '22:00', end: '06:00', break: 45 },
  split_morning: { start: '06:00', end: '10:00', break: 0 },
  split_evening: { start: '18:00', end: '22:00', break: 0 }
};

export function ShiftConfig({ 
  shifts, 
  onChange, 
  disabled = false, 
  errors = {} 
}: ShiftConfigProps) {
  const [showPresets, setShowPresets] = useState(false);

  const addShift = (preset?: keyof typeof SHIFT_PRESETS) => {
    const presetData = preset ? SHIFT_PRESETS[preset] : null;
    
    const newShift: PersonnelShift = {
      day_of_week: getNextAvailableDay(),
      start_time: presetData?.start || '09:00',
      end_time: presetData?.end || '17:00',
      break_duration: presetData?.break || 30
    };
    
    onChange([...shifts, newShift]);
  };

  const updateShift = (index: number, updates: Partial<PersonnelShift>) => {
    const updatedShifts = shifts.map((shift, i) => 
      i === index ? { ...shift, ...updates } : shift
    );
    onChange(updatedShifts);
  };

  const removeShift = (index: number) => {
    const updatedShifts = shifts.filter((_, i) => i !== index);
    onChange(updatedShifts);
  };

  const duplicateShift = (index: number) => {
    const shiftToDuplicate = shifts[index];
    const newShift = { 
      ...shiftToDuplicate, 
      day_of_week: getNextAvailableDay() 
    };
    onChange([...shifts, newShift]);
  };

  const getNextAvailableDay = (): number => {
    const usedDays = new Set(shifts.map(s => s.day_of_week));
    for (let day = 1; day <= 6; day++) { // Monday to Saturday
      if (!usedDays.has(day)) return day;
    }
    if (!usedDays.has(0)) return 0; // Sunday
    return 1; // Default to Monday if all days are used
  };

  const calculateShiftDuration = (shift: PersonnelShift): string => {
    const start = new Date(`1970-01-01T${shift.start_time}:00`);
    let end = new Date(`1970-01-01T${shift.end_time}:00`);
    
    // Handle overnight shifts
    if (end <= start) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    const workingMinutes = (hours * 60 + minutes) - (shift.break_duration || 0);
    const workingHours = Math.floor(workingMinutes / 60);
    const remainingMinutes = workingMinutes % 60;
    
    return `${workingHours}h ${remainingMinutes}m working`;
  };

  const getWeeklyHours = (): string => {
    const totalMinutes = shifts.reduce((total, shift) => {
      const start = new Date(`1970-01-01T${shift.start_time}:00`);
      let end = new Date(`1970-01-01T${shift.end_time}:00`);
      
      if (end <= start) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
      
      const durationMs = end.getTime() - start.getTime();
      const shiftMinutes = Math.floor(durationMs / (1000 * 60));
      return total + shiftMinutes - (shift.break_duration || 0);
    }, 0);
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m per week`;
  };

  const sortShiftsByDay = () => {
    const sorted = [...shifts].sort((a, b) => a.day_of_week - b.day_of_week);
    onChange(sorted);
  };

  const validateShift = (shift: PersonnelShift): string[] => {
    const errors: string[] = [];
    
    if (!shift.start_time) {
      errors.push('Start time is required');
    }
    
    if (!shift.end_time) {
      errors.push('End time is required');
    }
    
    if (shift.start_time && shift.end_time) {
      const start = new Date(`1970-01-01T${shift.start_time}:00`);
      const end = new Date(`1970-01-01T${shift.end_time}:00`);
      
      // Check for same time (not allowed)
      if (shift.start_time === shift.end_time) {
        errors.push('Start and end time cannot be the same');
      }
    }
    
    if (shift.break_duration && shift.break_duration < 0) {
      errors.push('Break duration cannot be negative');
    }
    
    if (shift.break_duration && shift.break_duration > 480) {
      errors.push('Break duration cannot exceed 8 hours');
    }
    
    return errors;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Work Schedule
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Define when this team member works
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              disabled={disabled}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Presets ▼
            </button>
            
            {showPresets && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                <div className="py-1">
                  {Object.entries(SHIFT_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        addShift(key as keyof typeof SHIFT_PRESETS);
                        setShowPresets(false);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      <div className="font-medium">{key.replace('_', ' ').toUpperCase()}</div>
                      <div className="text-xs text-gray-500">
                        {preset.start} - {preset.end} ({preset.break}min break)
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <button
            type="button"
            onClick={() => addShift()}
            disabled={disabled}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <PlusIcon className="w-4 h-4" />
            Add Shift
          </button>
        </div>
      </div>

      {/* Shifts List */}
      <div className="space-y-3">
        {shifts.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
            <ClockIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No shifts configured</p>
          </div>
        ) : (
          shifts.map((shift, index) => {
            const shiftErrors = validateShift(shift);
            
            return (
              <div 
                key={index} 
                className={`p-4 border rounded-lg ${
                  shiftErrors.length > 0 ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Day of Week */}
                  <div className="flex-shrink-0">
                    <label className="block text-xs text-gray-500 mb-1">Day</label>
                    <select
                      value={shift.day_of_week}
                      onChange={(e) => updateShift(index, { day_of_week: parseInt(e.target.value) })}
                      disabled={disabled}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {DAYS_OF_WEEK.map((day, dayIndex) => (
                        <option key={dayIndex} value={dayIndex}>{day}</option>
                      ))}
                    </select>
                  </div>

                  {/* Start Time */}
                  <div className="flex-shrink-0">
                    <label className="block text-xs text-gray-500 mb-1">Start</label>
                    <input
                      type="time"
                      value={shift.start_time}
                      onChange={(e) => updateShift(index, { start_time: e.target.value })}
                      disabled={disabled}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* End Time */}
                  <div className="flex-shrink-0">
                    <label className="block text-xs text-gray-500 mb-1">End</label>
                    <input
                      type="time"
                      value={shift.end_time}
                      onChange={(e) => updateShift(index, { end_time: e.target.value })}
                      disabled={disabled}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Break Duration */}
                  <div className="flex-shrink-0">
                    <label className="block text-xs text-gray-500 mb-1">Break (min)</label>
                    <input
                      type="number"
                      min="0"
                      max="480"
                      value={shift.break_duration || 0}
                      onChange={(e) => updateShift(index, { 
                        break_duration: e.target.value ? parseInt(e.target.value) : 0 
                      })}
                      disabled={disabled}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Duration Display */}
                  <div className="flex-1 text-sm text-gray-600">
                    {calculateShiftDuration(shift)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => duplicateShift(index)}
                      disabled={disabled}
                      className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                      title="Duplicate shift"
                    >
                      <CalendarIcon className="w-4 h-4" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => removeShift(index)}
                      disabled={disabled}
                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                      title="Remove shift"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Shift Errors */}
                {shiftErrors.length > 0 && (
                  <div className="mt-2 text-sm text-red-600">
                    {shiftErrors.map((error, errorIndex) => (
                      <div key={errorIndex}>• {error}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary and Quick Actions */}
      {shifts.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {getWeeklyHours()}
              </div>
              <div className="text-xs text-gray-500">
                {shifts.length} shift{shifts.length !== 1 ? 's' : ''} across {new Set(shifts.map(s => s.day_of_week)).size} days
              </div>
            </div>
            
            <button
              type="button"
              onClick={sortShiftsByDay}
              disabled={disabled}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Sort by Day
            </button>
          </div>

          {/* Weekly Schedule Visual */}
          <div className="mt-3 grid grid-cols-7 gap-1 text-xs">
            {DAYS_OF_WEEK.map((day, dayIndex) => {
              const dayShifts = shifts.filter(s => s.day_of_week === dayIndex);
              return (
                <div key={dayIndex} className="text-center">
                  <div className="font-medium text-gray-700 mb-1">
                    {day.slice(0, 3)}
                  </div>
                  <div className="space-y-1">
                    {dayShifts.length > 0 ? (
                      dayShifts.map((shift, shiftIndex) => (
                        <div 
                          key={shiftIndex}
                          className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs"
                        >
                          {shift.start_time}-{shift.end_time}
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400">-</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Validation Summary */}
      {shifts.some(shift => validateShift(shift).length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="text-sm font-medium text-red-800 mb-1">
            Schedule Issues Found
          </div>
          <div className="text-sm text-red-700">
            Please review and fix the highlighted shift errors above.
          </div>
        </div>
      )}
    </div>
  );
}

// Utility component for displaying shifts in read-only mode
export function ShiftDisplay({ shifts }: { shifts: PersonnelShift[] }) {
  if (shifts.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No schedule configured
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shifts
        .sort((a, b) => a.day_of_week - b.day_of_week)
        .map((shift, index) => (
          <div key={index} className="flex justify-between items-center text-sm">
            <span className="font-medium text-gray-700">
              {DAYS_OF_WEEK[shift.day_of_week]}
            </span>
            <span className="text-gray-600">
              {shift.start_time} - {shift.end_time}
              {shift.break_duration && shift.break_duration > 0 && (
                <span className="text-gray-400 ml-1">
                  ({shift.break_duration}min break)
                </span>
              )}
            </span>
          </div>
        ))}
    </div>
  );
}