'use client';

import React from 'react';
import { Line, Circle } from 'react-konva';
import type { MatchFrame } from '@/lib/engine/v2/types2d';

interface DebugLayerProps {
    frame: MatchFrame;
    width: number;
    height: number;
}

function colorByJob(job: string): string {
    if (job === 'PRESS') return '#ef4444';
    if (job === 'COVER') return '#f59e0b';
    if (job === 'DEFEND') return '#3b82f6';
    if (job === 'ATTACK') return '#22c55e';
    if (job === 'SUPPORT') return '#14b8a6';
    if (job === 'MARK') return '#a855f7';
    return '#94a3b8';
}

export function DebugLayer({ frame, width, height }: DebugLayerProps) {
    const debug = frame.debug;
    if (!debug || !debug.intents?.length) return null;

    const scaleX = width / 100;
    const scaleY = height / 100;

    return (
        <>
            {debug.intents.map((intent) => {
                const x1 = intent.from.x * scaleX;
                const y1 = intent.from.y * scaleY;
                const x2 = intent.to.x * scaleX;
                const y2 = intent.to.y * scaleY;
                const color = colorByJob(intent.job);

                return (
                    <React.Fragment key={`${intent.playerId}_${intent.job}`}>
                        <Line
                            points={[x1, y1, x2, y2]}
                            stroke={color}
                            strokeWidth={1.2}
                            opacity={0.45}
                            dash={[4, 4]}
                            listening={false}
                        />
                        <Circle
                            x={x2}
                            y={y2}
                            radius={1.6}
                            fill={color}
                            opacity={0.55}
                            listening={false}
                        />
                    </React.Fragment>
                );
            })}
        </>
    );
}
