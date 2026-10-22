# HEB Meal Planner

Weekly dinner planner and grocery budget for the Bowen house. Plan the week at home, see the real H-E-B cost before shopping, make weeknights easier.

Static site on GitHub Pages. No backend, no HEB account.

**Store:** H-E-B Main St (#789), 4800 Main St, Frisco TX 75033. All prices, sale flags, and aisles are for this store only.

## Layout

```
data/
  pantry.json   master pantry: every ingredient pinned to one H-E-B product id
  meals.json    meal cards (recipes, heat-and-add, repeat items)
  prices.json   this week's prices, flags, aisles, with the pull date
tools/
  heb-lookup.js helpers that run inside a heb.com tab in Chrome
  build_data.py rebuilds the three data files from the last pull
```

## How prices work

The site can't reach heb.com. At planning time, Claude in Chrome opens heb.com, runs `hebPrices(ids)` from `tools/heb-lookup.js` against every product id in `pantry.json`, and writes the result to `prices.json` with today's date. Every price in the app shows that pull date.

Flags:
- **sale** and **price cut** ring up automatically, so they count in the total.
- **coupon** (yellow) needs the HEB app or the paper slip. Flagged on the list, not subtracted.

## Build status

1. Pantry + test meals + lookup spike: done (Oct 21, 2026)
2. Planner UI: next
3. Shopping list + exports
4. On-sale view
