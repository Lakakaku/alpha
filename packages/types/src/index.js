"use strict";
// Shared TypeScript type definitions for Vocilia platform
// Generated from data model specifications
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSIONS = void 0;
// Permission constants
exports.PERMISSIONS = {
    BUSINESS_READ: 'business.read',
    BUSINESS_WRITE: 'business.write',
    BUSINESS_DELETE: 'business.delete',
    CUSTOMERS_READ: 'customers.read',
    CUSTOMERS_WRITE: 'customers.write',
    FEEDBACK_READ: 'feedback.read',
    FEEDBACK_MODERATE: 'feedback.moderate',
    ADMIN_USERS: 'admin.users',
    ADMIN_BUSINESSES: 'admin.businesses',
    ADMIN_SYSTEM: 'admin.system',
};
// Auto-generated database types
__exportStar(require("./database"), exports);
// Calls types
__exportStar(require("./calls"), exports);
// Custom Questions types
__exportStar(require("./questions"), exports);
// Feedback Analysis types
__exportStar(require("./feedback-analysis"), exports);
// AI Assistant types
__exportStar(require("./ai-assistant"), exports);
// PWA and Offline types
__exportStar(require("./pwa"), exports);
__exportStar(require("./offline"), exports);
// Customer Support types
__exportStar(require("./support"), exports);
// Admin Dashboard types
__exportStar(require("./admin"), exports);
// AI Call System types
__exportStar(require("./ai-call-system"), exports);
// Payment types
__exportStar(require("./payment"), exports);
//# sourceMappingURL=index.js.map