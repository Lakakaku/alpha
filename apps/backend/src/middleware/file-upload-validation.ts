import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import * as xlsx from 'xlsx';

export interface FileUploadRequest extends Request {
  file?: Express.Multer.File;
  validatedData?: {
    records: Array<{
      id: string;
      verification_status: 'verified' | 'fake' | 'pending';
      reward_percentage: number;
    }>;
    totalRecords: number;
    validRecords: number;
    errors: Array<{
      row: number;
      field: string;
      message: string;
    }>;
  };
}

const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_RECORDS = 50000;

const recordSchema = z.object({
  id: z.string().uuid('Invalid record ID format'),
  verification_status: z.enum(['verified', 'fake', 'pending'], {
    errorMap: () => ({ message: 'Status must be verified, fake, or pending' })
  }),
  reward_percentage: z.number()
    .min(0, 'Reward percentage must be non-negative')
    .max(100, 'Reward percentage cannot exceed 100%')
});

export const fileUploadConfig = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
      return;
    }
    cb(null, true);
  }
});

export const validateFileUpload = (
  req: FileUploadRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.file) {
    res.status(400).json({
      error: 'No file uploaded',
      code: 'MISSING_FILE'
    });
    return;
  }

  try {
    let data: any[][];
    
    // Parse file based on type
    if (req.file.mimetype === 'text/csv') {
      const csvContent = req.file.buffer.toString('utf-8');
      data = parseCSV(csvContent);
    } else {
      // Excel file
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    }

    if (data.length === 0) {
      res.status(400).json({
        error: 'File is empty',
        code: 'EMPTY_FILE'
      });
      return;
    }

    // Validate headers
    const headers = data[0];
    const expectedHeaders = ['id', 'verification_status', 'reward_percentage'];
    
    if (!expectedHeaders.every(header => headers.includes(header))) {
      res.status(400).json({
        error: 'Invalid file format. Required columns: id, verification_status, reward_percentage',
        code: 'INVALID_HEADERS',
        expected: expectedHeaders,
        found: headers
      });
      return;
    }

    // Get column indices
    const idIndex = headers.indexOf('id');
    const statusIndex = headers.indexOf('verification_status');
    const rewardIndex = headers.indexOf('reward_percentage');

    // Process records
    const records: any[] = [];
    const errors: Array<{ row: number; field: string; message: string }> = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 1;

      if (row.length === 0 || row.every(cell => !cell)) {
        continue; // Skip empty rows
      }

      const record = {
        id: row[idIndex],
        verification_status: row[statusIndex],
        reward_percentage: parseFloat(row[rewardIndex])
      };

      // Validate record
      const validation = recordSchema.safeParse(record);
      
      if (!validation.success) {
        validation.error.errors.forEach(error => {
          errors.push({
            row: rowNumber,
            field: error.path[0] as string,
            message: error.message
          });
        });
      } else {
        records.push(validation.data);
      }

      // Check record limit
      if (records.length > MAX_RECORDS) {
        res.status(400).json({
          error: `File contains too many records. Maximum allowed: ${MAX_RECORDS}`,
          code: 'TOO_MANY_RECORDS',
          limit: MAX_RECORDS
        });
        return;
      }
    }

    // Store validation results
    req.validatedData = {
      records,
      totalRecords: data.length - 1, // Exclude header
      validRecords: records.length,
      errors
    };

    // Check if we have any valid records
    if (records.length === 0 && errors.length > 0) {
      res.status(400).json({
        error: 'No valid records found in file',
        code: 'NO_VALID_RECORDS',
        errors: errors.slice(0, 10) // Limit error display
      });
      return;
    }

    next();

  } catch (error) {
    console.error('File validation error:', error);
    res.status(400).json({
      error: 'Failed to process file. Please check file format.',
      code: 'FILE_PROCESSING_ERROR'
    });
  }
};

function parseCSV(content: string): string[][] {
  const lines = content.split('\n');
  const result: string[][] = [];
  
  for (const line of lines) {
    if (line.trim()) {
      // Simple CSV parsing (handles basic cases)
      const row = line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
      result.push(row);
    }
  }
  
  return result;
}

export const validateFileSize = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentLength = req.get('content-length');
  
  if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
    res.status(413).json({
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      code: 'FILE_TOO_LARGE',
      maxSize: MAX_FILE_SIZE
    });
    return;
  }
  
  next();
};

export const handleFileUploadError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(413).json({
          error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          code: 'FILE_TOO_LARGE'
        });
        return;
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          error: 'Too many files. Only one file allowed.',
          code: 'TOO_MANY_FILES'
        });
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          error: 'Unexpected field name for file upload.',
          code: 'UNEXPECTED_FIELD'
        });
        return;
      default:
        res.status(400).json({
          error: 'File upload error',
          code: 'UPLOAD_ERROR',
          details: error.message
        });
        return;
    }
  }

  if (error.message.includes('Invalid file type')) {
    res.status(400).json({
      error: error.message,
      code: 'INVALID_FILE_TYPE',
      allowedTypes: ['CSV', 'Excel (.xls, .xlsx)']
    });
    return;
  }

  next(error);
};