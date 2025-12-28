#!/usr/bin/env python3
"""
Test script to verify summary task creation and management functionality.
Tests all aspects of summary task behavior including:
1. Creating summary tasks from scratch
2. Converting existing tasks to summary tasks
3. Summary task hierarchy rules
4. Validation constraints
"""

import requests
import json
from typing import Dict, Any, List

API_BASE = "http://localhost:8000"

def print_section(title: str):
    """Print a formatted section header"""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def print_result(test_name: str, success: bool, details: str = ""):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    {details}")

def get_tasks() -> List[Dict[str, Any]]:
    """Get all tasks from the current project"""
    response = requests.get(f"{API_BASE}/api/tasks")
    if response.status_code == 200:
        return response.json()["tasks"]
    return []

def create_task(task_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new task"""
    response = requests.post(f"{API_BASE}/api/tasks", json=task_data)
    return response.json()

def update_task(task_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update an existing task"""
    response = requests.put(f"{API_BASE}/api/tasks/{task_id}", json=updates)
    return response.json()

def delete_task(task_id: str) -> Dict[str, Any]:
    """Delete a task"""
    response = requests.delete(f"{API_BASE}/api/tasks/{task_id}")
    return response.json()

def validate_project() -> Dict[str, Any]:
    """Validate the current project"""
    response = requests.post(f"{API_BASE}/api/validate")
    return response.json()

def test_summary_task_creation():
    """Test creating summary tasks by adding child tasks"""
    print_section("TEST 1: Creating Summary Tasks from Scratch")

    # Get initial task count
    initial_tasks = get_tasks()
    print(f"Initial task count: {len(initial_tasks)}")

    # Step 1: Create a parent task (will become summary when children are added)
    print("\n1. Creating parent task '1 - Foundation Phase'...")
    parent_task = create_task({
        "name": "Foundation Phase",
        "outline_number": "1",
        "duration": "PT40H0M0S",  # 5 days
        "milestone": False,
        "predecessors": []
    })

    if parent_task.get("success"):
        print_result("Parent task created", True, f"ID: {parent_task['task']['id']}")
        parent_is_summary = parent_task['task'].get('summary', False)
        print(f"    Is summary: {parent_is_summary} (should be False initially)")
    else:
        print_result("Parent task created", False, parent_task.get("detail", "Unknown error"))
        return

    # Step 2: Create first child task
    print("\n2. Creating child task '1.1 - Excavation'...")
    child1_task = create_task({
        "name": "Excavation",
        "outline_number": "1.1",
        "duration": "PT16H0M0S",  # 2 days
        "milestone": False,
        "predecessors": []
    })

    if child1_task.get("success"):
        print_result("Child task 1 created", True, f"ID: {child1_task['task']['id']}")
    else:
        print_result("Child task 1 created", False, child1_task.get("detail", "Unknown error"))
        return

    # Step 3: Check if parent is now a summary task
    print("\n3. Checking if parent task is now marked as summary...")
    all_tasks = get_tasks()
    parent_updated = next((t for t in all_tasks if t['outline_number'] == '1'), None)

    if parent_updated:
        is_summary = parent_updated.get('summary', False)
        print_result("Parent auto-detected as summary", is_summary,
                    f"summary={is_summary}, milestone={parent_updated.get('milestone')}")
    else:
        print_result("Parent task found", False, "Could not find parent task")

    # Step 4: Create second child task
    print("\n4. Creating child task '1.2 - Formwork'...")
    child2_task = create_task({
        "name": "Formwork",
        "outline_number": "1.2",
        "duration": "PT24H0M0S",  # 3 days
        "milestone": False,
        "predecessors": [{"outline_number": "1.1", "type": 1, "lag": 0, "lag_format": 7}]
    })

    if child2_task.get("success"):
        print_result("Child task 2 created", True, f"ID: {child2_task['task']['id']}")
    else:
        print_result("Child task 2 created", False, child2_task.get("detail", "Unknown error"))

def test_summary_task_constraints():
    """Test validation constraints for summary tasks"""
    print_section("TEST 2: Summary Task Validation Constraints")

    all_tasks = get_tasks()
    parent_task = next((t for t in all_tasks if t['outline_number'] == '1'), None)

    if not parent_task:
        print_result("Find parent task", False, "Parent task '1' not found")
        return

    print(f"Testing constraints on summary task: {parent_task['name']}")
    print(f"Current state: summary={parent_task.get('summary')}, milestone={parent_task.get('milestone')}")

    # Test 1: Try to make summary task a milestone
    print("\n1. Attempting to set summary task as milestone (should fail)...")
    result = update_task(parent_task['id'], {"milestone": True})

    if not result.get("success"):
        print_result("Summary task cannot be milestone", True,
                    f"Correctly rejected: {result.get('detail', 'Unknown error')}")
    else:
        print_result("Summary task cannot be milestone", False,
                    "ERROR: System allowed summary task to be milestone!")

    # Test 2: Try to add predecessors to summary task
    print("\n2. Attempting to add predecessors to summary task (should fail)...")
    result = update_task(parent_task['id'], {
        "predecessors": [{"outline_number": "0", "type": 1, "lag": 0, "lag_format": 7}]
    })

    if not result.get("success"):
        print_result("Summary task cannot have predecessors", True,
                    f"Correctly rejected: {result.get('detail', 'Unknown error')}")
    else:
        print_result("Summary task cannot have predecessors", False,
                    "ERROR: System allowed predecessors on summary task!")

def test_summary_task_hierarchy():
    """Test multi-level summary task hierarchy"""
    print_section("TEST 3: Multi-Level Summary Task Hierarchy")

    # Create nested structure: 2 > 2.1 > 2.1.1
    print("Creating nested hierarchy: 2 > 2.1 > 2.1.1")

    # Level 1: Top-level phase
    print("\n1. Creating '2 - Structural Phase'...")
    create_task({
        "name": "Structural Phase",
        "outline_number": "2",
        "duration": "PT80H0M0S",
        "milestone": False,
        "predecessors": []
    })

    # Level 2: Sub-phase
    print("2. Creating '2.1 - Concrete Work'...")
    create_task({
        "name": "Concrete Work",
        "outline_number": "2.1",
        "duration": "PT40H0M0S",
        "milestone": False,
        "predecessors": []
    })

    # Level 3: Actual work task
    print("3. Creating '2.1.1 - Pour Foundation'...")
    create_task({
        "name": "Pour Foundation",
        "outline_number": "2.1.1",
        "duration": "PT8H0M0S",
        "milestone": False,
        "predecessors": []
    })

    # Check hierarchy
    print("\n4. Verifying hierarchy...")
    all_tasks = get_tasks()
    task_2 = next((t for t in all_tasks if t['outline_number'] == '2'), None)
    task_2_1 = next((t for t in all_tasks if t['outline_number'] == '2.1'), None)
    task_2_1_1 = next((t for t in all_tasks if t['outline_number'] == '2.1.1'), None)

    if task_2:
        print_result("2 is summary", task_2.get('summary', False),
                    f"Has child 2.1")
    if task_2_1:
        print_result("2.1 is summary", task_2_1.get('summary', False),
                    f"Has child 2.1.1")
    if task_2_1_1:
        print_result("2.1.1 is NOT summary", not task_2_1_1.get('summary', False),
                    f"Leaf task (no children)")

def create_new_test_project() -> bool:
    """Create a fresh project for testing"""
    print("Creating new test project...")
    response = requests.post(f"{API_BASE}/api/projects/new", params={"name": "Summary Task Test Project"})
    if response.status_code == 200:
        result = response.json()
        print_result("New project created", True, f"ID: {result.get('project_id')}")
        return True
    else:
        print_result("New project created", False, f"Status: {response.status_code}")
        return False

def main():
    """Run all summary task tests"""
    print("\n" + "="*80)
    print("  SUMMARY TASK FUNCTIONALITY TEST SUITE")
    print("="*80)

    try:
        # Check if server is running
        response = requests.get(f"{API_BASE}/health")
        if response.status_code != 200:
            print("❌ ERROR: Server is not responding")
            return

        print("✅ Server is running")

        # Create a fresh project for testing
        print_section("SETUP: Creating Fresh Test Project")
        if not create_new_test_project():
            print("❌ ERROR: Could not create test project")
            return

        # Run tests
        test_summary_task_creation()
        test_summary_task_constraints()
        test_summary_task_hierarchy()

        # Final validation
        print_section("FINAL PROJECT VALIDATION")
        validation = validate_project()

        if validation.get("valid"):
            print_result("Project validation", True, "All tasks are valid")
        else:
            print_result("Project validation", False,
                        f"Found {len(validation.get('errors', []))} errors")
            for error in validation.get('errors', []):
                print(f"    - {error.get('message')} (task: {error.get('task_id')})")

        print("\n" + "="*80)
        print("  TEST SUITE COMPLETE")
        print("="*80 + "\n")

    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to server. Is it running on http://localhost:8000?")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

if __name__ == "__main__":
    main()

