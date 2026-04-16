# ⚽ Football Manager (Text-Based)

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=flat-square&logo=sqlite)](https://www.sqlite.org/)

A deep, tactical, and high-performance **Football Manager Engine** built for those who love the numbers behind the beautiful game. Experience the thrill of management through a pure text-based interface where every decision carries weight.

---

## 🚀 Key Features

### 🧠 Advanced Match Engine

Our custom-built simulation engine goes beyond just scores. Every minute of the game is simulated with:

- **Realistic Statistical Volume**: Professional-level totals of 300-600 passes per team.
- **Background Actions**: Thousands of micro-interactions (passes, tackles, dribbles) that contribute to player ratings and seasonal aggregates.
- **Position-Based Logic**: Midfielders dictate the tempo, while wingers focus on high-impact transitions.

### ⚖️ Re-balanced Performance Rating

A sophisticated player rating system (1.0 - 10.0) that accurately reflects on-field impact:

- **Smart GK Logic**: Goalkeepers only receive credit for genuine on-target saves.
- **Impact Weighting**: Goals, assists, and defensive interceptions are weighted to ensure fair competition across all positions.

### 📅 Dynamic Season & Career System

- **Long-term Management**: Full league fixtures generation across multiple seasons.
- **Player Lifecycle**: Aging, performance degradation, and retirement systems.
- **UTC Standardization**: Robust time-management system ensuring consistent game-day transitions across all timezones.

### 📋 Deep Tactics & Squad Management

- **Tactical Mentality**: Adjust from Ultra-Defensive to All-Out Attack.
- **Passing Styles**: Choose between Short, Mixed, or Direct/Long passing games.
- **Player Profiles**: Detailed deep-dive metrics for every athlete, including passing accuracy and Man of the Match history.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [SQLite](https://www.sqlite.org/) (for localized high-speed persistence)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Styling**: Modern CSS with Glassmorphism and Responsive Design.

---

## 🏁 Getting Started

### Prerequisites

- Node.js 18+
- npm / yarn / pnpm

### Installation

1. **Clone the repo**

   ```bash
   git clone https://github.com/Megaeath/football-manager-antigravity.git
   cd football-manager-antigravity
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Initialize the Database**

   ```bash
   npx prisma db push
   npx prisma db seed
   ```

4. **Start the Engine**

   ```bash
   npm run dev
   ```

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## kill port

npx kill-port 3000
---

comment db url on .env

npx prisma generate
npm run dev

## list project file

git ls-files | xargs wc -l
git ls-files | xargs wc -l | awk '$1 > 500 && $2 != "total" {print $0}' | sort -rn

*Developed with ❤️ for the Football Management community.*
