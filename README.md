# VERITAS // TRUTH ENGINE

**Veritas** is a sophisticated Multi-Agent Reasoning System designed to minimize hallucinations and maximize factual accuracy through recursive debate. Built on the **Google Gemini 3** architecture, it orchestrates a team of specialized AI agents who analyze, critique, and judge information before presenting a final verdict.

## 🧠 The Cognitive Architecture

Veritas moves beyond simple "chatbot" interactions by implementing a rigorous debate protocol:

1.  **Analyst (Data Core)**: Performs deep searches, gathers raw data, and constructs an initial factual hypothesis based on verified sources.
2.  **Skeptic (Auditor)**: Adversarially attacks the Analyst's output. It looks for logical fallacies, unsupported claims, and context errors. It *wants* to find a flaw.
3.  **Judge (Veritas Final)**: Synthesizes the debate. If the Skeptic finds a flaw, the Analyst must refine their answer. The Judge only issues a verdict when consensus is reached or the truth is synthesized from the conflict.
4.  **Validator (Optional)**: A final automated check that performs an independent search to verify the Judge's specific claims before rendering text.

## ✨ Key Features

*   **Recursive Reasoning Loops**: Agents debate in rounds (default: 3) to refine accuracy.
*   **Gemini 3 Pro + Thinking**: Utilizes the latest Gemini 3 models with "Thinking" budgets for deep logical inference.
*   **Search Grounding**: Integrated with Google Search to anchor claims in real-time reality.
*   **Text-to-Speech (TTS)**: The final verdict is spoken aloud using `gemini-2.5-flash-tts` for an immersive briefing experience.
*   **Custom Workflows**: Define linear chains (e.g., Ideator -> Writer -> Editor) for creative tasks.
*   **Agent Interrogation**: Interrupt the process to "speak" directly to a specific agent about their internal state or logic (`@AgentName: query`).
*   **Cinematic UI**: A "High-Tech/Low-Life" Cyberpunk terminal interface with CRT effects, sound FX, and reactive visualizations.

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript
*   **Styling**: Tailwind CSS (Custom "Veritas" Design System)
*   **AI Engine**: `@google/genai` SDK
    *   Reasoning: `gemini-3-pro-preview`
    *   TTS: `gemini-2.5-flash-preview-tts`
*   **Backend**: Express.js (OAuth proxy server)
*   **State**: Custom React Hooks (`useReasoningEngine`, `useCommandTerminal`)

## 🔐 Authentication Options

Veritas supports two authentication methods:

| Method | Description | Best For |
|--------|-------------|----------|
| **Google OAuth** | Sign in with Google to use Gemini Code Assist subscription | Production use, no API costs |
| **Manual API Key** | Direct Gemini API key input | Development/testing |

## 🚀 Getting Started

### Option A: Google OAuth (Recommended)

1.  **Setup OAuth Credentials**:
    - Go to [Google Cloud Console → APIs & Credentials](https://console.cloud.google.com/apis/credentials)
    - Create OAuth 2.0 Client ID (Web application)
    - Add redirect URI: `http://localhost:3001/auth/google/callback`

2.  **Configure Backend**:
    ```bash
    cd server
    cp .env.example .env
    # Edit .env with your OAuth credentials
    ```

3.  **Run Both Servers**:
    ```bash
    # Terminal 1 - Backend
    cd server && npm install && npm run dev
    
    # Terminal 2 - Frontend
    npm install && npm run dev
    ```

4.  **Authenticate**: Click the auth badge → Select "GOOGLE OAUTH" → Sign in

### Option B: Manual API Key

1.  **Run Frontend Only**:
    ```bash
    npm install
    npm run dev
    ```

2.  **Authenticate**: Click the auth badge → Enter your Gemini API key

## ⚙️ Configuration

Click the `CFG` button in the header to open the System Configuration Editor. You can modify agent personas, debate rules, or create entirely new agent swarms.

## 📂 Project Structure

The project follows a feature-based architecture:

*   `features/reasoning/`: Core logic for the agent engine.
    *   `services/`:
        *   `geminiService.ts`: The Orchestrator managing the debate flow.
        *   `geminiCore.ts`: Low-level API pipe (retry logic, JSON parsing).
        *   `schemas.ts`: Strict JSON schemas for agent outputs.
        *   `prompts.ts`: System instructions for Analyst, Skeptic, etc.
    *   `components/`: UI components for the terminal log, agent cards, and header.
    *   `hooks/`: Custom hooks for sound, speech, and state management.

## 🎛️ Usage Guide

*   **Standard Mode**: Type a query and hit EXECUTE. Watch the agents debate.
*   **Interrogation**: Type `@DATA_CORE_01: Why did you cite that source?` to query an agent directly.
*   **Presets**: Use the presets (Academic, Creative, Story Chain) to instantly swap the "Cognitive Personality" of the system.
*   **Export**: Press `Ctrl+E` to download the entire debate transcript as JSON.

---
*Built with radical intent.*