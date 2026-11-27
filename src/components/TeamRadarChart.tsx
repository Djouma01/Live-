import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { StatPair } from '../lib/football';
import { buildRadarMetrics, type RadarMetricPoint } from '../lib/radarChart';

interface TeamRadarChartProps {
  statistics: StatPair[];
  homeName: string;
  awayName: string;
}

const SVG_WIDTH = 420;
const SVG_HEIGHT = 330;
const RADIUS = 100;
const RING_LEVELS = [0.25, 0.5, 0.75, 1];

export const TeamRadarChart: React.FC<TeamRadarChartProps> = ({
  statistics,
  homeName,
  awayName,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const metrics = useMemo(() => buildRadarMetrics(statistics), [statistics]);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const activeMetric: RadarMetricPoint | null = useMemo(() => {
    if (metrics.length === 0) return null;
    return metrics.find((m) => m.key === hoveredKey) || metrics[0];
  }, [metrics, hoveredKey]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || metrics.length < 3) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const cx = SVG_WIDTH / 2;
    const cy = SVG_HEIGHT / 2 + 4;
    const angleSlice = (Math.PI * 2) / metrics.length;
    const rScale = d3.scaleLinear().domain([0, 1]).range([0, RADIUS]);

    const root = svg
      .append('g')
      .attr('transform', `translate(${cx}, ${cy})`);

    // 1. Concentric polygonal grid rings
    const ringLine = d3
      .lineRadial<number>()
      .radius((d) => d)
      .angle((_d, i) => i * angleSlice)
      .curve(d3.curveLinearClosed);

    RING_LEVELS.forEach((lvl) => {
      const r = rScale(lvl);
      const pts = metrics.map(() => r);
      root
        .append('path')
        .datum(pts)
        .attr('d', ringLine)
        .attr('fill', lvl === 1 ? 'rgba(139, 92, 246, 0.04)' : 'none')
        .attr('stroke', 'rgba(255, 255, 255, 0.1)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', lvl < 1 ? '3,3' : 'none');

      root
        .append('text')
        .attr('x', 4)
        .attr('y', -r - 3)
        .attr('fill', 'rgba(161, 161, 170, 0.65)')
        .attr('font-size', '9px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text(`${Math.round(lvl * 100)}%`);
    });

    // 2. Radial axis spokes & labels
    metrics.forEach((m, idx) => {
      const angle = idx * angleSlice - Math.PI / 2;
      const x2 = Math.cos(angle) * RADIUS;
      const y2 = Math.sin(angle) * RADIUS;

      root
        .append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', 'rgba(255, 255, 255, 0.12)')
        .attr('stroke-width', 1);

      const labelRadius = RADIUS + 24;
      const lx = Math.cos(angle) * labelRadius;
      const ly = Math.sin(angle) * labelRadius;
      const anchor =
        Math.abs(Math.cos(angle)) < 0.2
          ? 'middle'
          : Math.cos(angle) > 0
          ? 'start'
          : 'end';

      const labelGroup = root
        .append('g')
        .style('cursor', 'pointer')
        .on('mouseenter', () => setHoveredKey(m.key))
        .on('click', () => setHoveredKey(m.key));

      labelGroup
        .append('text')
        .attr('x', lx)
        .attr('y', ly - 2)
        .attr('text-anchor', anchor)
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#E4E4E7')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .text(m.label);

      labelGroup
        .append('text')
        .attr('x', lx)
        .attr('y', ly + 12)
        .attr('text-anchor', anchor)
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .attr('fill', '#A1A1AA')
        .text(`${m.homeRaw} · ${m.awayRaw}`);
    });

    // 3. Team radar polygons using D3 radial generator
    const areaLine = d3
      .lineRadial<number>()
      .radius((d) => rScale(d))
      .angle((_d, i) => i * angleSlice)
      .curve(d3.curveLinearClosed);

    const drawTeamArea = (
      values: number[],
      strokeColor: string,
      fillColor: string,
      dotColor: string,
      teamLabel: 'home' | 'away'
    ) => {
      root
        .append('path')
        .datum(values)
        .attr('d', areaLine)
        .attr('fill', fillColor)
        .attr('stroke', strokeColor)
        .attr('stroke-width', 2.2)
        .attr('stroke-linejoin', 'round');

      values.forEach((val, idx) => {
        const angle = idx * angleSlice - Math.PI / 2;
        const px = Math.cos(angle) * rScale(val);
        const py = Math.sin(angle) * rScale(val);
        const metric = metrics[idx];

        root
          .append('circle')
          .attr('cx', px)
          .attr('cy', py)
          .attr('r', 4.5)
          .attr('fill', dotColor)
          .attr('stroke', '#0F0F16')
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer')
          .on('mouseenter', () => setHoveredKey(metric.key))
          .on('click', () => setHoveredKey(metric.key))
          .append('title')
          .text(
            `${metric.label} (${teamLabel === 'home' ? homeName : awayName}) : ${
              teamLabel === 'home' ? metric.homeRaw : metric.awayRaw
            }`
          );
      });
    };

    drawTeamArea(
      metrics.map((m) => m.awayNormalized),
      '#38BDF8',
      'rgba(56, 189, 248, 0.22)',
      '#7DD3FC',
      'away'
    );

    drawTeamArea(
      metrics.map((m) => m.homeNormalized),
      '#8B5CF6',
      'rgba(139, 92, 246, 0.30)',
      '#C4B5FD',
      'home'
    );
  }, [metrics, homeName, awayName]);

  if (metrics.length < 3) {
    return null;
  }

  return (
    <section
      aria-label="Graphique radar comparatif des performances"
      className="p-4 rounded-2xl bg-[#151520] border border-white/8 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-white">
            Radar comparatif des performances
          </h4>
          <p className="text-xs text-zinc-400">
            Possession, tirs cadrés, corners et efficacité offensive
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-zinc-200 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500" aria-hidden="true" />
            {homeName}
          </span>
          <span className="inline-flex items-center gap-1.5 text-zinc-200 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" aria-hidden="true" />
            {awayName}
          </span>
        </div>
      </div>

      <div className="w-full flex justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          role="img"
          aria-label={`Radar D3 comparant ${homeName} et ${awayName} sur ${metrics.map((m) => m.label).join(', ')}`}
          className="w-full max-w-[420px] h-auto select-none"
        />
      </div>

      {activeMetric && (
        <div className="px-3.5 py-2 rounded-xl bg-black/30 border border-white/6 flex items-center justify-between gap-3 text-xs">
          <span className="font-mono font-bold text-violet-300 tabular-nums">
            {homeName} : {activeMetric.homeRaw}
          </span>
          <span className="text-zinc-400 font-medium">{activeMetric.label}</span>
          <span className="font-mono font-bold text-sky-300 tabular-nums text-right">
            {activeMetric.awayRaw} : {awayName}
          </span>
        </div>
      )}
    </section>
  );
};
