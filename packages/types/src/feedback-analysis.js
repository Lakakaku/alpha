"use strict";
/**
 * TypeScript types for Feedback Analysis Dashboard
 * Feature: 008-step-2-6
 * Created: 2025-09-21
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALIDATION_RULES = void 0;
// Validation schemas (used by both frontend and backend)
exports.VALIDATION_RULES = {
    SEARCH_QUERY: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 500,
    },
    FEEDBACK_CONTENT: {
        MIN_LENGTH: 10,
        MAX_LENGTH: 5000,
    },
    INSIGHT_TITLE: {
        MIN_LENGTH: 5,
        MAX_LENGTH: 200,
    },
    PRIORITY_SCORE: {
        MIN: 1,
        MAX: 10,
    },
    CONFIDENCE_SCORE: {
        MIN: 0.0,
        MAX: 1.0,
    },
    WEEK_NUMBER: {
        MIN: 1,
        MAX: 53,
    },
};
//# sourceMappingURL=feedback-analysis.js.map