import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { google } from 'googleapis';

const router = express.Router();

/**
 * Middleware to check authentication
 * Either OAuth session or API key in request body
 */
const authMiddleware = (req, res, next) => {
    const hasOAuth = req.session.isAuthenticated && req.session.tokens;
    const hasApiKey = req.body.apiKey;

    if (!hasOAuth && !hasApiKey) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Please authenticate with Google or provide an API key'
        });
    }

    next();
};

/**
 * Get or refresh access token
 */
async function getAccessToken(session) {
    if (!session.tokens) {
        throw new Error('No tokens in session');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials(session.tokens);

    // Check if token is expired
    const now = Date.now();
    const expiryDate = session.tokens.expiry_date;

    if (expiryDate && expiryDate < now) {
        console.log('Access token expired, refreshing...');
        const { credentials } = await oauth2Client.refreshAccessToken();
        session.tokens = { ...session.tokens, ...credentials };
        await session.save();
    }

    return session.tokens.access_token;
}

// Antigravity API constants
const ANTIGRAVITY_ENDPOINTS = [
    'https://cloudcode-pa.googleapis.com',  // prod
    'https://autopush-cloudcode-pa.sandbox.googleapis.com',  // staging
    'https://daily-cloudcode-pa.sandbox.googleapis.com'  // dev
];
const ANTIGRAVITY_API_VERSION = 'v1internal';
const ANTIGRAVITY_HEADERS = {
    'User-Agent': 'google-api-nodejs-client/9.15.1',
    'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
    'Client-Metadata': JSON.stringify({
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI'
    })
};

// Default Project ID (fallback when loadCodeAssist API fails)
const ANTIGRAVITY_DEFAULT_PROJECT_ID = 'rising-fact-p41fc';

// Cache for project context
const projectContextCache = new Map();

/**
 * Fetch project context via loadCodeAssist API
 */
async function fetchProjectContext(accessToken) {
    // Check cache first
    if (projectContextCache.has(accessToken)) {
        console.log('📋 Using cached project context');
        return projectContextCache.get(accessToken);
    }

    const metadata = {
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI'
    };

    for (const endpoint of ANTIGRAVITY_ENDPOINTS) {
        const url = `${endpoint}/${ANTIGRAVITY_API_VERSION}:loadCodeAssist`;
        console.log(`📡 Calling loadCodeAssist: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    ...ANTIGRAVITY_HEADERS
                },
                body: JSON.stringify({ metadata })
            });

            if (!response.ok) {
                console.log(`❌ loadCodeAssist failed: ${response.status}`);
                continue;
            }

            const data = await response.json();
            console.log('✅ loadCodeAssist response:', JSON.stringify(data, null, 2));

            // Extract project ID
            let projectId = data.cloudaicompanionProject;
            if (typeof projectId === 'object' && projectId.id) {
                projectId = projectId.id;
            }

            if (projectId) {
                projectContextCache.set(accessToken, projectId);
                return projectId;
            }

            // If no project, try onboarding for free tier
            if (data.allowedTiers) {
                const tierId = data.currentTier?.id || data.allowedTiers[0]?.id || 'free-tier';
                console.log(`🔄 Attempting onboardUser with tierId: ${tierId}`);

                const onboardUrl = `${endpoint}/${ANTIGRAVITY_API_VERSION}:onboardUser`;
                const onboardResponse = await fetch(onboardUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        ...ANTIGRAVITY_HEADERS
                    },
                    body: JSON.stringify({ tierId, metadata })
                });

                if (onboardResponse.ok) {
                    const onboardData = await onboardResponse.json();
                    console.log('✅ onboardUser response:', JSON.stringify(onboardData, null, 2));

                    const managedProjectId = onboardData.response?.cloudaicompanionProject?.id;
                    if (onboardData.done && managedProjectId) {
                        projectContextCache.set(accessToken, managedProjectId);
                        return managedProjectId;
                    }
                }
            }
        } catch (err) {
            console.error(`❌ loadCodeAssist error: ${err.message}`);
            continue;
        }
    }

    // Fallback - use default project ID
    console.log(`⚠️ Could not get project context, using fallback: ${ANTIGRAVITY_DEFAULT_PROJECT_ID}`);
    projectContextCache.set(accessToken, ANTIGRAVITY_DEFAULT_PROJECT_ID);
    return ANTIGRAVITY_DEFAULT_PROJECT_ID;
}

/**
 * POST /api/chat
 * Stream chat responses from Gemini API
 * Supports both OAuth and API key authentication
 */
router.post('/chat', authMiddleware, async (req, res) => {
    const { messages, model, temperature, apiKey } = req.body;

    try {
        // Set headers for Server-Sent Events (SSE)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Default model config
        const modelName = model || 'gemini-3-flash-preview';
        const temp = temperature ?? 0.7;

        // Prepare contents for API
        const contents = messages.map(msg => {
            const parts = [];

            if (msg.content && msg.content.trim()) {
                parts.push({ text: msg.content.trim() });
            } else if (msg.parts && msg.parts.length > 0) {
                parts.push(...msg.parts);
            }

            if (parts.length === 0) {
                return null;
            }

            return {
                role: msg.role === 'user' ? 'user' : 'model',
                parts
            };
        }).filter(Boolean);

        console.log('📝 Formatted contents:', JSON.stringify(contents, null, 2));

        let response;

        // Determine authentication method
        if (req.session.isAuthenticated && req.session.tokens) {
            // OAuth authentication - use Cloudcode/Antigravity API
            const accessToken = await getAccessToken(req.session);
            console.log(`Request from OAuth user: ${req.session.userInfo?.email}`);

            // Get user's project context
            const projectId = await fetchProjectContext(accessToken);
            console.log(`🎯 Using project: ${projectId}`);

            // Generate request ID and session ID
            const requestId = `agent-${crypto.randomUUID()}`;
            const sessionId = req.session.id || crypto.randomUUID();

            // Wrap request in Antigravity format
            const antigravityBody = {
                project: projectId,
                model: modelName,
                userAgent: 'antigravity',
                requestId,
                request: {
                    contents,
                    generationConfig: {
                        temperature: temp
                    },
                    sessionId
                }
            };

            // Try each endpoint in order: daily → autopush → prod
            const endpoints = [
                'https://daily-cloudcode-pa.sandbox.googleapis.com',
                'https://autopush-cloudcode-pa.sandbox.googleapis.com',
                'https://cloudcode-pa.googleapis.com'
            ];

            let lastError = null;
            const GCP_PERMISSION_ERROR_PATTERNS = [
                'PERMISSION_DENIED',
                'does not have permission',
                'Cloud AI Companion API has not been used',
                'has not been enabled'
            ];

            const isGcpPermissionError = (text) => {
                return GCP_PERMISSION_ERROR_PATTERNS.some(pattern => text.includes(pattern));
            };

            const calculateRetryDelay = (attempt) => {
                return Math.min(200 * Math.pow(2, attempt), 2000);
            };

            for (const endpoint of endpoints) {
                const apiUrl = `${endpoint}/v1internal:streamGenerateContent?alt=sse`;

                console.log(`📤 Trying: ${endpoint}`);

                // GCP permission error retry loop (up to 10 attempts per endpoint)
                const maxPermissionRetries = 10;
                let endpointSuccess = false;

                for (let attempt = 0; attempt < maxPermissionRetries; attempt++) {
                    try {
                        response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                                ...ANTIGRAVITY_HEADERS,
                                'Accept': 'text/event-stream'
                            },
                            body: JSON.stringify(antigravityBody)
                        });

                        console.log(`📥 Status: ${response.status}`);

                        if (response.ok) {
                            console.log(`✅ Success with: ${endpoint}`);
                            endpointSuccess = true;
                            break;
                        }

                        // Check for GCP permission errors that may resolve with retry
                        if (response.status === 403) {
                            const errorText = await response.text();
                            if (isGcpPermissionError(errorText)) {
                                if (attempt < maxPermissionRetries - 1) {
                                    const delay = calculateRetryDelay(attempt);
                                    console.log(`🔄 GCP permission error, retry ${attempt + 1}/${maxPermissionRetries} after ${delay}ms`);
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                    continue;
                                }
                            }
                            lastError = errorText;
                            break;
                        }

                        // Log error but continue to next endpoint
                        const errorText = await response.text();
                        console.log(`⚠️ ${response.status} from ${endpoint}:`, errorText.substring(0, 200));
                        lastError = errorText;
                        break;

                    } catch (err) {
                        console.log(`❌ Network error from ${endpoint}:`, err.message);
                        lastError = err.message;
                        break;
                    }
                }

                if (endpointSuccess) break;
            }

            if (!response || !response.ok) {
                throw new Error(`All endpoints failed. Last error: ${lastError?.substring(0, 200)}`);
            }
        } else if (apiKey) {
            // API key authentication - use SDK
            console.log('Request with API key');
            const ai = new GoogleGenAI({ apiKey });
            const genModel = ai.getGenerativeModel({
                model: modelName,
                generationConfig: { temperature: temp }
            });

            const result = await genModel.generateContentStream({ contents });

            for await (const chunk of result.stream) {
                const text = chunk.text();
                if (text) {
                    res.write(`data: ${JSON.stringify({ text })}\n\n`);
                }
            }

            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        // Handle OAuth/Cloudcode response stream (Antigravity format)
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let chunkCount = 0;
        let textReceived = false;
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            chunkCount++;
            console.log(`📦 Chunk ${chunkCount}:`, chunk.substring(0, 200));

            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    console.log(`📨 Data line:`, data.substring(0, 150));

                    if (data === '[DONE]') {
                        res.write('data: [DONE]\n\n');
                        continue;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        console.log(`🔍 Parsed keys:`, Object.keys(parsed));

                        // Unwrap Antigravity response wrapper
                        const unwrapped = parsed.response || parsed;
                        console.log(`🎁 Unwrapped keys:`, Object.keys(unwrapped));

                        // Extract text from candidates
                        const parts = unwrapped.candidates?.[0]?.content?.parts || [];
                        for (const part of parts) {
                            if (part.text) {
                                textReceived = true;
                                console.log(`✅ Extracted text:`, part.text.substring(0, 50));
                                res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
                            }
                        }

                        if (!textReceived && parts.length > 0) {
                            console.log(`⚠️ Parts found but no text. Parts:`, parts.map(p => Object.keys(p)));
                        }
                    } catch (e) {
                        console.error('❌ Error parsing SSE chunk:', e.message);
                        console.log(`📄 Raw data that failed to parse:`, data.substring(0, 300));
                    }
                }
            }
        }

        // Process any remaining data in buffer
        if (buffer.startsWith('data: ')) {
            const data = buffer.slice(6);
            if (data && data !== '[DONE]') {
                try {
                    const parsed = JSON.parse(data);
                    const unwrapped = parsed.response || parsed;
                    const parts = unwrapped.candidates?.[0]?.content?.parts || [];
                    for (const part of parts) {
                        if (part.text) {
                            textReceived = true;
                            res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
                        }
                    }
                } catch (e) {
                    console.error('❌ Error parsing final buffer:', e.message);
                }
            }
        }

        console.log(`📊 Stream complete. Chunks: ${chunkCount}, Text received: ${textReceived}`);
        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('Chat API error:', error);

        if (!res.headersSent) {
            res.status(500).json({
                error: 'API request failed',
                message: error.message
            });
        } else {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        }
    }
});

/**
 * GET /api/quota
 * Get current quota usage (OAuth only)
 */
router.get('/quota', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'OAuth authentication required' });
    }

    try {
        res.json({
            requestsPerMinute: 60,
            requestsPerDay: 1000,
            tier: 'Free (OAuth)'
        });
    } catch (error) {
        console.error('Quota check error:', error);
        res.status(500).json({ error: 'Failed to check quota' });
    }
});

export default router;
