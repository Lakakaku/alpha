"use strict";
// Admin Dashboard Foundation Types
// Date: 2025-09-23
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminValidationError = exports.AdminAuthorizationError = exports.AdminAuthenticationError = void 0;
class AdminAuthenticationError extends Error {
    code;
    constructor(message, code = 'AUTH_ERROR') {
        super(message);
        this.code = code;
        this.name = 'AdminAuthenticationError';
    }
}
exports.AdminAuthenticationError = AdminAuthenticationError;
class AdminAuthorizationError extends Error {
    code;
    constructor(message, code = 'AUTHZ_ERROR') {
        super(message);
        this.code = code;
        this.name = 'AdminAuthorizationError';
    }
}
exports.AdminAuthorizationError = AdminAuthorizationError;
class AdminValidationError extends Error {
    field;
    code;
    constructor(message, field, code = 'VALIDATION_ERROR') {
        super(message);
        this.field = field;
        this.code = code;
        this.name = 'AdminValidationError';
    }
}
exports.AdminValidationError = AdminValidationError;
//# sourceMappingURL=admin.js.map