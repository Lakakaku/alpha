'use client';

import React, { useState } from 'react';
import { StoreContextInventory, InventoryCategory } from '@vocilia/types/src/context';
import { PlusIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface InventoryFormProps {
  inventory: StoreContextInventory;
  onChange: (inventory: StoreContextInventory) => void;
  onSave: () => Promise<void>;
  isLoading?: boolean;
  errors?: Record<string, string>;
}

const PRIORITY_LEVELS = [
  { value: 'high', label: 'High Priority', color: 'bg-red-100 text-red-800' },
  { value: 'medium', label: 'Medium Priority', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'low', label: 'Low Priority', color: 'bg-green-100 text-green-800' }
] as const;

const COMMON_CATEGORIES = [
  'Clothing & Apparel',
  'Electronics',
  'Home & Garden',
  'Health & Beauty',
  'Sports & Outdoors',
  'Food & Beverages',
  'Books & Media',
  'Automotive',
  'Office Supplies',
  'Toys & Games',
  'Jewelry & Accessories',
  'Pet Supplies'
];

export function InventoryForm({
  inventory,
  onChange,
  onSave,
  isLoading = false,
  errors = {}
}: InventoryFormProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const updateInventory = (updates: Partial<StoreContextInventory>) => {
    onChange({ ...inventory, ...updates });
  };

  const addCategory = (preset?: string) => {
    const newCategory: InventoryCategory = {
      name: preset || '',
      description: '',
      priority: 'medium',
      seasonal: false,
      target_margin: undefined,
      parent_category: undefined
    };

    updateInventory({
      categories: [...(inventory.categories || []), newCategory]
    });

    // Expand the new category
    setExpandedCategories(prev => new Set([...prev, (inventory.categories || []).length]));
  };

  const updateCategory = (index: number, updates: Partial<InventoryCategory>) => {
    const updatedCategories = (inventory.categories || []).map((cat, i) =>
      i === index ? { ...cat, ...updates } : cat
    );
    updateInventory({ categories: updatedCategories });
  };

  const removeCategory = (index: number) => {
    const categoryToRemove = inventory.categories?.[index];
    if (!categoryToRemove) return;

    // Remove this category and update any children
    const updatedCategories = (inventory.categories || [])
      .filter((_, i) => i !== index)
      .map(cat => ({
        ...cat,
        parent_category: cat.parent_category === categoryToRemove.name ? undefined : cat.parent_category
      }));

    updateInventory({ categories: updatedCategories });

    // Remove from expanded set
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      // Adjust indices for categories after the removed one
      const adjustedSet = new Set();
      newSet.forEach(expandedIndex => {
        adjustedSet.add(expandedIndex > index ? expandedIndex - 1 : expandedIndex);
      });
      return adjustedSet;
    });
  };

  const toggleExpanded = (index: number) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getAvailableParentCategories = (currentIndex: number): InventoryCategory[] => {
    if (!inventory.categories) return [];
    
    return inventory.categories.filter((cat, index) => {
      // Can't be parent of itself
      if (index === currentIndex) return false;
      
      // Can't create circular dependencies
      const currentCategory = inventory.categories[currentIndex];
      if (currentCategory && cat.parent_category === currentCategory.name) return false;
      
      return true;
    });
  };

  const getCategoryHierarchy = (): { category: InventoryCategory; index: number; level: number }[] => {
    if (!inventory.categories) return [];

    const result: { category: InventoryCategory; index: number; level: number }[] = [];
    const processed = new Set<number>();

    const addCategoryAndChildren = (category: InventoryCategory, index: number, level: number) => {
      if (processed.has(index)) return;
      
      result.push({ category, index, level });
      processed.add(index);

      // Find children
      inventory.categories?.forEach((childCat, childIndex) => {
        if (childCat.parent_category === category.name && !processed.has(childIndex)) {
          addCategoryAndChildren(childCat, childIndex, level + 1);
        }
      });
    };

    // First add all top-level categories (no parent)
    inventory.categories.forEach((cat, index) => {
      if (!cat.parent_category) {
        addCategoryAndChildren(cat, index, 0);
      }
    });

    // Then add any orphaned categories (parent doesn't exist)
    inventory.categories.forEach((cat, index) => {
      if (!processed.has(index)) {
        addCategoryAndChildren(cat, index, 0);
      }
    });

    return result;
  };

  const renderCategoryCard = (category: InventoryCategory, index: number, level: number = 0) => {
    const isExpanded = expandedCategories.has(index);
    const priorityInfo = PRIORITY_LEVELS.find(p => p.value === category.priority);
    const availableParents = getAvailableParentCategories(index);

    return (
      <div 
        key={index} 
        className={`border rounded-lg bg-white shadow-sm ${level > 0 ? 'ml-6 border-l-4 border-l-blue-200' : ''}`}
      >
        {/* Category Header */}
        <div 
          className="p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleExpanded(index)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center">
                {isExpanded ? (
                  <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                )}
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900">
                  {category.name || `Category ${index + 1}`}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityInfo?.color}`}>
                    {priorityInfo?.label}
                  </span>
                  {category.seasonal && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Seasonal
                    </span>
                  )}
                  {category.parent_category && (
                    <span className="text-xs text-gray-500">
                      under {category.parent_category}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeCategory(index);
              }}
              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expanded Category Details */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={category.name}
                  onChange={(e) => updateCategory(index, { name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Category name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority *
                </label>
                <select
                  value={category.priority}
                  onChange={(e) => updateCategory(index, { priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {PRIORITY_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Category
                </label>
                <select
                  value={category.parent_category || ''}
                  onChange={(e) => updateCategory(index, { 
                    parent_category: e.target.value || undefined 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No parent (top-level)</option>
                  {availableParents.map((parent, parentIndex) => (
                    <option key={parentIndex} value={parent.name}>
                      {parent.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Margin (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={category.target_margin || ''}
                  onChange={(e) => updateCategory(index, { 
                    target_margin: e.target.value ? parseFloat(e.target.value) : undefined 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 25.5"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={category.description || ''}
                  onChange={(e) => updateCategory(index, { description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe this category..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={category.seasonal || false}
                    onChange={(e) => updateCategory(index, { seasonal: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Seasonal category (sales vary by season)
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const hierarchicalCategories = getCategoryHierarchy();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Product Inventory</h2>
          <p className="text-sm text-gray-600">
            Define your product categories to help AI understand your inventory
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Quick Add ▼
            </button>
            
            {showQuickAdd && (
              <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                <div className="py-2 max-h-60 overflow-y-auto">
                  {COMMON_CATEGORIES.map(category => (
                    <button
                      key={category}
                      onClick={() => {
                        addCategory(category);
                        setShowQuickAdd(false);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => addCategory()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <PlusIcon className="w-4 h-4" />
            Add Category
          </button>
        </div>
      </div>

      {/* Category List */}
      <div className="space-y-4">
        {hierarchicalCategories.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-gray-500">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                📦
              </div>
              <p>No inventory categories added yet</p>
              <p className="text-sm text-gray-400">Click "Add Category" to get started</p>
            </div>
          </div>
        ) : (
          hierarchicalCategories.map(({ category, index, level }) => 
            renderCategoryCard(category, index, level)
          )
        )}
      </div>

      {/* Strategic Information */}
      <div className="space-y-4">
        <h3 className="text-md font-medium text-gray-900">Business Strategy</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Seasonal Patterns
          </label>
          <textarea
            rows={3}
            value={inventory.seasonal_patterns || ''}
            onChange={(e) => updateInventory({ seasonal_patterns: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe how your inventory changes with seasons, holidays, or market trends..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supplier Preferences
          </label>
          <textarea
            rows={3}
            value={inventory.supplier_preferences || ''}
            onChange={(e) => updateInventory({ supplier_preferences: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Preferred suppliers, sourcing strategies, quality requirements..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pricing Strategy
          </label>
          <textarea
            rows={3}
            value={inventory.pricing_strategy || ''}
            onChange={(e) => updateInventory({ pricing_strategy: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Pricing approach, competitive positioning, margin targets..."
          />
        </div>
      </div>

      {/* Summary Stats */}
      {(inventory.categories?.length || 0) > 0 && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Inventory Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-blue-600 font-semibold">{inventory.categories?.length || 0}</div>
              <div className="text-blue-800">Total Categories</div>
            </div>
            <div>
              <div className="text-blue-600 font-semibold">
                {inventory.categories?.filter(c => c.priority === 'high').length || 0}
              </div>
              <div className="text-blue-800">High Priority</div>
            </div>
            <div>
              <div className="text-blue-600 font-semibold">
                {inventory.categories?.filter(c => c.seasonal).length || 0}
              </div>
              <div className="text-blue-800">Seasonal</div>
            </div>
            <div>
              <div className="text-blue-600 font-semibold">
                {inventory.categories?.filter(c => !c.parent_category).length || 0}
              </div>
              <div className="text-blue-800">Top-Level</div>
            </div>
          </div>
          
          {/* Priority Breakdown */}
          <div className="mt-3 pt-3 border-t border-blue-200">
            <div className="flex flex-wrap gap-2">
              {PRIORITY_LEVELS.map(priority => {
                const count = inventory.categories?.filter(c => c.priority === priority.value).length || 0;
                return (
                  <span key={priority.value} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priority.color}`}>
                    {priority.label}: {count}
                  </span>
                );
              })}
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
          {isLoading ? 'Saving...' : 'Save Inventory'}
        </button>
      </div>
    </div>
  );
}