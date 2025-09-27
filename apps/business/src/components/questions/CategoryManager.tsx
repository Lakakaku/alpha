'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@vocilia/ui/components/button';
import { Input } from '@vocilia/ui/components/input';
import { Label } from '@vocilia/ui/components/label';
import { Textarea } from '@vocilia/ui/components/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui/components/card';
import { Badge } from '@vocilia/ui/components/badge';
import { Alert, AlertDescription } from '@vocilia/ui/components/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@vocilia/ui/components/dialog';
import { QuestionCategory } from '@vocilia/types';
import { PlusIcon, EditIcon, TrashIcon, StarIcon, PaletteIcon, BarChart3Icon } from 'lucide-react';

export interface CategoryManagerProps {
  categories: QuestionCategory[];
  onCreateCategory: (category: Omit<QuestionCategory, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateCategory: (categoryId: string, updates: Partial<QuestionCategory>) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onSetDefault: (categoryId: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  isDefault: boolean;
}

const defaultColors = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6B7280', // Gray
];

const initialFormData: CategoryFormData = {
  name: '',
  description: '',
  color: defaultColors[0],
  isDefault: false,
};

export function CategoryManager({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onSetDefault,
  loading = false,
  error = null,
}: CategoryManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialogs close
  useEffect(() => {
    if (!isCreateDialogOpen && !isEditDialogOpen) {
      setFormData(initialFormData);
      setFormErrors({});
      setSelectedCategory(null);
    }
  }, [isCreateDialogOpen, isEditDialogOpen]);

  // Populate form when editing
  useEffect(() => {
    if (selectedCategory && isEditDialogOpen) {
      setFormData({
        name: selectedCategory.name,
        description: selectedCategory.description || '',
        color: selectedCategory.color,
        isDefault: selectedCategory.isDefault || false,
      });
    }
  }, [selectedCategory, isEditDialogOpen]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Category name is required';
    } else if (formData.name.length > 50) {
      errors.name = 'Category name must be 50 characters or less';
    }

    // Check for duplicate names (excluding current category when editing)
    const isDuplicate = categories.some(cat => 
      cat.name.toLowerCase() === formData.name.toLowerCase().trim() &&
      cat.id !== selectedCategory?.id
    );
    
    if (isDuplicate) {
      errors.name = 'A category with this name already exists';
    }

    if (formData.description && formData.description.length > 200) {
      errors.description = 'Description must be 200 characters or less';
    }

    // Validate hex color
    const hexRegex = /^#[0-9A-F]{6}$/i;
    if (!hexRegex.test(formData.color)) {
      errors.color = 'Please enter a valid hex color code';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onCreateCategory({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
        isDefault: formData.isDefault,
      });
      setIsCreateDialogOpen(false);
    } catch (err) {
      console.error('Error creating category:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedCategory || !validateForm()) return;

    setIsSubmitting(true);
    try {
      await onUpdateCategory(selectedCategory.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
        isDefault: formData.isDefault,
      });
      setIsEditDialogOpen(false);
    } catch (err) {
      console.error('Error updating category:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    setIsSubmitting(true);
    try {
      await onDeleteCategory(selectedCategory.id);
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.error('Error deleting category:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (categoryId: string) => {
    try {
      await onSetDefault(categoryId);
    } catch (err) {
      console.error('Error setting default category:', err);
    }
  };

  const openEditDialog = (category: QuestionCategory) => {
    setSelectedCategory(category);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (category: QuestionCategory) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  const getCategoryStats = (category: QuestionCategory) => {
    // These would normally come from the API
    return {
      questionCount: category.questionCount || 0,
      activeQuestions: Math.floor((category.questionCount || 0) * 0.7),
      responseCount: Math.floor((category.questionCount || 0) * 15),
    };
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Question Categories</h2>
          <p className="text-gray-600">Organize your questions into categories for better management</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Category
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Category</DialogTitle>
              <DialogDescription>
                Add a new category to organize your questions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Category Name *</Label>
                <Input
                  id="create-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter category name"
                  className={formErrors.name ? 'border-red-500' : ''}
                />
                {formErrors.name && (
                  <p className="text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-description">Description</Label>
                <Textarea
                  id="create-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                  className={formErrors.description ? 'border-red-500' : ''}
                />
                {formErrors.description && (
                  <p className="text-sm text-red-600">{formErrors.description}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-color">Color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="create-color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-10 p-1 border rounded"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    placeholder="#3B82F6"
                    className={`flex-1 ${formErrors.color ? 'border-red-500' : ''}`}
                  />
                </div>
                {formErrors.color && (
                  <p className="text-sm text-red-600">{formErrors.color}</p>
                )}
                
                <div className="flex flex-wrap gap-2 mt-2">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      className={`
                        w-6 h-6 rounded border-2 transition-transform hover:scale-110
                        ${formData.color === color ? 'border-gray-900' : 'border-gray-300'}
                      `}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting || loading}
              >
                {isSubmitting ? 'Creating...' : 'Create Category'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <PaletteIcon className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No categories yet</h3>
            <p className="text-gray-600 text-center mb-4">
              Create your first category to start organizing your questions
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => {
            const stats = getCategoryStats(category);
            
            return (
              <Card key={category.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <div>
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        {category.isDefault && (
                          <Badge variant="secondary" className="mt-1">
                            <StarIcon className="w-3 h-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(category)}
                      >
                        <EditIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(category)}
                        disabled={category.isDefault || stats.questionCount > 0}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {category.description && (
                    <CardDescription className="mt-2">
                      {category.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Questions</span>
                      <span className="font-medium">{stats.questionCount}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Active</span>
                      <span className="font-medium text-green-600">{stats.activeQuestions}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Responses</span>
                      <span className="font-medium">{stats.responseCount}</span>
                    </div>

                    {!category.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(category.id)}
                        className="w-full mt-3"
                      >
                        <StarIcon className="w-4 h-4 mr-2" />
                        Set as Default
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Category Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter category name"
                className={formErrors.name ? 'border-red-500' : ''}
              />
              {formErrors.name && (
                <p className="text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
                className={formErrors.description ? 'border-red-500' : ''}
              />
              {formErrors.description && (
                <p className="text-sm text-red-600">{formErrors.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-color">Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="edit-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-10 p-1 border rounded"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#3B82F6"
                  className={`flex-1 ${formErrors.color ? 'border-red-500' : ''}`}
                />
              </div>
              {formErrors.color && (
                <p className="text-sm text-red-600">{formErrors.color}</p>
              )}
              
              <div className="flex flex-wrap gap-2 mt-2">
                {defaultColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={`
                      w-6 h-6 rounded border-2 transition-transform hover:scale-110
                      ${formData.color === color ? 'border-gray-900' : 'border-gray-300'}
                    `}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isSubmitting || loading}
            >
              {isSubmitting ? 'Updating...' : 'Update Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedCategory?.name}"?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedCategory?.isDefault && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertDescription className="text-yellow-800">
                  This is the default category. You cannot delete it while it's set as default.
                </AlertDescription>
              </Alert>
            )}

            {selectedCategory && getCategoryStats(selectedCategory).questionCount > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  This category contains {getCategoryStats(selectedCategory).questionCount} questions. 
                  You must move or delete all questions before deleting this category.
                </AlertDescription>
              </Alert>
            )}

            {selectedCategory && !selectedCategory.isDefault && getCategoryStats(selectedCategory).questionCount === 0 && (
              <p className="text-gray-600">
                This action cannot be undone. The category will be permanently deleted.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                isSubmitting || 
                loading || 
                selectedCategory?.isDefault || 
                (selectedCategory && getCategoryStats(selectedCategory).questionCount > 0)
              }
            >
              {isSubmitting ? 'Deleting...' : 'Delete Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}