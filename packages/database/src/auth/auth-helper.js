"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthHelper = void 0;
exports.createAuthHelper = createAuthHelper;
const user_account_js_1 = require("../queries/user-account.js");
const utils_js_1 = require("../client/utils.js");
class AuthHelper {
    client;
    userAccountQueries;
    constructor(client) {
        this.client = client;
        this.userAccountQueries = (0, user_account_js_1.createUserAccountQueries)(client);
    }
    async extractJWTClaims(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }
            const payload = parts[1];
            const decoded = Buffer.from(payload, 'base64url').toString('utf8');
            const claims = JSON.parse(decoded);
            return claims;
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to extract JWT claims', error);
            return null;
        }
    }
    async validateAuthToken(token) {
        try {
            if (!token) {
                return {
                    isValid: false,
                    error: 'No authentication token provided'
                };
            }
            const { data, error } = await this.client.auth.getUser(token);
            if (error) {
                utils_js_1.dbLogger.warn('Token validation failed', error);
                return {
                    isValid: false,
                    error: error.message
                };
            }
            if (!data.user) {
                return {
                    isValid: false,
                    error: 'Invalid user token'
                };
            }
            const claims = await this.extractJWTClaims(token);
            return {
                isValid: true,
                user: data.user,
                claims: claims || undefined
            };
        }
        catch (error) {
            utils_js_1.dbLogger.error('Error validating auth token', error);
            return {
                isValid: false,
                error: error instanceof Error ? error.message : 'Token validation failed'
            };
        }
    }
    async createAuthContext(user) {
        try {
            utils_js_1.dbLogger.debug('Creating auth context for user', { userId: user.id, email: user.email });
            const userAccount = await this.userAccountQueries.findByEmail(user.email || '');
            if (!userAccount) {
                throw new Error('User account not found in database');
            }
            const permissions = this.extractPermissions(userAccount);
            const authContext = {
                user_id: userAccount.id,
                business_id: userAccount.business_id,
                role: userAccount.role,
                permissions,
                email: userAccount.email
            };
            utils_js_1.dbLogger.debug('Auth context created', {
                userId: authContext.user_id,
                businessId: authContext.business_id,
                role: authContext.role
            });
            return authContext;
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to create auth context', error);
            throw new Error('Failed to create authentication context');
        }
    }
    async createRLSContext(authContext) {
        const rlsContext = {
            business_id: authContext.business_id,
            role: authContext.role,
            user_id: authContext.user_id
        };
        return rlsContext;
    }
    async setRLSContext(authContext) {
        try {
            utils_js_1.dbLogger.debug('Setting RLS context', {
                userId: authContext.user_id,
                businessId: authContext.business_id,
                role: authContext.role
            });
            const { error: userIdError } = await this.client.rpc('set_current_user_id', {
                user_id: authContext.user_id
            });
            if (userIdError && !userIdError.message.includes('function does not exist')) {
                utils_js_1.dbLogger.warn('Failed to set current user ID in RLS context', userIdError);
            }
            if (authContext.business_id) {
                const { error: businessIdError } = await this.client.rpc('set_current_business_id', {
                    business_id: authContext.business_id
                });
                if (businessIdError && !businessIdError.message.includes('function does not exist')) {
                    utils_js_1.dbLogger.warn('Failed to set current business ID in RLS context', businessIdError);
                }
            }
            const { error: roleError } = await this.client.rpc('set_current_user_role', {
                user_role: authContext.role
            });
            if (roleError && !roleError.message.includes('function does not exist')) {
                utils_js_1.dbLogger.warn('Failed to set current user role in RLS context', roleError);
            }
        }
        catch (error) {
            utils_js_1.dbLogger.warn('Error setting RLS context (functions may not exist in schema)', error);
        }
    }
    async clearRLSContext() {
        try {
            utils_js_1.dbLogger.debug('Clearing RLS context');
            await this.client.rpc('clear_current_user_context');
        }
        catch (error) {
            utils_js_1.dbLogger.warn('Error clearing RLS context (function may not exist in schema)', error);
        }
    }
    async requireAuth(token) {
        const validation = await this.validateAuthToken(token);
        if (!validation.isValid || !validation.user) {
            throw new Error(validation.error || 'Authentication required');
        }
        return await this.createAuthContext(validation.user);
    }
    async requireRole(authContext, allowedRoles) {
        if (!allowedRoles.includes(authContext.role)) {
            throw new Error(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
        }
    }
    async requireBusinessAccess(authContext, businessId) {
        if (authContext.role === 'admin') {
            return;
        }
        if (authContext.business_id !== businessId) {
            throw new Error('Access denied. Cannot access resources from different business');
        }
    }
    async requirePermission(authContext, permission) {
        if (authContext.role === 'admin') {
            return;
        }
        if (!authContext.permissions.includes(permission)) {
            throw new Error(`Access denied. Required permission: ${permission}`);
        }
    }
    hasPermission(authContext, permission) {
        if (authContext.role === 'admin') {
            return true;
        }
        return authContext.permissions.includes(permission);
    }
    canAccessBusiness(authContext, businessId) {
        if (authContext.role === 'admin') {
            return true;
        }
        return authContext.business_id === businessId;
    }
    canAccessStore(authContext, storeBelongsToBusiness) {
        if (authContext.role === 'admin') {
            return true;
        }
        return authContext.business_id === storeBelongsToBusiness;
    }
    isAdmin(authContext) {
        return authContext.role === 'admin';
    }
    isBusinessOwner(authContext) {
        return authContext.role === 'business_owner';
    }
    isBusinessStaff(authContext) {
        return authContext.role === 'business_staff';
    }
    async refreshUserAccount(authContext) {
        try {
            const userAccount = await this.userAccountQueries.findById(authContext.user_id);
            if (!userAccount) {
                throw new Error('User account not found');
            }
            await this.userAccountQueries.updateLastLogin(authContext.user_id);
            return {
                ...authContext,
                business_id: userAccount.business_id,
                role: userAccount.role,
                permissions: this.extractPermissions(userAccount),
                email: userAccount.email
            };
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to refresh user account', error);
            throw new Error('Failed to refresh user account');
        }
    }
    extractPermissions(userAccount) {
        const permissions = [];
        if (userAccount.role === 'admin') {
            return [
                'read:all',
                'write:all',
                'delete:all',
                'manage:users',
                'manage:businesses',
                'manage:system'
            ];
        }
        if (userAccount.role === 'business_owner') {
            permissions.push('read:business', 'write:business', 'manage:stores', 'manage:staff', 'read:feedback', 'read:analytics', 'manage:verification');
        }
        if (userAccount.role === 'business_staff') {
            permissions.push('read:business', 'read:stores', 'read:feedback', 'write:feedback');
        }
        if (userAccount.permissions && typeof userAccount.permissions === 'object') {
            Object.entries(userAccount.permissions).forEach(([key, value]) => {
                if (value === true && !permissions.includes(key)) {
                    permissions.push(key);
                }
            });
        }
        return permissions;
    }
    async createSystemAuthContext() {
        return {
            user_id: 'system',
            business_id: null,
            role: 'admin',
            permissions: ['read:all', 'write:all', 'delete:all', 'manage:system'],
            email: 'system@alpha.internal'
        };
    }
    async validateBusinessOwnership(authContext, businessId) {
        try {
            if (authContext.role === 'admin') {
                return true;
            }
            if (authContext.role !== 'business_owner') {
                return false;
            }
            return authContext.business_id === businessId;
        }
        catch {
            return false;
        }
    }
    async extractAuthFromRequest(request) {
        try {
            const authHeader = request.headers.authorization || request.headers.Authorization;
            if (!authHeader) {
                return null;
            }
            const token = authHeader.replace(/^Bearer\s+/i, '');
            const validation = await this.validateAuthToken(token);
            if (!validation.isValid || !validation.user) {
                return null;
            }
            return await this.createAuthContext(validation.user);
        }
        catch (error) {
            utils_js_1.dbLogger.warn('Failed to extract auth from request', error);
            return null;
        }
    }
    async withAuth(token, operation) {
        const authContext = await this.requireAuth(token);
        await this.setRLSContext(authContext);
        try {
            return await operation(authContext);
        }
        finally {
            await this.clearRLSContext();
        }
    }
    async withOptionalAuth(token, operation) {
        try {
            const validation = await this.validateAuthToken(token);
            if (validation.isValid && validation.user) {
                const authContext = await this.createAuthContext(validation.user);
                await this.setRLSContext(authContext);
                try {
                    return await operation(authContext);
                }
                finally {
                    await this.clearRLSContext();
                }
            }
            else {
                return await operation();
            }
        }
        catch (error) {
            utils_js_1.dbLogger.warn('Error in optional auth operation', error);
            return await operation();
        }
    }
}
exports.AuthHelper = AuthHelper;
function createAuthHelper(client) {
    return new AuthHelper(client);
}
//# sourceMappingURL=auth-helper.js.map