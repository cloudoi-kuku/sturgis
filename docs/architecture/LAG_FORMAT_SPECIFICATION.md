# MS Project Lag Format Specification

## Critical Bug Fix Documentation

### Problem
Our system was incorrectly interpreting lag values from MS Project XML files, causing lags to appear as 48000 days when they should be 0 days.

### Root Cause
MS Project stores lag values in different units depending on the `LagFormat` field:

| LagFormat | Unit | Storage in XML | Example |
|-----------|------|----------------|---------|
| 3 | Minutes | Minutes | LinkLag=480 = 1 day (8 hours × 60 min) |
| 4 | Elapsed Minutes | Minutes | LinkLag=1440 = 1 day (24 hours × 60 min) |
| 5 | Hours | Hours | LinkLag=8 = 1 day |
| 6 | Elapsed Hours | Hours | LinkLag=24 = 1 day |
| **7** | **Days** | **Days** | **LinkLag=1 = 1 day** |
| 8 | Elapsed Days | Days | LinkLag=1 = 1 day |
| 9 | Weeks | Weeks | LinkLag=1 = 1 week (5 working days) |
| 10 | Elapsed Weeks | Weeks | LinkLag=1 = 1 week (7 calendar days) |
| 11 | Months | Months | LinkLag=1 = 1 month (~20 working days) |
| 12 | Elapsed Months | Months | LinkLag=1 = 1 month (~30 calendar days) |

### The Bug
**When `LagFormat=7` (Days), the `LinkLag` value is ALREADY in days, NOT minutes!**

Our code was incorrectly assuming ALL lag values needed conversion from minutes to days (dividing by 480), but:
- `LagFormat=3` (Minutes): LinkLag=480 means 1 day ✅ Needs conversion
- `LagFormat=7` (Days): LinkLag=1 means 1 day ✅ NO conversion needed

### Example from Tom's Project
```xml
<PredecessorLink>
  <PredecessorUID>7</PredecessorUID>
  <Type>1</Type>
  <LinkLag>0</LinkLag>
  <LagFormat>7</LagFormat>  <!-- Days format -->
</PredecessorLink>
```

This means: **0 days lag**

But our system was showing: **48000 days lag** ❌

### Fix Applied
1. **xml_processor.py**: Added documentation explaining lag format storage
2. **Database**: Stores lag values exactly as they appear in XML (no conversion)
3. **Frontend**: Correctly interprets lag based on lag_format when displaying

### Conversion Rules (for display only)
When displaying lag values to users, convert based on lag_format:

```python
def convert_lag_to_days(lag_value, lag_format):
    """Convert lag to days for display"""
    if lag_format == 3:  # Minutes
        return lag_value / 480  # 8 hours * 60 min
    elif lag_format == 4:  # Elapsed minutes
        return lag_value / 1440  # 24 hours * 60 min
    elif lag_format == 5:  # Hours
        return lag_value / 8
    elif lag_format == 6:  # Elapsed hours
        return lag_value / 24
    elif lag_format in [7, 8]:  # Days or elapsed days
        return lag_value  # Already in days!
    elif lag_format == 9:  # Weeks
        return lag_value * 5  # 5 working days
    elif lag_format == 10:  # Elapsed weeks
        return lag_value * 7  # 7 calendar days
    elif lag_format == 11:  # Months
        return lag_value * 20  # ~20 working days
    elif lag_format == 12:  # Elapsed months
        return lag_value * 30  # ~30 calendar days
    else:
        return lag_value  # Default to days
```

### Testing
To verify the fix:
1. Upload a fresh XML file from MS Project
2. Check task with outline 1.2.1.2
3. Verify lag shows as 0 days (not 48000)
4. Export to XML and re-import to MS Project
5. Verify lag values match original

### Database Cleanup
If you have corrupted data in the database from previous uploads:
```sql
-- Find tasks with suspicious lag values
SELECT t.name, t.outline_number, p.lag, p.lag_format 
FROM tasks t 
JOIN predecessors p ON t.id = p.task_id 
WHERE p.lag > 1000 AND p.lag_format = 7;

-- These are likely corrupted (lag_format=7 should have small values)
```

### Prevention
- Always store lag values exactly as they appear in MS Project XML
- Never convert lag values during storage
- Only convert for display purposes
- Document the lag_format meaning clearly

