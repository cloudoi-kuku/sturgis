"""
AI Command Handler - Parse and execute natural language commands
Allows AI to modify tasks, lags, durations, and project settings
"""

import re
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta


class AICommandHandler:
    """Parse and execute AI commands for project modification"""
    
    def __init__(self):
        self.command_patterns = {
            # Task duration modifications
            'set_duration': [
                r'(?:change|set|update|modify)\s+task\s+([0-9.]+)\s+duration\s+to\s+(\d+)\s*days?',
                r'(?:change|set|update|modify)\s+(?:task\s+)?([0-9.]+)\s+to\s+(\d+)\s*days?',
                r'set\s+([0-9.]+)\s+duration\s+(\d+)',
            ],
            # Task lag modifications
            'set_lag': [
                r'(?:change|set|update|modify)\s+(?:task\s+)?([0-9.]+)\s+lag\s+to\s+(\d+)\s*days?',
                r'set\s+lag\s+(?:for\s+)?(?:task\s+)?([0-9.]+)\s+to\s+(\d+)',
                r'add\s+(\d+)\s*days?\s+lag\s+(?:to\s+)?(?:task\s+)?([0-9.]+)',
            ],
            # Remove lag
            'remove_lag': [
                r'remove\s+lag\s+(?:from\s+)?(?:task\s+)?([0-9.]+)',
                r'clear\s+lag\s+(?:from\s+)?(?:task\s+)?([0-9.]+)',
                r'delete\s+lag\s+(?:from\s+)?(?:task\s+)?([0-9.]+)',
            ],
            # Project start date
            'set_start_date': [
                r'(?:change|set|update|modify)\s+(?:project\s+)?start\s+date\s+to\s+(\d{4}-\d{2}-\d{2})',
                r'set\s+start\s+(?:date\s+)?(\d{4}-\d{2}-\d{2})',
                r'project\s+starts?\s+(?:on\s+)?(\d{4}-\d{2}-\d{2})',
            ],
            # Project duration
            'set_project_duration': [
                r'(?:change|set|update|modify)\s+(?:project\s+)?(?:overall\s+)?duration\s+to\s+(\d+)\s*days?',
                r'project\s+should\s+(?:be\s+)?(\d+)\s*days?',
                r'compress\s+project\s+to\s+(\d+)\s*days?',
            ],
            # Bulk duration changes
            'add_buffer': [
                r'add\s+(\d+)%?\s+buffer\s+to\s+all\s+tasks',
                r'increase\s+all\s+tasks\s+by\s+(\d+)%?',
            ],
            # Task constraints
            'set_constraint': [
                r'(?:set|change|update|modify)\s+task\s+([0-9.]+)\s+constraint\s+to\s+(must\s+start\s+on|must\s+finish\s+on|start\s+no\s+earlier\s+than|start\s+no\s+later\s+than|finish\s+no\s+earlier\s+than|finish\s+no\s+later\s+than|as\s+soon\s+as\s+possible|as\s+late\s+as\s+possible)(?:\s+(\d{4}-\d{2}-\d{2}))?',
                r'(?:change|set|update|modify)\s+task\s+([0-9.]+)\s+to\s+(must\s+start\s+on|must\s+finish\s+on|start\s+no\s+earlier\s+than|start\s+no\s+later\s+than|finish\s+no\s+earlier\s+than|finish\s+no\s+later\s+than|as\s+soon\s+as\s+possible|as\s+late\s+as\s+possible)(?:\s+(\d{4}-\d{2}-\d{2}))?',
            ],
            # Fix validation issues
            'fix_validation': [
                r'fix\s+(?:all\s+)?validation\s+(?:issues|errors|problems)',
                r'fix\s+(?:the\s+)?project\s+(?:issues|errors|problems)',
                r'repair\s+(?:the\s+)?project',
                r'clean\s+up\s+(?:the\s+)?project',
                r'fix\s+(?:all\s+)?(?:the\s+)?issues',
            ],
            # Fix milestones specifically
            'fix_milestones': [
                r'fix\s+(?:all\s+)?milestones?(?:\s+duration)?',
                r'set\s+(?:all\s+)?milestones?\s+(?:duration\s+)?to\s+(?:zero|0)',
                r'milestones?\s+should\s+(?:have|be)\s+(?:zero|0)\s+duration',
            ],
            # Fix summary task predecessors
            'fix_summary_predecessors': [
                r'fix\s+summary\s+(?:task\s+)?predecessors?',
                r'remove\s+predecessors?\s+from\s+summary\s+tasks?',
                r'summary\s+tasks?\s+should\s+not\s+have\s+predecessors?',
                r'clear\s+summary\s+(?:task\s+)?predecessors?',
            ],
            # Make task a milestone
            'make_milestone': [
                r'(?:make|set|convert)\s+task\s+([0-9.]+)\s+(?:a\s+|as\s+)?milestone',
                r'task\s+([0-9.]+)\s+(?:is|should\s+be)\s+(?:a\s+)?milestone',
            ],
            # Remove milestone status
            'remove_milestone': [
                r'(?:remove|unset|clear)\s+milestone\s+(?:from\s+)?task\s+([0-9.]+)',
                r'task\s+([0-9.]+)\s+(?:is\s+)?not\s+(?:a\s+)?milestone',
                r'(?:make|convert)\s+task\s+([0-9.]+)\s+(?:a\s+)?(?:regular|normal)\s+task',
            ],
            # Remove predecessor from specific task
            'remove_predecessor': [
                r'remove\s+predecessor(?:s)?\s+(?:from\s+)?task\s+([0-9.]+)',
                r'clear\s+predecessor(?:s)?\s+(?:from\s+)?task\s+([0-9.]+)',
                r'task\s+([0-9.]+)\s+should\s+(?:have\s+)?no\s+predecessor(?:s)?',
            ],
        }
    
    def parse_command(self, message: str) -> Optional[Dict[str, Any]]:
        """
        Parse natural language message to detect commands
        Returns: {"action": str, "params": dict} or None
        """
        message_lower = message.lower().strip()
        
        # Check each command pattern
        for action, patterns in self.command_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, message_lower)
                if match:
                    return self._extract_params(action, match)
        
        return None
    
    def _extract_params(self, action: str, match: re.Match) -> Dict[str, Any]:
        """Extract parameters from regex match"""
        groups = match.groups()
        
        if action == 'set_duration':
            return {
                "action": "set_duration",
                "params": {
                    "task_outline": groups[0],
                    "duration_days": int(groups[1])
                }
            }
        
        elif action == 'set_lag':
            # Handle both "set task X lag to Y" and "add Y lag to task X"
            if len(groups) == 2:
                # Check which group is the number
                if groups[0].replace('.', '').isdigit():
                    task_outline = groups[0]
                    lag_days = int(groups[1])
                else:
                    lag_days = int(groups[0])
                    task_outline = groups[1]
                
                return {
                    "action": "set_lag",
                    "params": {
                        "task_outline": task_outline,
                        "lag_days": lag_days
                    }
                }
        
        elif action == 'remove_lag':
            return {
                "action": "remove_lag",
                "params": {
                    "task_outline": groups[0]
                }
            }
        
        elif action == 'set_start_date':
            return {
                "action": "set_start_date",
                "params": {
                    "start_date": groups[0]
                }
            }
        
        elif action == 'set_project_duration':
            return {
                "action": "set_project_duration",
                "params": {
                    "target_days": int(groups[0])
                }
            }
        
        elif action == 'add_buffer':
            return {
                "action": "add_buffer",
                "params": {
                    "buffer_percent": int(groups[0])
                }
            }
        
        elif action == 'set_constraint':
            # Map constraint type strings to numbers
            constraint_map = {
                'as soon as possible': 0,
                'as late as possible': 1,
                'must start on': 2,
                'must finish on': 3,
                'start no earlier than': 4,
                'start no later than': 5,
                'finish no earlier than': 6,
                'finish no later than': 7
            }

            constraint_type_str = groups[1].lower()
            constraint_type = constraint_map.get(constraint_type_str, 0)
            constraint_date = groups[2] if len(groups) > 2 and groups[2] else None

            return {
                "action": "set_constraint",
                "params": {
                    "task_outline": groups[0],
                    "constraint_type": constraint_type,
                    "constraint_date": constraint_date + 'T08:00:00' if constraint_date else None
                }
            }

        elif action == 'fix_validation':
            return {
                "action": "fix_validation",
                "params": {}
            }

        elif action == 'fix_milestones':
            return {
                "action": "fix_milestones",
                "params": {}
            }

        elif action == 'fix_summary_predecessors':
            return {
                "action": "fix_summary_predecessors",
                "params": {}
            }

        elif action == 'make_milestone':
            return {
                "action": "make_milestone",
                "params": {
                    "task_outline": groups[0]
                }
            }

        elif action == 'remove_milestone':
            return {
                "action": "remove_milestone",
                "params": {
                    "task_outline": groups[0]
                }
            }

        elif action == 'remove_predecessor':
            return {
                "action": "remove_predecessor",
                "params": {
                    "task_outline": groups[0]
                }
            }

        return None
    
    def execute_command(self, command: Dict[str, Any], project: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a parsed command on the project
        Returns: {"success": bool, "message": str, "changes": list}
        """
        action = command["action"]
        params = command["params"]
        
        if action == "set_duration":
            return self._set_task_duration(project, params["task_outline"], params["duration_days"])
        
        elif action == "set_lag":
            return self._set_task_lag(project, params["task_outline"], params["lag_days"])
        
        elif action == "remove_lag":
            return self._remove_task_lag(project, params["task_outline"])
        
        elif action == "set_start_date":
            return self._set_project_start_date(project, params["start_date"])
        
        elif action == "set_project_duration":
            return self._set_project_duration(project, params["target_days"])
        
        elif action == "add_buffer":
            return self._add_buffer_to_all_tasks(project, params["buffer_percent"])
        
        elif action == "set_constraint":
            return self._set_task_constraint(project, params["task_outline"], params["constraint_type"], params["constraint_date"])

        elif action == "fix_validation":
            return self._fix_all_validation_issues(project)

        elif action == "fix_milestones":
            return self._fix_milestone_durations(project)

        elif action == "fix_summary_predecessors":
            return self._fix_summary_predecessors(project)

        elif action == "make_milestone":
            return self._make_milestone(project, params["task_outline"])

        elif action == "remove_milestone":
            return self._remove_milestone(project, params["task_outline"])

        elif action == "remove_predecessor":
            return self._remove_all_predecessors(project, params["task_outline"])

        return {"success": False, "message": "Unknown command", "changes": []}

    def _set_task_duration(self, project: Dict[str, Any], task_outline: str, duration_days: int) -> Dict[str, Any]:
        """Set task duration"""
        task = self._find_task_by_outline(project, task_outline)
        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

        # Validate: Milestone tasks must have zero duration
        if task.get("milestone", False) and duration_days != 0:
            return {
                "success": False,
                "message": f"Cannot set duration for milestone task {task_outline} '{task['name']}'. Milestone tasks must have zero duration.",
                "changes": []
            }

        # Validate: Summary tasks should not have duration set directly
        if task.get("summary", False):
            return {
                "success": False,
                "message": f"Cannot set duration for summary task {task_outline} '{task['name']}'. Summary task durations are calculated from their children.",
                "changes": []
            }

        old_duration = task.get("duration", "")
        # Convert days to ISO 8601 format (PT{hours}H0M0S)
        hours = duration_days * 8  # 8 hours per day
        new_duration = f"PT{hours}H0M0S"
        task["duration"] = new_duration

        return {
            "success": True,
            "message": f"Updated task {task_outline} '{task['name']}' duration from {self._parse_duration_to_days(old_duration)} to {duration_days} days",
            "changes": [{
                "type": "duration",
                "task": task_outline,
                "task_name": task["name"],
                "old_value": old_duration,
                "new_value": new_duration,
                "old_days": self._parse_duration_to_days(old_duration),
                "new_days": duration_days
            }]
        }

    def _set_task_lag(self, project: Dict[str, Any], task_outline: str, lag_days: int) -> Dict[str, Any]:
        """Set lag for task's first predecessor"""
        task = self._find_task_by_outline(project, task_outline)
        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

        # Validate: Summary tasks should not have predecessors
        if task.get("summary", False):
            return {
                "success": False,
                "message": f"Cannot set lag for summary task {task_outline} '{task['name']}'. Summary tasks should not have predecessors.",
                "changes": []
            }

        if not task.get("predecessors") or len(task["predecessors"]) == 0:
            return {"success": False, "message": f"Task {task_outline} '{task['name']}' has no predecessors", "changes": []}

        # Set lag on first predecessor (in minutes: 480 min = 1 day)
        predecessor = task["predecessors"][0]
        old_lag = predecessor.get("lag", 0)
        old_lag_days = old_lag / 480.0
        new_lag = lag_days * 480  # Convert days to minutes
        predecessor["lag"] = new_lag

        return {
            "success": True,
            "message": f"Updated task {task_outline} '{task['name']}' lag from {old_lag_days:.1f} to {lag_days} days",
            "changes": [{
                "type": "lag",
                "task": task_outline,
                "task_name": task["name"],
                "predecessor": predecessor.get("outline_number"),
                "old_value": old_lag,
                "new_value": new_lag,
                "old_days": old_lag_days,
                "new_days": lag_days
            }]
        }

    def _remove_task_lag(self, project: Dict[str, Any], task_outline: str) -> Dict[str, Any]:
        """Remove lag from task's predecessors"""
        task = self._find_task_by_outline(project, task_outline)
        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

        # Validate: Summary tasks should not have predecessors
        if task.get("summary", False):
            return {
                "success": False,
                "message": f"Cannot remove lag from summary task {task_outline} '{task['name']}'. Summary tasks should not have predecessors.",
                "changes": []
            }

        if not task.get("predecessors"):
            return {"success": False, "message": f"Task {task_outline} has no predecessors", "changes": []}

        changes = []
        for predecessor in task["predecessors"]:
            old_lag = predecessor.get("lag", 0)
            if old_lag != 0:
                old_lag_days = old_lag / 480.0
                predecessor["lag"] = 0
                changes.append({
                    "type": "lag",
                    "task": task_outline,
                    "task_name": task["name"],
                    "predecessor": predecessor.get("outline_number"),
                    "old_value": old_lag,
                    "new_value": 0,
                    "old_days": old_lag_days,
                    "new_days": 0
                })

        if not changes:
            return {"success": False, "message": f"Task {task_outline} has no lags to remove", "changes": []}

        return {
            "success": True,
            "message": f"Removed {len(changes)} lag(s) from task {task_outline} '{task['name']}'",
            "changes": changes
        }

    def _set_project_start_date(self, project: Dict[str, Any], start_date: str) -> Dict[str, Any]:
        """Set project start date"""
        old_start = project.get("start_date", "")
        project["start_date"] = start_date

        return {
            "success": True,
            "message": f"Updated project start date from {old_start} to {start_date}",
            "changes": [{
                "type": "project_start_date",
                "old_value": old_start,
                "new_value": start_date
            }]
        }

    def _set_project_duration(self, project: Dict[str, Any], target_days: int) -> Dict[str, Any]:
        """
        Set overall project duration by proportionally adjusting all task durations
        This is a simplified approach - for complex optimization, use the optimize endpoint
        """
        tasks = project.get("tasks", [])
        non_summary_tasks = [t for t in tasks if not t.get("summary") and not t.get("milestone")]

        if not non_summary_tasks:
            return {"success": False, "message": "No tasks to modify", "changes": []}

        # Calculate current total duration (sum of all tasks)
        current_total = sum(self._parse_duration_to_days(t.get("duration", "")) for t in non_summary_tasks)

        if current_total == 0:
            return {"success": False, "message": "Current project duration is 0", "changes": []}

        # Calculate scaling factor
        scale_factor = target_days / current_total

        changes = []
        for task in non_summary_tasks:
            old_duration = task.get("duration", "")
            old_days = self._parse_duration_to_days(old_duration)
            new_days = max(1, int(old_days * scale_factor))  # Minimum 1 day
            hours = new_days * 8
            new_duration = f"PT{hours}H0M0S"
            task["duration"] = new_duration

            changes.append({
                "type": "duration",
                "task": task.get("outline_number"),
                "task_name": task["name"],
                "old_value": old_duration,
                "new_value": new_duration,
                "old_days": old_days,
                "new_days": new_days
            })

        return {
            "success": True,
            "message": f"Scaled project from {current_total:.0f} to {target_days} days (factor: {scale_factor:.2f}). Modified {len(changes)} tasks.",
            "changes": changes
        }

    def _add_buffer_to_all_tasks(self, project: Dict[str, Any], buffer_percent: int) -> Dict[str, Any]:
        """Add percentage buffer to all task durations"""
        tasks = project.get("tasks", [])
        non_summary_tasks = [t for t in tasks if not t.get("summary") and not t.get("milestone")]

        changes = []
        for task in non_summary_tasks:
            old_duration = task.get("duration", "")
            old_days = self._parse_duration_to_days(old_duration)
            new_days = max(1, int(old_days * (1 + buffer_percent / 100.0)))
            hours = new_days * 8
            new_duration = f"PT{hours}H0M0S"
            task["duration"] = new_duration

            changes.append({
                "type": "duration",
                "task": task.get("outline_number"),
                "task_name": task["name"],
                "old_value": old_duration,
                "new_value": new_duration,
                "old_days": old_days,
                "new_days": new_days
            })

        return {
            "success": True,
            "message": f"Added {buffer_percent}% buffer to {len(changes)} tasks",
            "changes": changes
        }
    
    def _set_task_constraint(self, project: Dict[str, Any], task_outline: str, constraint_type: int, constraint_date: str) -> Dict[str, Any]:
        """Set task constraint type and date"""
        task = self._find_task_by_outline(project, task_outline)
        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

        # Validate: Summary tasks should not have constraints
        if task.get("summary", False):
            return {
                "success": False,
                "message": f"Cannot set constraint for summary task {task_outline} '{task['name']}'. Summary tasks should not have constraints.",
                "changes": []
            }

        # Validate constraint type requires date for types 2-7
        if constraint_type >= 2 and not constraint_date:
            constraint_names = {
                2: "Must Start On", 3: "Must Finish On", 4: "Start No Earlier Than",
                5: "Start No Later Than", 6: "Finish No Earlier Than", 7: "Finish No Later Than"
            }
            return {
                "success": False,
                "message": f"Constraint type '{constraint_names[constraint_type]}' requires a date",
                "changes": []
            }

        # Store old values for change tracking
        old_constraint_type = task.get("constraint_type", 0)
        old_constraint_date = task.get("constraint_date")
        
        # Map constraint types to readable names
        constraint_names = {
            0: "As Soon As Possible", 1: "As Late As Possible", 2: "Must Start On",
            3: "Must Finish On", 4: "Start No Earlier Than", 5: "Start No Later Than",
            6: "Finish No Earlier Than", 7: "Finish No Later Than"
        }

        # Update task
        task["constraint_type"] = constraint_type
        if constraint_type >= 2:
            task["constraint_date"] = constraint_date
        else:
            task["constraint_date"] = None

        changes = []
        
        # Track constraint type change
        if old_constraint_type != constraint_type:
            changes.append({
                "type": "constraint_type",
                "task": task_outline,
                "task_name": task["name"],
                "old_value": old_constraint_type,
                "new_value": constraint_type,
                "old_name": constraint_names.get(old_constraint_type, "Unknown"),
                "new_name": constraint_names.get(constraint_type, "Unknown")
            })
        
        # Track constraint date change
        if old_constraint_date != constraint_date:
            changes.append({
                "type": "constraint_date",
                "task": task_outline,
                "task_name": task["name"],
                "old_value": old_constraint_date,
                "new_value": constraint_date
            })

        message_parts = []
        if old_constraint_type != constraint_type:
            message_parts.append(f"constraint: {constraint_names[old_constraint_type]} → {constraint_names[constraint_type]}")
        if old_constraint_date != constraint_date:
            date_str = constraint_date.split('T')[0] if constraint_date else 'None'
            old_date_str = old_constraint_date.split('T')[0] if old_constraint_date else 'None'
            message_parts.append(f"constraint date: {old_date_str} → {date_str}")

        return {
            "success": True,
            "message": f"Updated task {task_outline} '{task['name']}' {', '.join(message_parts)}",
            "changes": changes
        }

    def _find_task_by_outline(self, project: Dict[str, Any], outline_number: str) -> Optional[Dict[str, Any]]:
        """Find task by outline number"""
        for task in project.get("tasks", []):
            if task.get("outline_number") == outline_number:
                return task
        return None

    def _parse_duration_to_days(self, duration: str) -> float:
        """Parse ISO 8601 duration to days (8 hours = 1 day)"""
        if not duration or duration == "PT0H0M0S":
            return 0.0

        # Extract hours from PT{hours}H0M0S format
        match = re.search(r'PT(\d+)H', duration)
        if match:
            hours = int(match.group(1))
            return hours / 8.0  # 8 hours = 1 day

        return 0.0

    def _fix_all_validation_issues(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """Fix all common validation issues in the project"""
        changes = []

        # Fix milestone durations
        milestone_result = self._fix_milestone_durations(project)
        changes.extend(milestone_result.get("changes", []))

        # Fix summary task predecessors
        summary_result = self._fix_summary_predecessors(project)
        changes.extend(summary_result.get("changes", []))

        if not changes:
            return {
                "success": True,
                "message": "No validation issues found to fix",
                "changes": []
            }

        return {
            "success": True,
            "message": f"Fixed {len(changes)} validation issue(s)",
            "changes": changes
        }

    def _fix_milestone_durations(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """Fix all milestones to have zero duration"""
        tasks = project.get("tasks", [])
        changes = []

        for task in tasks:
            if task.get("milestone", False):
                old_duration = task.get("duration", "")
                if old_duration != "PT0H0M0S":
                    old_days = self._parse_duration_to_days(old_duration)
                    task["duration"] = "PT0H0M0S"
                    changes.append({
                        "type": "milestone_duration_fix",
                        "task": task.get("outline_number"),
                        "task_name": task.get("name"),
                        "old_value": old_duration,
                        "new_value": "PT0H0M0S",
                        "old_days": old_days,
                        "new_days": 0
                    })

        if not changes:
            return {
                "success": True,
                "message": "All milestones already have zero duration",
                "changes": []
            }

        return {
            "success": True,
            "message": f"Fixed {len(changes)} milestone(s) to have zero duration",
            "changes": changes
        }

    def _fix_summary_predecessors(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """Remove predecessors from all summary tasks"""
        tasks = project.get("tasks", [])
        changes = []

        for task in tasks:
            if task.get("summary", False):
                predecessors = task.get("predecessors", [])
                if predecessors and len(predecessors) > 0:
                    old_preds = [p.get("outline_number") for p in predecessors]
                    task["predecessors"] = []
                    changes.append({
                        "type": "summary_predecessor_fix",
                        "task": task.get("outline_number"),
                        "task_name": task.get("name"),
                        "removed_predecessors": old_preds
                    })

        if not changes:
            return {
                "success": True,
                "message": "No summary tasks have predecessors",
                "changes": []
            }

        return {
            "success": True,
            "message": f"Removed predecessors from {len(changes)} summary task(s)",
            "changes": changes
        }

    def _make_milestone(self, project: Dict[str, Any], task_outline: str) -> Dict[str, Any]:
        """Convert a task to a milestone"""
        task = self._find_task_by_outline(project, task_outline)
        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

        if task.get("summary", False):
            return {
                "success": False,
                "message": f"Cannot make summary task {task_outline} '{task['name']}' a milestone",
                "changes": []
            }

        if task.get("milestone", False):
            return {
                "success": False,
                "message": f"Task {task_outline} '{task['name']}' is already a milestone",
                "changes": []
            }

        old_duration = task.get("duration", "")
        task["milestone"] = True
        task["duration"] = "PT0H0M0S"

        return {
            "success": True,
            "message": f"Converted task {task_outline} '{task['name']}' to milestone (duration set to 0)",
            "changes": [{
                "type": "make_milestone",
                "task": task_outline,
                "task_name": task["name"],
                "old_duration": old_duration,
                "old_days": self._parse_duration_to_days(old_duration)
            }]
        }

    def _remove_milestone(self, project: Dict[str, Any], task_outline: str) -> Dict[str, Any]:
        """Remove milestone status from a task"""
        task = self._find_task_by_outline(project, task_outline)
        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

        if not task.get("milestone", False):
            return {
                "success": False,
                "message": f"Task {task_outline} '{task['name']}' is not a milestone",
                "changes": []
            }

        task["milestone"] = False
        # Set a default duration of 1 day
        task["duration"] = "PT8H0M0S"

        return {
            "success": True,
            "message": f"Removed milestone status from task {task_outline} '{task['name']}' (duration set to 1 day)",
            "changes": [{
                "type": "remove_milestone",
                "task": task_outline,
                "task_name": task["name"],
                "new_duration": "PT8H0M0S",
                "new_days": 1
            }]
        }

    def _remove_all_predecessors(self, project: Dict[str, Any], task_outline: str) -> Dict[str, Any]:
        """Remove all predecessors from a task"""
        task = self._find_task_by_outline(project, task_outline)
        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

        predecessors = task.get("predecessors", [])
        if not predecessors or len(predecessors) == 0:
            return {
                "success": False,
                "message": f"Task {task_outline} '{task['name']}' has no predecessors to remove",
                "changes": []
            }

        old_preds = [p.get("outline_number") for p in predecessors]
        task["predecessors"] = []

        return {
            "success": True,
            "message": f"Removed {len(old_preds)} predecessor(s) from task {task_outline} '{task['name']}'",
            "changes": [{
                "type": "remove_predecessors",
                "task": task_outline,
                "task_name": task["name"],
                "removed_predecessors": old_preds
            }]
        }


# Singleton instance
ai_command_handler = AICommandHandler()

