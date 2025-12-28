#!/usr/bin/env python3
"""Test AI project population for empty projects"""

import asyncio
from ai_service import AIService

async def test_empty_project_detection():
    """Test that AI detects empty projects and offers to populate them"""
    
    ai_service = AIService()
    
    # Test 1: No project context (should trigger generation)
    print("=" * 60)
    print("TEST 1: No project context")
    print("=" * 60)
    
    message = "Create a 5000 sq ft commercial office building project"
    response = await ai_service.chat(message, project_context=None)
    
    print(f"Message: {message}")
    print(f"Response: {response[:200]}...")
    print()
    
    # Test 2: Empty project (should trigger generation)
    print("=" * 60)
    print("TEST 2: Empty project context")
    print("=" * 60)
    
    empty_project = {
        "name": "Empty Project",
        "start_date": "2024-01-01",
        "status_date": "2024-01-01",
        "tasks": []
    }
    
    message = "Generate a residential home construction project"
    response = await ai_service.chat(message, project_context=empty_project)
    
    print(f"Message: {message}")
    print(f"Response: {response[:200]}...")
    print()
    
    # Test 3: Project with only summary tasks (should trigger generation)
    print("=" * 60)
    print("TEST 3: Project with only summary tasks")
    print("=" * 60)
    
    summary_only_project = {
        "name": "Summary Only Project",
        "start_date": "2024-01-01",
        "status_date": "2024-01-01",
        "tasks": [
            {
                "id": "1",
                "name": "Phase 1",
                "outline_number": "1",
                "summary": True,
                "duration": "PT0H0M0S"
            }
        ]
    }
    
    message = "Build a warehouse project"
    response = await ai_service.chat(message, project_context=summary_only_project)
    
    print(f"Message: {message}")
    print(f"Response: {response[:200]}...")
    print()
    
    # Test 4: Project with actual tasks (should NOT trigger generation)
    print("=" * 60)
    print("TEST 4: Project with actual tasks (should NOT generate)")
    print("=" * 60)
    
    populated_project = {
        "name": "Populated Project",
        "start_date": "2024-01-01",
        "status_date": "2024-01-01",
        "tasks": [
            {
                "id": "1",
                "name": "Task 1",
                "outline_number": "1",
                "summary": False,
                "duration": "PT8H0M0S"
            }
        ]
    }
    
    message = "Create a new project"
    response = await ai_service.chat(message, project_context=populated_project)
    
    print(f"Message: {message}")
    print(f"Response: {response[:200]}...")
    print()
    
    print("=" * 60)
    print("✅ All tests completed!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_empty_project_detection())

