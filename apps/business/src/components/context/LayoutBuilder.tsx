'use client';

import React, { useState, useRef, useCallback } from 'react';
import { StoreContextLayout, LayoutDepartment } from '@vocilia/types/src/context';
import { PlusIcon, TrashIcon, CursorArrowRaysIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';

interface LayoutBuilderProps {
  layout: StoreContextLayout;
  onChange: (layout: StoreContextLayout) => void;
  onSave: () => Promise<void>;
  isLoading?: boolean;
  errors?: Record<string, string>;
}

const DEPARTMENT_CATEGORIES = [
  { value: 'retail', label: 'Retail Area', color: '#3B82F6' },
  { value: 'service', label: 'Service Counter', color: '#10B981' },
  { value: 'storage', label: 'Storage/Warehouse', color: '#6B7280' },
  { value: 'office', label: 'Office', color: '#8B5CF6' },
  { value: 'dining', label: 'Dining Area', color: '#F59E0B' },
  { value: 'checkout', label: 'Checkout/POS', color: '#EF4444' },
  { value: 'entrance', label: 'Entrance/Exit', color: '#06B6D4' },
  { value: 'restroom', label: 'Restroom', color: '#84CC16' },
  { value: 'other', label: 'Other', color: '#64748B' }
] as const;

const LAYOUT_TEMPLATES = {
  retail_basic: {
    name: 'Basic Retail',
    departments: [
      { name: 'Entrance', category: 'entrance', x: 5, y: 5, width: 20, height: 10 },
      { name: 'Main Sales Floor', category: 'retail', x: 10, y: 20, width: 60, height: 50 },
      { name: 'Checkout', category: 'checkout', x: 75, y: 30, width: 20, height: 15 },
      { name: 'Storage', category: 'storage', x: 75, y: 70, width: 20, height: 25 }
    ]
  },
  restaurant: {
    name: 'Restaurant',
    departments: [
      { name: 'Entrance/Host', category: 'entrance', x: 5, y: 5, width: 15, height: 10 },
      { name: 'Dining Area', category: 'dining', x: 10, y: 20, width: 50, height: 60 },
      { name: 'Kitchen', category: 'service', x: 65, y: 30, width: 30, height: 40 },
      { name: 'Restrooms', category: 'restroom', x: 5, y: 85, width: 15, height: 10 }
    ]
  },
  service_center: {
    name: 'Service Center',
    departments: [
      { name: 'Reception', category: 'entrance', x: 5, y: 5, width: 30, height: 15 },
      { name: 'Service Counter', category: 'service', x: 40, y: 5, width: 50, height: 20 },
      { name: 'Waiting Area', category: 'other', x: 10, y: 30, width: 40, height: 30 },
      { name: 'Office', category: 'office', x: 60, y: 40, width: 35, height: 35 }
    ]
  }
};

export function LayoutBuilder({ 
  layout, 
  onChange, 
  onSave, 
  isLoading = false, 
  errors = {} 
}: LayoutBuilderProps) {
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateLayout = (updates: Partial<StoreContextLayout>) => {
    onChange({ ...layout, ...updates });
  };

  const addDepartment = () => {
    const newDepartment: LayoutDepartment = {
      name: `Department ${layout.departments.length + 1}`,
      category: 'retail',
      x_position: 10,
      y_position: 10,
      width: 20,
      height: 15,
      description: ''
    };
    
    updateLayout({
      departments: [...layout.departments, newDepartment]
    });
    setSelectedDepartment(layout.departments.length);
  };

  const updateDepartment = (index: number, updates: Partial<LayoutDepartment>) => {
    const updatedDepartments = layout.departments.map((dept, i) => 
      i === index ? { ...dept, ...updates } : dept
    );
    updateLayout({ departments: updatedDepartments });
  };

  const removeDepartment = (index: number) => {
    const updatedDepartments = layout.departments.filter((_, i) => i !== index);
    updateLayout({ departments: updatedDepartments });
    if (selectedDepartment === index) {
      setSelectedDepartment(null);
    } else if (selectedDepartment !== null && selectedDepartment > index) {
      setSelectedDepartment(selectedDepartment - 1);
    }
  };

  const applyTemplate = (templateKey: keyof typeof LAYOUT_TEMPLATES) => {
    const template = LAYOUT_TEMPLATES[templateKey];
    const templateDepartments: LayoutDepartment[] = template.departments.map(dept => ({
      name: dept.name,
      category: dept.category as any,
      x_position: dept.x,
      y_position: dept.y,
      width: dept.width,
      height: dept.height,
      description: ''
    }));
    
    updateLayout({
      name: layout.name || template.name,
      departments: templateDepartments
    });
    setShowTemplates(false);
  };

  const handleMouseDown = (e: React.MouseEvent, deptIndex: number) => {
    e.preventDefault();
    setSelectedDepartment(deptIndex);
    setIsDragging(true);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const dept = layout.departments[deptIndex];
      const canvasX = (e.clientX - rect.left) / rect.width * 100;
      const canvasY = (e.clientY - rect.top) / rect.height * 100;
      
      setDragOffset({
        x: canvasX - dept.x_position,
        y: canvasY - dept.y_position
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || selectedDepartment === null || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) / rect.width * 100;
    const canvasY = (e.clientY - rect.top) / rect.height * 100;
    
    const newX = Math.max(0, Math.min(100 - layout.departments[selectedDepartment].width, canvasX - dragOffset.x));
    const newY = Math.max(0, Math.min(100 - layout.departments[selectedDepartment].height, canvasY - dragOffset.y));
    
    updateDepartment(selectedDepartment, {
      x_position: Math.round(newX),
      y_position: Math.round(newY)
    });
  }, [isDragging, selectedDepartment, dragOffset, layout.departments]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        updateLayout({ image_url: imageUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const getCategoryColor = (category: string) => {
    const categoryData = DEPARTMENT_CATEGORIES.find(c => c.value === category);
    return categoryData?.color || '#64748B';
  };

  const renderDepartment = (dept: LayoutDepartment, index: number) => {
    const isSelected = selectedDepartment === index;
    const color = getCategoryColor(dept.category);
    
    return (
      <div
        key={index}
        className={`absolute border-2 cursor-move transition-all ${
          isSelected 
            ? 'border-blue-500 bg-blue-100 shadow-lg z-10' 
            : 'border-gray-300 bg-white hover:border-gray-400 hover:shadow-md'
        }`}
        style={{
          left: `${dept.x_position}%`,
          top: `${dept.y_position}%`,
          width: `${dept.width}%`,
          height: `${dept.height}%`,
          backgroundColor: isSelected ? `${color}20` : `${color}10`,
          borderColor: isSelected ? color : '#D1D5DB'
        }}
        onMouseDown={(e) => handleMouseDown(e, index)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedDepartment(index);
        }}
      >
        <div className="p-2 h-full flex flex-col justify-center items-center text-center">
          <div className="font-medium text-sm text-gray-800 leading-tight">
            {dept.name}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {DEPARTMENT_CATEGORIES.find(c => c.value === dept.category)?.label}
          </div>
        </div>
        
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeDepartment(index);
            }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
          >
            <TrashIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Store Layout</h2>
          <p className="text-sm text-gray-600">
            Design your store layout to help AI understand spatial context
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Templates ▼
            </button>
            
            {showTemplates && (
              <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg z-20">
                <div className="py-2">
                  {Object.entries(LAYOUT_TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      onClick={() => applyTemplate(key as keyof typeof LAYOUT_TEMPLATES)}
                      className="block w-full px-4 py-3 text-left hover:bg-gray-100"
                    >
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-gray-500">
                        {template.departments.length} departments
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={addDepartment}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <PlusIcon className="w-4 h-4" />
            Add Department
          </button>
        </div>
      </div>

      {/* Layout Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Layout Name
          </label>
          <input
            type="text"
            value={layout.name || ''}
            onChange={(e) => updateLayout({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Main Floor Layout"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Area (sq ft)
          </label>
          <input
            type="number"
            min="1"
            value={layout.total_area_sqft || ''}
            onChange={(e) => updateLayout({ 
              total_area_sqft: e.target.value ? parseFloat(e.target.value) : undefined 
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="1200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Layout Image
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <DocumentArrowUpIcon className="w-4 h-4" />
            Upload Image
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          rows={2}
          value={layout.description || ''}
          onChange={(e) => updateLayout({ description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="Describe the overall layout and flow..."
        />
      </div>

      {/* Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Layout Canvas */}
        <div className="lg:col-span-2">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Store Layout</h3>
                <div className="text-xs text-gray-500">
                  {layout.departments.length} departments
                </div>
              </div>
            </div>
            
            <div 
              ref={canvasRef}
              className="relative bg-white aspect-square cursor-pointer"
              style={{ 
                backgroundImage: layout.image_url ? `url(${layout.image_url})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
              onClick={() => setSelectedDepartment(null)}
            >
              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full">
                  <defs>
                    <pattern id="grid" width="10%" height="10%" patternUnits="userSpaceOnUse">
                      <path d="M 0 0 L 0 100 L 100 100" fill="none" stroke="#E5E7EB" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>
              
              {/* Departments */}
              {layout.departments.map((dept, index) => renderDepartment(dept, index))}
              
              {/* Empty state */}
              {layout.departments.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <CursorArrowRaysIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>Click "Add Department" to start building your layout</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Department Properties Panel */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">
            {selectedDepartment !== null ? 'Edit Department' : 'Department Properties'}
          </h3>
          
          {selectedDepartment !== null ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={layout.departments[selectedDepartment].name}
                  onChange={(e) => updateDepartment(selectedDepartment, { name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={layout.departments[selectedDepartment].category}
                  onChange={(e) => updateDepartment(selectedDepartment, { category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {DEPARTMENT_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    X Position
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={layout.departments[selectedDepartment].x_position}
                    onChange={(e) => updateDepartment(selectedDepartment, { 
                      x_position: parseInt(e.target.value) || 0 
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Y Position
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={layout.departments[selectedDepartment].y_position}
                    onChange={(e) => updateDepartment(selectedDepartment, { 
                      y_position: parseInt(e.target.value) || 0 
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Width
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={layout.departments[selectedDepartment].width}
                    onChange={(e) => updateDepartment(selectedDepartment, { 
                      width: parseInt(e.target.value) || 1 
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={layout.departments[selectedDepartment].height}
                    onChange={(e) => updateDepartment(selectedDepartment, { 
                      height: parseInt(e.target.value) || 1 
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={layout.departments[selectedDepartment].description || ''}
                  onChange={(e) => updateDepartment(selectedDepartment, { description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe this area..."
                />
              </div>

              <button
                onClick={() => removeDepartment(selectedDepartment)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-2"
              >
                <TrashIcon className="w-4 h-4" />
                Remove Department
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Select a department to edit its properties</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Department Categories</h4>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {DEPARTMENT_CATEGORIES.map(cat => (
            <div key={cat.value} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded border"
                style={{ backgroundColor: `${cat.color}30`, borderColor: cat.color }}
              />
              <span className="text-xs text-gray-700">{cat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <button
          onClick={onSave}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save Layout'}
        </button>
      </div>
    </div>
  );
}