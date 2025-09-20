import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { BusinessRegistrationData } from './use-business-auth';

export interface ValidationError {
  field: string;
  message: string;
}

export interface RegistrationValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface RegistrationResult {
  success: boolean;
  error?: string;
  requiresEmailVerification?: boolean;
}

/**
 * Validates business registration data according to business rules
 */
export function validateBusinessRegistration(data: BusinessRegistrationData): RegistrationValidationResult {
  const errors: ValidationError[] = [];

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  // Password validation
  if (data.password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password)) {
    errors.push({ 
      field: 'password', 
      message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
    });
  }

  // Business name validation
  if (!data.businessName || data.businessName.trim().length < 2) {
    errors.push({ field: 'businessName', message: 'Business name must be at least 2 characters' });
  }
  if (data.businessName.length > 100) {
    errors.push({ field: 'businessName', message: 'Business name must be less than 100 characters' });
  }

  // Contact person validation
  if (!data.contactPerson || data.contactPerson.trim().length < 2) {
    errors.push({ field: 'contactPerson', message: 'Contact person name must be at least 2 characters' });
  }

  // Phone validation
  const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
  if (!phoneRegex.test(data.phone)) {
    errors.push({ field: 'phone', message: 'Invalid phone number format' });
  }

  // Address validation
  if (!data.address || data.address.trim().length < 10) {
    errors.push({ field: 'address', message: 'Address must be at least 10 characters' });
  }

  // Business type validation
  const validBusinessTypes = [
    'restaurant',
    'retail',
    'services',
    'hospitality',
    'healthcare',
    'entertainment',
    'other'
  ];
  if (!validBusinessTypes.includes(data.businessType)) {
    errors.push({ field: 'businessType', message: 'Invalid business type' });
  }

  // Estimated monthly customers validation
  if (!Number.isInteger(data.estimatedMonthlyCustomers) || data.estimatedMonthlyCustomers < 1) {
    errors.push({ 
      field: 'estimatedMonthlyCustomers', 
      message: 'Estimated monthly customers must be a positive integer' 
    });
  }
  if (data.estimatedMonthlyCustomers > 100000) {
    errors.push({ 
      field: 'estimatedMonthlyCustomers', 
      message: 'Estimated monthly customers seems too high (max 100,000)' 
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Checks if email is already registered
 */
export async function checkEmailAvailability(email: string): Promise<{ available: boolean; error?: string }> {
  try {
    const supabase = createClientComponentClient();
    
    // Check if email exists in auth.users
    const { data: existingUser, error: authError } = await supabase
      .from('auth.users')
      .select('email')
      .eq('email', email)
      .single();

    if (authError && authError.code !== 'PGRST116') { // PGRST116 = not found
      return { available: false, error: 'Unable to check email availability' };
    }

    return { available: !existingUser };
  } catch (err) {
    return { 
      available: false, 
      error: err instanceof Error ? err.message : 'Email availability check failed' 
    };
  }
}

/**
 * Sanitizes and normalizes registration data
 */
export function sanitizeRegistrationData(data: BusinessRegistrationData): BusinessRegistrationData {
  return {
    email: data.email.toLowerCase().trim(),
    password: data.password, // Don't trim password - user might want spaces
    businessName: data.businessName.trim(),
    contactPerson: data.contactPerson.trim(),
    phone: data.phone.replace(/[\s\-\(\)]/g, ''), // Remove formatting
    address: data.address.trim(),
    businessType: data.businessType.toLowerCase(),
    estimatedMonthlyCustomers: Math.floor(Math.abs(data.estimatedMonthlyCustomers))
  };
}

/**
 * Registers a new business account with validation and error handling
 */
export async function registerBusinessAccount(data: BusinessRegistrationData): Promise<RegistrationResult> {
  try {
    // Validate input data
    const validation = validateBusinessRegistration(data);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.map(e => e.message).join('. ')
      };
    }

    // Check email availability
    const emailCheck = await checkEmailAvailability(data.email);
    if (!emailCheck.available) {
      return {
        success: false,
        error: emailCheck.error || 'Email is already registered'
      };
    }

    // Sanitize data
    const sanitizedData = sanitizeRegistrationData(data);

    const supabase = createClientComponentClient();

    // Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: sanitizedData.email,
      password: sanitizedData.password,
      options: {
        data: {
          business_name: sanitizedData.businessName,
          contact_person: sanitizedData.contactPerson,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (signUpError) {
      return {
        success: false,
        error: signUpError.message
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'Failed to create user account'
      };
    }

    // Create business account record with pending status
    const { error: businessError } = await supabase
      .from('business_accounts')
      .insert({
        user_id: authData.user.id,
        business_name: sanitizedData.businessName,
        contact_person: sanitizedData.contactPerson,
        phone: sanitizedData.phone,
        address: sanitizedData.address,
        business_type: sanitizedData.businessType,
        estimated_monthly_customers: sanitizedData.estimatedMonthlyCustomers,
        verification_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (businessError) {
      // Cleanup: delete auth user if business account creation fails
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user after business account creation failure:', cleanupError);
      }
      
      return {
        success: false,
        error: `Failed to create business account: ${businessError.message}`
      };
    }

    // Send notification to admins about new registration
    await notifyAdminsOfNewRegistration(sanitizedData);

    return {
      success: true,
      requiresEmailVerification: !authData.user.email_confirmed_at
    };

  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Registration failed with unknown error'
    };
  }
}

/**
 * Sends notification to admin about new business registration
 */
async function notifyAdminsOfNewRegistration(data: BusinessRegistrationData): Promise<void> {
  try {
    const supabase = createClientComponentClient();
    
    // Insert admin notification
    await supabase
      .from('admin_notifications')
      .insert({
        type: 'business_registration',
        title: 'New Business Registration',
        message: `New business "${data.businessName}" registered by ${data.contactPerson}`,
        metadata: {
          business_name: data.businessName,
          contact_person: data.contactPerson,
          email: data.email,
          business_type: data.businessType
        },
        priority: 'medium',
        read: false,
        created_at: new Date().toISOString()
      });
  } catch (err) {
    // Don't fail registration if notification fails
    console.error('Failed to notify admins of new registration:', err);
  }
}

/**
 * Utility function to format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map(error => `${error.field}: ${error.message}`)
    .join('\n');
}

/**
 * Checks business name uniqueness
 */
export async function checkBusinessNameAvailability(businessName: string): Promise<{ available: boolean; error?: string }> {
  try {
    const supabase = createClientComponentClient();
    
    const { data: existingBusiness, error } = await supabase
      .from('business_accounts')
      .select('business_name')
      .ilike('business_name', businessName.trim())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      return { available: false, error: 'Unable to check business name availability' };
    }

    return { available: !existingBusiness };
  } catch (err) {
    return { 
      available: false, 
      error: err instanceof Error ? err.message : 'Business name availability check failed' 
    };
  }
}