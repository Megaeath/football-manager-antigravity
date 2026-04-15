'use client';

/**
 * BallLayer - Renders the ball position
 * 
 * Displays the ball as a white circle with shadow,
 * with size adjusted based on z-coordinate (height).
 */

import React from 'react';
import { Circle, Group, Line, RegularPolygon } from 'react-konva';
import type { MatchFrame } from '@/lib/engine/v2/types2d';

interface BallLayerProps {
    frame: MatchFrame;
    width: number;
    height: number;
}

export function BallLayer({ frame, width, height }: BallLayerProps) {
    // Scale factors
    const scaleX = width / 100;
    const scaleY = height / 100;
    
    const scale = (value: number, axis: 'x' | 'y' = 'x') => {
        return axis === 'x' ? value * scaleX : value * scaleY;
    };
    
    const ballPos = frame.ball.position;
    const activeTransition = frame.ballTransitions?.[0];
    
    // Skip if ball position is invalid
    if (!ballPos || isNaN(ballPos.x) || isNaN(ballPos.y)) {
        return null;
    }
    
    // Ball size based on height (z coordinate)
    const baseRadius = 1.2;
    const heightFactor = 1 + (frame.ball.z / 10); // z ranges 0-10 (ground to air)
    const ballRadius = scale(baseRadius * heightFactor);
    const patternRadius = ballRadius * 0.24;
    const ringRadius = ballRadius * 0.58;
    const spinAngle = ((frame.minute * 60 + frame.tick) * 14 + ((ballPos.x + ballPos.y) * 2)) % 360;
    
    // Shadow offset based on height
    const shadowOffset = frame.ball.z * 2;
    
    return (
        <>
            {activeTransition && activeTransition.trajectory.length > 1 && (
                <Line
                    points={activeTransition.trajectory.flatMap((point) => [scale(point.x), scale(point.y, 'y')])}
                    stroke={activeTransition.type === 'GOAL' ? '#fbbf24' : activeTransition.type === 'SHOT' ? '#fb7185' : '#93c5fd'}
                    strokeWidth={2}
                    opacity={0.55}
                    dash={[6, 4]}
                    lineCap="round"
                    lineJoin="round"
                />
            )}

            {/* Ball shadow (on ground) */}
            {frame.ball.z > 0 && (
                <Circle
                    x={scale(ballPos.x) + shadowOffset}
                    y={scale(ballPos.y, 'y') + shadowOffset}
                    radius={ballRadius * 0.8}
                    fill="rgba(0, 0, 0, 0.3)"
                    blur={5}
                />
            )}
            
            {/* Ball (football pattern + spin) */}
            <Group
                x={scale(ballPos.x)}
                y={scale(ballPos.y, 'y')}
                rotation={spinAngle}
            >
                <Circle
                    x={0}
                    y={0}
                    radius={ballRadius}
                    fill="#ffffff"
                    stroke="#0f172a"
                    strokeWidth={Math.max(0.8, ballRadius * 0.18)}
                    shadowColor="black"
                    shadowBlur={10}
                    shadowOpacity={0.6}
                />

                <RegularPolygon
                    x={0}
                    y={0}
                    sides={5}
                    radius={patternRadius}
                    fill="#0f172a"
                    stroke="#0f172a"
                    strokeWidth={0.5}
                    rotation={18}
                />

                {[0, 72, 144, 216, 288].map((angle) => {
                    const rad = (angle * Math.PI) / 180;
                    return (
                        <RegularPolygon
                            key={`panel_${angle}`}
                            x={Math.cos(rad) * ringRadius}
                            y={Math.sin(rad) * ringRadius}
                            sides={5}
                            radius={Math.max(1, patternRadius * 0.68)}
                            fill="#111827"
                            stroke="#111827"
                            strokeWidth={0.4}
                            rotation={18 + angle}
                            opacity={0.95}
                        />
                    );
                })}

                <Line
                    points={[-ballRadius * 0.9, 0, ballRadius * 0.9, 0]}
                    stroke="#111827"
                    strokeWidth={Math.max(0.6, ballRadius * 0.1)}
                    opacity={0.35}
                    lineCap="round"
                />
            </Group>
        </>
    );
}
