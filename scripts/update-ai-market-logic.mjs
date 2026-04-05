#!/usr/bin/env node
/**
 * Update AI Market logic to:
 * 1. Include teams with position depth issues (< 2 players in any position)
 * 2. Change batch size from 5 to 3 teams per day
 */

import fs from 'fs';
import path from 'path';

const filePath = '/Users/auii/Project/game/src/lib/services/gameTime.ts';

// Read the file
const content = fs.readFileSync(filePath, 'utf-8');

// Find the line with "if (overdueTeams.length > 0) {"
const lines = content.split('\n');
const targetLineIndex = lines.findIndex(l => l.includes('if (overdueTeams.length > 0) {'));

if (targetLineIndex === -1) {
    console.error('❌ Could not find the target line');
    process.exit(1);
}

console.log(`✓ Found target at line ${targetLineIndex + 1}`);

// Find the closing brace of the if block
let braceCount = 0;
let endLineIndex = targetLineIndex;
for (let i = targetLineIndex; i < lines.length; i++) {
    const line = lines[i];
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;
    if (braceCount === 0 && i > targetLineIndex) {
        endLineIndex = i;
        break;
    }
}

console.log(`✓ Found closing brace at line ${endLineIndex + 1}`);

// Prepare the new section
const newLines = [
    '        // Also find teams with position depth issues (< 2 players in any required position)',
    '        const allTeams = await prisma.team.findMany({',
    '            where: { id: { not: settings.userTeamId || undefined } },',
    '            include: { players: { where: { isRetired: false }, select: { naturalPosition: true } } }',
    '        });',
    '',
    '        const teamsWithDepthIssues = allTeams.filter(team => {',
    '            const depthMap = new Map<string, number>();',
    '            for (const player of team.players) {',
    '                const pos = (player.naturalPosition || \'\').trim().toUpperCase();',
    '                depthMap.set(pos, (depthMap.get(pos) || 0) + 1);',
    '            }',
    '            // Check if any position has depth < 2 (< 2 players in same position)',
    '            for (const depth of depthMap.values()) {',
    '                if (depth < 2) return true;',
    '            }',
    '            return false;',
    '        });',
    '',
    '        // Combine both lists: teams that haven\'t been processed in 14 days + teams with position depth issues',
    '        const teamsToProcess = new Set<string>();',
    '        for (const team of overdueTeams) {',
    '            teamsToProcess.add(team.id);',
    '        }',
    '        for (const team of teamsWithDepthIssues) {',
    '            teamsToProcess.add(team.id);',
    '        }',
    '',
    '        if (teamsToProcess.size > 0) {',
    '            // Shuffle and take batch from .env (default 3 teams per day instead of 5)',
    '            const batchSize = parseInt(process.env.AI_MARKET_BATCH_SIZE || \'3\', 10);',
    '            const shuffled = Array.from(teamsToProcess).sort(() => Math.random() - 0.5);',
    '            const toProcess = shuffled.slice(0, Math.min(batchSize, shuffled.length));',
    '',
    '            console.log(`[GameTime] Processing AI Market for ${toProcess.length} teams (${overdueTeams.length} overdue + ${teamsWithDepthIssues.length} with position depth issues)...`);',
    '',
    '            const { processAIMarketForTeam } = await import(\'./aiMarketService\');',
    '',
    '            // Process in series with atomic date updates to avoid race conditions',
    '            for (const teamId of toProcess) {',
    '                try {',
    '                    await processAIMarketForTeam(teamId);',
    '                    // Update timestamp only after successful processing',
    '                    await prisma.team.update({',
    '                        where: { id: teamId },',
    '                        data: { lastAIMarketProcessedDate: nextDate }',
    '                    });',
    '                } catch (teamError) {',
    '                    console.error(`[GameTime] Failed to process AI market for team ${teamId}:`, teamError);',
    '                    // Don\'t update timestamp on failure - team will be retried next day',
    '                }',
    '            }',
    '',
    '            console.log(\'[GameTime] ✓ Distributed AI Market processing complete\');',
    '        }'
];

// Replace the lines
const updatedLines = [
    ...lines.slice(0, targetLineIndex),
    ...newLines,
    ...lines.slice(endLineIndex + 1)
];

// Write back
fs.writeFileSync(filePath, updatedLines.join('\n'), 'utf-8');
console.log('✅ gameTime.ts updated successfully');
console.log(`📝 Changes:`);
console.log(`  - Added position depth issue detection`);
console.log(`  - Changed batch size from 5 to 3 teams per day`);
console.log(`  - Teams will be selected from both overdue list and depth-issue list`);
