# Summary Task Auto-Detection Fix

## Issue
The summary task auto-detection test was failing because the test was using an incorrect MS Project outline numbering scheme.

## Root Cause
The test was using:
- Parent: "1.0"
- Children: "1.1", "1.2"

But MS Project uses:
- Parent: "1"
- Children: "1.1", "1.2"

The `_calculate_summary_tasks` function checks if a child's outline number starts with the parent's outline number followed by a dot:
```python
if other_outline.startswith(outline + ".") and other_outline != outline:
    has_children = True
```

For "1.0" to be detected as a parent of "1.1":
- Check: "1.1".startswith("1.0.") → **False** ❌

For "1" to be detected as a parent of "1.1":
- Check: "1.1".startswith("1.") → **True** ✅

## Solution
Updated the test to use the correct MS Project outline numbering scheme:
- Level 1: "1", "2", "3" (major phases)
- Level 2: "1.1", "1.2", "2.1" (sub-phases)
- Level 3: "1.1.1", "1.1.2", "2.1.1" (actual tasks)

## Changes Made
1. **test_summary_tasks.py**:
   - Changed parent task from "1.0" to "1"
   - Changed second-level parent from "2.0" to "2"
   - Updated all references to use correct outline numbers

## Test Results
All tests now pass:
- ✅ Parent task auto-detected as summary when child is added
- ✅ Summary task cannot be milestone
- ✅ Summary task cannot have predecessors
- ✅ Multi-level hierarchy works correctly (2 > 2.1 > 2.1.1)

## MS Project Compliance
The system now correctly follows MS Project's outline numbering scheme:
- Root task: "0" (level 0)
- Major phases: "1", "2", "3" (level 1)
- Sub-phases: "1.1", "1.2", "2.1" (level 2)
- Tasks: "1.1.1", "1.1.2", "2.1.1" (level 3)
- And so on...

This matches the actual MS Project XML format used in the template files.

