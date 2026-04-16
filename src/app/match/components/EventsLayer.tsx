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
import { toMasterEventCategory, type MasterEventFilterValue } from '@/lib/constants/matchEventFilters';

interface EventsLayerProps {
    frame: MatchFrame;
    width: number;
    height: number;
    eventFilter?: MasterEventFilterValue;
}

export function EventsLayer({ frame, width, height, eventFilter = 'all' }: EventsLayerProps) {
    // Scale factors
    const scaleX = width / 100;
    const scaleY = height / 100;
    
    const scale = (value: number, axis: 'x' | 'y' = 'x') => {
        return axis === 'x' ? value * scaleX : value * scaleY;
    };
    
    if (!frame.events || frame.events.length === 0) {
        return null;
    }

    const filteredEvents = frame.events.filter((event) => {
        if (eventFilter === 'all') return true;
        return toMasterEventCategory(event.type) === eventFilter;
    });

    if (filteredEvents.length === 0) {
        return null;
    }
    
    return (
        <>
            {filteredEvents.map((event, index) => {
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

                        case 'PASS':
                        return (
                            <Group key={`${event.id}-${index}`}>
                                <Circle
                                    x={scale(eventPos.x)}
                                    y={scale(eventPos.y, 'y')}
                                    radius={scale(1.5)}
                                    fill="rgba(59, 130, 246, 0.22)"
                                    stroke="#3b82f6"
                                    strokeWidth={1.5}
                                />
                                <Text
                                    x={scale(eventPos.x) - 4}
                                    y={scale(eventPos.y, 'y') - 6}
                                    text="P"
                                    fontSize={11}
                                    fontStyle="bold"
                                    fill="#bfdbfe"
                                    stroke="#0f172a"
                                    strokeWidth={1}
                                />
                            </Group>
                        );

                    case 'DRIBBLE':
                        return (
                            <Group key={`${event.id}-${index}`}>
                                <Circle
                                    x={scale(eventPos.x)}
                                    y={scale(eventPos.y, 'y')}
                                    radius={scale(1.5)}
                                    fill="rgba(34, 197, 94, 0.2)"
                                    stroke="#22c55e"
                                    strokeWidth={1.5}
                                />
                                <Text
                                    x={scale(eventPos.x) - 4}
                                    y={scale(eventPos.y, 'y') - 6}
                                    text="D"
                                    fontSize={11}
                                    fontStyle="bold"
                                    fill="#dcfce7"
                                    stroke="#0f172a"
                                    strokeWidth={1}
                                />
                            </Group>
                        );
                    
                    default:
                        return null;
                }
            })}
        </>
    );
}
