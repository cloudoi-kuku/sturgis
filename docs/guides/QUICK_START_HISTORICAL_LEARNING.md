# Quick Start: Historical Project Learning

## What Is This?
The AI now learns from your company's past projects to create new projects that match your standards, terminology, and realistic timelines.

## 5-Minute Setup

### Step 1: Build Your Historical Database (One-Time)
Import 2-5 existing projects to teach the AI your company's patterns:

```bash
# Start the application
cd backend && python main.py
cd frontend && npm run dev
```

1. Click **"Upload XML"**
2. Select 2-5 of your company's past projects (.xml files)
3. Import each one

**Tip:** Choose diverse projects (residential, commercial, etc.) for better learning.

---

### Step 2: Test Historical Learning

```bash
cd backend
python test_historical_learning.py
```

**Expected Output:**
```
Found 5 historical projects with sufficient data

📊 Most Common Tasks:
   • 'site preparation': appears 3x, avg 3.5 days
   • 'foundation excavation': appears 3x, avg 5.2 days
   • 'concrete pour': appears 4x, avg 2.1 days
   ...

📋 Common Phases:
   • Pre-Construction: appears 5x
   • Foundation & Sitework: appears 4x
   ...
```

---

### Step 3: Create a New Project with AI

1. **Create Empty Project:**
   - Click **"New Project"**
   - Name it anything (e.g., "Test Office Building")

2. **Open AI Chat:**
   - Click the chat icon 💬

3. **Describe Your Project:**
   ```
   Create a 10,000 sq ft commercial office building with:
   - 2 floors
   - Modern finishes
   - Full MEP systems
   - Parking lot
   ```

4. **Watch the Magic:**
   - AI analyzes your 5 historical projects
   - Generates tasks using YOUR company's terminology
   - Applies realistic durations from YOUR past projects
   - Follows YOUR standard phase structure

5. **AI Confirms:**
   ```
   "I've generated a complete commercial project based on your description! 
   The project 'Commercial Office Building - 10,000 sq ft' has 45 tasks 
   organized into phases. I've used patterns from 5 of your past projects 
   to ensure consistency with your company's standards."
   ```

---

## What Gets Learned?

### ✅ Task Names
**Before:** Generic names like "Foundation Work"  
**After:** Your company's terms like "Foundation & Concrete Work"

### ✅ Durations
**Before:** Generic estimates (10 days)  
**After:** Based on YOUR history (15.2 days average)

### ✅ Phase Structure
**Before:** Random phases  
**After:** YOUR standard phases:
- Pre-Construction
- Foundation & Sitework
- Structural Framing
- MEP Rough-In
- Interior Finishes
- Closeout

### ✅ Consistency
Every new project matches your company's standards!

---

## Real-World Example

### Your Historical Data Shows:
```
"Site Preparation" appears 8 times, average 3.2 days
"Foundation Excavation" appears 6 times, average 5.5 days
"Concrete Pour - Foundation" appears 7 times, average 2.1 days
```

### AI Generates New Project:
```
✅ Task: "Site Preparation" - Duration: 3 days
✅ Task: "Foundation Excavation" - Duration: 5 days  
✅ Task: "Concrete Pour - Foundation" - Duration: 2 days
```

**Result:** New project matches your company's actual practices!

---

## Tips for Best Results

### 1. Import Quality Projects
- ✅ Complete projects with realistic data
- ✅ Diverse project types
- ❌ Avoid test/demo projects
- ❌ Avoid incomplete projects

### 2. Import Enough Projects
- **2-3 projects:** Basic patterns
- **5 projects:** Good patterns (recommended)
- **10+ projects:** Excellent patterns

### 3. Keep Importing
- The more projects you import, the better the AI learns
- AI automatically uses the 5 most recent substantial projects
- Your historical database grows over time

### 4. Verify Generated Projects
- First few generations: Review carefully
- After 5+ historical projects: Should be very accurate
- Adjust as needed, then save as new historical data

---

## Troubleshooting

### "Found 0 historical projects"
**Problem:** No projects imported yet  
**Solution:** Import 2-5 .xml files first

### "AI generates generic tasks"
**Problem:** Not enough historical data  
**Solution:** Import more projects (aim for 5+)

### "Durations seem off"
**Problem:** Historical projects have unrealistic durations  
**Solution:** Import better quality projects with accurate data

### "Task names don't match"
**Problem:** Historical projects use inconsistent naming  
**Solution:** Standardize naming in future projects, AI will learn

---

## Advanced: Customize Learning

### Change Number of Historical Projects Used

Edit `backend/main.py`:

```python
# Use more historical projects (slower but better patterns)
historical_data = db.get_historical_project_data(limit=10)

# Use fewer (faster but less reliable)
historical_data = db.get_historical_project_data(limit=3)
```

**Default:** 5 projects (good balance)

---

## Summary

1. ✅ Import 2-5 past projects
2. ✅ Run test to verify patterns
3. ✅ Create new project via AI chat
4. ✅ Enjoy consistent, realistic projects!

**The more you use it, the smarter it gets!** 🚀

