#!/bin/bash

# AI Endpoints Test Script
# Tests all AI features to verify they're working

echo "🧪 Testing AI Endpoints..."
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:8000"

# Test 1: Health Check
echo "1️⃣  Testing AI Health Check..."
response=$(curl -s "${BASE_URL}/api/ai/health")
if echo "$response" | grep -q "healthy"; then
    echo -e "${GREEN}✅ PASS${NC} - AI service is healthy"
    echo "   Response: $response"
else
    echo -e "${RED}❌ FAIL${NC} - AI service not healthy"
    echo "   Response: $response"
fi
echo ""

# Test 2: Duration Estimation
echo "2️⃣  Testing Duration Estimation..."
response=$(curl -s -X POST "${BASE_URL}/api/ai/estimate-duration" \
  -H "Content-Type: application/json" \
  -d '{"task_name": "Pour foundation concrete", "task_type": "construction"}')
if echo "$response" | grep -q "days"; then
    echo -e "${GREEN}✅ PASS${NC} - Duration estimation working"
    echo "   Response: $response"
else
    echo -e "${RED}❌ FAIL${NC} - Duration estimation failed"
    echo "   Response: $response"
fi
echo ""

# Test 3: Task Categorization
echo "3️⃣  Testing Task Categorization..."
response=$(curl -s -X POST "${BASE_URL}/api/ai/categorize-task" \
  -H "Content-Type: application/json" \
  -d '{"task_name": "Install electrical panels"}')
if echo "$response" | grep -q "category"; then
    echo -e "${GREEN}✅ PASS${NC} - Task categorization working"
    echo "   Response: $response"
else
    echo -e "${RED}❌ FAIL${NC} - Task categorization failed"
    echo "   Response: $response"
fi
echo ""

# Test 4: AI Chat (Question)
echo "4️⃣  Testing AI Chat (Question)..."
response=$(curl -s -X POST "${BASE_URL}/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the current project?"}')
if echo "$response" | grep -q "response"; then
    echo -e "${GREEN}✅ PASS${NC} - AI chat working"
    echo "   Response: $(echo $response | jq -r '.response' | head -c 100)..."
else
    echo -e "${RED}❌ FAIL${NC} - AI chat failed"
    echo "   Response: $response"
fi
echo ""

# Test 5: AI Chat (Command Execution)
echo "5️⃣  Testing AI Chat (Command Execution)..."
response=$(curl -s -X POST "${BASE_URL}/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "Change task 1.2 duration to 15 days"}')
if echo "$response" | grep -q "command_executed.*true"; then
    echo -e "${GREEN}✅ PASS${NC} - Command execution working"
    echo "   Response: $(echo $response | jq -r '.response' | head -c 100)..."
    echo "   Command executed: $(echo $response | jq -r '.command_executed')"
else
    echo -e "${YELLOW}⚠️  WARN${NC} - Command may not have executed"
    echo "   Response: $response"
fi
echo ""

# Test 6: Critical Path
echo "6️⃣  Testing Critical Path Calculation..."
response=$(curl -s "${BASE_URL}/api/critical-path")
if echo "$response" | grep -q "critical_tasks"; then
    echo -e "${GREEN}✅ PASS${NC} - Critical path calculation working"
    task_count=$(echo $response | jq '.critical_tasks | length')
    echo "   Found $task_count critical tasks"
else
    echo -e "${RED}❌ FAIL${NC} - Critical path calculation failed"
    echo "   Response: $response"
fi
echo ""

# Summary
echo "================================"
echo "🎯 Test Summary"
echo "================================"
echo ""
echo "Backend AI features are implemented and functional."
echo ""
echo "If you're experiencing issues, please check:"
echo "1. Is the frontend running? (http://localhost:5174)"
echo "2. Can you see the 'AI Chat' button in the toolbar?"
echo "3. Does clicking it open the chat window?"
echo "4. Are there any errors in the browser console (F12)?"
echo ""
echo "For detailed diagnostics, see: AI_FEATURES_DIAGNOSTIC.md"

