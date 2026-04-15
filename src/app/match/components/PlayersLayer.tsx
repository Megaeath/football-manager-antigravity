'use client';

/**
 * PlayersLayer - Renders all 22 player positions
 * 
 * Displays players as colored circles on the pitch,
 * with smooth position updates as the match progresses.
 */

import React from 'react';
import { Circle, Group, Text } from 'react-konva';
import type { MatchFrame, SpatialPosition } from '@/lib/engine/v2/types2d';

interface PlayersLayerProps {
    frame: MatchFrame;
    width: number;
    height: number;
    homePlayerIds?: Set<string>;
    playerNames?: Record<string, string>;
    playerNumbers?: Record<string, number>;
}

export function PlayersLayer({ frame, width, height, homePlayerIds, playerNames, playerNumbers }: PlayersLayerProps) {
    // Scale factors
    const scaleX = width / 100;
    const scaleY = height / 100;
    
    const scale = (value: number, axis: 'x' | 'y' = 'x') => {
        return axis === 'x' ? value * scaleX : value * scaleY;
    };
    
    // Convert Map or Object to array for rendering
    const rawPositions = frame?.playerPositions;
    const playerPositions = !rawPositions
        ? []
        : rawPositions instanceof Map
            ? Array.from(rawPositions.entries())
            : Object.entries(rawPositions);
    
    return (
        <>
            {playerPositions.map(([playerId, pos]) => {
                const position = pos as SpatialPosition;
                if (!position || Number.isNaN(position.x) || Number.isNaN(position.y)) {
                    return null;
                }
                // Determine team: use playerStats mapping if available, fall back to x<50
                const isHomeTeam = homePlayerIds ? homePlayerIds.has(playerId) : position.x < 50;
                const teamColor = isHomeTeam ? '#3b82f6' : '#ef4444';
                const strokeColor = isHomeTeam ? '#1d4ed8' : '#b91c1c';
                
                // Check if this player has the ball
                const hasBall = frame.ball?.carrier?.id === playerId;
                const jerseyNumber = playerNumbers?.[playerId];
                const displayName = playerNames?.[playerId] || playerId;
                
                return (
                    <Group key={playerId}>
                        {/* Player circle */}
                        <Circle
                            x={scale(position.x)}
                            y={scale(position.y, 'y')}
                            radius={scale(hasBall ? 1.25 : 1)}
                            fill={teamColor}
                            stroke={strokeColor}
                            strokeWidth={hasBall ? 1.5 : 1}
                            shadowColor="black"
                            shadowBlur={hasBall ? 5 : 3}
                            shadowOpacity={hasBall ? 0.8 : 0.5}
                        />
                        
                        {/* Ball possession indicator (ring around player) */}
                        {hasBall && (
                            <Circle
                                x={scale(position.x)}
                                y={scale(position.y, 'y')}
                                radius={scale(1.75)}
                                stroke="#fbbf24"
                                strokeWidth={1.25}
                                dash={[4, 2]}
                            />
                        )}

                        {/* Jersey number */}
                        <Text
                            x={scale(position.x) - scale(0.75)}
                            y={scale(position.y, 'y') - scale(0.75)}
                            width={scale(1.5)}
                            height={scale(1.5)}
                            text={String(jerseyNumber ?? '')}
                            fontSize={Math.max(7, scale(0.9))}
                            align="center"
                            verticalAlign="middle"
                            fill="#ffffff"
                            fontStyle="bold"
                            listening={false}
                        />

                        {/* Ball carrier name label */}
                        {hasBall && (
                            <Text
                                x={scale(position.x) - 38}
                                y={scale(position.y, 'y') - 20}
                                width={76}
                                text={displayName}
                                fontSize={10}
                                align="center"
                                fill="#f8fafc"
                                fontStyle="bold"
                                listening={false}
                            />
                        )}
                    </Group>
                );
            })}
        </>
    );
}
