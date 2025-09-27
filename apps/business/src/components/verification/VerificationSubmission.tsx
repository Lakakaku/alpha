'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { 
  Upload, 
  FileText, 
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  X,
  FileCheck
} from 'lucide-react';

interface VerificationSubmissionProps {
  databaseId: string;
  onSubmissionComplete?: (result: SubmissionResult) => void;
}

interface SubmissionResult {
  message: string;
  verified_count: number;
  fake_count: number;
  total_processed: number;
}

interface ValidationError {
  field: string;
  message: string;
  row?: number;
}

export function VerificationSubmission({ 
  databaseId, 
  onSubmissionComplete 
}: VerificationSubmissionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel'>('csv');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [success, setSuccess] = useState<SubmissionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedFormats = {
    csv: {
      name: 'CSV',
      description: 'Comma-separated values file',
      icon: FileText,
      accept: '.csv,text/csv',
      maxSize: '10 MB'
    },
    excel: {
      name: 'Excel',
      description: 'Microsoft Excel workbook (.xlsx)',
      icon: FileSpreadsheet,
      accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      maxSize: '25 MB'
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isValidType = selectedFormat === 'csv' 
      ? file.type === 'text/csv' || file.name.endsWith('.csv')
      : file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx');

    if (!isValidType) {
      setError(`Please select a valid ${supportedFormats[selectedFormat].name} file`);
      return;
    }

    // Validate file size (CSV: 10MB, Excel: 25MB)
    const maxSize = selectedFormat === 'csv' ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File size must be less than ${supportedFormats[selectedFormat].maxSize}`);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setValidationErrors([]);
    setSuccess(null);
  };

  const handleFormatChange = (format: 'csv' | 'excel') => {
    setSelectedFormat(format);
    setSelectedFile(null);
    setError(null);
    setValidationErrors([]);
    setSuccess(null);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setValidationErrors([]);

      const formData = new FormData();
      formData.append('verification_file', selectedFile);
      formData.append('format', selectedFormat);

      const response = await fetch(`/api/business/verification/databases/${databaseId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('business_token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 && data.validation_errors) {
          setValidationErrors(data.validation_errors);
          setError('File validation failed. Please check the errors below and correct your file.');
        } else {
          throw new Error(data.message || `Upload failed: ${response.statusText}`);
        }
        return;
      }

      setSuccess(data);
      onSubmissionComplete?.(data);

    } catch (err) {
      console.error('Error submitting verification:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit verification');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    setValidationErrors([]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderFormatSelector = () => (
    <div className="space-y-3">
      <Label className="text-base font-medium">File Format</Label>
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(supportedFormats).map(([format, config]) => {
          const Icon = config.icon;
          const isSelected = selectedFormat === format;
          
          return (
            <button
              key={format}
              type="button"
              onClick={() => handleFormatChange(format as 'csv' | 'excel')}
              className={`p-3 border-2 rounded-lg text-left transition-all duration-200 ${
                isSelected 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                  {config.name}
                </span>
              </div>
              <p className={`text-sm ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                {config.description}
              </p>
              <p className={`text-xs mt-1 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                Max size: {config.maxSize}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderFileUpload = () => (
    <div className="space-y-3">
      <Label className="text-base font-medium">Upload Verification File</Label>
      
      {!selectedFile ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-2">
            Click to select your {supportedFormats[selectedFormat].name} file
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={supportedFormats[selectedFormat].accept}
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            Choose File
          </Button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-600">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderValidationErrors = () => {
    if (validationErrors.length === 0) return null;

    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium text-red-800">File validation errors:</p>
            <div className="space-y-1">
              {validationErrors.map((error, index) => (
                <div key={index} className="text-sm text-red-700">
                  {error.row ? `Row ${error.row}: ` : ''}{error.field} - {error.message}
                </div>
              ))}
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  };

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Verification Submitted Successfully!
            </h3>
            <p className="text-green-800 mb-4">{success.message}</p>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{success.verified_count}</div>
                <div className="text-sm text-green-800">Verified</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{success.fake_count}</div>
                <div className="text-sm text-green-800">Flagged as Fake</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{success.total_processed}</div>
                <div className="text-sm text-green-800">Total Processed</div>
              </div>
            </div>

            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/verification'}
            >
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Submit Verification Results
        </CardTitle>
        <CardDescription>
          Upload your completed verification file with transaction statuses marked as verified or fake.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {renderValidationErrors()}
        {renderFormatSelector()}
        {renderFileUpload()}

        {/* File Requirements */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">File Requirements</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Include all original transaction records</li>
            <li>• Add a "verification_status" column with values: "verified" or "fake"</li>
            <li>• Do not modify transaction times, amounts, or IDs</li>
            <li>• Ensure all rows have a verification status assigned</li>
          </ul>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Submitting...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Upload size={16} />
                <span>Submit Verification</span>
              </div>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default VerificationSubmission;