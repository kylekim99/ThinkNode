import { useEffect, useState } from 'react';
import { parseISO, isToday, isPast, differenceInDays, format, endOfWeek, addWeeks } from 'date-fns';
import { getAllMaps, getMapData } from '../../db/database';
import { useMapStore } from '../../store/useMapStore';
import { useTagStore } from '../../store/useTagStore';

interface TimelineItem {
  nodeId: string;
  nodeContent: string;
  dueDate: string;
  mapId: string;
  mapName: string;
}

type TimelineGroup = 'overdue' | 'today' | 'thisWeek' | 'nextWeek' | 'later';

const groupLabels: Record<TimelineGroup, string> = {
  overdue: 'Overdue',
  today: 'Today',
  thisWeek: 'This Week',
  nextWeek: 'Next Week',
  later: 'Later',
};

const groupColors: Record<TimelineGroup, { header: string; accent: string }> = {
  overdue: { header: 'text-red-600', accent: 'border-l-red-400' },
  today: { header: 'text-amber-600', accent: 'border-l-amber-400' },
  thisWeek: { header: 'text-blue-600', accent: 'border-l-blue-400' },
  nextWeek: { header: 'text-slate-600', accent: 'border-l-slate-400' },
  later: { header: 'text-green-600', accent: 'border-l-green-400' },
};

function getStatusBadge(dueDate: string) {
  const parsed = parseISO(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInDays(parsed, today);

  if (isToday(parsed)) {
    return { label: 'Due today', className: 'bg-amber-100 text-amber-700' };
  }
  if (isPast(parsed)) {
    return { label: 'Overdue', className: 'bg-red-100 text-red-700' };
  }
  if (diff <= 3) {
    return { label: 'Upcoming', className: 'bg-amber-100 text-amber-600' };
  }
  return { label: 'Scheduled', className: 'bg-green-100 text-green-700' };
}

function classifyItem(dueDate: string): TimelineGroup {
  const parsed = parseISO(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (isToday(parsed)) return 'today';
  if (isPast(parsed)) return 'overdue';

  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  if (parsed <= weekEnd) return 'thisWeek';

  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  if (parsed <= nextWeekEnd) return 'nextWeek';

  return 'later';
}

export function TimelineView() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadMap = useMapStore((s) => s.loadMap);
  const selectNode = useMapStore((s) => s.selectNode);
  const setViewMode = useTagStore((s) => s.setViewMode);

  useEffect(() => {
    async function scan() {
      setLoading(true);
      const maps = await getAllMaps();
      const collected: TimelineItem[] = [];

      for (const map of maps) {
        const data = await getMapData(map.id);
        if (!data) continue;

        for (const node of data.nodes) {
          if (node.data.dueDate) {
            collected.push({
              nodeId: node.id,
              nodeContent: node.data.content,
              dueDate: node.data.dueDate,
              mapId: map.id,
              mapName: map.name,
            });
          }
        }
      }

      collected.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setItems(collected);
      setLoading(false);
    }

    scan();
  }, []);

  async function handleItemClick(item: TimelineItem) {
    await loadMap(item.mapId);
    selectNode(item.nodeId);
    setViewMode('mindmap');
  }

  function handleBack() {
    setViewMode('mindmap');
  }

  // Group items
  const grouped: Record<TimelineGroup, TimelineItem[]> = {
    overdue: [],
    today: [],
    thisWeek: [],
    nextWeek: [],
    later: [],
  };

  for (const item of items) {
    const group = classifyItem(item.dueDate);
    grouped[group].push(item);
  }

  const groupOrder: TimelineGroup[] = ['overdue', 'today', 'thisWeek', 'nextWeek', 'later'];

  return (
    <div className="flex-1 h-full bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Timeline
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {items.length} node{items.length !== 1 ? 's' : ''} with due dates
          </p>
        </div>
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to map
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">Loading timeline...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">No nodes with due dates yet.</p>
            <p className="text-xs mt-1 text-slate-300">Select a node and set a due date in the properties panel.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupOrder.map((group) => {
              const groupItems = grouped[group];
              if (groupItems.length === 0) return null;
              const colors = groupColors[group];

              return (
                <div key={group}>
                  <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${colors.header}`}>
                    {group === 'overdue' && (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    {groupLabels[group]}
                    <span className="text-slate-400 font-normal">({groupItems.length})</span>
                  </h3>
                  <div className="space-y-1.5">
                    {groupItems.map((item) => {
                      const badge = getStatusBadge(item.dueDate);
                      const parsedDate = parseISO(item.dueDate);
                      return (
                        <button
                          key={`${item.mapId}-${item.nodeId}`}
                          onClick={() => handleItemClick(item)}
                          className={`w-full text-left px-4 py-3 bg-white rounded-lg border border-slate-200 border-l-4 ${colors.accent} hover:border-blue-300 hover:shadow-sm transition-all group`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-slate-800 group-hover:text-blue-700 transition-colors truncate">
                                {item.nodeContent}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                {item.mapName}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.className}`}>
                                {badge.label}
                              </span>
                              <span className="text-xs text-slate-400">
                                {format(parsedDate, 'MMM d, yyyy')}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
