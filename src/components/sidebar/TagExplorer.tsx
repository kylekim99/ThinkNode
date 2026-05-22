import { useEffect } from 'react';
import { useTagStore } from '../../store/useTagStore';

export function TagExplorer() {
  const tagIndex = useTagStore((s) => s.tagIndex);
  const selectedTag = useTagStore((s) => s.selectedTag);
  const selectTag = useTagStore((s) => s.selectTag);
  const buildTagIndex = useTagStore((s) => s.buildTagIndex);

  useEffect(() => {
    buildTagIndex();
  }, [buildTagIndex]);

  // Sort tags alphabetically
  const sortedTags = Array.from(tagIndex.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <div className="flex flex-col border-t border-slate-200">
      <div className="px-4 py-2.5 flex items-center gap-2">
        <svg
          className="w-4 h-4 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
        <h3 className="text-sm font-semibold text-slate-800">Tags</h3>
      </div>

      {sortedTags.length === 0 ? (
        <div className="px-4 py-3 text-xs text-slate-400 text-center">
          No tags yet. Use #tag in nodes.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[200px]">
          {sortedTags.map(([tag, entries]) => (
            <button
              key={tag}
              onClick={() => selectTag(selectedTag === tag ? null : tag)}
              className={`
                w-full flex items-center justify-between px-4 py-1.5 text-left
                hover:bg-slate-50 transition-colors
                ${selectedTag === tag ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}
              `}
            >
              <span className="text-xs font-medium truncate">#{tag}</span>
              <span
                className={`
                  text-xs px-1.5 py-0.5 rounded-full
                  ${selectedTag === tag ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}
                `}
              >
                {entries.length}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
