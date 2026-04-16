'use client';

/**
 * BallLayer - Renders the ball position
 * 
 * Displays the ball as a white circle with shadow,
 * with size adjusted based on z-coordinate (height).
 */

import React from 'react';
import { Circle, Group, Line, Rect, RegularPolygon, Text } from 'react-konva';
import type { MatchFrame } from '@/lib/engine/v2/types2d';
import { TUNING_PARAMS } from '@/lib/engine/v2/config';

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
    
    const goalMouthMinY = 46;
    const goalMouthMaxY = 54;
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const ballPos = frame.ball.position;
    const activeTransition = frame.ballTransitions?.[0];
    const isGoalFrame = Boolean(frame.events?.some((event) => event.type === 'GOAL')) || activeTransition?.type === 'GOAL';
    const renderedBallPos = isGoalFrame
        ? {
            x: ballPos.x < 50 ? 1.5 : 98.5,
            y: clamp(ballPos.y, goalMouthMinY, goalMouthMaxY),
        }
        : ballPos;
    
    // Skip if ball position is invalid
    if (!renderedBallPos || isNaN(renderedBallPos.x) || isNaN(renderedBallPos.y)) {
        return null;
    }
    
    // Ball size based on height (z coordinate)
    const baseRadius = 1.2;
    const heightFactor = 1 + (frame.ball.z / 10); // z ranges 0-10 (ground to air)
    const ballRadius = scale(baseRadius * heightFactor);
    const patternRadius = ballRadius * 0.24;
    const ringRadius = ballRadius * 0.58;
    const ticksPerMinute = Math.max(1, Number(TUNING_PARAMS.simulationTicksPerMinute || 10));
    const spinAngle = ((frame.minute * ticksPerMinute + frame.tick) * 14 + ((renderedBallPos.x + renderedBallPos.y) * 2)) % 360;
    
    // Shadow offset based on height
    const shadowOffset = frame.ball.z * 2;
    const coordinateLabel = `${renderedBallPos.x.toFixed(1)}, ${renderedBallPos.y.toFixed(1)}`;
    const coordinateLabelWidth = Math.max(64, coordinateLabel.length * 5.8);
    const coordinateLabelX = scale(renderedBallPos.x) - (coordinateLabelWidth / 2);
    const coordinateLabelY = scale(renderedBallPos.y, 'y') - (ballRadius + 20);
    
    return (
        <>
            {/* Ball shadow (on ground) */}
            {frame.ball.z > 0 && (
                <Circle
                    x={scale(renderedBallPos.x) + shadowOffset}
                    y={scale(renderedBallPos.y, 'y') + shadowOffset}
                    radius={ballRadius * 0.8}
                    fill="rgba(0, 0, 0, 0.3)"
                    blur={5}
                />
            )}
            
            {/* Ball (football pattern + spin) */}
            <Group
                x={scale(renderedBallPos.x)}
                y={scale(renderedBallPos.y, 'y')}
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

            <Rect
                x={coordinateLabelX}
                y={coordinateLabelY}
                width={coordinateLabelWidth}
                height={12}
                cornerRadius={3}
                fill="rgba(245, 158, 11, 0.92)"
                listening={false}
            />
            <Text
                x={coordinateLabelX}
                y={coordinateLabelY + 1}
                width={coordinateLabelWidth}
                text={coordinateLabel}
                fontSize={9}
                align="center"
                fill="#111827"
                fontStyle="bold"
                listening={false}
            />
        </>
    );
}
