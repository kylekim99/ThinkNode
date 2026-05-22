import type { GuideLine } from '../../hooks/useSnapGuides';

interface Props {
  guides: GuideLine[];
}

export function SnapGuideLines({ guides }: Props) {
  if (guides.length === 0) return null;

  return (
    <svg className="react-flow__snap-guides" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 1000,
    }}>
      {guides.map((guide, i) =>
        guide.type === 'vertical' ? (
          <line
            key={`v-${i}`}
            x1={guide.position}
            y1={-10000}
            x2={guide.position}
            y2={10000}
            stroke="#ef4444"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ) : (
          <line
            key={`h-${i}`}
            x1={-10000}
            y1={guide.position}
            x2={10000}
            y2={guide.position}
            stroke="#ef4444"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )
      )}
    </svg>
  );
}
