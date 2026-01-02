/**
 * Backend Proxy Service
 * Handles communication with the OAuth backend server
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === 'true';

export interface AuthStatus {
    authenticated: boolean;
    user?: {
        email: string;
        name: string;
        picture: string;
    };
    hasRefreshToken?: boolean;
}

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

/**
 * Check if user is authenticated via backend OAuth
 */
export async function checkAuthStatus(): Promise<AuthStatus> {
    if (!USE_BACKEND) {
        return { authenticated: false };
    }

    try {
        const response = await fetch(`${BACKEND_URL}/auth/status`, {
            credentials: 'include'
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to check auth status:', error);
        return { authenticated: false };
    }
}

/**
 * Logout from backend session
 */
export async function logout(): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.ok;
    } catch (error) {
        console.error('Logout failed:', error);
        return false;
    }
}

/**
 * Stream chat response via backend
 * Returns an async generator that yields text chunks
 */
export async function* streamChat(
    messages: ChatMessage[],
    model: string = 'gemini-3-flash-preview',
    temperature: number = 0.7
): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            messages,
            model,
            temperature
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Chat request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    if (parsed.text) {
                        yield parsed.text;
                    }
                    if (parsed.error) {
                        throw new Error(parsed.error);
                    }
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }
    }
}

/**
 * Check if backend OAuth is available
 */
export function isBackendAvailable(): boolean {
    return USE_BACKEND;
}

/**
 * Get the OAuth login URL
 */
export function getOAuthLoginUrl(): string {
    return `${BACKEND_URL}/auth/google`;
}
