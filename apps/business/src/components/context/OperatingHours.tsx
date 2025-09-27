'use client';

import React, { memo, useCallback, useMemo } from 'react';
import { OperatingHours } from '@vocilia/types/src/context';

interface OperatingHoursProps {
  hours: OperatingHours[];
  onChange: (hours: OperatingHours[]) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
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

const PRESET_HOURS = {
  standard: { open: '09:00', close: '17:00' },
  extended: { open: '08:00', close: '20:00' },
  restaurant: { open: '11:00', close: '22:00' },
  retail: { open: '10:00', close: '19:00' },
  early: { open: '06:00', close: '14:00' }
};

const OperatingHoursSelectorComponent = ({ 
  hours, 
  onChange, 
  errors = {}, 
  disabled = false 
}: OperatingHoursProps) {
  
  const handleDayChange = (dayIndex: number, field: keyof OperatingHours, value: any) => {
    const newHours = hours.map((dayHours, index) => 
      index === dayIndex ? { ...dayHours, [field]: value } : dayHours
    );
    onChange(newHours);
  };

  const applyPreset = (preset: keyof typeof PRESET_HOURS) => {
    const presetTimes = PRESET_HOURS[preset];
    const newHours = hours.map(dayHours => ({
      ...dayHours,
      ...(dayHours.is_closed ? {} : presetTimes)
    }));
    onChange(newHours);
  };

  const copyToAllDays = (sourceDay: number) => {
    const sourceHours = hours[sourceDay];
    const newHours = hours.map((dayHours, index) => ({
      ...dayHours,
      ...(index === sourceDay ? {} : {
        open_time: sourceHours.open_time,
        close_time: sourceHours.close_time,
        is_closed: sourceHours.is_closed
      })
    }));
    onChange(newHours);
  };

  const setWeekdaysWeekends = () => {
    const newHours = hours.map((dayHours, index) => {
      if (index === 0 || index === 6) { // Sunday and Saturday
        return {
          ...dayHours,
          open_time: '10:00',
          close_time: '18:00',
          is_closed: false
        };
      } else { // Monday - Friday
        return {
          ...dayHours,
          open_time: '09:00',
          close_time: '17:00',
          is_closed: false
        };
      }
    });
    onChange(newHours);
  };

  const toggleAllDays = (closed: boolean) => {
    const newHours = hours.map(dayHours => ({
      ...dayHours,
      is_closed: closed
    }));
    onChange(newHours);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Operating Hours
        </label>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <select 
            onChange={(e) => e.target.value && applyPreset(e.target.value as keyof typeof PRESET_HOURS)}
            className="text-xs px-2 py-1 border border-gray-300 rounded"
            disabled={disabled}
            defaultValue=""
          >
            <option value="">Apply preset</option>
            <option value="standard">Standard (9-5)</option>
            <option value="extended">Extended (8-8)</option>
            <option value="restaurant">Restaurant (11-10)</option>
            <option value="retail">Retail (10-7)</option>
            <option value="early">Early (6-2)</option>
          </select>
          
          <button
            type="button"
            onClick={setWeekdaysWeekends}
            className="text-xs px-2 py-1 text-blue-600 hover:text-blue-800"
            disabled={disabled}
          >
            Weekdays/Weekends
          </button>
        </div>
      </div>

      {errors.operating_hours_general && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-600">{errors.operating_hours_general}</p>
        </div>
      )}
      
      <div className="space-y-2">
        {hours.map((dayHours, index) => (
          <div key={index} className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
            <div className="w-24 text-sm font-medium text-gray-700">
              {DAYS_OF_WEEK[index]}
            </div>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dayHours.is_closed}
                onChange={(e) => handleDayChange(index, 'is_closed', e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Closed</span>
            </label>
            
            {!dayHours.is_closed && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Open</label>
                  <input
                    type="time"
                    value={dayHours.open_time}
                    onChange={(e) => handleDayChange(index, 'open_time', e.target.value)}
                    disabled={disabled}
                    className={`px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors[`operating_hours_${index}_open`] 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-gray-300'
                    }`}
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Close</label>
                  <input
                    type="time"
                    value={dayHours.close_time}
                    onChange={(e) => handleDayChange(index, 'close_time', e.target.value)}
                    disabled={disabled}
                    className={`px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors[`operating_hours_${index}_close`] 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-gray-300'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => copyToAllDays(index)}
                  disabled={disabled}
                  className="text-xs px-2 py-1 text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:bg-blue-50"
                  title="Copy to all days"
                >
                  Copy
                </button>
              </>
            )}
            
            {/* Error messages for this day */}
            {(errors[`operating_hours_${index}_open`] || 
              errors[`operating_hours_${index}_close`] || 
              errors[`operating_hours_${index}`]) && (
              <div className="ml-auto">
                {errors[`operating_hours_${index}_open`] && (
                  <p className="text-xs text-red-600">{errors[`operating_hours_${index}_open`]}</p>
                )}
                {errors[`operating_hours_${index}_close`] && (
                  <p className="text-xs text-red-600">{errors[`operating_hours_${index}_close`]}</p>
                )}
                {errors[`operating_hours_${index}`] && (
                  <p className="text-xs text-red-600">{errors[`operating_hours_${index}`]}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions Footer */}
      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleAllDays(false)}
            disabled={disabled}
            className="text-sm px-3 py-1 text-green-600 hover:text-green-800 border border-green-200 rounded hover:bg-green-50"
          >
            Open All Days
          </button>
          <button
            type="button"
            onClick={() => toggleAllDays(true)}
            disabled={disabled}
            className="text-sm px-3 py-1 text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50"
          >
            Close All Days
          </button>
        </div>

        <div className="text-xs text-gray-500">
          {hours.filter(h => !h.is_closed).length} days open
        </div>
      </div>

      {/* Summary Display */}
      <div className="bg-blue-50 rounded-lg p-3">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Schedule Summary</h4>
        <div className="text-xs text-blue-800 space-y-1">
          {hours.map((dayHours, index) => (
            <div key={index} className="flex justify-between">
              <span className="font-medium">{DAYS_OF_WEEK[index]}:</span>
              <span>
                {dayHours.is_closed 
                  ? 'Closed' 
                  : `${dayHours.open_time} - ${dayHours.close_time}`
                }
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Utility component for displaying read-only hours
export function OperatingHoursDisplay({ hours }: { hours: OperatingHours[] }) {
  return (
    <div className="space-y-2">
      {hours.map((dayHours, index) => (
        <div key={index} className="flex justify-between items-center py-1">
          <span className="text-sm font-medium text-gray-700">
            {DAYS_OF_WEEK[index]}
          </span>
          <span className="text-sm text-gray-600">
            {dayHours.is_closed 
              ? 'Closed' 
              : `${dayHours.open_time} - ${dayHours.close_time}`
            }
          </span>
        </div>
      ))}
    </div>
  );
}

// Utility function to format hours for display
export function formatOperatingHours(hours: OperatingHours[]): string {
  const openDays = hours.filter(h => !h.is_closed);
  
  if (openDays.length === 0) {
    return 'Closed all week';
  }
  
  if (openDays.length === 7) {
    // Check if all days have same hours
    const firstDay = openDays[0];
    const allSameHours = openDays.every(
      h => h.open_time === firstDay.open_time && h.close_time === firstDay.close_time
    );
    
    if (allSameHours) {
      return `Daily ${firstDay.open_time} - ${firstDay.close_time}`;
    }
  }
  
  // Group consecutive days with same hours
  const groups: string[] = [];
  let currentGroup: { days: number[]; hours: string } | null = null;
  
  hours.forEach((dayHours, index) => {
    const hoursString = dayHours.is_closed 
      ? 'Closed' 
      : `${dayHours.open_time} - ${dayHours.close_time}`;
    
    if (!currentGroup || currentGroup.hours !== hoursString) {
      if (currentGroup) {
        groups.push(formatDayGroup(currentGroup.days, currentGroup.hours));
      }
      currentGroup = { days: [index], hours: hoursString };
    } else {
      currentGroup.days.push(index);
    }
  });
  
  if (currentGroup) {
    groups.push(formatDayGroup(currentGroup.days, currentGroup.hours));
  }
  
  return groups.join(', ');
}

function formatDayGroup(days: number[], hours: string): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  if (days.length === 1) {
    return `${dayNames[days[0]]}: ${hours}`;
  }
  
  // Check for consecutive days
  const isConsecutive = days.every((day, index) => 
    index === 0 || day === days[index - 1] + 1
  );
  
  if (isConsecutive) {
    return `${dayNames[days[0]]}-${dayNames[days[days.length - 1]]}: ${hours}`;
  } else {
    return `${days.map(d => dayNames[d]).join(', ')}: ${hours}`;
  }
};

// Memoized components
export const OperatingHoursSelector = memo(OperatingHoursSelectorComponent);
OperatingHoursSelector.displayName = 'OperatingHoursSelector';

const OperatingHoursDisplayComponent = memo(({ hours }: { hours: OperatingHours[] }) => {
  const groupedHours = useMemo(() => groupHoursBySchedule(hours), [hours]);
  
  return (
    <div className="space-y-2">
      {groupedHours.length > 0 ? (
        groupedHours.map((group, index) => (
          <div key={index} className="text-sm text-gray-600">
            {group}
          </div>
        ))
      ) : (
        <div className="text-sm text-gray-500">No operating hours set</div>
      )}
    </div>
  );
});

OperatingHoursDisplayComponent.displayName = 'OperatingHoursDisplay';
export { OperatingHoursDisplayComponent as OperatingHoursDisplay };