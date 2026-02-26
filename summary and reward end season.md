Requirements: Football Management Finance & Reputation System

1. Popularity & Reputation Definitions (0-100)
Player Popularity Levels:

0-10: Unknown

11-30: Rising Prospect

31-50: Local Hero

51-70: Well-Known

71-80: Star Player

81-90: Superstar

91-100: Global Icon

Club Reputation Levels:

0-10: Underdog / Amateur

11-30: Small Town Club

31-50: Professional Side

51-70: Established Club

71-80: National Heavyweight

81-90: Continental Power

91-100: Elite Giant

1. Dynamic Popularity Logic (Player & Club)
Player Popularity Changes:

Increase: Match Rating > 8.0, Scoring Goals, MOTM, Winning Streak, Selected in Team of the Week.

Decrease: Match Rating < 5.5, Long-term Injury, Suspensions (Red Cards), Inactivity (Not playing).

Club Reputation Changes:

Increase: League Position improvement, Winning against higher-rep teams, Winning Trophies, Signing High-Popularity players.

Decrease: Consecutive losses, Relegation, Selling "Star" players without replacement.

1. Financial & Revenue System (Weekly)
Sponsorship Revenue: Calculated weekly based on Club Reputation. Higher rep yields exponential growth in sponsorship money.

Jersey Sales Revenue: Calculated weekly based on the sum of all Player Popularity scores in the squad.

Gate Receipts (Ticket Sales):

Attendance: Variable based on Club Reputation and Stadium Capacity.

Ticket Price: Auto-calculated based on Club Reputation.

Weekly Expenses:

Total Wages: Sum of all 23 players' current wages.

Operating Costs: Fixed maintenance costs based on Stadium Capacity.

1. Market Value & Contract Management
Market Value Engine:

Formula must use Overall (OVR) and Popularity as primary drivers.

Age Depreciation: Reduce value for players aged 30+ regardless of OVR.

Contract Length Penalty: Reduce market value if ContractWeeks < 20.

Contract Renewal:

Players demand higher wages if their Popularity increases significantly.

Renewal logic must prevent losing stars for free (Free Agent).

1. End-of-Season Rewards (December 31st)
League Position Prize: Scaled money from 1st place to last place.

Achievement Bonuses:

Golden Boot (Top Scorer)

Golden Glove (Clean Sheets)

Player of the Season

TV Rights Share: Fixed payment distributed equally to all teams.

Commercial Bonus: Bonus if jersey sales exceeded targets.

1. Financial Fair Play (FFP) & Balance Control
FFP Check: System must alert if Total Wages > 70% of total weekly revenue.

Luxury Tax: Implement a tax on clubs with Balance > 500M to prevent hyper-inflation.

Financial Health Status: Dashboard must show status (Healthy, Warning, Danger).

1. Dashboard UI Requirements
Global Stats: Current Balance, Net Profit/Loss (Weekly), FFP Status indicator.

Revenue Breakdown: Visualization of Sponsorship vs Tickets vs Jersey Sales.

Squad Finance Table: List of players with their Market Value, Wage, and Popularity arrow indicators.

Stadium Box: Capacity, Average Attendance, and Gate Revenue display.

Contract Alerts: Notification list for players with expiring contracts.
