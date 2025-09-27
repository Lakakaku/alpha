import { PhoneValidatorService } from './src/services/validation/phone-validator';

const result = PhoneValidatorService.validateSwedishPhone('070-123 45 67');
console.log('Result:', JSON.stringify(result, null, 2));