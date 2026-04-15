'use client';

/**
 * FieldLayer - Renders the football pitch
 * 
 * Draws field markings, lines, boxes, goals, and center circle
 * on a scaled canvas matching the 100x100 coordinate system.
 */

import React from 'react';
import { Rect, Line, Circle } from 'react-konva';

interface FieldLayerProps {
    width: number;
    height: number;
}

export function FieldLayer({ width, height }: FieldLayerProps) {
    // Scale factors to convert 100x100 coords to canvas pixels
    const scaleX = width / 100;
    const scaleY = height / 100;
    
    const scale = (value: number, axis: 'x' | 'y' = 'x') => {
        return axis === 'x' ? value * scaleX : value * scaleY;
    };
    
    return (
        <>
            {/* Pitch background */}
            <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="#1a8c3a"
            />
            
            {/* Halfway line */}
            <Line
                points={[scale(50), 0, scale(50), height]}
                stroke="#ffffff"
                strokeWidth={2}
            />
            
            {/* Center circle */}
            <Circle
                x={scale(50)}
                y={scale(50, 'y')}
                radius={scale(10)}
                stroke="#ffffff"
                strokeWidth={2}
            />
            
            {/* Center spot */}
            <Circle
                x={scale(50)}
                y={scale(50, 'y')}
                radius={scale(0.5)}
                fill="#ffffff"
            />
            
            {/* Outer boundary */}
            <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                stroke="#ffffff"
                strokeWidth={2}
            />
            
            {/* Home penalty box */}
            <Rect
                x={scale(0)}
                y={scale(20, 'y')}
                width={scale(18)}
                height={scale(60, 'y')}
                stroke="#ffffff"
                strokeWidth={2}
            />
            
            {/* Home goal area */}
            <Rect
                x={scale(0)}
                y={scale(35, 'y')}
                width={scale(6)}
                height={scale(30, 'y')}
                stroke="#ffffff"
                strokeWidth={2}
            />
            
            {/* Home penalty spot */}
            <Circle
                x={scale(12)}
                y={scale(50, 'y')}
                radius={scale(0.5)}
                fill="#ffffff"
            />
            
            {/* Away penalty box */}
            <Rect
                x={scale(82)}
                y={scale(20, 'y')}
                width={scale(18)}
                height={scale(60, 'y')}
                stroke="#ffffff"
                strokeWidth={2}
            />
            
            {/* Away goal area */}
            <Rect
                x={scale(94)}
                y={scale(35, 'y')}
                width={scale(6)}
                height={scale(30, 'y')}
                stroke="#ffffff"
                strokeWidth={2}
            />
            
            {/* Away penalty spot */}
            <Circle
                x={scale(88)}
                y={scale(50, 'y')}
                radius={scale(0.5)}
                fill="#ffffff"
            />
            
            {/* Corner arcs - Home left */}
            <Circle
                x={scale(0)}
                y={scale(0, 'y')}
                radius={scale(2)}
                stroke="#ffffff"
                strokeWidth={2}
            />
            
            {/* Corner arcs - Home right */}
            <Circle
                x={scale(0)}
                y={scale(100, 'y')}
                radius={scale(2)}
                stroke="#ffffff"
                strokeWidth={2}
            />
            
            {/* Corner arcs - Away left */}
            <Circle
                x={scale(100)}
                y={scale(0, 'y')}
                radius={scale(2)}
                stroke="#ffffff"
                strokeWidth={2}
            />
            
            {/* Corner arcs - Away right */}
            <Circle
                x={scale(100)}
                y={scale(100, 'y')}
                radius={scale(2)}
                stroke="#ffffff"
                strokeWidth={2}
            />
        </>
    );
}
