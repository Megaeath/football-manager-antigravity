'use client';

/**
 * EventsLayer - Renders visual event markers
 * 
 * Displays icons/markers for goals, cards, tackles, and other
 * significant events that occurred in the current frame.
 */

import React from 'react';
import { Circle, Text, Group } from 'react-konva';
import type { MatchFrame } from '@/lib/engine/v2/types2d';

interface EventsLayerProps {
    frame: MatchFrame;
    width: number;
    height: number;
}

export function EventsLayer({ frame, width, height }: EventsLayerProps) {
    // Scale factors
    const scaleX = width / 100;
    const scaleY = height / 100;
    
    const scale = (value: number, axis: 'x' | 'y' = 'x') => {
        return axis === 'x' ? value * scaleX : value * scaleY;
    };
    
    if (!frame.events || frame.events.length === 0) {
        return null;
    }
    
    return (
        <>
            {frame.events.map((event, index) => {
                const eventPos = event.position;
                
                // Skip if position is invalid
                if (!eventPos || isNaN(eventPos.x) || isNaN(eventPos.y)) {
                    return null;
                }
                
                // Render different visuals based on event type
                switch (event.type) {
                    case 'GOAL':
                        return null;
                    
                    case 'YELLOW_CARD':
                        return (
                            <Circle
                                key={`${event.id}-${index}`}
                                x={scale(eventPos.x)}
                                y={scale(eventPos.y, 'y')}
                                radius={scale(2)}
                                fill="#fbbf24"
                                stroke="#f59e0b"
                                strokeWidth={2}
                            />
                        );
                    
                    case 'RED_CARD':
                        return (
                            <Circle
                                key={`${event.id}-${index}`}
                                x={scale(eventPos.x)}
                                y={scale(eventPos.y, 'y')}
                                radius={scale(2)}
                                fill="#ef4444"
                                stroke="#b91c1c"
                                strokeWidth={2}
                            />
                        );
                    
                    case 'TACKLE':
                        return (
                            <Circle
                                key={`${event.id}-${index}`}
                                x={scale(eventPos.x)}
                                y={scale(eventPos.y, 'y')}
                                radius={scale(1.5)}
                                fill="rgba(255, 255, 255, 0.5)"
                                stroke="#ffffff"
                                strokeWidth={1}
                            />
                        );

                    case 'SHOT':
                        {
                            const shotOutcome = event.metadata?.reason;
                            const shotLabel = shotOutcome?.startsWith('OFF_TARGET')
                                ? 'WIDE'
                                : shotOutcome?.startsWith('SAVED_PARRY')
                                    ? 'PARRY'
                                    : 'SAVE';
                        return (
                            <Group key={`${event.id}-${index}`}>
                                <Circle
                                    x={scale(eventPos.x)}
                                    y={scale(eventPos.y, 'y')}
                                    radius={scale(2.2)}
                                    fill="rgba(251, 113, 133, 0.22)"
                                    stroke="#fb7185"
                                    strokeWidth={2}
                                />
                                <Text
                                    x={scale(eventPos.x) - 22}
                                    y={scale(eventPos.y, 'y') - 24}
                                    text={shotLabel}
                                    fontSize={16}
                                    fontStyle="bold"
                                    fill="#fde68a"
                                    stroke="#111827"
                                    strokeWidth={1.5}
                                />
                            </Group>
                        );
                        }
                    
                    default:
                        return null;
                }
            })}
        </>
    );
}
