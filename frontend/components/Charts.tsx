"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/api";

export interface ChartSegment {
  label: string;
  value: number;
  count?: number;
  color: string;
}

export interface PieChartProps {
  segments: ChartSegment[];
  size?: number;
  donut?: boolean;
  donutWidth?: number;
  showLegend?: boolean;
  className?: string;
}

export function PieChart({
  segments,
  size = 200,
  donut = false,
  donutWidth = 40,
  showLegend = true,
  className = "",
}: PieChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = segments.reduce((s, seg) => s + (seg.value > 0 ? seg.value : 0), 0);
  const activeSegments = segments.filter((s) => s.value > 0);

  const cx = size / 2;
  const cy = size / 2;
  const margin = 14;
  const outerR = cx - margin;
  const innerR = donut ? outerR - donutWidth : 0;

  // Compute angles for each active segment
  let currentAngle = 0;
  const slices = activeSegments.map((seg) => {
    const fraction = total > 0 ? seg.value / total : 0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + fraction * 2 * Math.PI;
    const midAngle = (startAngle + endAngle) / 2;
    currentAngle = endAngle;

    return {
      ...seg,
      originalIndex: segments.findIndex((s) => s.label === seg.label),
      fraction,
      startAngle,
      endAngle,
      midAngle,
    };
  });

  const getSlicePath = (slice: (typeof slices)[0]) => {
    if (activeSegments.length === 1) return null;
    const { startAngle, endAngle } = slice;
    const x1 = cx + outerR * Math.sin(startAngle);
    const y1 = cy - outerR * Math.cos(startAngle);
    const x2 = cx + outerR * Math.sin(endAngle);
    const y2 = cy - outerR * Math.cos(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    if (!donut) {
      return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    } else {
      const x1i = cx + innerR * Math.sin(startAngle);
      const y1i = cy - innerR * Math.cos(startAngle);
      const x2i = cx + innerR * Math.sin(endAngle);
      const y2i = cy - innerR * Math.cos(endAngle);
      return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x2i.toFixed(2)} ${y2i.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)} Z`;
    }
  };

  const hoveredSlice = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-6 ${className}`}>
      {/* SVG Container */}
      <div
        className="relative shrink-0 flex items-center justify-center select-none"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
          role="img"
          aria-label="Pie Chart"
        >
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={outerR} fill="#f1f5f9" stroke="#e2e8f0" strokeWidth={2} />
          ) : activeSegments.length === 1 ? (
            <circle
              cx={cx}
              cy={cy}
              r={outerR}
              fill={activeSegments[0].color}
              stroke="#ffffff"
              strokeWidth={2}
              className="cursor-pointer transition-transform duration-200 hover:scale-105"
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              onMouseEnter={() => setHoveredIdx(0)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ) : (
            slices.map((slice) => {
              const path = getSlicePath(slice);
              if (!path) return null;
              const isHovered = hoveredIdx === slice.originalIndex;

              // Pop-out translation along center bisector angle
              const popDist = isHovered ? 8 : 0;
              const dx = popDist * Math.sin(slice.midAngle);
              const dy = -popDist * Math.cos(slice.midAngle);

              return (
                <path
                  key={slice.label}
                  d={path}
                  fill={slice.color}
                  stroke="#ffffff"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
                    filter: isHovered
                      ? "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2)) brightness(1.06)"
                      : "none",
                  }}
                  onMouseEnter={() => setHoveredIdx(slice.originalIndex)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredSlice && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-line bg-white/95 px-3 py-1.5 shadow-md backdrop-blur-xs transition-opacity duration-150 text-center"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {hoveredSlice.label}
            </p>
            <p className="tabular text-sm font-bold text-ink">
              {formatMoney(hoveredSlice.value)}
            </p>
            <p className="text-[10px] text-faint">
              {total > 0 ? `${((hoveredSlice.value / total) * 100).toFixed(1)}%` : "0%"}
              {hoveredSlice.count !== undefined && ` · ${hoveredSlice.count} invoice${hoveredSlice.count === 1 ? "" : "s"}`}
            </p>
          </div>
        )}
      </div>

      {/* Interactive Legend */}
      {showLegend && (
        <div className="w-full min-w-0 space-y-1.5">
          {segments.map((seg, idx) => {
            const isHovered = hoveredIdx === idx;
            const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : "0";
            return (
              <div
                key={seg.label}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  isHovered
                    ? "bg-slate-100 shadow-2xs font-semibold scale-[1.02]"
                    : "hover:bg-slate-50 text-ink-2"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-3 w-3 rounded-full shrink-0 transition-transform ${
                      isHovered ? "scale-125 ring-2 ring-offset-1 ring-slate-300" : ""
                    }`}
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-ink truncate">{seg.label}</span>
                  {seg.count !== undefined && (
                    <span className="text-faint text-[11px]">({seg.count})</span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="tabular font-semibold text-ink">
                    {formatMoney(seg.value)}
                  </span>
                  <span className="tabular ml-2 text-faint text-[11px]">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface DonutChartProps {
  segments: ChartSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
  showLegend?: boolean;
}

export function DonutChart({
  segments,
  size = 190,
  strokeWidth = 24,
  centerLabel = "Total",
  centerValue,
  showLegend = true,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = segments.reduce((s, seg) => s + (seg.value > 0 ? seg.value : 0), 0);
  const activeSegments = segments.filter((s) => s.value > 0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativePercent = 0;

  const hoveredSeg = hoveredIndex !== null ? segments[hoveredIndex] : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* SVG Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rotate-[-90deg] transition-transform duration-300"
          role="img"
          aria-label="Donut Chart"
        >
          {/* Base background ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {total === 0 ? (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
            />
          ) : (
            activeSegments.map((seg) => {
              const segPercent = seg.value / total;
              const dashLength = segPercent * circumference;
              const spaceLength = circumference - dashLength;
              const strokeOffset = -cumulativePercent * circumference;
              cumulativePercent += segPercent;

              const originalIndex = segments.findIndex((s) => s.label === seg.label);
              const isHovered = hoveredIndex === originalIndex;

              return (
                <circle
                  key={seg.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${dashLength} ${spaceLength}`}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(originalIndex)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })
          )}
        </svg>

        {/* Center content */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          {hoveredSeg ? (
            <>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted truncate max-w-[110px]">
                {hoveredSeg.label}
              </span>
              <span className="tabular text-base font-bold text-ink leading-tight">
                {formatMoney(hoveredSeg.value)}
              </span>
              <span className="text-[10px] text-faint">
                {total > 0 ? `${((hoveredSeg.value / total) * 100).toFixed(1)}%` : "0%"}
                {hoveredSeg.count !== undefined && ` · ${hoveredSeg.count}`}
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
                {centerLabel}
              </span>
              <span className="tabular text-base font-bold text-ink leading-tight">
                {centerValue ?? formatMoney(total)}
              </span>
              <span className="text-[10px] text-faint">
                {activeSegments.length} {activeSegments.length === 1 ? "category" : "categories"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="w-full min-w-0 space-y-2">
          {segments.map((seg, idx) => {
            const isHovered = hoveredIndex === idx;
            const pct = total > 0 ? ((seg.value / total) * 100).toFixed(0) : "0";
            return (
              <div
                key={seg.label}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  isHovered ? "bg-slate-100/80 font-medium" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-ink truncate">{seg.label}</span>
                  {seg.count !== undefined && (
                    <span className="text-faint text-[11px]">({seg.count})</span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="tabular font-semibold text-ink">
                    {formatMoney(seg.value)}
                  </span>
                  <span className="tabular ml-1.5 text-faint text-[11px]">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface MonthlyBarData {
  month: string;
  year?: number;
  billed: number;
  collected: number;
}

interface MonthlyBarChartProps {
  data: MonthlyBarData[];
  height?: number;
}

export function MonthlyBarChart({ data, height = 210 }: MonthlyBarChartProps) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-muted">
        No billing data for chart.
      </div>
    );
  }

  const maxVal = Math.max(...data.flatMap((d) => [d.billed, d.collected]), 100);
  const chartHeight = height - 55;
  const chartWidth = 520;
  const paddingLeft = 45;
  const paddingRight = 15;
  const availableWidth = chartWidth - paddingLeft - paddingRight;
  const stepX = availableWidth / data.length;
  const barWidth = Math.max(8, Math.min(16, stepX / 3.2));

  // Y-axis grid lines (4 intervals)
  const gridTicks = [0, 0.33, 0.66, 1];

  return (
    <div className="w-full">
      {/* Top Legend */}
      <div className="flex items-center justify-end gap-4 pb-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
          <span>Billed</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          <span>Collected</span>
        </span>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="w-full overflow-visible"
          style={{ maxHeight: height }}
        >
          {/* Horizontal Grid lines */}
          {gridTicks.map((tick) => {
            const y = chartHeight - tick * (chartHeight - 15) + 10;
            const val = tick * maxVal;
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  className="tabular"
                >
                  {val >= 1000 ? `${(val / 1000).toFixed(val >= 10000 ? 0 : 1)}k` : val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((d, i) => {
            const centerX = paddingLeft + i * stepX + stepX / 2;
            const billedH = (d.billed / maxVal) * (chartHeight - 15);
            const collectedH = (d.collected / maxVal) * (chartHeight - 15);
            const isHovered = hoveredMonth === i;

            const billedY = chartHeight + 10 - billedH;
            const collectedY = chartHeight + 10 - collectedH;

            return (
              <g
                key={d.month + i}
                onMouseEnter={() => setHoveredMonth(i)}
                onMouseLeave={() => setHoveredMonth(null)}
                className="cursor-pointer"
              >
                {/* Hover backdrop column */}
                <rect
                  x={centerX - stepX / 2 + 2}
                  y={10}
                  width={stepX - 4}
                  height={chartHeight}
                  fill={isHovered ? "#f8fafc" : "transparent"}
                  rx="6"
                  className="transition-colors"
                />

                {/* Billed Bar (Blue) */}
                <rect
                  x={centerX - barWidth - 1.5}
                  y={billedY}
                  width={barWidth}
                  height={Math.max(2, billedH)}
                  rx="3"
                  className={`transition-all ${
                    isHovered ? "fill-blue-600" : "fill-blue-500"
                  }`}
                />

                {/* Collected Bar (Emerald) */}
                <rect
                  x={centerX + 1.5}
                  y={collectedY}
                  width={barWidth}
                  height={Math.max(2, collectedH)}
                  rx="3"
                  className={`transition-all ${
                    isHovered ? "fill-emerald-600" : "fill-emerald-500"
                  }`}
                />

                {/* X Axis Label */}
                <text
                  x={centerX}
                  y={chartHeight + 28}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? "600" : "400"}
                  fill={isHovered ? "#0f172a" : "#64748b"}
                >
                  {d.month}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoveredMonth !== null && data[hoveredMonth] && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-line bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-xs transition-all"
            style={{
              left: `${Math.min(
                Math.max(10, ((paddingLeft + hoveredMonth * stepX + stepX / 2) / chartWidth) * 100),
                80
              )}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-semibold text-ink">
              {data[hoveredMonth].month} {data[hoveredMonth].year ?? ""}
            </p>
            <div className="mt-1 space-y-0.5 tabular text-[11px]">
              <div className="flex items-center justify-between gap-3 text-blue-600">
                <span>Billed:</span>
                <span className="font-semibold">{formatMoney(data[hoveredMonth].billed)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-emerald-600">
                <span>Collected:</span>
                <span className="font-semibold">{formatMoney(data[hoveredMonth].collected)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
