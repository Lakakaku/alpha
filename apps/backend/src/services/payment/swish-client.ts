import type { SwishPaymentRequest, SwishPaymentResponse } from '@vocilia/types';

export interface ISwishClient {
  createPayment(request: SwishPaymentRequest): Promise<SwishPaymentResponse>;
  getPaymentStatus(paymentReference: string): Promise<SwishPaymentResponse>;
  cancelPayment(paymentReference: string): Promise<void>;
}

export class SwishError extends Error {
  constructor(
    message: string,
    public code: string,
    public additionalInfo?: string
  ) {
    super(message);
    this.name = 'SwishError';
  }
}

export class MockSwishClient implements ISwishClient {
  private payments: Map<string, SwishPaymentResponse> = new Map();
  private successRate: number;

  constructor(successRate: number = 0.9) {
    this.successRate = successRate;
  }

  async createPayment(request: SwishPaymentRequest): Promise<SwishPaymentResponse> {
    this.validateSwedishPhone(request.payeeAlias);

    await this.simulateNetworkDelay(2000);

    const paymentReference = this.generatePaymentReference();
    const transactionId = this.generateTransactionId();

    const shouldSucceed = Math.random() < this.successRate;

    const response: SwishPaymentResponse = {
      id: paymentReference,
      paymentReference,
      status: shouldSucceed ? 'PAID' : 'ERROR',
      amount: request.amount,
      currency: request.currency,
      message: request.message,
      payeeAlias: request.payeeAlias,
      dateCreated: new Date().toISOString(),
      datePaid: shouldSucceed ? new Date().toISOString() : undefined,
      errorCode: shouldSucceed ? undefined : 'PA02',
      errorMessage: shouldSucceed ? undefined : 'PAYEE_NOT_ENROLLED'
    };

    if (shouldSucceed) {
      response.swishTransactionId = transactionId;
    }

    this.payments.set(paymentReference, response);
    return response;
  }

  async getPaymentStatus(paymentReference: string): Promise<SwishPaymentResponse> {
    await this.simulateNetworkDelay(500);

    const payment = this.payments.get(paymentReference);
    if (!payment) {
      throw new SwishError(
        'Payment not found',
        'RP01',
        `Payment reference ${paymentReference} does not exist`
      );
    }

    return payment;
  }

  async cancelPayment(paymentReference: string): Promise<void> {
    await this.simulateNetworkDelay(1000);

    const payment = this.payments.get(paymentReference);
    if (!payment) {
      throw new SwishError(
        'Payment not found',
        'RP01',
        `Payment reference ${paymentReference} does not exist`
      );
    }

    if (payment.status === 'PAID') {
      throw new SwishError(
        'Cannot cancel paid payment',
        'RP03',
        'Payment already completed'
      );
    }

    payment.status = 'CANCELLED';
    this.payments.set(paymentReference, payment);
  }

  private validateSwedishPhone(phone: string): void {
    const swedishMobilePattern = /^467\d{8}$/;
    if (!swedishMobilePattern.test(phone)) {
      throw new SwishError(
        'Invalid Swedish phone number',
        'PA01',
        'Phone must match format 467XXXXXXXX'
      );
    }
  }

  private generatePaymentReference(): string {
    return `MOCK${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  }

  private generateTransactionId(): string {
    return `TXN${Date.now()}${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
  }

  private simulateNetworkDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}