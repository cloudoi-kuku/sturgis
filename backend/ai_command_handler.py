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
        
        return {"success": False, "message": "Unknown command", "changes": []}

    def _set_task_duration(self, project: Dict[str, Any], task_outline: str, duration_days: int) -> Dict[str, Any]:
        """Set task duration"""
        task = self._find_task_by_outline(project, task_outline)
        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

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

        if not task.get("predecessors") or len(task["predecessors"]) == 0:
            return {"success": False, "message": f"Task {task_outline} has no predecessors", "changes": []}

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


# Singleton instance
ai_command_handler = AICommandHandler()

