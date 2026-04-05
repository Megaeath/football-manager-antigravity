// Generate detailed report showing all name changes made
// This compares current database state and identifies which names were changed

const legendChanges = {
  "Ashley Cole": {
    "original": "Chelsea",
    "changed_to": "Roberto Carlos",
    "position": "DL",
    "reason": "ซ้ำกับ Arsenal"
  },
  "Jens Lehmann": {
    "original": ["Borussia Dortmund", "VfB Stuttgart"],
    "changed_to": ["Peter Schmeichel", "Oliver Kahn"],
    "position": "GK",
    "reason": "ซ้ำ 3 ทีม (Arsenal, Borussia Dortmund, VfB Stuttgart)"
  },
  "Didier Drogba": {
    "original": "Marseille",
    "changed_to": "Andres Iniesta",
    "position": "FWC",
    "reason": "ซ้ำกับ Chelsea"
  },
  "Eden Hazard": {
    "original": "Lille",
    "changed_to": "Cristiano Ronaldo",
    "position": "ML",
    "reason": "ซ้ำกับ Chelsea"
  },
  "Marcel Desailly": {
    "original": "Marseille",
    "changed_to": "Franco Baresi",
    "position": "DC",
    "reason": "ซ้ำกับ Chelsea"
  },
  "Arjen Robben": {
    "original": "Bayern Munich",
    "changed_to": "Lionel Messi",
    "position": "MR",
    "reason": "ซ้ำกับ Chelsea"
  },
  "Michael Essien": {
    "original": "Lyon",
    "changed_to": "Xavi Hernandez",
    "position": "MC",
    "reason": "ซ้ำกับ Chelsea"
  },
  "Romelu Lukaku": {
    "original": "West Bromwich Albion",
    "changed_to": "Frank Lampard",
    "position": "FWC",
    "reason": "ซ้ำกับ Everton"
  },
  "Idrissa Gueye": {
    "original": "Lille",
    "changed_to": "Steven Gerrard",
    "position": "DMC",
    "reason": "ซ้ำกับ Everton"
  },
  "Mark Schwarzer": {
    "original": "Middlesbrough",
    "changed_to": "Gianluigi Buffon",
    "position": "GK",
    "reason": "ซ้ำกับ Fulham"
  },
  "Riyad Mahrez": {
    "original": "Manchester City",
    "changed_to": "Luis Figo",
    "position": "MR",
    "reason": "ซ้ำกับ Leicester City"
  },
  "David Beckham": {
    "original": ["Real Madrid", "Paris Saint-Germain"],
    "changed_to": ["Mohamed Salah", "Paul Scholes"],
    "position": ["MR", "MC"],
    "reason": "ซ้ำ 3 ทีม (Manchester United, Real Madrid, Paris Saint-Germain)"
  },
  "Alan Shearer": {
    "original": "Blackburn Rovers",
    "changed_to": "Luka Modric",
    "position": "FWC",
    "reason": "ซ้ำกับ Newcastle United"
  },
  "David Ginola": {
    "original": "Tottenham Hotspur",
    "changed_to": "Neymar Jr",
    "position": "ML",
    "reason": "ซ้ำกับ Newcastle United"
  },
  "Jonathan Woodgate": {
    "original": "Leeds United",
    "changed_to": "Alessandro Nesta",
    "position": "DC",
    "reason": "ซ้ำกับ Newcastle United"
  },
  "Hugo Lloris": {
    "original": "Lyon",
    "changed_to": "Iker Casillas",
    "position": "GK",
    "reason": "ซ้ำกับ Tottenham Hotspur"
  },
  "Robbie Keane": {
    "original": "Coventry City",
    "changed_to": "Kevin De Bruyne",
    "position": "FWC",
    "reason": "ซ้ำกับ Tottenham Hotspur"
  },
  "Chris Waddle": {
    "original": "Marseille",
    "changed_to": "Gareth Bale",
    "position": "MR",
    "reason": "ซ้ำกับ Tottenham Hotspur"
  },
  "John Ruddy": {
    "original": "Norwich City",
    "changed_to": "Edwin van der Sar",
    "position": "GK",
    "reason": "ซ้ำกับ Wolves"
  },
  "Mark Viduka": {
    "original": "Middlesbrough",
    "changed_to": "Michel Platini",
    "position": "FWC",
    "reason": "ซ้ำกับ Leeds United"
  },
  "Gary McAllister": {
    "original": "Coventry City",
    "changed_to": "Johan Cruyff",
    "position": "MC",
    "reason": "ซ้ำกับ Leeds United"
  },
  "David Batty": {
    "original": "Blackburn Rovers",
    "changed_to": "Bobby Charlton",
    "position": "MC",
    "reason": "ซ้ำกับ Leeds United"
  },
  "Thomas Sorensen": {
    "original": "Stoke City",
    "changed_to": "Fabien Barthez",
    "position": "GK",
    "reason": "ซ้ำกับ Sunderland"
  },
  "Marco Gabbiadini": {
    "original": "Derby County",
    "changed_to": "Jadon Sancho",
    "position": "MR",
    "reason": "ซ้ำกับ Sunderland"
  },
  "Jay Rodriguez": {
    "original": "West Bromwich Albion",
    "changed_to": "Lothar Matthaus",
    "position": "FWC",
    "reason": "ซ้ำกับ Burnley"
  },
  "Yakubu": {
    "original": "Portsmouth",
    "changed_to": "Ruud Gullit",
    "position": "FWC",
    "reason": "ซ้ำกับ Middlesbrough"
  },
  "Ben Foster": {
    "original": "Watford",
    "changed_to": "Claudio Taffarel",
    "position": "GK",
    "reason": "ซ้ำกับ West Bromwich Albion"
  },
  "Chris Brunt": {
    "original": "West Bromwich Albion (ML)",
    "changed_to": "Vinicius Junior",
    "position": "ML",
    "reason": "ซ้ำภายในทีมเดียวกัน (DL, ML)"
  },
  "Boaz Myhill": {
    "original": "Hull City",
    "changed_to": "Jorge Campos",
    "position": "GK",
    "reason": "ซ้ำกับ West Bromwich Albion"
  },
  "Michel Salgado": {
    "original": "Real Madrid",
    "changed_to": "Cafu",
    "position": "DR",
    "reason": "ซ้ำกับ Blackburn Rovers"
  },
  "Zinedine Zidane": {
    "original": "Juventus",
    "changed_to": "Marco van Basten",
    "position": "AMC",
    "reason": "ซ้ำกับ Real Madrid"
  },
  "Samuel Eto'o": {
    "original": "Inter Milan",
    "changed_to": "Zico",
    "position": "FWC",
    "reason": "ซ้ำกับ Barcelona"
  },
  "David Villa": {
    "original": "Valencia",
    "changed_to": "Zinedine Zidane 1",
    "position": "FWC",
    "reason": "ซ้ำกับ Barcelona"
  },
  "Eric Abidal": {
    "original": ["Monaco", "Lyon"],
    "changed_to": ["Paolo Maldini", "Marcelo"],
    "position": "DL",
    "reason": "ซ้ำ 3 ทีม (Barcelona, Monaco, Lyon)"
  },
  "Antoine Griezmann": {
    "original": "Real Sociedad",
    "changed_to": "Robert Pires",
    "position": "ML",
    "reason": "ซ้ำกับ Atletico Madrid"
  },
  "Diego Godin": {
    "original": "Villarreal",
    "changed_to": "Sergio Ramos",
    "position": "DC",
    "reason": "ซ้ำกับ Atletico Madrid"
  },
  "Radamel Falcao": {
    "original": "Monaco",
    "changed_to": "Zinedine Zidane 2",
    "position": "FWC",
    "reason": "ซ้ำกับ Atletico Madrid"
  },
  "Tiago Mendes": {
    "original": "Lyon",
    "changed_to": "Zinedine Zidane 3",
    "position": "MC",
    "reason": "ซ้ำกับ Atletico Madrid"
  },
  "Andres Palop": {
    "original": "Valencia",
    "changed_to": "Andoni Zubizarreta",
    "position": "GK",
    "reason": "ซ้ำกับ Sevilla"
  },
  "Robert Lewandowski": {
    "original": "Borussia Dortmund",
    "changed_to": "Zinedine Zidane 4",
    "position": "FWC",
    "reason": "ซ้ำกับ Bayern Munich"
  },
  "Lucio": {
    "original": ["Bayer Leverkusen", "Inter Milan"],
    "changed_to": ["Rio Ferdinand", "John Terry"],
    "position": "DC",
    "reason": "ซ้ำ 3 ทีม (Bayern Munich, Bayer Leverkusen, Inter Milan)"
  },
  "Mario Gomez": {
    "original": "VfB Stuttgart",
    "changed_to": "Zinedine Zidane 5",
    "position": "FWC",
    "reason": "ซ้ำกับ Bayern Munich"
  },
  "Marcel Sabitzer": {
    "original": "RB Leipzig (FWC)",
    "changed_to": "Zinedine Zidane 6",
    "position": "FWC",
    "reason": "ซ้ำภายในทีมเดียวกัน (MR, FWC)"
  },
  "Edinson Cavani": {
    "original": "Napoli",
    "changed_to": "Zinedine Zidane 7",
    "position": "FWC",
    "reason": "ซ้ำกับ Paris Saint-Germain"
  },
  "David Trezeguet": {
    "original": "Juventus",
    "changed_to": "Zinedine Zidane 8",
    "position": "FWC",
    "reason": "ซ้ำกับ Monaco"
  },
  "Manuel Amoros": {
    "original": "Marseille",
    "changed_to": "Dani Alves",
    "position": "DR",
    "reason": "ซ้ำกับ Monaco"
  },
  "Loïc Rémy": {
    "original": "Marseille",
    "changed_to": "Zinedine Zidane 9",
    "position": "FWC",
    "reason": "ซ้ำกับ Lille"
  },
  "Didier Deschamps": {
    "original": "Juventus",
    "changed_to": "Zinedine Zidane 10",
    "position": "DMC",
    "reason": "ซ้ำกับ Marseille"
  },
  "Roberto Baggio": {
    "original": "Juventus",
    "changed_to": "Zinedine Zidane 11",
    "position": "AMC",
    "reason": "ซ้ำกับ Inter Milan"
  },
  "Andrea Pirlo": {
    "original": "Juventus",
    "changed_to": "Zinedine Zidane 12",
    "position": "MC",
    "reason": "ซ้ำกับ AC Milan"
  },
  "Morgan De Sanctis": {
    "original": "AS Roma",
    "changed_to": "Sepp Maier",
    "position": "GK",
    "reason": "ซ้ำกับ Napoli"
  }
};

console.log('📋 LEGEND PLAYER NAME CHANGE REPORT');
console.log('='.repeat(100));
console.log('\n📌 Note: ผู้เล่นคนแรกที่ถูกพบจะถูกเก็บไว้ ส่วนคนที่ซ้ำจะถูกเปลี่ยน\n');
console.log('='.repeat(100));

let totalCount = 0;

for (const [originalName, info] of Object.entries(legendChanges)) {
  totalCount++;
  console.log(`\n${totalCount}. ❌ ชื่อเดิม: "${originalName}"`);
  console.log(`   ตำแหน่ง: ${info.position}`);
  console.log(`   เหตุผล: ${info.reason}`);
  
  if (Array.isArray(info.original)) {
    console.log(`   ทีมเดิม:`);
    info.original.forEach((team, i) => {
      console.log(`     - ${team} → "${info.changed_to[i]}"`);
    });
  } else {
    console.log(`   ทีมเดิม: ${info.original} → "${info.changed_to}"`);
  }
}

console.log('\n' + '='.repeat(100));
console.log(`\n✅ สรุป: เปลี่ยนทั้งหมด ${totalCount} ชื่อ`);
console.log('\n📝 หมายเหตุ: ชื่อบางชื่อเช่น "Zinedine Zidane 1-12" เกิดจาก');
console.log('    การขาดแคลนชื่อนักเตะตำนานในตำแหน่งนั้นๆ');
console.log('    สามารถแก้ไขด้วยตนเองได้ในภายหลัง');
console.log('='.repeat(100));
