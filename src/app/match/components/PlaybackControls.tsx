'use client';

/**
 * PlaybackControls - Match replay controls
 * 
 * Provides play/pause, timeline scrubbing, speed control,
 * and current match time display.
 */

import React from 'react';

interface PlaybackControlsProps {
    isPlaying: boolean;
    currentFrame: number;
    totalFrames: number;
    playbackSpeed: number;
    currentMinute: number;
    onPlayPause: () => void;
    onSeek: (frameIndex: number) => void;
    onSpeedChange: (speed: number) => void;
    onReset: () => void;
}

export function PlaybackControls({
    isPlaying,
    currentFrame,
    totalFrames,
    playbackSpeed,
    currentMinute,
    onPlayPause,
    onSeek,
    onSpeedChange,
    onReset,
}: PlaybackControlsProps) {
    const speedOptions = [2.0, 4.0, 8.0, 10.0, 15.0, 20.0];
    // Shift display by -1 so the timeline starts at 0' (kickoff) instead of 1'
    const displayCurrentMinute = Math.max(0, Math.min(90, Number(currentMinute || 1) - 1));
    const displayEndMinute = 90;
    
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSeek(parseInt(e.target.value));
    };
    
    return (
        <div className="bg-white rounded-lg p-4 shadow-md">
            <div className="flex flex-col gap-4">
                {/* Timeline slider */}
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-600 w-16">
                        {displayCurrentMinute}&apos;
                    </span>
                    <input
                        type="range"
                        min="0"
                        max={totalFrames - 1}
                        value={currentFrame}
                        onChange={handleSliderChange}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-sm text-gray-500 w-16 text-right">
                        {displayEndMinute}&apos;
                    </span>
                </div>
                
                {/* Control buttons */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {/* Reset button */}
                        <button
                            onClick={onReset}
                            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                            title="Reset to start"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                        </button>
                        
                        {/* Play/Pause button */}
                        <button
                            onClick={onPlayPause}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                            {isPlaying ? (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                        </button>
                    </div>
                    
                    {/* Speed selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Speed:</span>
                        {speedOptions.map(speed => (
                            <button
                                key={speed}
                                onClick={() => onSpeedChange(speed)}
                                className={`px-3 py-1 rounded-lg transition-colors ${
                                    playbackSpeed === speed
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                }`}
                            >
                                {speed}x
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Minute-only mode intentionally hides frame/tick details */}
            </div>
        </div>
    );
}
