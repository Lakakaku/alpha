import { PhoneValidatorService } from './src/services/validation/phone-validator';

console.log('Simple debug test:');
const result = PhoneValidatorService.validateSwedishPhone('070-123 45 67');
console.log('Result:', result);
console.log('isValid:', result.isValid);
console.log('status:', result.status);
console.log('errorMessage:', result.errorMessage);