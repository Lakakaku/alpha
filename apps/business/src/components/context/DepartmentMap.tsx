'use client';

import React, { useState, useRef } from 'react';
import { LayoutDepartment } from '@vocilia/types/src/context';
import { MapPinIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline';

interface DepartmentMapProps {
  departments: LayoutDepartment[];
  onDepartmentUpdate?: (index: number, updates: Partial<LayoutDepartment>) => void;
  onDepartmentSelect?: (index: number | null) => void;
  selectedDepartment?: number | null;
  readonly?: boolean;
  showGrid?: boolean;
  backgroundImage?: string;
  className?: string;
}

const DEPARTMENT_COLORS = {
  retail: '#3B82F6',
  service: '#10B981',
  storage: '#6B7280',
  office: '#8B5CF6',
  dining: '#F59E0B',
  checkout: '#EF4444',
  entrance: '#06B6D4',
  restroom: '#84CC16',
  other: '#64748B'
} as const;

export function DepartmentMap({
  departments,
  onDepartmentUpdate,
  onDepartmentSelect,
  selectedDepartment,
  readonly = false,
  showGrid = true,
  backgroundImage,
  className = ''
}: DepartmentMapProps) {
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    departmentIndex: number;
    offset: { x: number; y: number };
  } | null>(null);
  
  const mapRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent, deptIndex: number) => {
    if (readonly || !onDepartmentUpdate) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const dept = departments[deptIndex];
    const mouseX = (e.clientX - rect.left) / rect.width * 100;
    const mouseY = (e.clientY - rect.top) / rect.height * 100;
    
    setDragState({
      isDragging: true,
      departmentIndex: deptIndex,
      offset: {
        x: mouseX - dept.x_position,
        y: mouseY - dept.y_position
      }
    });
    
    onDepartmentSelect?.(deptIndex);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState?.isDragging || readonly || !onDepartmentUpdate) return;
    
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = (e.clientX - rect.left) / rect.width * 100;
    const mouseY = (e.clientY - rect.top) / rect.height * 100;
    
    const dept = departments[dragState.departmentIndex];
    const newX = Math.max(0, Math.min(100 - dept.width, mouseX - dragState.offset.x));
    const newY = Math.max(0, Math.min(100 - dept.height, mouseY - dragState.offset.y));
    
    onDepartmentUpdate(dragState.departmentIndex, {
      x_position: Math.round(newX),
      y_position: Math.round(newY)
    });
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  const handleMapClick = (e: React.MouseEvent) => {
    if (e.target === mapRef.current) {
      onDepartmentSelect?.(null);
    }
  };

  const getDepartmentColor = (category: keyof typeof DEPARTMENT_COLORS): string => {
    return DEPARTMENT_COLORS[category] || DEPARTMENT_COLORS.other;
  };

  const checkOverlap = (dept1: LayoutDepartment, dept2: LayoutDepartment): boolean => {
    return !(
      dept1.x_position + dept1.width <= dept2.x_position ||
      dept2.x_position + dept2.width <= dept1.x_position ||
      dept1.y_position + dept1.height <= dept2.y_position ||
      dept2.y_position + dept2.height <= dept1.y_position
    );
  };

  const getOverlappingDepartments = (deptIndex: number): number[] => {
    const dept = departments[deptIndex];
    return departments
      .map((other, index) => ({ department: other, index }))
      .filter(({ department, index }) => 
        index !== deptIndex && checkOverlap(dept, department)
      )
      .map(({ index }) => index);
  };

  return (
    <div className={`relative bg-gray-50 border rounded-lg overflow-hidden ${className}`}>
      {/* Map Container */}
      <div
        ref={mapRef}
        className="relative w-full aspect-square bg-white cursor-pointer"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleMapClick}
      >
        {/* Grid Overlay */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none opacity-30">
            <svg className="w-full h-full">
              <defs>
                <pattern id="grid" width="10%" height="10%" patternUnits="userSpaceOnUse">
                  <path d="M 0 0 L 0 100 L 100 100" fill="none" stroke="#E5E7EB" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        )}

        {/* Department Overlays */}
        {departments.map((dept, index) => {
          const isSelected = selectedDepartment === index;
          const isDragging = dragState?.departmentIndex === index;
          const overlapping = getOverlappingDepartments(index);
          const hasOverlap = overlapping.length > 0;
          const color = getDepartmentColor(dept.category);
          
          return (
            <div
              key={index}
              className={`absolute border-2 transition-all ${
                isSelected 
                  ? 'border-blue-500 shadow-lg z-20' 
                  : hasOverlap
                  ? 'border-red-400 z-10'
                  : 'border-gray-300 hover:border-gray-400 z-0'
              } ${
                readonly ? 'cursor-pointer' : 'cursor-move'
              } ${
                isDragging ? 'opacity-80' : ''
              }`}
              style={{
                left: `${dept.x_position}%`,
                top: `${dept.y_position}%`,
                width: `${dept.width}%`,
                height: `${dept.height}%`,
                backgroundColor: hasOverlap 
                  ? '#FEE2E2' 
                  : isSelected 
                  ? `${color}30` 
                  : `${color}15`,
                borderColor: hasOverlap 
                  ? '#EF4444' 
                  : isSelected 
                  ? color 
                  : '#D1D5DB'
              }}
              onMouseDown={(e) => handleMouseDown(e, index)}
              onClick={(e) => {
                e.stopPropagation();
                if (!dragState?.isDragging) {
                  onDepartmentSelect?.(index);
                }
              }}
            >
              {/* Department Content */}
              <div className="h-full flex flex-col justify-center items-center text-center p-1">
                <div 
                  className="font-medium text-xs leading-tight"
                  style={{ 
                    color: isSelected ? color : '#374151',
                    fontSize: Math.max(8, Math.min(dept.width * 0.8, dept.height * 0.6))
                  }}
                >
                  {dept.name}
                </div>
                
                {/* Show icon for small departments */}
                {(dept.width < 15 || dept.height < 10) && (
                  <MapPinIcon 
                    className="w-3 h-3 mt-1" 
                    style={{ color: color }}
                  />
                )}
              </div>

              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute -top-1 -right-1">
                  <div 
                    className="w-3 h-3 rounded-full border-2 border-white"
                    style={{ backgroundColor: color }}
                  />
                </div>
              )}

              {/* Overlap Warning */}
              {hasOverlap && (
                <div className="absolute -top-1 -left-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                </div>
              )}

              {/* Resize Handles (only when selected and not readonly) */}
              {isSelected && !readonly && (
                <>
                  {/* Corner handles */}
                  <div 
                    className="absolute -bottom-1 -right-1 w-3 h-3 border-2 border-white rounded-full cursor-se-resize"
                    style={{ backgroundColor: color }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      // TODO: Implement resize functionality
                    }}
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {departments.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MapPinIcon className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">No departments mapped</p>
            </div>
          </div>
        )}
      </div>

      {/* Overlap Warnings */}
      {departments.some((_, index) => getOverlappingDepartments(index).length > 0) && (
        <div className="absolute top-2 left-2 bg-red-100 border border-red-300 rounded-md p-2">
          <div className="flex items-center gap-1 text-red-800 text-xs">
            <span className="font-medium">⚠️ Overlapping departments detected</span>
          </div>
        </div>
      )}

      {/* Department Info Panel */}
      {selectedDepartment !== null && departments[selectedDepartment] && (
        <div className="absolute top-2 right-2 bg-white border border-gray-300 rounded-md shadow-lg p-3 max-w-xs">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium text-sm text-gray-900">
              {departments[selectedDepartment].name}
            </h4>
            <div className="flex items-center gap-1">
              {readonly ? (
                <EyeIcon className="w-4 h-4 text-gray-400" />
              ) : (
                <PencilIcon className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
          
          <div className="space-y-1 text-xs text-gray-600">
            <div>
              <span className="font-medium">Category:</span> {departments[selectedDepartment].category}
            </div>
            <div>
              <span className="font-medium">Position:</span> {departments[selectedDepartment].x_position}%, {departments[selectedDepartment].y_position}%
            </div>
            <div>
              <span className="font-medium">Size:</span> {departments[selectedDepartment].width}% × {departments[selectedDepartment].height}%
            </div>
            {departments[selectedDepartment].description && (
              <div>
                <span className="font-medium">Description:</span> {departments[selectedDepartment].description}
              </div>
            )}
          </div>

          {/* Overlap Info */}
          {getOverlappingDepartments(selectedDepartment).length > 0 && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
              <div className="text-red-800 font-medium">Overlapping with:</div>
              <div className="text-red-700">
                {getOverlappingDepartments(selectedDepartment)
                  .map(index => departments[index].name)
                  .join(', ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Utility component for displaying department statistics
export function DepartmentStats({ departments }: { departments: LayoutDepartment[] }) {
  const stats = departments.reduce((acc, dept) => {
    acc[dept.category] = (acc[dept.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalArea = departments.reduce((sum, dept) => sum + (dept.width * dept.height), 0);
  const overlaps = departments.filter((_, index) => {
    return departments.some((other, otherIndex) => {
      if (index === otherIndex) return false;
      return !(
        dept.x_position + dept.width <= other.x_position ||
        other.x_position + other.width <= dept.x_position ||
        dept.y_position + dept.height <= other.y_position ||
        other.y_position + other.height <= dept.y_position
      );
    });
  }).length;

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Layout Statistics</h4>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-600 font-medium">{departments.length}</div>
          <div className="text-gray-500">Total Departments</div>
        </div>
        
        <div>
          <div className="text-gray-600 font-medium">{Object.keys(stats).length}</div>
          <div className="text-gray-500">Categories</div>
        </div>
        
        <div>
          <div className="text-gray-600 font-medium">{totalArea.toFixed(0)}%</div>
          <div className="text-gray-500">Coverage</div>
        </div>
        
        <div>
          <div className={`font-medium ${overlaps > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {overlaps}
          </div>
          <div className="text-gray-500">Overlaps</div>
        </div>
      </div>

      {Object.keys(stats).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-2">By Category:</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats).map(([category, count]) => (
              <span 
                key={category}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                style={{
                  backgroundColor: `${getDepartmentColor(category as keyof typeof DEPARTMENT_COLORS)}20`,
                  color: getDepartmentColor(category as keyof typeof DEPARTMENT_COLORS)
                }}
              >
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getDepartmentColor(category as keyof typeof DEPARTMENT_COLORS) }}
                />
                {category}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getDepartmentColor(category: keyof typeof DEPARTMENT_COLORS): string {
  return DEPARTMENT_COLORS[category] || DEPARTMENT_COLORS.other;
}