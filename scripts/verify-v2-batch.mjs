#!/usr/bin/env node

const rounds = Number(process.argv[2] || 50);
const endpoint = process.argv[3] || 'http://localhost:3000/api/test-v2-match';

let totalGoals = 0;
let totalHomeGoals = 0;
let totalAwayGoals = 0;
let totalHomeShots = 0;
let totalAwayShots = 0;

for (let i = 0; i < rounds; i++) {
  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`Request failed at round ${i + 1}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const match = data.match || data.replay;
  if (!match) {
    throw new Error(`Invalid payload at round ${i + 1}`);
  }

  totalHomeGoals += match.homeScore || 0;
  totalAwayGoals += match.awayScore || 0;

  const allStats = Object.values(match.playerStats || {});
  totalHomeShots += allStats
    .filter((p) => p.teamId === 'home')
    .reduce((sum, p) => sum + (p.shots || 0), 0);
  totalAwayShots += allStats
    .filter((p) => p.teamId === 'away')
    .reduce((sum, p) => sum + (p.shots || 0), 0);
}

totalGoals = totalHomeGoals + totalAwayGoals;

console.log('=== V2 Batch Verification ===');
console.log(`Rounds: ${rounds}`);
console.log(`Avg goals/game: ${(totalGoals / rounds).toFixed(2)}`);
console.log(`Avg home goals: ${(totalHomeGoals / rounds).toFixed(2)}`);
console.log(`Avg away goals: ${(totalAwayGoals / rounds).toFixed(2)}`);
console.log(`Avg home shots: ${(totalHomeShots / rounds).toFixed(2)}`);
console.log(`Avg away shots: ${(totalAwayShots / rounds).toFixed(2)}`);
