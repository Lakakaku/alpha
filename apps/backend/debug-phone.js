const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');

const phoneNumber = '070-123 45 67';
const cleanedNumber = phoneNumber.replace(/[\s\-\.\/_\(\)]/g, '').trim();

console.log('Original:', phoneNumber);
console.log('Cleaned:', cleanedNumber);

try {
  const parsed = parsePhoneNumber(cleanedNumber, 'SE');
  console.log('Parsed:', parsed);
  console.log('Country:', parsed?.country);
  console.log('Type:', parsed?.getType());
  console.log('National number:', parsed?.nationalNumber);
  console.log('Is valid:', isValidPhoneNumber(cleanedNumber, 'SE'));
  console.log('E.164:', parsed?.format('E.164'));
  console.log('National:', parsed?.format('NATIONAL'));
} catch (error) {
  console.error('Error:', error.message);
}