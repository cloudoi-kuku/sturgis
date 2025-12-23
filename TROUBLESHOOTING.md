# Troubleshooting Guide

## Common Issues and Solutions

### Frontend Issues

#### Issue: "The requested module does not provide an export named 'Task'"

**Symptoms:** Browser console shows error about missing exports from `/src/api/client.ts`

**Solutions:**

1. **Clear Vite cache and restart:**
   ```bash
   cd frontend
   rm -rf node_modules/.vite
   npm run dev
   ```

2. **Hard refresh the browser:**
   - Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Firefox: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
   - Safari: `Cmd+Option+R`

3. **Clear browser cache:**
   - Open DevTools (F12)
   - Right-click the refresh button
   - Select "Empty Cache and Hard Reload"

4. **Restart both servers:**
   ```bash
   # Kill both terminals (Ctrl+C)
   
   # Terminal 1 - Backend
   cd backend
   source venv/bin/activate
   python main.py
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

5. **Verify the file exists:**
   ```bash
   ls -la frontend/src/api/client.ts
   ```

#### Issue: "Cannot connect to backend" or CORS errors

**Symptoms:** Network errors in browser console, API calls failing

**Solutions:**

1. **Verify backend is running:**
   ```bash
   curl http://localhost:8000/docs
   ```
   Should return HTML for Swagger UI

2. **Check environment variable:**
   ```bash
   cat frontend/.env
   ```
   Should contain: `VITE_API_URL=http://localhost:8000`

3. **Restart frontend after changing .env:**
   ```bash
   cd frontend
   # Kill the dev server (Ctrl+C)
   npm run dev
   ```

4. **Check CORS configuration in backend:**
   - Open `backend/main.py`
   - Verify CORS origins include `http://localhost:5173`

#### Issue: Blank page or white screen

**Symptoms:** Application loads but shows nothing

**Solutions:**

1. **Check browser console for errors:**
   - Press F12 to open DevTools
   - Look at Console tab for errors
   - Look at Network tab for failed requests

2. **Verify all dependencies installed:**
   ```bash
   cd frontend
   npm install
   ```

3. **Check if React is rendering:**
   - Open browser DevTools
   - Check Elements/Inspector tab
   - Look for `<div id="root">` with content

### Backend Issues

#### Issue: "ModuleNotFoundError: No module named 'fastapi'"

**Symptoms:** Backend won't start, Python import errors

**Solutions:**

1. **Activate virtual environment:**
   ```bash
   cd backend
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Verify installation:**
   ```bash
   pip list | grep fastapi
   ```

#### Issue: "Address already in use" on port 8000

**Symptoms:** Backend won't start, port conflict

**Solutions:**

1. **Find and kill the process:**
   ```bash
   # macOS/Linux
   lsof -ti:8000 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :8000
   taskkill /PID <PID> /F
   ```

2. **Use a different port:**
   - Edit `backend/main.py`
   - Change port in `uvicorn.run()` call
   - Update `frontend/.env` to match

#### Issue: XML parsing errors

**Symptoms:** Upload fails, backend logs show XML errors

**Solutions:**

1. **Verify XML file is valid:**
   - Open in text editor
   - Check for proper XML structure
   - Ensure it's an MS Project XML file

2. **Check file encoding:**
   - Should be UTF-8
   - No special characters that break XML

3. **Test with template file:**
   ```bash
   # Use the original template file
   cp "Mulit Family - Schedule.xml" backend/template.xml
   ```

### Build Issues

#### Issue: npm install fails

**Symptoms:** Dependency installation errors

**Solutions:**

1. **Clear npm cache:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Use correct Node version:**
   ```bash
   node --version  # Should be 16+
   ```

3. **Try with legacy peer deps:**
   ```bash
   npm install --legacy-peer-deps
   ```

#### Issue: TypeScript errors

**Symptoms:** Build fails with type errors

**Solutions:**

1. **Check TypeScript version:**
   ```bash
   cd frontend
   npm list typescript
   ```

2. **Regenerate types:**
   ```bash
   rm -rf node_modules
   npm install
   ```

### Runtime Issues

#### Issue: Tasks not displaying after upload

**Symptoms:** File uploads successfully but Gantt chart is empty

**Solutions:**

1. **Check API response:**
   - Open browser DevTools
   - Go to Network tab
   - Look at response from `/api/tasks`
   - Verify it contains task data

2. **Check console for errors:**
   - Look for JavaScript errors
   - Check for data parsing issues

3. **Verify backend parsed the file:**
   ```bash
   curl http://localhost:8000/api/tasks
   ```

#### Issue: Validation always fails

**Symptoms:** Can't export, validation shows errors

**Solutions:**

1. **Read validation errors carefully:**
   - Check the validation panel
   - Fix each error one by one

2. **Common validation issues:**
   - Duplicate outline numbers → Make unique
   - Invalid duration format → Use `PT8H0M0S` format
   - Circular dependencies → Remove circular references
   - Missing required fields → Fill in name and outline number

3. **Test validation via API:**
   ```bash
   curl -X POST http://localhost:8000/api/validate
   ```

#### Issue: Export downloads empty or corrupt file

**Symptoms:** Downloaded XML file is invalid

**Solutions:**

1. **Check backend logs:**
   - Look for errors during XML generation
   - Verify all tasks have required fields

2. **Test export via API:**
   ```bash
   curl -X POST http://localhost:8000/api/export -o test.xml
   ```

3. **Validate the XML:**
   - Open in text editor
   - Check for proper XML structure
   - Try opening in MS Project

## Performance Issues

#### Issue: Slow Gantt chart rendering

**Symptoms:** UI is sluggish with many tasks

**Solutions:**

1. **Reduce number of tasks:**
   - Test with smaller project first
   - Consider pagination for large projects

2. **Check browser performance:**
   - Close other tabs
   - Disable browser extensions
   - Use Chrome DevTools Performance tab

## Development Tips

### Enable Debug Logging

**Backend:**
```python
# Add to backend/main.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Frontend:**
```typescript
// Add to frontend/src/api/client.ts
apiClient.interceptors.request.use(request => {
  console.log('Starting Request', request);
  return request;
});
```

### Test API Directly

Use the Swagger UI at http://localhost:8000/docs to test endpoints without the frontend.

### Check Network Traffic

1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Watch API calls in real-time

### Verify File Structure

```bash
# Check all files are present
ls -R frontend/src/
ls -R backend/
```

## Getting More Help

1. **Check the logs:**
   - Backend: Terminal running `python main.py`
   - Frontend: Browser console (F12)

2. **Review documentation:**
   - README.md
   - ARCHITECTURE.md
   - API docs at http://localhost:8000/docs

3. **Test with curl:**
   - Verify backend endpoints work
   - Isolate frontend vs backend issues

4. **Start fresh:**
   ```bash
   # Complete reset
   cd backend
   rm -rf venv
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   
   cd ../frontend
   rm -rf node_modules
   npm install
   ```

## Still Having Issues?

If none of these solutions work:

1. Check that you're using compatible versions:
   - Python 3.8+
   - Node.js 16+
   
2. Verify all files are present and not corrupted

3. Try running on a different machine or browser

4. Check system resources (CPU, memory, disk space)

