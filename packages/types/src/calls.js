"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CALL_COST_LIMITS = exports.QUESTION_CONSTRAINTS = exports.CALL_DURATION_LIMITS = void 0;
// Call duration constraints
exports.CALL_DURATION_LIMITS = {
    MIN_SECONDS: 60,
    MAX_SECONDS: 120,
    WARNING_THRESHOLD: 0.8, // 80% of max duration
};
// Question constraints
exports.QUESTION_CONSTRAINTS = {
    MIN_TEXT_LENGTH: 10,
    MAX_TEXT_LENGTH: 500,
    MIN_FREQUENCY: 1,
    MAX_FREQUENCY: 100,
    DEFAULT_RESPONSE_TIME: 30,
    MAX_RESPONSE_TIME: 60,
};
// Call cost constraints
exports.CALL_COST_LIMITS = {
    MAX_COST_PER_CALL: 0.25, // $0.25
    WARNING_THRESHOLD: 0.20, // $0.20
};
//# sourceMappingURL=calls.js.map