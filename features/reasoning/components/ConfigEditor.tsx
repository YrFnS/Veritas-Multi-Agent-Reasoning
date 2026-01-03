
import React, { useState, useEffect } from 'react';
import { SystemConfig } from '../types';
import { PRESETS } from '../constants';

interface ConfigEditorProps {
  config: SystemConfig;
  onSave: (newConfig: SystemConfig) => void;
  onClose: () => void;
}

const CUSTOM_PRESETS_KEY = 'veritas_custom_presets';

export const ConfigEditor: React.FC<ConfigEditorProps> = ({ config, onSave, onClose }) => {
  const [jsonText, setJsonText] = useState(JSON.stringify(config, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [customPresets, setCustomPresets] = useState<Record<string, SystemConfig>>({});
  const [newPresetName, setNewPresetName] = useState('');

  // Load custom presets on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_PRESETS_KEY);
      if (stored) {
        setCustomPresets(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load custom presets", e);
    }
  }, []);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      // Basic validation
      if (!parsed.agents || !Array.isArray(parsed.agents) || parsed.agents.length !== 3) {
        throw new Error("Configuration must include exactly 3 agents.");
      }
      onSave(parsed);
      onClose();
    } catch (e: any) {
      setError(e.message || "Invalid JSON");
    }
  };

  const handleLoadPreset = (presetConfig: SystemConfig) => {
    setJsonText(JSON.stringify(presetConfig, null, 2));
    setError(null);
  };

  const handleInsertWorkflowTemplate = () => {
    try {
        const current = JSON.parse(jsonText);
        const template = {
            ...current,
            workflow: [
                {
                    "id": "step_1",
                    "name": "PHASE_1_ANALYSIS",
                    "agentName": current.agents[0].name,
                    "instruction": "Analyze the prompt and extract key entities."
                },
                {
                    "id": "step_2",
                    "name": "PHASE_2_CRITIQUE",
                    "agentName": current.agents[1].name,
                    "instruction": "Review the entities from step 1 for accuracy."
                }
            ]
        };
        setJsonText(JSON.stringify(template, null, 2));
    } catch (e) {
        setError("Invalid current JSON. Fix before inserting template.");
    }
  };

  const handleSaveCustomPreset = () => {
    try {
      if (!newPresetName.trim()) throw new Error("Preset name required");
      
      const parsed = JSON.parse(jsonText);
      // Basic validation
      if (!parsed.agents || !Array.isArray(parsed.agents) || parsed.agents.length !== 3) {
        throw new Error("Invalid configuration structure. Must have 3 agents.");
      }
      
      // Store in Upper Case for consistency
      const key = newPresetName.trim().toUpperCase().replace(/\s+/g, '_');
      
      const updatedPresets = { ...customPresets, [key]: parsed };
      setCustomPresets(updatedPresets);
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updatedPresets));
      setNewPresetName('');
      setError(null); // Clear errors on success
    } catch (e: any) {
      setError(e.message || "Invalid JSON");
    }
  };

  const handleDeletePreset = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...customPresets };
    delete updated[key];
    setCustomPresets(updated);
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl h-[85vh] bg-zinc-950 border border-zinc-700 shadow-2xl flex flex-col md:flex-row overflow-hidden">
        
        {/* SIDEBAR: PRESETS */}
        <div className="w-full md:w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col min-h-[200px] md:min-h-0">
          <div className="p-3 border-b border-zinc-800 bg-zinc-950/50">
            <h3 className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Load Preset</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {/* SYSTEM PRESETS */}
            <div>
              <div className="text-[10px] text-zinc-600 font-bold mb-2 px-2">SYSTEM DEFAULTS</div>
              <div className="space-y-1">
                {Object.entries(PRESETS).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => handleLoadPreset(val as SystemConfig)}
                    className="w-full text-left px-3 py-2 text-xs font-mono text-zinc-400 hover:bg-zinc-800 hover:text-veritas-cyan transition-colors rounded-sm"
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            {/* CUSTOM PRESETS */}
            <div>
              <div className="text-[10px] text-zinc-600 font-bold mb-2 px-2">USER ARCHIVES</div>
              {Object.keys(customPresets).length === 0 && (
                 <div className="px-3 text-[10px] text-zinc-700 italic">No custom presets saved.</div>
              )}
              <div className="space-y-1">
                {Object.entries(customPresets).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => handleLoadPreset(val as SystemConfig)}
                    className="w-full text-left px-3 py-2 text-xs font-mono text-zinc-300 hover:bg-zinc-800 hover:text-veritas-gold transition-colors rounded-sm flex justify-between group"
                  >
                    <span>{key}</span>
                    <span 
                      onClick={(e) => handleDeletePreset(key, e)}
                      className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>

             {/* SCHEMA DOCS */}
             <div className="border-t border-zinc-800 mt-2 pt-2">
               <div className="text-[10px] text-zinc-600 font-bold mb-2 px-2">SCHEMA REFERENCE</div>
               <div className="px-3 text-[10px] text-zinc-500 space-y-2 font-mono">
                  <p>Overrides for optimal reasoning:</p>
                  <ul className="list-disc list-inside opacity-70">
                    <li><span className="text-veritas-cyan">thinkingBudget</span> (1024 - 32768)</li>
                    <li><span className="text-veritas-cyan">temperature</span> (0.0 - 2.0)</li>
                    <li><span className="text-veritas-cyan">topK</span> (1 - 40)</li>
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

        {/* MAIN EDITOR AREA */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
            <h2 className="text-veritas-cyan font-mono text-lg font-bold">SYSTEM_CONFIGURATION.JSON</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white">ESC</button>
          </div>
          
          <div className="flex-1 relative bg-black/50">
             <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full h-full bg-transparent text-zinc-300 font-mono text-sm p-4 resize-none focus:outline-none focus:ring-1 focus:ring-veritas-cyan/30"
              spellCheck={false}
            />
          </div>

          <div className="p-4 border-t border-zinc-800 bg-zinc-900">
            {error && <div className="text-red-500 font-mono text-xs mb-3 border-l-2 border-red-500 pl-2 py-1 bg-red-950/20">{error}</div>}
            
            <div className="flex flex-col md:flex-row justify-between gap-4">
              
              {/* SAVE PRESET CONTROL */}
              <div className="flex gap-2 items-center flex-1">
                 <input 
                    type="text" 
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
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

              {/* ACTION BUTTONS */}
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
                  COMPILE & APPLY
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
