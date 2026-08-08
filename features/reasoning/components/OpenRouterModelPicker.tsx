import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchOpenRouterModels,
  isFreeOpenRouterModel,
  searchOpenRouterModels,
} from '../services/openRouterModels.js';
import type { OpenRouterModel } from '../services/openRouterModels.js';

interface OpenRouterModelPickerProps {
  selectedModel: string;
  onSelect: (modelId: string) => void;
}

const formatContext = (value: number | undefined): string =>
  value ? `${new Intl.NumberFormat().format(value)} ctx` : 'context unknown';

const formatPrice = (value: string | undefined): string => {
  if (value === undefined) return 'unknown';
  const perMillion = Number(value) * 1_000_000;
  if (!Number.isFinite(perMillion)) return 'unknown';
  if (perMillion < 0) return 'varies';
  return perMillion === 0 ? 'free' : `$${perMillion.toFixed(2)}/M`;
};

export const OpenRouterModelPicker: React.FC<OpenRouterModelPickerProps> = ({
  selectedModel,
  onSelect,
}) => {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadModels = useCallback(
    async (forceRefresh = false, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        setModels(await fetchOpenRouterModels({ forceRefresh, signal }));
      } catch (loadError) {
        if (!signal?.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'OpenRouter model discovery is unavailable. Enter a model ID manually.'
          );
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadModels(false, controller.signal);
    return () => controller.abort();
  }, [loadModels]);

  const matches = useMemo(
    () => searchOpenRouterModels(models, query, freeOnly),
    [models, query, freeOnly]
  );
  const selectedMetadata = models.find((model) => model.id === selectedModel);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[9px] text-zinc-500 font-mono uppercase">
          OpenRouter model
        </label>
        <button
          type="button"
          onClick={() => void loadModels(true)}
          disabled={loading}
          className="text-[8px] text-veritas-cyan disabled:text-zinc-700 font-mono uppercase"
        >
          {loading ? 'Loading…' : 'Refresh catalog'}
        </button>
      </div>

      <input
        type="text"
        value={selectedModel}
        onChange={(event) => onSelect(event.target.value)}
        aria-label="OpenRouter model ID"
        placeholder="Enter exact model ID"
        autoComplete="off"
        className="w-full bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-300 p-1.5 focus:border-veritas-cyan/50 focus:outline-none"
      />
      <p className="text-[8px] text-zinc-700 font-mono">
        No default is chosen. Select from the live catalog or enter an exact ID.
      </p>

      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search OpenRouter models"
          placeholder="Search name or ID"
          className="min-w-0 flex-1 bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-300 p-1.5 focus:border-veritas-cyan/50 focus:outline-none"
        />
        <label className="flex items-center gap-1 text-[8px] text-zinc-500 font-mono whitespace-nowrap">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(event) => setFreeOnly(event.target.checked)}
          />
          Free
        </label>
      </div>

      {error && <p className="text-[9px] text-amber-400 font-mono">{error}</p>}

      {selectedMetadata && (
        <div className="border border-veritas-cyan/30 bg-veritas-cyan/5 p-2 text-[9px] font-mono">
          <div className="text-veritas-cyan">{selectedMetadata.name}</div>
          <div className="text-zinc-500 break-all">{selectedMetadata.id}</div>
          <div className="text-zinc-600">
            {formatContext(selectedMetadata.contextLength)} · prompt{' '}
            {formatPrice(selectedMetadata.pricing?.prompt)} · completion{' '}
            {formatPrice(selectedMetadata.pricing?.completion)}
            {isFreeOpenRouterModel(selectedMetadata) ? ' · FREE' : ''}
          </div>
        </div>
      )}

      {!loading && models.length > 0 && (
        <div className="max-h-48 overflow-y-auto border border-zinc-800 divide-y divide-zinc-900">
          {matches.slice(0, 80).map((model) => (
            <button
              type="button"
              key={model.id}
              onClick={() => onSelect(model.id)}
              aria-pressed={model.id === selectedModel}
              className={`w-full text-left p-2 font-mono hover:bg-zinc-800 ${
                model.id === selectedModel ? 'bg-veritas-cyan/10' : 'bg-zinc-950'
              }`}
            >
              <div className="text-[10px] text-zinc-300">{model.name}</div>
              <div className="text-[8px] text-zinc-600 break-all">{model.id}</div>
              <div className="text-[8px] text-zinc-700">
                {formatContext(model.contextLength)} · prompt{' '}
                {formatPrice(model.pricing?.prompt)} · completion{' '}
                {formatPrice(model.pricing?.completion)}
              </div>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="p-2 text-[9px] text-zinc-600 font-mono">
              No catalog matches. Enter an exact model ID above.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
