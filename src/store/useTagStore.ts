import { create } from 'zustand';
import { getAllMaps, getMapData } from '../db/database';
import { parseTags } from '../lib/tagParser';

export interface TagEntry {
  mapId: string;
  mapName: string;
  nodeId: string;
  nodeContent: string;
  tags: string[];
}

interface TagStore {
  // Global tag index: tag -> TagEntry[]
  tagIndex: Map<string, TagEntry[]>;

  // Search/filter state
  selectedTag: string | null;
  searchQuery: string;
  searchResults: TagEntry[];

  // View mode
  viewMode: 'mindmap' | 'search' | 'merged' | 'timeline';

  // Search overlay
  searchOverlayOpen: boolean;

  // Actions
  buildTagIndex: () => Promise<void>;
  selectTag: (tag: string | null) => void;
  search: (query: string) => void;
  setViewMode: (mode: 'mindmap' | 'search' | 'merged' | 'timeline') => void;
  setSearchOverlayOpen: (open: boolean) => void;
}

export const useTagStore = create<TagStore>((set, get) => ({
  tagIndex: new Map(),
  selectedTag: null,
  searchQuery: '',
  searchResults: [],
  viewMode: 'mindmap',
  searchOverlayOpen: false,

  buildTagIndex: async () => {
    const maps = await getAllMaps();
    const newIndex = new Map<string, TagEntry[]>();

    for (const map of maps) {
      const data = await getMapData(map.id);
      if (!data) continue;

      for (const node of data.nodes) {
        const tags = parseTags(node.data.content);
        if (tags.length === 0) continue;

        const entry: TagEntry = {
          mapId: map.id,
          mapName: map.name,
          nodeId: node.id,
          nodeContent: node.data.content,
          tags,
        };

        for (const tag of tags) {
          const existing = newIndex.get(tag) || [];
          existing.push(entry);
          newIndex.set(tag, existing);
        }
      }
    }

    set({ tagIndex: newIndex });

    // If there's a selected tag, refresh search results
    const { selectedTag } = get();
    if (selectedTag) {
      const results = newIndex.get(selectedTag) || [];
      set({ searchResults: results });
    }
  },

  selectTag: (tag: string | null) => {
    const { tagIndex } = get();
    if (tag) {
      const results = tagIndex.get(tag) || [];
      set({ selectedTag: tag, searchResults: results, viewMode: 'search' });
    } else {
      set({ selectedTag: null, searchResults: [], viewMode: 'mindmap' });
    }
  },

  search: (query: string) => {
    const { tagIndex } = get();
    const q = query.toLowerCase().trim();

    if (!q) {
      set({ searchQuery: query, searchResults: [] });
      return;
    }

    const results: TagEntry[] = [];
    const seenNodeIds = new Set<string>();

    // Search across all entries in the tag index
    for (const [_tag, entries] of tagIndex) {
      for (const entry of entries) {
        if (seenNodeIds.has(`${entry.mapId}-${entry.nodeId}`)) continue;

        const matchesContent = entry.nodeContent.toLowerCase().includes(q);
        const matchesTags = entry.tags.some((t) => t.toLowerCase().includes(q));

        if (matchesContent || matchesTags) {
          results.push(entry);
          seenNodeIds.add(`${entry.mapId}-${entry.nodeId}`);
        }
      }
    }

    set({ searchQuery: query, searchResults: results });
  },

  setViewMode: (mode: 'mindmap' | 'search' | 'merged' | 'timeline') => {
    set({ viewMode: mode });
  },

  setSearchOverlayOpen: (open: boolean) => {
    set({ searchOverlayOpen: open });
    if (!open) {
      set({ searchQuery: '', searchResults: [] });
    }
  },
}));
