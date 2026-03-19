import './StatCharts.css';

const DEFAULT_WIDTH = 640;

function toFiniteValues(data, valueKey) {
  return data
    .map((item) => Number(item?.[valueKey]))
    .filter((value) => Number.isFinite(value));
}

function buildDomain(values, includeZero = false) {
  if (values.length === 0) {
    return { min: 0, max: 1 };
  }

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.12, 1);
    return { min: min - padding, max: max + padding };
  }

  const padding = (max - min) * 0.08;
  return { min: min - padding, max: max + padding };
}

function buildTrendPoints(data, valueKey, dimensions, includeZero) {
  const values = toFiniteValues(data, valueKey);
  const domain = buildDomain(values, includeZero);
  const innerWidth = DEFAULT_WIDTH - dimensions.left - dimensions.right;
  const innerHeight = dimensions.height - dimensions.top - dimensions.bottom;

  const xForIndex = (index) => {
    if (data.length === 1) {
      return dimensions.left + innerWidth / 2;
    }
    return dimensions.left + (innerWidth * index) / (data.length - 1);
  };

  const yForValue = (value) => {
    const ratio = (value - domain.min) / (domain.max - domain.min);
    return dimensions.height - dimensions.bottom - ratio * innerHeight;
  };

  const points = data
    .map((item, index) => {
      const value = Number(item?.[valueKey]);
      if (!Number.isFinite(value)) {
        return null;
      }

      return {
        x: xForIndex(index),
        y: yForValue(value),
        value,
        label: item?.label ?? item?.dateLabel ?? item?.date ?? '',
      };
    })
    .filter(Boolean);

  return { points, domain, yForValue };
}

function buildLinePath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function buildAreaPath(points, baselineY) {
  if (points.length === 0) {
    return '';
  }

  return [
    buildLinePath(points),
    `L ${points[points.length - 1].x} ${baselineY}`,
    `L ${points[0].x} ${baselineY}`,
    'Z',
  ].join(' ');
}

function buildFooterLabels(data, labelKey) {
  if (data.length === 0) {
    return [];
  }

  const candidates = [
    data[0]?.[labelKey],
    data[Math.floor(data.length / 2)]?.[labelKey],
    data[data.length - 1]?.[labelKey],
  ].filter(Boolean);

  return candidates.filter((label, index) => candidates.indexOf(label) === index);
}

export function StatLineChart({
  data = [],
  valueKey = 'value',
  labelKey = 'label',
  color = 'var(--accent-primary)',
  area = false,
  height = 220,
  includeZero = false,
  emptyText = 'No chart data available.',
}) {
  if (data.length === 0) {
    return <div className="stat-chart-empty">{emptyText}</div>;
  }

  const dimensions = { top: 16, right: 14, bottom: 28, left: 14, height };
  const { points, domain, yForValue } = buildTrendPoints(data, valueKey, dimensions, includeZero);

  if (points.length === 0) {
    return <div className="stat-chart-empty">{emptyText}</div>;
  }

  const linePath = buildLinePath(points);
  const baselineY =
    includeZero && domain.min <= 0 && domain.max >= 0
      ? yForValue(0)
      : height - dimensions.bottom;
  const footerLabels = buildFooterLabels(data, labelKey);

  return (
    <div className="stat-chart-shell">
      <svg
        className="stat-chart-svg"
        viewBox={`0 0 ${DEFAULT_WIDTH} ${height}`}
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3].map((index) => {
          const y = dimensions.top + ((height - dimensions.top - dimensions.bottom) * index) / 3;
          return (
            <line
              key={index}
              x1={dimensions.left}
              y1={y}
              x2={DEFAULT_WIDTH - dimensions.right}
              y2={y}
              className="stat-chart-grid"
            />
          );
        })}

        {includeZero && domain.min <= 0 && domain.max >= 0 && (
          <line
            x1={dimensions.left}
            y1={baselineY}
            x2={DEFAULT_WIDTH - dimensions.right}
            y2={baselineY}
            className="stat-chart-zero"
          />
        )}

        {area && (
          <path
            d={buildAreaPath(points, baselineY)}
            fill={color}
            fillOpacity="0.14"
            stroke="none"
          />
        )}

        <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />

        {points.length > 1 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="5"
            fill={color}
            className="stat-chart-dot"
          />
        )}
      </svg>

      {footerLabels.length > 0 && (
        <div className="stat-chart-footer">
          {footerLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatHistogramChart({
  data = [],
  valueKey = 'count',
  labelKey = 'label',
  height = 200,
  emptyText = 'No distribution data available.',
}) {
  if (data.length === 0) {
    return <div className="stat-chart-empty">{emptyText}</div>;
  }

  const dimensions = { top: 16, right: 14, bottom: 28, left: 14 };
  const innerWidth = DEFAULT_WIDTH - dimensions.left - dimensions.right;
  const innerHeight = height - dimensions.top - dimensions.bottom;
  const maxValue = Math.max(...toFiniteValues(data, valueKey), 1);
  const step = innerWidth / data.length;
  const barWidth = Math.max(10, step * 0.72);
  const footerLabels = buildFooterLabels(data, labelKey);

  return (
    <div className="stat-chart-shell">
      <svg
        className="stat-chart-svg"
        viewBox={`0 0 ${DEFAULT_WIDTH} ${height}`}
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3].map((index) => {
          const y = dimensions.top + (innerHeight * index) / 3;
          return (
            <line
              key={index}
              x1={dimensions.left}
              y1={y}
              x2={DEFAULT_WIDTH - dimensions.right}
              y2={y}
              className="stat-chart-grid"
            />
          );
        })}

        {data.map((item, index) => {
          const value = Number(item?.[valueKey]) || 0;
          const label = String(item?.[labelKey] ?? '');
          const x = dimensions.left + index * step + (step - barWidth) / 2;
          const barHeight = (value / maxValue) * innerHeight;
          const y = height - dimensions.bottom - barHeight;
          const tone =
            parseFloat(label) >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

          return (
            <rect
              key={`${label}-${index}`}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 2)}
              rx="2"
              fill={tone}
              fillOpacity="0.85"
            />
          );
        })}
      </svg>

      {footerLabels.length > 0 && (
        <div className="stat-chart-footer">
          {footerLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
