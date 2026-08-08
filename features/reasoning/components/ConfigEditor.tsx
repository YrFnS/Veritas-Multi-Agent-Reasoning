import type * as React from 'react';
import { useEffect, useState } from 'react';
import type { ProviderConfig, ProviderType, SystemConfig } from '../types';
import { OpenRouterModelPicker } from './OpenRouterModelPicker';
import { PRESETS } from '../constants';
import {
  validateAndNormalizeSystemConfig,
} from '../validation/configValidation.js';
import { readProviderKeys, writeProviderKey } from '../services/providerKeys.js';
import type { ProviderKeyMap } from '../services/providerKeys.js';

interface ConfigEditorProps {
  config: SystemConfig;
  onSave: (newConfig: SystemConfig) => void;
  onClose: () => void;
}

const CUSTOM_PRESETS_KEY = 'veritas_custom_presets';

export const ConfigEditor: React.FC<ConfigEditorProps> = ({
  config,
  onSave,
  onClose,
}) => {
  const [jsonText, setJsonText] = useState(JSON.stringify(config, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [customPresets, setCustomPresets] = useState<
    Record<string, SystemConfig>
  >({});
  const [newPresetName, setNewPresetName] = useState('');
  const [apiKeys, setApiKeys] = useState<ProviderKeyMap>(() =>
    readProviderKeys()
  );

  const readEditorProvider = (): ProviderConfig => {
    try {
      const parsed = JSON.parse(jsonText) as { provider?: unknown };
      if (typeof parsed.provider === 'object' && parsed.provider !== null) {
        const provider = parsed.provider as Record<string, unknown>;
        if (provider.type === 'gemini' || provider.type === 'openrouter') {
          return {
            type: provider.type,
            model: typeof provider.model === 'string' ? provider.model : '',
          };
        }
      }
    } catch {
      // The JSON editor displays its own parse error on apply.
    }
    return config.provider;
  };

  const editorProvider = readEditorProvider();

  const updateEditorProvider = (provider: ProviderConfig) => {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      setJsonText(JSON.stringify({ ...parsed, provider }, null, 2));
      setError(null);
    } catch {
      setError('Fix the configuration JSON before changing provider settings.');
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_PRESETS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (typeof parsed === 'object' && parsed !== null) {
          setCustomPresets(parsed as Record<string, SystemConfig>);
        }
      }
    } catch (loadError) {
      console.error('Failed to load custom presets.', loadError);
    }
  }, []);

  const parseEditorConfig = (): SystemConfig => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('Configuration is not valid JSON.');
    }

    const result = validateAndNormalizeSystemConfig(parsed);
    if (!result.success || !result.config) {
      throw new Error(result.errors.join('\n'));
    }
    return result.config;
  };

  const handleApply = () => {
    try {
      const normalized = parseEditorConfig();
      onSave(normalized);
      onClose();
    } catch (applyError) {
      setError(
        applyError instanceof Error ? applyError.message : 'Invalid configuration.'
      );
    }
  };

  const updateApiKey = (provider: ProviderType, key: string) => {
    setApiKeys(writeProviderKey(provider, key));
  };

  const handleLoadPreset = (presetConfig: SystemConfig) => {
    setJsonText(JSON.stringify(presetConfig, null, 2));
    setError(null);
  };

  const handleInsertWorkflowTemplate = () => {
    try {
      const current = JSON.parse(jsonText) as SystemConfig;
      if (!Array.isArray(current.agents) || current.agents.length < 2) {
        throw new Error('Add at least two agents before inserting a workflow.');
      }

      const template: SystemConfig = {
        ...current,
        max_rounds: 0,
        workflow: [
          {
            id: 'step_1',
            name: 'PHASE_1_ANALYSIS',
            agentName: current.agents[0].name,
            instruction: 'Analyze the prompt and extract the key entities.',
          },
          {
            id: 'step_2',
            name: 'PHASE_2_CRITIQUE',
            agentName: current.agents[1].name,
            instruction: 'Review the previous output for accuracy and omissions.',
          },
        ],
      };
      setJsonText(JSON.stringify(template, null, 2));
      setError(null);
    } catch (templateError) {
      setError(
        templateError instanceof Error
          ? templateError.message
          : 'Invalid current JSON.'
      );
    }
  };

  const handleSaveCustomPreset = () => {
    try {
      if (!newPresetName.trim()) {
        throw new Error('Preset name is required.');
      }

      const normalized = parseEditorConfig();
      const key = newPresetName.trim().toUpperCase().replace(/\s+/g, '_');
      const updatedPresets = { ...customPresets, [key]: normalized };
      setCustomPresets(updatedPresets);
      localStorage.setItem(
        CUSTOM_PRESETS_KEY,
        JSON.stringify(updatedPresets)
      );
      setNewPresetName('');
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Invalid configuration.'
      );
    }
  };

  const handleDeletePreset = (
    key: string,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
    const updated = { ...customPresets };
    delete updated[key];
    setCustomPresets(updated);
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl h-[85vh] bg-zinc-950 border border-zinc-700 shadow-2xl flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col min-h-[200px] md:min-h-0">
          <div className="p-3 border-b border-zinc-800 bg-zinc-950/50">
            <h3 className="text-zinc-500 font-mono text-xs uppercase tracking-widest">
              Load Preset
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            <div className="space-y-2 px-2">
              <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-tighter">
                Provider &amp; Model
              </div>
              <select
                value={editorProvider.type}
                onChange={(event) =>
                  updateEditorProvider({
                    type: event.target.value as ProviderType,
                    model: '',
                  })
                }
                aria-label="AI provider"
                className="w-full bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-300 p-1.5 focus:border-veritas-cyan/50 focus:outline-none"
              >
                <option value="gemini">Gemini</option>
                <option value="openrouter">OpenRouter</option>
              </select>

              {editorProvider.type === 'openrouter' ? (
                <OpenRouterModelPicker
                  selectedModel={editorProvider.model}
                  onSelect={(model) =>
                    updateEditorProvider({ type: 'openrouter', model })
                  }
                />
              ) : (
                <div className="space-y-1">
                  <label className="text-[9px] text-zinc-500 font-mono uppercase">
                    Gemini model
                  </label>
                  <input
                    type="text"
                    value={editorProvider.model}
                    onChange={(event) =>
                      updateEditorProvider({
                        type: 'gemini',
                        model: event.target.value,
                      })
                    }
                    aria-label="Gemini model ID"
                    placeholder="Enter exact model ID"
                    autoComplete="off"
                    className="w-full bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-300 p-1.5 focus:border-veritas-cyan/50 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] text-zinc-600 font-bold mb-2 px-2 uppercase tracking-tighter">
                Provider Keys (Browser Local)
              </div>
              <div className="space-y-4 px-2">
                {(['gemini', 'openrouter'] as ProviderType[]).map((provider) => (
                  <div className="space-y-1" key={provider}>
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`${provider}-api-key`}
                        className="text-[9px] text-zinc-500 font-mono uppercase"
                      >
                        {provider}_api_key
                      </label>
                      {apiKeys[provider] && (
                        <button
                          type="button"
                          onClick={() => updateApiKey(provider, '')}
                          className="text-[8px] text-zinc-600 hover:text-red-400 font-mono uppercase"
                        >
                          Forget
                        </button>
                      )}
                    </div>
                    <input
                      id={`${provider}-api-key`}
                      type="password"
                      aria-label={`${provider} API key`}
                      value={apiKeys[provider] || ''}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        updateApiKey(provider, event.target.value)
                      }
                      autoComplete="off"
                      className="w-full bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-400 p-1.5 focus:border-veritas-cyan/50 focus:outline-none"
                      placeholder="Enter key..."
                    />
                  </div>
                ))}
                <p className="text-[9px] text-zinc-700 font-mono leading-relaxed">
                  Keys remain in this browser profile. Do not use this client-only
                  mode on shared devices.
                </p>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-zinc-600 font-bold mb-2 px-2">
                SYSTEM DEFAULTS
              </div>
              <div className="space-y-1">
                {Object.entries(PRESETS).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => handleLoadPreset(value)}
                    className="w-full text-left px-3 py-2 text-xs font-mono text-zinc-400 hover:bg-zinc-800 hover:text-veritas-cyan transition-colors rounded-sm"
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-zinc-600 font-bold mb-2 px-2">
                USER ARCHIVES
              </div>
              {Object.keys(customPresets).length === 0 && (
                <div className="px-3 text-[10px] text-zinc-700 italic">
                  No custom presets saved.
                </div>
              )}
              <div className="space-y-1">
                {Object.entries(customPresets).map(([key, value]) => (
                  <div key={key} className="flex group">
                    <button
                      type="button"
                      onClick={() => handleLoadPreset(value)}
                      className="flex-1 text-left px-3 py-2 text-xs font-mono text-zinc-300 hover:bg-zinc-800 hover:text-veritas-gold transition-colors rounded-sm"
                    >
                      {key}
                    </button>
                    <button
                      type="button"
                      onClick={(event: React.MouseEvent<HTMLButtonElement>) =>
                        handleDeletePreset(key, event)
                      }
                      aria-label={`Delete preset ${key}`}
                      className="px-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-800 mt-2 pt-2">
              <div className="text-[10px] text-zinc-600 font-bold mb-2 px-2">
                SCHEMA REFERENCE
              </div>
              <div className="px-3 text-[10px] text-zinc-500 space-y-2 font-mono">
                <p>Validation rules:</p>
                <ul className="list-disc list-inside opacity-70 space-y-1">
                  <li>Standard mode needs analyst, skeptic, and judge roles.</li>
                  <li>Validator and additional agents are optional.</li>
                  <li>Workflow mode supports any positive agent count.</li>
                  <li>provider.type: gemini or openrouter.</li>
                  <li>max_rounds: 0–10 (standard mode: at least 1).</li>
                </ul>
                <button
                  onClick={handleInsertWorkflowTemplate}
                  className="mt-2 w-full text-[9px] border border-zinc-700 hover:bg-zinc-800 py-1 text-veritas-cyan uppercase"
                >
                  + Insert Workflow Template
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col h-full min-w-0">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
            <h2 className="text-veritas-cyan font-mono text-lg font-bold">
              SYSTEM_CONFIGURATION.JSON
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close configuration editor"
              className="text-zinc-500 hover:text-white"
            >
              ESC
            </button>
          </div>

          <div className="flex-1 relative bg-black/50">
            <textarea
              value={jsonText}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                setJsonText(event.target.value)
              }
              className="w-full h-full bg-transparent text-zinc-300 font-mono text-sm p-4 resize-none focus:outline-none focus:ring-1 focus:ring-veritas-cyan/30"
              spellCheck={false}
              aria-label="System configuration JSON"
            />
          </div>

          <div className="p-4 border-t border-zinc-800 bg-zinc-900">
            {error && (
              <div className="text-red-500 whitespace-pre-wrap font-mono text-xs mb-3 border-l-2 border-red-500 pl-2 py-1 bg-red-950/20 max-h-28 overflow-y-auto">
                {error}
              </div>
            )}

            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="flex gap-2 items-center flex-1">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setNewPresetName(event.target.value)
                  }
                  placeholder="NEW_PRESET_NAME"
                  className="bg-zinc-950 border border-zinc-700 text-xs font-mono text-white px-3 py-2 w-full md:w-48 focus:outline-none focus:border-zinc-500"
                />
                <button
                  onClick={handleSaveCustomPreset}
                  className="whitespace-nowrap px-4 py-2 border border-zinc-700 text-zinc-400 font-mono text-xs hover:bg-zinc-800 hover:text-veritas-gold transition-colors"
                >
                  SAVE PRESET
                </button>
              </div>

              <div className="flex gap-4 justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-zinc-600 text-zinc-400 font-mono text-xs hover:bg-zinc-800 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleApply}
                  className="px-6 py-2 bg-veritas-cyan/10 border border-veritas-cyan text-veritas-cyan font-mono text-xs font-bold hover:bg-veritas-cyan/20 transition-colors"
                >
                  VALIDATE & APPLY
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
