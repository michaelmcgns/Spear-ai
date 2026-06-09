# 📈 Sales Tracker

Each call = a note in `Call Logs/` (use [[_templates/Call Log]]). These roll up automatically.

## Closes
```dataview
table lead_type as "Lead", ap as "AP", date
from "01 Pinnacle/Call Logs"
where outcome = "closed"
sort date desc
```

## Personal AP toward 90% unlock
```dataview
table sum(rows.ap) as "Total AP"
from "01 Pinnacle/Call Logs"
where outcome = "closed"
group by "Running total"
```
Target: **$30,000** → 90% comp.

## All call outcomes this period
```dataview
table outcome, lead_type, date
from "01 Pinnacle/Call Logs"
sort date desc
limit 50
```

## Ratios to watch
- Contact rate = contacts ÷ dials
- Appt rate = appts ÷ contacts
- Close rate = closes ÷ presentations
- $/lead source ROI = AP ÷ lead spend
