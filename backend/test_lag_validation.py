#!/usr/bin/env python3
"""Test the lag validation warning system"""

from validator import ProjectValidator

# Create test project with suspicious lag
test_project = {
    "name": "Test Project",
    "start_date": "2024-01-01T08:00:00",
    "status_date": "2024-01-01T08:00:00",
    "tasks": [
        {
            "id": "1",
            "uid": "1",
            "name": "Task A",
            "outline_number": "1",
            "outline_level": 1,
            "duration": "PT8H0M0S",
            "milestone": False,
            "summary": False,
            "predecessors": []
        },
        {
            "id": "2",
            "uid": "2",
            "name": "Task B with suspicious lag",
            "outline_number": "2",
            "outline_level": 1,
            "duration": "PT8H0M0S",
            "milestone": False,
            "summary": False,
            "predecessors": [
                {
                    "outline_number": "1",
                    "type": 1,
                    "lag": 48000,  # Suspicious! 48000 days
                    "lag_format": 7  # Days format
                }
            ]
        },
        {
            "id": "3",
            "uid": "3",
            "name": "Task C with normal lag",
            "outline_number": "3",
            "outline_level": 1,
            "duration": "PT8H0M0S",
            "milestone": False,
            "summary": False,
            "predecessors": [
                {
                    "outline_number": "2",
                    "type": 1,
                    "lag": 5,  # Normal: 5 days
                    "lag_format": 7  # Days format
                }
            ]
        }
    ]
}

# Run validation
validator = ProjectValidator()
result = validator.validate_project(test_project)

print("=" * 60)
print("VALIDATION RESULT")
print("=" * 60)
print(f"Valid: {result['valid']}")
print(f"Errors: {len(result['errors'])}")
print(f"Warnings: {len(result['warnings'])}")
print()

if result['errors']:
    print("ERRORS:")
    for error in result['errors']:
        print(f"  - {error}")
    print()

if result['warnings']:
    print("WARNINGS:")
    for warning in result['warnings']:
        print(f"  - Field: {warning['field']}")
        print(f"    Message: {warning['message']}")
        print(f"    Task: {warning.get('task_id', 'N/A')}")
        print()

print("=" * 60)
print("✅ Test completed successfully!")
print("=" * 60)

