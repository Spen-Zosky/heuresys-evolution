'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { CareerRecommendation } from '@/lib/api/endpoints/career-intelligence';

// ============================================
// TYPES
// ============================================

interface CareerGraphProps {
  centerLabel: string;
  recommendations: CareerRecommendation[];
  onNodeClick: (rec: CareerRecommendation) => void;
  selectedNodeId?: string;
}

// ============================================
// HELPERS
// ============================================

function getCoverageColor(coverage: number): string {
  if (coverage >= 0.7) return '#37b24d';
  if (coverage >= 0.4) return '#f59f00';
  return '#e03131';
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

// ============================================
// CAREER GRAPH COMPONENT
// ============================================

export function CareerGraph({
  centerLabel,
  recommendations,
  onNodeClick,
  selectedNodeId,
}: CareerGraphProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const cx = 400;
  const cy = 400;
  const radius = 280;
  const centerR = 50;
  const nodeR = 35;

  const nodes = useMemo(() => {
    return recommendations.map((rec, i) => {
      const angle = (2 * Math.PI * i) / recommendations.length - Math.PI / 2;
      return {
        ...rec,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        angle,
      };
    });
  }, [recommendations]);

  return (
    <div className="w-full" style={{ aspectRatio: '1 / 1', maxWidth: 800 }}>
      <svg
        viewBox="0 0 800 800"
        className="w-full h-full"
        role="img"
        aria-label="Career recommendations graph"
      >
        {/* Connection lines */}
        {nodes.map((node) => (
          <motion.line
            key={`line-${node.occupationId}`}
            x1={cx}
            y1={cy}
            x2={node.x}
            y2={node.y}
            stroke={getCoverageColor(node.skillCoverage)}
            strokeWidth={1.5}
            strokeOpacity={Math.max(0.15, node.embeddingMatch)}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />
        ))}

        {/* Center node */}
        <circle cx={cx} cy={cy} r={centerR} fill="#1e293b" />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize={11}
          fontWeight={600}
        >
          {truncate(centerLabel, 18)}
        </text>

        {/* Recommendation nodes */}
        {nodes.map((node, i) => {
          const isHovered = hoveredId === node.occupationId;
          const isSelected = selectedNodeId === node.occupationId;
          const color = getCoverageColor(node.skillCoverage);
          const readiness = Math.round(node.skillCoverage * 100);

          return (
            <motion.g
              key={node.occupationId}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
              style={{ transformOrigin: `${node.x}px ${node.y}px`, cursor: 'pointer' }}
              onMouseEnter={() => setHoveredId(node.occupationId)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onNodeClick(node)}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeR + 5}
                  fill="none"
                  stroke={color}
                  strokeWidth={3}
                  strokeDasharray="6 3"
                />
              )}

              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={nodeR}
                fill={color}
                fillOpacity={0.15}
                stroke={color}
                strokeWidth={2}
                transform={isHovered ? `scale(1.1)` : undefined}
                style={{
                  transformOrigin: `${node.x}px ${node.y}px`,
                  transition: 'transform 0.15s ease-out',
                }}
              />

              {/* Occupation label */}
              <text
                x={node.x}
                y={node.y - 6}
                textAnchor="middle"
                dominantBaseline="central"
                fill="currentColor"
                fontSize={9}
                fontWeight={500}
                className="fill-foreground"
              >
                {truncate(node.occupationLabel, 20)}
              </text>

              {/* Readiness percentage */}
              <text
                x={node.x}
                y={node.y + 10}
                textAnchor="middle"
                dominantBaseline="central"
                fill={color}
                fontSize={11}
                fontWeight={700}
              >
                {readiness}%
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
