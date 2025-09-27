"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwishError = void 0;
// Swish error structure
class SwishError extends Error {
    code;
    message;
    additionalInformation;
    constructor(code, message, additionalInformation) {
        super(message);
        this.code = code;
        this.message = message;
        this.additionalInformation = additionalInformation;
        this.name = 'SwishError';
    }
}
exports.SwishError = SwishError;
//# sourceMappingURL=payment.js.map