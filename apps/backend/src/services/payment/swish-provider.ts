import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
import { loggingService } from '../loggingService';

export interface SwishPaymentRequest {
  phoneNumber: string;
  amount: number;
  currency: 'SEK';
  message: string;
  reference?: string;
}

export interface SwishPaymentResponse {
  id: string;
  phoneNumber: string;
  amount: number;
  currency: string;
  status: 'CREATED' | 'PAID' | 'DECLINED' | 'ERROR' | 'CANCELLED';
  message: string;
  reference?: string;
  payeePaymentReference?: string;
  dateCreated: string;
  datePaid?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SwishPaymentStatus {
  id: string;
  status: 'CREATED' | 'PAID' | 'DECLINED' | 'ERROR' | 'CANCELLED';
  dateCreated: string;
  datePaid?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SwishRefundRequest {
  originalPaymentReference: string;
  amount: number;
  currency: 'SEK';
  message: string;
}

export interface SwishRefundResponse {
  id: string;
  originalPaymentReference: string;
  amount: number;
  currency: string;
  status: 'CREATED' | 'PAID' | 'DECLINED' | 'ERROR';
  message: string;
  dateCreated: string;
  datePaid?: string;
  errorCode?: string;
  errorMessage?: string;
}

class SwishProviderService {
  private client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly payeeAlias: string;
  private readonly isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.baseUrl = this.isProduction 
      ? 'https://cpc.getswish.net/swish-cpcapi/api/v1'
      : 'https://mss.cpc.getswish.net/swish-cpcapi/api/v1';
    
    this.payeeAlias = process.env.SWISH_PAYEE_ALIAS || '1231181189'; // Test number for development
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add certificate authentication for production
    if (this.isProduction) {
      // In production, you would configure client certificates here
      // this.client.defaults.httpsAgent = new https.Agent({
      //   cert: fs.readFileSync(process.env.SWISH_CERT_PATH!),
      //   key: fs.readFileSync(process.env.SWISH_KEY_PATH!),
      //   ca: fs.readFileSync(process.env.SWISH_CA_PATH!)
      // });
    }

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        loggingService.logInfo('Swish API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data ? { ...config.data, phoneNumber: '***MASKED***' } : undefined
        });
        return config;
      },
      (error) => {
        loggingService.logError('Swish API request error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        loggingService.logInfo('Swish API response', {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        });
        return response;
      },
      (error) => {
        loggingService.logError('Swish API response error', error, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  async createPayment(request: SwishPaymentRequest): Promise<SwishPaymentResponse> {
    // In development/test mode, return mock response
    if (!this.isProduction) {
      return this.createMockPayment(request);
    }

    try {
      const paymentId = randomUUID();
      const swishRequest = {
        payeePaymentReference: request.reference || paymentId,
        callbackUrl: `${process.env.API_BASE_URL}/api/webhooks/swish/payment-callback`,
        payerAlias: this.formatPhoneNumber(request.phoneNumber),
        payeeAlias: this.payeeAlias,
        amount: request.amount,
        currency: request.currency,
        message: request.message
      };

      const response = await this.client.post('/paymentrequests', swishRequest);

      // Swish returns 201 with Location header containing payment request ID
      const locationHeader = response.headers.location;
      const paymentRequestId = locationHeader?.split('/').pop();

      if (!paymentRequestId) {
        throw new Error('No payment request ID received from Swish');
      }

      return {
        id: paymentRequestId,
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        currency: request.currency,
        status: 'CREATED',
        message: request.message,
        reference: request.reference,
        payeePaymentReference: swishRequest.payeePaymentReference,
        dateCreated: new Date().toISOString()
      };

    } catch (error) {
      await loggingService.logError('Failed to create Swish payment', error as Error, {
        phoneNumber: '***MASKED***',
        amount: request.amount,
        reference: request.reference
      });
      throw this.handleSwishError(error);
    }
  }

  async getPaymentStatus(paymentId: string): Promise<SwishPaymentStatus> {
    // In development/test mode, return mock status
    if (!this.isProduction) {
      return this.getMockPaymentStatus(paymentId);
    }

    try {
      const response = await this.client.get(`/paymentrequests/${paymentId}`);
      
      return {
        id: paymentId,
        status: response.data.status,
        dateCreated: response.data.dateCreated,
        datePaid: response.data.datePaid,
        errorCode: response.data.errorCode,
        errorMessage: response.data.errorMessage
      };

    } catch (error) {
      await loggingService.logError('Failed to get Swish payment status', error as Error, {
        paymentId
      });
      throw this.handleSwishError(error);
    }
  }

  async createRefund(request: SwishRefundRequest): Promise<SwishRefundResponse> {
    // In development/test mode, return mock response
    if (!this.isProduction) {
      return this.createMockRefund(request);
    }

    try {
      const refundId = randomUUID();
      const swishRequest = {
        originalPaymentReference: request.originalPaymentReference,
        callbackUrl: `${process.env.API_BASE_URL}/api/webhooks/swish/refund-callback`,
        payerAlias: this.payeeAlias,
        amount: request.amount,
        currency: request.currency,
        message: request.message
      };

      const response = await this.client.post('/refunds', swishRequest);

      const locationHeader = response.headers.location;
      const refundRequestId = locationHeader?.split('/').pop();

      if (!refundRequestId) {
        throw new Error('No refund request ID received from Swish');
      }

      return {
        id: refundRequestId,
        originalPaymentReference: request.originalPaymentReference,
        amount: request.amount,
        currency: request.currency,
        status: 'CREATED',
        message: request.message,
        dateCreated: new Date().toISOString()
      };

    } catch (error) {
      await loggingService.logError('Failed to create Swish refund', error as Error, {
        originalPaymentReference: request.originalPaymentReference,
        amount: request.amount
      });
      throw this.handleSwishError(error);
    }
  }

  async validatePhoneNumber(phoneNumber: string): Promise<boolean> {
    // Swedish phone number validation
    const cleaned = this.formatPhoneNumber(phoneNumber);
    
    // Swedish mobile numbers: +46 70-79 (8 digits after prefix)
    const swedishMobileRegex = /^46[7][0-9]{8}$/;
    
    return swedishMobileRegex.test(cleaned);
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Handle different formats
    if (digits.startsWith('46')) {
      return digits; // Already in international format
    } else if (digits.startsWith('0')) {
      return '46' + digits.substring(1); // Remove leading 0, add country code
    } else if (digits.length === 9) {
      return '46' + digits; // Assume Swedish number without country code
    }
    
    return digits;
  }

  private handleSwishError(error: any): Error {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          return new Error(`Bad request: ${data.message || 'Invalid payment data'}`);
        case 401:
          return new Error('Unauthorized: Invalid Swish credentials');
        case 403:
          return new Error('Forbidden: Insufficient permissions');
        case 422:
          return new Error(`Validation error: ${data.message || 'Invalid payment parameters'}`);
        case 500:
          return new Error('Swish service temporarily unavailable');
        default:
          return new Error(`Swish API error: ${status} - ${data.message || 'Unknown error'}`);
      }
    }
    
    if (error.code === 'ECONNREFUSED') {
      return new Error('Cannot connect to Swish service');
    }
    
    return new Error(`Network error: ${error.message}`);
  }

  // Mock implementations for development/testing
  private createMockPayment(request: SwishPaymentRequest): SwishPaymentResponse {
    const paymentId = randomUUID();
    
    // Simulate different outcomes based on phone number
    let status: SwishPaymentResponse['status'] = 'CREATED';
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    const lastDigit = request.phoneNumber.slice(-1);
    if (lastDigit === '1') {
      status = 'DECLINED';
      errorCode = 'FF08';
      errorMessage = 'PaymentReference is invalid';
    } else if (lastDigit === '2') {
      status = 'ERROR';
      errorCode = 'RP03';
      errorMessage = 'Callback URL is missing or does not use Https';
    }

    return {
      id: paymentId,
      phoneNumber: request.phoneNumber,
      amount: request.amount,
      currency: request.currency,
      status,
      message: request.message,
      reference: request.reference,
      payeePaymentReference: request.reference || paymentId,
      dateCreated: new Date().toISOString(),
      errorCode,
      errorMessage
    };
  }

  private getMockPaymentStatus(paymentId: string): SwishPaymentStatus {
    // Simulate payment progression over time
    const created = new Date(Date.now() - 60000); // 1 minute ago
    
    return {
      id: paymentId,
      status: 'PAID',
      dateCreated: created.toISOString(),
      datePaid: new Date().toISOString()
    };
  }

  private createMockRefund(request: SwishRefundRequest): SwishRefundResponse {
    const refundId = randomUUID();
    
    return {
      id: refundId,
      originalPaymentReference: request.originalPaymentReference,
      amount: request.amount,
      currency: request.currency,
      status: 'CREATED',
      message: request.message,
      dateCreated: new Date().toISOString()
    };
  }

  // Utility methods
  async testConnection(): Promise<boolean> {
    try {
      if (!this.isProduction) {
        return true; // Mock connection always succeeds
      }

      // In production, you might want to test with a minimal API call
      // const response = await this.client.get('/health');
      // return response.status === 200;
      
      return true; // Placeholder for production health check
      
    } catch (error) {
      await loggingService.logError('Swish connection test failed', error as Error);
      return false;
    }
  }

  getConfiguration(): {
    isProduction: boolean;
    baseUrl: string;
    payeeAlias: string;
  } {
    return {
      isProduction: this.isProduction,
      baseUrl: this.baseUrl,
      payeeAlias: this.payeeAlias
    };
  }
}

export const swishProvider = new SwishProviderService();
export { SwishProviderService };