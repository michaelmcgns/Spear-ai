# 🗓️ This Week — Command View

## 🔥 Priority (#now) across everything
```dataview
task
from "01 Pinnacle" or "02 Spear" or "03 Calisthenics & Brand"
where !completed and contains(text, "#now")
group by file.link
```

## All open tasks by area
```dataview
task
from "01 Pinnacle" or "02 Spear" or "03 Calisthenics & Brand"
where !completed
group by file.folder
```

## Recent daily notes
```dataview
list
from "04 Reviews/Daily"
sort file.name desc
limit 7
```
