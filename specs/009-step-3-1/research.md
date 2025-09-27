# Research: QR Code Landing & Verification System

**Date**: 2025-09-22  
**Feature**: Mobile-optimized customer verification form with QR code handling

## QR Code Handling Decisions

### **Decision**: URL-based QR code data extraction with security validation
**Rationale**: 
- Existing codebase already implements robust URL-based QR system (`/feedback/{storeId}?v={version}&t={timestamp}`)
- Security validation through UUID store IDs and timestamp verification prevents replay attacks
- Mobile browser compatibility optimized for HTTPS-only operation

**Alternatives considered**:
- Base64 encoded QR data → Rejected: Less readable, harder to debug
- JSON payload in QR → Rejected: Size limitations, parsing complexity

### **Key Patterns**:
- Use path parameters for primary identifier (storeId)
- Query parameters for metadata (version, timestamp, session)
- HTTPS enforcement for mobile browser compatibility
- Input validation with UUID regex and bounds checking

## Swedish Phone Number Validation

### **Decision**: libphonenumber-js with Swish-specific validation
**Rationale**:
- Comprehensive Swedish mobile number format support (070, 072, 073, 076, 079 prefixes)
- E.164 format output required for Swish payment integration
- Production-ready library with extensive testing and maintenance

**Alternatives considered**:
- Custom regex patterns → Rejected: Error-prone, maintenance overhead
- intl-tel-input only → Rejected: Frontend-only solution, lacks backend validation

### **Implementation Requirements**:
```typescript
// Valid Swedish mobile formats
National: 070-123 45 67 (10 digits)
International: +46 70 123 45 67 (12 digits with +46)
E.164: +46701234567 (required for Swish)

// Validation regex
^(\+46|0046|0)[\s-]?7[\s-]?[02369][\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$
```

## Mobile Form UX Architecture

### **Decision**: Progressive enhancement with mobile-first design
**Rationale**:
- Single-screen completion optimizes for 2-minute interaction limit
- Touch-friendly 48px minimum targets exceed accessibility standards
- Progressive validation reduces cognitive load and form abandonment

**Alternatives considered**:
- Multi-step wizard → Rejected: Additional complexity for simple 3-field form
- Desktop-first responsive → Rejected: Conflicts with mobile QR scan use case

### **UX Optimization Strategy**:
1. **Field Order**: Time (easiest) → Amount → Phone (hardest)
2. **Validation Timing**: onBlur validation with immediate success feedback
3. **Input Types**: `type="time"`, `inputmode="decimal"`, `type="tel"`
4. **Error Messaging**: Contextual with tolerance range examples

## Technology Integration Decisions

### **Decision**: Next.js 14 customer app with Express backend validation
**Rationale**:
- Leverages existing monorepo architecture (apps/customer + apps/backend)
- TypeScript strict mode compliance enforced across full stack
- Supabase RLS integration for secure transaction storage

**Implementation Stack**:
```typescript
Frontend: Next.js 14 + React 18 + Tailwind CSS
Backend: Express.js + Supabase client + Zod validation
Validation: libphonenumber-js + custom tolerance checking
Deployment: Vercel (frontend) + Railway (backend)
```

## Performance and Security Requirements

### **Performance Targets**:
- Page load: <2s on 3G networks
- API response: <500ms for validation
- Form completion: <1 minute average
- Touch target: 48px minimum (WCAG AAA)

### **Security Implementation**:
- HTTPS-only QR URLs (mobile camera requirement)
- Input sanitization and validation on both client and server
- Rate limiting for fraud prevention
- RLS policies for database access control
- Session-based QR codes with expiration timestamps

## Tolerance Validation Patterns

### **Time Tolerance (±2 minutes)**:
```typescript
// JavaScript implementation
const isValidTime = (userTime: string, currentTime: Date) => {
  const userDateTime = parseTimeWithToday(userTime);
  const timeDiff = Math.abs(userDateTime.getTime() - currentTime.getTime());
  return timeDiff <= 2 * 60 * 1000; // 2 minutes in milliseconds
};
```

### **Amount Tolerance (±2 SEK)**:
```typescript
// Validation with user feedback
const validateAmount = (userAmount: number, expectedAmount: number) => {
  const difference = Math.abs(userAmount - expectedAmount);
  const tolerance = 2.00;
  
  return {
    isValid: difference <= tolerance,
    range: `${expectedAmount - tolerance} - ${expectedAmount + tolerance} SEK`,
    difference: difference.toFixed(2)
  };
};
```

## Mobile Browser Compatibility

### **QR Code Scanning Requirements**:
- HTTPS mandatory for camera access
- Progressive enhancement for devices without camera
- Fallback to manual URL entry for accessibility
- iOS Safari optimized (primary Swedish market browser)

### **Input Method Optimization**:
- `inputmode="numeric"` for amount fields (decimal keypad)
- `type="tel"` for phone numbers (numeric keypad with symbols)
- `autocomplete` attributes for form field recognition
- Virtual keyboard awareness for layout adjustments

## Error Handling Strategy

### **Error Categories**:
1. **QR Code Errors**: Invalid format, expired codes, store not found
2. **Validation Errors**: Out of tolerance, invalid phone format
3. **Network Errors**: API timeouts, connection failures
4. **System Errors**: Server issues, database unavailability

### **User-Friendly Error Messages**:
```typescript
const ERROR_MESSAGES = {
  TIME_OUT_OF_RANGE: "Time must be within 2 minutes of transaction (14:30-14:34)",
  AMOUNT_OUT_OF_RANGE: "Amount should be within 2 SEK of receipt total (48-52 SEK)",
  INVALID_PHONE: "Please enter a valid Swedish mobile number (070-123 45 67)",
  QR_EXPIRED: "QR code has expired. Please request a new one from the business"
};
```

## Integration with Existing Codebase

### **Reusable Components**:
- Store validation service (apps/backend/src/services/qr/)
- Fraud detection middleware (existing scan tracking)
- Database models for verification sessions
- Shared types package for request/response validation

### **Constitutional Compliance**:
- ✅ Production from Day One: Real Supabase integration, no mocks
- ✅ Security & Privacy First: RLS policies, input validation
- ✅ TypeScript Strict Mode: Full type safety enforcement
- ✅ Real Data Only: Actual transaction validation
- ✅ Monorepo Architecture: Existing apps/customer + apps/backend structure