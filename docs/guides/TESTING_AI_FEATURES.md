# 🧪 Testing AI Features - Step by Step Guide

## ✅ What Was Integrated

The **AI Task Helper** is now integrated into the **Task Editor Dialog**. When you create or edit a task, you'll see:

```
┌─────────────────────────────────────────┐
│ Create Task                        [X]  │
├─────────────────────────────────────────┤
│                                         │
│ Task Name *                             │
│ ┌─────────────────────────────────────┐ │
│ │ Design database schema              │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │  ✨ 🤖 AI Suggest                   │ │ ← NEW!
│ └─────────────────────────────────────┘ │
│                                         │
│ [AI suggestions appear here after click]│
│                                         │
│ Duration (days): [2.5]                  │
│ ...                                     │
└─────────────────────────────────────────┘
```

---

## 🚀 Step-by-Step Testing

### **Step 1: Install Ollama**

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download from https://ollama.com/download

---

### **Step 2: Start Ollama Service**

Open a **new terminal** and run:

```bash
ollama serve
```

**Expected output:**
```
Listening on 127.0.0.1:11434 (version 0.x.x)
```

**Keep this terminal running!** Don't close it.

---

### **Step 3: Pull the AI Model**

Open **another terminal** and run:

```bash
ollama pull llama3.2:3b
```

**Expected output:**
```
pulling manifest
pulling 8934d96d3f08... 100% ▕████████████████▏ 2.0 GB
pulling 966de95ca8a6... 100% ▕████████████████▏ 1.4 KB
pulling fcc5a6bec9da... 100% ▕████████████████▏ 7.7 KB
pulling a70ff7e570d9... 100% ▕████████████████▏ 6.0 KB
pulling 56bb8bd477a5... 100% ▕████████████████▏  96 B
pulling 34bb5ab01051... 100% ▕████████████████▏ 561 B
verifying sha256 digest
writing manifest
success
```

This downloads ~2GB, so it may take a few minutes.

---

### **Step 4: Test Ollama**

```bash
ollama run llama3.2:3b "Hello, how are you?"
```

**Expected output:**
```
I'm doing well, thank you for asking! How can I help you today?
```

If this works, Ollama is ready! Press `Ctrl+D` to exit.

---

### **Step 5: Start the Backend**

Open a **new terminal**:

```bash
cd backend
python main.py
```

**Expected output:**
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

### **Step 6: Test AI Endpoints**

Open **another terminal** and test:

```bash
# Test 1: Health check
curl http://localhost:8000/api/ai/health

# Expected: {"status":"healthy","model":"llama3.2:3b","provider":"Ollama (Local)"}
```

```bash
# Test 2: Duration estimation
curl -X POST http://localhost:8000/api/ai/estimate-duration \
  -H "Content-Type: application/json" \
  -d '{"task_name": "Design database schema"}'

# Expected: {"days":2.5,"confidence":85,"reasoning":"Database schema design..."}
```

If both work, the backend AI is ready! ✅

---

### **Step 7: Start the Frontend**

Open **another terminal**:

```bash
cd frontend
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

### **Step 8: Test in the UI**

1. **Open browser**: http://localhost:5173

2. **Upload a project** (or create tasks manually)

3. **Click "Create Task"** button (the + icon in header)

4. **Fill in task name**: 
   - Type: `Design database schema`

5. **Click the "🤖 AI Suggest" button**

6. **Wait 1-2 seconds** - You should see:
   ```
   ┌─────────────────────────────────────┐
   │ 📊 Duration Estimate  [85% confident]│
   │                                     │
   │ 2.5 days                            │
   │                                     │
   │ Database schema design typically... │
   │                                     │
   │ [✓ Apply Duration]                  │
   └─────────────────────────────────────┘
   ```

7. **Click "✓ Apply Duration"**

8. **Check the Duration field** - It should now show `2.5`

9. **Save the task** ✅

---

## 🎯 What to Test (Construction Tasks)

### **Test Case 1: Site Work**
- **Task Name**: `Site excavation and grading`
- **Expected AI**: ~5-7 days, 🚜 Site Work category

### **Test Case 2: Foundation**
- **Task Name**: `Pour concrete foundation`
- **Expected AI**: ~7-10 days (includes curing), 🏗️ Foundation category

### **Test Case 3: Structural**
- **Task Name**: `Frame exterior walls`
- **Expected AI**: ~10-15 days, 🔨 Structural category

### **Test Case 4: Mechanical**
- **Task Name**: `Install electrical rough-in`
- **Expected AI**: ~3-5 days, ⚡ Mechanical category

### **Test Case 5: Finishing**
- **Task Name**: `Paint interior walls`
- **Expected AI**: ~5-7 days, 🎨 Finishing category

### **Test Case 6: Inspection**
- **Task Name**: `Final building inspection`
- **Expected AI**: ~1-2 days, ✅ Inspection category

---

## 🐛 Troubleshooting

### **Problem: "AI service unavailable" error**

**Solution 1**: Check if Ollama is running
```bash
curl http://localhost:11434/api/tags
```

If it fails, start Ollama:
```bash
ollama serve
```

**Solution 2**: Check if model is downloaded
```bash
ollama list
```

Should show `llama3.2:3b`. If not:
```bash
ollama pull llama3.2:3b
```

---

### **Problem: Backend returns 500 error**

**Check backend logs** - Look for error messages in the terminal running `python main.py`

**Common issues:**
- Ollama not running → Start with `ollama serve`
- Model not found → Pull with `ollama pull llama3.2:3b`
- Port conflict → Check if port 11434 is available

---

### **Problem: AI button doesn't appear**

**Check:**
1. Is the task a milestone? (AI disabled for milestones)
2. Is it a summary task? (AI disabled for summary tasks)
3. Check browser console for errors (F12 → Console tab)

---

### **Problem: Slow responses (>5 seconds)**

**Solutions:**
1. Use smaller model:
   ```bash
   ollama pull llama3.2:1b
   ```
   Then edit `backend/ai_service.py`:
   ```python
   self.model = "llama3.2:1b"  # Change from 3b to 1b
   ```

2. Increase timeout in `backend/ai_service.py`:
   ```python
   async with httpx.AsyncClient(timeout=60.0) as client:  # Increase from 30
   ```

---

## 📊 Expected Performance

**On M1/M2 Mac:**
- Duration estimation: 300-500ms
- First request: ~1-2 seconds (model loading)
- Subsequent requests: <500ms

**On Intel Mac/PC:**
- Duration estimation: 600-1200ms
- First request: ~2-3 seconds
- Subsequent requests: 800ms-1.5s

---

## ✅ Success Checklist

- [ ] Ollama installed and running (`ollama serve`)
- [ ] Model downloaded (`ollama list` shows `llama3.2:3b`)
- [ ] Backend running (`http://localhost:8000/api/ai/health` returns healthy)
- [ ] Frontend running (`http://localhost:5173` loads)
- [ ] AI button appears in task editor
- [ ] Clicking AI button shows suggestions
- [ ] Apply button fills duration field
- [ ] Task saves successfully

---

## 🎉 You're Done!

If all tests pass, you now have a **fully functional AI assistant** integrated into your Gantt chart tool!

**Next steps:**
- Try different task names to see AI suggestions
- Create multiple tasks and see how AI estimates vary
- Check the confidence scores to gauge AI certainty

---

## 📸 Visual Guide

**Where to find the AI button:**

1. Click **"+ Create Task"** in the header
2. Enter a task name
3. Look for the **purple gradient button** with sparkles icon: `✨ 🤖 AI Suggest`
4. Click it and wait for suggestions
5. Click **"✓ Apply Duration"** to use the suggestion

**The button appears:**
- ✅ When creating new tasks
- ✅ When editing existing tasks
- ✅ Between "Task Name" and "Duration" fields
- ❌ NOT for milestones
- ❌ NOT for summary tasks (auto-calculated)

---

## 🆘 Still Having Issues?

Check the browser console (F12 → Console) for errors and share them for debugging.

