import * as vscode from 'vscode';
import { ConfigManager } from './configManager';

export class AuthManager {
    private context: vscode.ExtensionContext;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private configManager: ConfigManager;
    private isRefreshing: boolean = false; // Prevent multiple refresh attempts
    private refreshPromise: Promise<boolean> | null = null; // Share refresh promise

    constructor(context: vscode.ExtensionContext, configManager: ConfigManager) {
        this.context = context;
        this.configManager = configManager;
        this.loadStoredTokens();
    }

    private async loadStoredTokens(): Promise<void> {
        try {
            const storedAccessToken = await this.context.globalState.get('promptdc.accessToken', null);
            const storedRefreshToken = await this.context.globalState.get('promptdc.refreshToken', null);
            if (storedAccessToken) {
                this.accessToken = storedAccessToken as string;
            }
            if (storedRefreshToken) {
                this.refreshToken = storedRefreshToken as string;
            }
        } catch (error) {
            console.error('PromptDC: Error loading stored tokens:', error);
        }
    }

    private async storeTokens(accessToken: string, refreshToken?: string): Promise<void> {
        try {
            await this.context.globalState.update('promptdc.accessToken', accessToken);
            this.accessToken = accessToken;

            if (refreshToken) {
                await this.context.globalState.update('promptdc.refreshToken', refreshToken);
                this.refreshToken = refreshToken;
            }
        } catch (error) {
            console.error('PromptDC: Error storing tokens:', error);
        }
    }

    private async clearStoredTokens(): Promise<void> {
        try {
            await this.context.globalState.update('promptdc.accessToken', null);
            await this.context.globalState.update('promptdc.refreshToken', null);
            this.accessToken = null;
            this.refreshToken = null;
        } catch (error) {
            console.error('PromptDC: Error clearing tokens:', error);
        }
    }

    async login(): Promise<boolean> {
        try {
            const state = Math.random().toString(36).substring(2, 15);

            const authUrl = `https://promptdc.com/login?vscode=true&state=${state}&redirect=vscode`;

            // Register URL handler for immediate callback - supports all editor protocols
            let authCompleted = false;
            const disposable = vscode.window.registerUriHandler({
                handleUri: async (uri) => {

                    if (uri.path === '/auth-callback' && !authCompleted) {
                        const query = new URLSearchParams(uri.query);
                        const callbackState = query.get('state');
                        const accessToken = query.get('access_token');
                        const refreshToken = query.get('refresh_token');
                        const editorFromCallback = query.get('editor');

                        if (callbackState === state && accessToken) {
                            authCompleted = true;
                            await this.storeTokens(accessToken, refreshToken || undefined);

                            vscode.window.showInformationMessage('Successfully logged in to PromptDC in VS Code! You can now close this browser tab.');
                            disposable.dispose();
                        } else {
                        }
                    } else {
                    }
                }
            });

            await vscode.env.openExternal(vscode.Uri.parse(authUrl));

            // Small delay to ensure browser has time to load before we start aggressive polling
            await new Promise(resolve => setTimeout(resolve, 1000));

            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "PromptDC: Waiting for authorization",
                cancellable: true
            }, async (progress, token) => {
                progress.report({ message: "Complete login in your browser" });
                const result = await this.waitForAuthorization(state, token, () => authCompleted);
                disposable.dispose(); // Clean up URI handler

                if (result.success) {
                    // If auth was completed via URL callback, tokens are already stored
                    if (!authCompleted && result.accessToken) {
                        await this.storeTokens(result.accessToken, result.refreshToken);
                        // Only show success message if URI callback didn't already handle it
                        vscode.window.showInformationMessage('Successfully logged in to PromptDC! You can now close this browser tab.');
                    }
                    // Note: If authCompleted is true, the URI callback already showed success message
                    return true;
                } else if (result.cancelled) {
                    if (!authCompleted) {
                        vscode.window.showInformationMessage('Login cancelled');
                    }
                    return false;
                } else {
                    if (!authCompleted) {
                        vscode.window.showErrorMessage('Login failed. Please try again');
                    }
                    return false;
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage('Login failed. Please try again');
            return false;
        }
    }

    private async waitForAuthorization(state: string, cancellationToken: vscode.CancellationToken, authCompleted?: () => boolean): Promise<{ success: boolean, accessToken?: string, refreshToken?: string, cancelled?: boolean }> {
        return new Promise((resolve) => {
            let pollCount = 0;
            const maxPolls = 150; // 10 minutes total with faster polling
            let pollInterval = 50; // Start with 50ms ultra-fast polling for instant response

            const poll = async () => {
                if (cancellationToken.isCancellationRequested) {
                    resolve({ success: false, cancelled: true });
                    return;
                }

                // Check if auth was completed via URL callback
                if (authCompleted && authCompleted()) {
                    resolve({ success: true });
                    return;
                }

                pollCount++;
                if (pollCount > maxPolls) {
                    resolve({ success: false });
                    return;
                }

                // Increase polling interval gradually (but keep it more responsive)
                if (pollCount === 40) { // After 2 seconds (40 * 50ms)
                    pollInterval = 100; // 100ms intervals
                } else if (pollCount === 80) { // After 6 seconds total
                    pollInterval = 250; // 250ms intervals
                } else if (pollCount === 160) { // After 26 seconds total
                    pollInterval = 500; // 500ms intervals
                }

                try {
                    const config = this.configManager.getConfig();
                    const response = await fetch(`${config.apiUrl}/vscode-auth?state=${state}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': config.supabaseApiKey
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.authorized && (data.accessToken || data.access_token)) {
                            // Handle both possible response formats
                            const accessToken = data.accessToken || data.access_token;
                            const refreshToken = data.refreshToken || data.refresh_token;
                            resolve({ success: true, accessToken, refreshToken });
                            return;
                        }
                    } else {
                    }
                } catch (error) {
                    // Continue polling on error - could be temporary network issue
                }

                // Schedule next poll
                setTimeout(poll, pollInterval);
            };

            // Start with burst polling for immediate response
            poll(); // First poll immediately
            setTimeout(poll, 25); // Second poll after 25ms  
            setTimeout(poll, 50); // Third poll after 50ms
            setTimeout(poll, 100); // Fourth poll after 100ms

            cancellationToken.onCancellationRequested(() => {
                resolve({ success: false, cancelled: true });
            });
        });
    }

    async logout(): Promise<void> {
        await this.clearStoredTokens();
        vscode.window.showInformationMessage('Logged out from PromptDC');
    }

    async getAccessToken(): Promise<string | null> {
        // Always try to load stored tokens first
        if (!this.accessToken) {
            await this.loadStoredTokens();
        }

        if (!this.accessToken) {
            return null;
        }

        // Check if token is expired and try to refresh if we have a refresh token
        if (this.isTokenExpired(this.accessToken)) {

            if (this.refreshToken) {
                // If already refreshing, wait for the existing refresh to complete
                if (this.isRefreshing && this.refreshPromise) {
                    const refreshed = await this.refreshPromise;
                    return refreshed ? this.accessToken : null;
                }

                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    return this.accessToken;
                } else {
                    // Don't clear tokens immediately - they might work on next attempt
                    // Only clear if the refresh explicitly returned a 401/403
                    return null;
                }
            } else {
                await this.clearStoredTokens();
                return null;
            }
        }

        return this.accessToken;
    }

    async isLoggedIn(): Promise<boolean> {
        const token = await this.getAccessToken(); // This will automatically refresh if needed
        return token !== null;
    }

    /**
     * Check if user has stored credentials without triggering refresh
     * Useful for quick checks without network calls
     */
    async hasStoredCredentials(): Promise<boolean> {
        if (!this.accessToken || !this.refreshToken) {
            await this.loadStoredTokens();
        }
        return this.accessToken !== null && this.refreshToken !== null;
    }

    /**
     * Validate session silently on startup
     * This checks if stored tokens are valid and refreshes them if needed
     */
    async validateSession(): Promise<boolean> {
        try {
            const hasCredentials = await this.hasStoredCredentials();

            if (!hasCredentials) {
                return false;
            }

            // Try to get a valid access token (this will refresh if needed)
            const token = await this.getAccessToken();
            const isValid = token !== null;

            return isValid;
        } catch (error) {
            console.error('PromptDC: Error validating session:', error);
            return false;
        }
    }

    async getUserInfo(): Promise<any> {
        const token = await this.getAccessToken();
        if (!token) {
            return null;
        }
        try {
            const config = this.configManager.getConfig();
            const response = await fetch(`${config.apiUrl}/get-user-profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': config.supabaseApiKey
                }
            });

            if (!response.ok) {
                return this.decodeUserInfoFromToken(token);
            }

            return await response.json();
        } catch (error) {
            return this.decodeUserInfoFromToken(token);
        }
    }

    private decodeUserInfoFromToken(token: string): any {
        try {
            const payload = this.decodeJWT(token);
            return {
                email: payload.email || 'N/A',
                plan: payload.plan || payload.subscription_type || payload.subscription_tier || 'Free',
                userId: payload.sub || payload.user_id
            };
        } catch (error) {
            return null;
        }
    }

    private decodeJWT(token: string): any {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (error) {
            return {};
        }
    }

    async getApiKey(): Promise<string | null> {
        try {
            const apiKey = await this.context.globalState.get<string | null>('promptdc.apiKey', null);
            return apiKey && typeof apiKey === 'string' ? apiKey.trim() : null;
        } catch (error) {
            return null;
        }
    }

    private isTokenExpired(token: string): boolean {
        try {
            const payload = this.decodeJWT(token);
            const now = Math.floor(Date.now() / 1000);
            // Less aggressive expiration check - only consider expired 30 seconds before actual expiration
            // This gives more time for the token to be used while still refreshing proactively
            const isExpired = !payload.exp || payload.exp < (now + 30);

            if (isExpired) {
            }

            return isExpired;
        } catch (e) {
            console.error('PromptDC: Error checking token expiration:', e);
            return true;
        }
    }

    private async refreshAccessToken(): Promise<boolean> {
        if (!this.refreshToken) {
            return false;
        }

        // Prevent multiple simultaneous refresh attempts
        if (this.isRefreshing && this.refreshPromise) {
            return await this.refreshPromise;
        }

        this.isRefreshing = true;
        this.refreshPromise = this.performTokenRefresh();

        try {
            const result = await this.refreshPromise;
            return result;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    private async performTokenRefresh(): Promise<boolean> {
        const maxRetries = 3;
        let lastError: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {

                const config = this.configManager.getConfig();
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

                const response = await fetch(`${config.apiUrl}/refresh-token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': config.supabaseApiKey
                    },
                    body: JSON.stringify({
                        refresh_token: this.refreshToken
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    if (data.access_token) {
                        await this.storeTokens(data.access_token, data.refresh_token || this.refreshToken);
                        return true;
                    } else {
                        lastError = new Error('Missing access_token in response');
                    }
                } else {

                    // Only clear tokens for definitive auth failures
                    if (response.status === 401 || response.status === 403) {
                        await this.clearStoredTokens();
                        return false;
                    }

                    // For other errors (500, network issues, etc.), retry
                    lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error: any) {
                lastError = error;

                // If it's an abort error (timeout), we might want to retry
                if (error.name === 'AbortError') {
                }
            }

            // Wait before retrying (exponential backoff)
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.error('PromptDC: All refresh attempts failed. Last error:', lastError?.message);

        // Don't clear tokens here - let them be retried on next getAccessToken call
        // This is more forgiving for temporary network issues
        return false;
    }
}