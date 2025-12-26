"""
Test AI Command Handler
Run this to verify command parsing and execution
"""

from ai_command_handler import ai_command_handler
import json

# Sample project for testing
test_project = {
    "name": "Test Construction Project",
    "start_date": "2024-01-01",
    "tasks": [
        {
            "id": "1",
            "name": "Site Preparation",
            "outline_number": "1.1",
            "duration": "PT80H0M0S",  # 10 days
            "summary": False,
            "milestone": False,
            "predecessors": []
        },
        {
            "id": "2",
            "name": "Foundation Work",
            "outline_number": "1.2",
            "duration": "PT120H0M0S",  # 15 days
            "summary": False,
            "milestone": False,
            "predecessors": [
                {
                    "outline_number": "1.1",
                    "type": "FS",
                    "lag": 0
                }
            ]
        },
        {
            "id": "3",
            "name": "Framing",
            "outline_number": "2.1",
            "duration": "PT160H0M0S",  # 20 days
            "summary": False,
            "milestone": False,
            "predecessors": [
                {
                    "outline_number": "1.2",
                    "type": "FS",
                    "lag": 2400  # 5 days lag
                }
            ]
        }
    ]
}

def test_command(message: str):
    """Test a command"""
    print(f"\n{'='*60}")
    print(f"Testing: '{message}'")
    print(f"{'='*60}")
    
    # Parse command
    command = ai_command_handler.parse_command(message)
    
    if command:
        print(f"✅ Command parsed: {command['action']}")
        print(f"   Parameters: {command['params']}")
        
        # Execute command
        result = ai_command_handler.execute_command(command, test_project)
        
        if result["success"]:
            print(f"✅ Execution successful!")
            print(f"   Message: {result['message']}")
            if result["changes"]:
                print(f"   Changes: {len(result['changes'])} modifications")
                for change in result["changes"][:3]:
                    print(f"   - {change}")
        else:
            print(f"❌ Execution failed: {result['message']}")
    else:
        print(f"❌ No command detected")

# Run tests
print("\n🧪 AI Command Handler Tests")
print("="*60)

# Test 1: Set task duration
test_command("Change task 1.2 duration to 10 days")

# Test 2: Set task lag
test_command("Set lag for task 2.1 to 3 days")

# Test 3: Remove lag
test_command("Remove lag from task 2.1")

# Test 4: Set project start date
test_command("Set project start date to 2024-02-01")

# Test 5: Set project duration
test_command("Set project duration to 30 days")

# Test 6: Add buffer
test_command("Add 10% buffer to all tasks")

# Test 7: Invalid task
test_command("Change task 9.9 duration to 5 days")

# Test 8: Not a command
test_command("What is the weather today?")

print("\n" + "="*60)
print("✅ All tests completed!")
print("="*60)

# Print final project state
print("\n📊 Final Project State:")
print(f"Start Date: {test_project['start_date']}")
print(f"\nTasks:")
for task in test_project['tasks']:
    duration_hours = int(task['duration'].replace('PT', '').replace('H0M0S', ''))
    duration_days = duration_hours / 8
    print(f"  {task['outline_number']} {task['name']}: {duration_days} days")
    if task['predecessors']:
        for pred in task['predecessors']:
            lag_days = pred['lag'] / 480.0
            print(f"    → Predecessor {pred['outline_number']}, lag: {lag_days} days")

