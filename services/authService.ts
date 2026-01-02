/**
 * Auth Service
 * Handles OAuth popup flow for Google authentication
 */

import { getOAuthLoginUrl, checkAuthStatus, AuthStatus } from './backendProxy';

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;

/**
 * Open OAuth popup and handle the authentication flow
 * Returns a promise that resolves with the auth status
 */
export function openOAuthPopup(): Promise<AuthStatus> {
    return new Promise((resolve, reject) => {
        const url = getOAuthLoginUrl();

        // Calculate popup position (center of screen)
        const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
        const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;

        const popup = window.open(
            url,
            'oauth-popup',
            `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},popup=1`
        );

        if (!popup) {
            reject(new Error('Popup blocked. Please allow popups for this site.'));
            return;
        }

        // Poll for popup close and check URL parameters
        const pollTimer = setInterval(async () => {
            try {
                // Check if popup was closed
                if (popup.closed) {
                    clearInterval(pollTimer);
                    // Check auth status after popup closes
                    const status = await checkAuthStatus();
                    if (status.authenticated) {
                        resolve(status);
                    } else {
                        reject(new Error('Authentication cancelled or failed'));
                    }
                    return;
                }

                // Try to read the popup URL (will throw if on different origin)
                const currentUrl = popup.location.href;

                // Check for success/error in URL params
                if (currentUrl.includes('auth_success=true')) {
                    clearInterval(pollTimer);
                    popup.close();
                    const status = await checkAuthStatus();
                    resolve(status);
                    return;
                }

                if (currentUrl.includes('auth_error=')) {
                    clearInterval(pollTimer);
                    popup.close();
                    const urlParams = new URLSearchParams(new URL(currentUrl).search);
                    const error = urlParams.get('auth_error');
                    reject(new Error(`Authentication error: ${error}`));
                    return;
                }
            } catch (e) {
                // Ignore cross-origin errors while on Google's OAuth page
            }
        }, 500);

        // Timeout after 5 minutes
        setTimeout(() => {
            clearInterval(pollTimer);
            if (!popup.closed) {
                popup.close();
            }
            reject(new Error('Authentication timeout'));
        }, 5 * 60 * 1000);
    });
}

/**
 * Listen for OAuth redirect messages (alternative to polling)
 */
export function listenForOAuthMessage(): Promise<AuthStatus> {
    return new Promise((resolve, reject) => {
        const handler = async (event: MessageEvent) => {
            // Validate origin
            const backendUrl = new URL(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001');
            if (event.origin !== backendUrl.origin) {
                return;
            }

            if (event.data?.type === 'oauth_success') {
                window.removeEventListener('message', handler);
                const status = await checkAuthStatus();
                resolve(status);
            }

            if (event.data?.type === 'oauth_error') {
                window.removeEventListener('message', handler);
                reject(new Error(event.data.error));
            }
        };

        window.addEventListener('message', handler);

        // Cleanup after timeout
        setTimeout(() => {
            window.removeEventListener('message', handler);
        }, 5 * 60 * 1000);
    });
}
