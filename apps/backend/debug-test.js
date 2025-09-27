const { PhoneValidatorService } = require('./src/services/validation/phone-validator.ts');

console.log('Testing 070-123 45 67:');
const result = PhoneValidatorService.validateSwedishPhone('070-123 45 67');
console.log(JSON.stringify(result, null, 2));