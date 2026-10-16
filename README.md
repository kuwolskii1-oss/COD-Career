# COD Career

A Warzone skill tracker (Multiplayer coming soon). Open `index.html` in a browser — no install or build needed.

## How it works

- **Profiles** — switch between *Kolurin Zero* and *Kuwolskii Zero* in the top-left. Each has its own matches and ELO.
- **Log Match** — the coach/spectator taps **+** (addition) or **−** (deduction) on each item during or after a match. Right-click / long-press a button to undo a tap.
  - Centering, Live pinging, Rotation planning, General play planning, Range clocking, Aim, Movement mechanisms, 6th sense / acute awareness
  - Reason for final death: Low ground, Out-gunned, Lag, Out-numbered, Gas, Lethal, Splat, Gatekeep (pick one, and grade it with +/−)
- **ELO** — starts at 60. Each match changes it by `(additions − deductions) ÷ number of items` (currently 9: 8 skills + final death). Add a skill to `SKILLS` in `app.js` and the divisor grows automatically; old matches keep the divisor they were scored with.
- **Match summary** — after saving, shows what to do right next match, what went wrong/right, and the death reason.
- **Account Stats** — ELO trend, most common manner of death, top 3 areas lacking and top 3 best areas (by average net per match).

Data is stored in the browser (localStorage). Use **Export / Import** on the stats tab to back up or share data with your coach.
