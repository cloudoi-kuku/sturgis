"""
AI Command Handler - Parse and execute natural language commands
Allows AI to modify tasks, lags, durations, and project settings
"""

import re
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta


def _recalculate_dates_standalone(project: Dict) -> Dict:
    """Standalone date recalculation function to avoid circular imports"""
    from datetime import datetime, timedelta

    tasks = project.get("tasks", [])
    if not tasks:
        return project

    # Get project start date
    project_start_str = project.get("start_date", "")
    try:
        project_start = datetime.fromisoformat(project_start_str.replace('Z', '+00:00').split('T')[0]) if project_start_str else datetime.now()
    except:
        project_start = datetime.now()

    # Build task lookup
    task_map = {t["outline_number"]: t for t in tasks}

    # Parse duration helper
    def parse_duration(duration_str):
        if not duration_str:
            return 0
        import re
        match = re.search(r'PT(\d+)H', duration_str)
        if match:
            return int(match.group(1)) / 8
        return 0

    # First pass: Calculate dates for non-summary tasks
    processed = set()
    max_iterations = len(tasks) * 2
    iteration = 0

    while len(processed) < len(tasks) and iteration < max_iterations:
        iteration += 1
        for task in tasks:
            outline = task["outline_number"]
            if outline in processed or task.get("summary"):
                continue

            predecessors = task.get("predecessors", [])
            all_preds_processed = all(
                p.get("outline_number") in processed or p.get("outline_number") not in task_map
                for p in predecessors
            )

            if not all_preds_processed and predecessors:
                continue

            start_date = project_start

            for pred in predecessors:
                pred_outline = pred.get("outline_number")
                if pred_outline in task_map:
                    pred_task = task_map[pred_outline]
                    pred_finish_str = pred_task.get("finish_date", "")
                    if pred_finish_str:
                        try:
                            pred_finish = datetime.fromisoformat(pred_finish_str.replace('Z', '+00:00').split('T')[0])
                            lag_days = pred.get("lag", 0)
                            if isinstance(lag_days, str):
                                lag_days = 0
                            pred_finish = pred_finish + timedelta(days=int(lag_days))
                            if pred_finish > start_date:
                                start_date = pred_finish
                        except:
                            pass

            duration_days = parse_duration(task.get("duration", "PT8H0M0S"))
            finish_date = start_date + timedelta(days=max(duration_days, 0))

            task["start_date"] = start_date.strftime("%Y-%m-%dT08:00:00")
            task["finish_date"] = finish_date.strftime("%Y-%m-%dT17:00:00")
            processed.add(outline)

    # Second pass: Calculate summary task dates
    summary_tasks = [t for t in tasks if t.get("summary")]
    summary_tasks.sort(key=lambda t: -t.get("outline_level", 0))

    for summary in summary_tasks:
        summary_outline = summary["outline_number"]
        children = [t for t in tasks if t["outline_number"].startswith(summary_outline + ".")]

        if not children:
            continue

        min_start = None
        max_finish = None

        for child in children:
            if child.get("start_date"):
                try:
                    child_start = datetime.fromisoformat(child["start_date"].replace('Z', '+00:00').split('T')[0])
                    if min_start is None or child_start < min_start:
                        min_start = child_start
                except:
                    pass

            if child.get("finish_date"):
                try:
                    child_finish = datetime.fromisoformat(child["finish_date"].replace('Z', '+00:00').split('T')[0])
                    if max_finish is None or child_finish > max_finish:
                        max_finish = child_finish
                except:
                    pass

        if min_start:
            summary["start_date"] = min_start.strftime("%Y-%m-%dT08:00:00")
        if max_finish:
            summary["finish_date"] = max_finish.strftime("%Y-%m-%dT17:00:00")
        if min_start and max_finish:
            duration_days = (max_finish - min_start).days
            summary["duration"] = f"PT{duration_days * 8}H0M0S"

    return project


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
            # Fix dependencies (broken refs, circular, etc.)
            'fix_dependencies': [
                r'fix\s+(?:all\s+)?(?:the\s+)?dependenc(?:y|ies)',
                r'fix\s+(?:all\s+)?(?:the\s+)?predecessors?',
                r'fix\s+(?:broken|invalid)\s+(?:predecessor\s+)?(?:references?|links?)',
                r'fix\s+circular\s+dependenc(?:y|ies)',
                r'repair\s+(?:all\s+)?dependenc(?:y|ies)',
                r'clean\s+up\s+(?:all\s+)?dependenc(?:y|ies)',
                r'remove\s+(?:broken|invalid)\s+predecessors?',
            ],
            # Organize project - create summary tasks and dependencies
            'organize_project': [
                r'organi[sz]e\s+(?:the\s+)?project',  # organize/organise (US/UK)
                r'create\s+(?:the\s+)?(?:project\s+)?structure',
                r'create\s+summary\s+tasks?',
                r'add\s+summary\s+tasks?',
                r'group\s+(?:the\s+)?tasks?',
                r'structure\s+(?:the\s+)?project',
                r'setup?\s+(?:project\s+)?hierarchy',
                r'create\s+(?:wbs|work\s+breakdown)',
                r'organi[sz]e\s+(?:and\s+)?(?:fix\s+)?(?:the\s+)?tasks?',  # organize/organise
                r'intelligently\s+(?:organi[sz]e|structure|group)',
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

        elif action == 'fix_dependencies':
            return {
                "action": "fix_dependencies",
                "params": {}
            }

        elif action == 'organize_project':
            return {
                "action": "organize_project",
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

        elif action == "extend_duration":
            return self._extend_task_duration(project, params["task_outline"], params["days_to_add"])

        elif action == "reduce_duration":
            return self._reduce_task_duration(project, params["task_outline"], params["days_to_subtract"])

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

        elif action == "fix_dependencies":
            return self._fix_all_dependencies(project)

        elif action == "organize_project":
            return self._organize_project(project)

        elif action == "make_milestone":
            return self._make_milestone(project, params["task_outline"])

        elif action == "remove_milestone":
            return self._remove_milestone(project, params["task_outline"])

        elif action == "remove_predecessor":
            return self._remove_all_predecessors(project, params["task_outline"])

        elif action == "move_task":
            return self._move_task(project, params["task_outline"], params["target_outline"], params.get("position", "after"))

        elif action == "insert_task":
            return self._insert_task(project, params["task_name"], params["reference_outline"], params.get("position", "after"))

        elif action == "delete_task":
            return self._delete_task(project, params["task_outline"])

        elif action == "merge_tasks":
            return self._merge_tasks(project, params["task_outline_1"], params["task_outline_2"])

        elif action == "split_task":
            return self._split_task(project, params["task_outline"], params.get("parts", 2))

        elif action == "scale_durations":
            return self._scale_all_durations(project, params.get("scale_factor", 1.0))

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

    def _extend_task_duration(self, project: Dict[str, Any], task_outline: str, days_to_add: int) -> Dict[str, Any]:
        """Extend task duration by adding days to current duration"""
        task = self._find_task_by_outline(project, task_outline)
        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

        if task.get("milestone", False):
            return {
                "success": False,
                "message": f"Cannot extend duration for milestone task {task_outline} '{task['name']}'. Milestone tasks must have zero duration.",
                "changes": []
            }

        if task.get("summary", False):
            return {
                "success": False,
                "message": f"Cannot extend duration for summary task {task_outline} '{task['name']}'. Summary task durations are calculated from their children.",
                "changes": []
            }

        old_duration = task.get("duration", "PT8H0M0S")
        old_days = self._parse_duration_to_days(old_duration)
        new_days = old_days + days_to_add

        if new_days < 0:
            new_days = 0

        hours = int(new_days * 8)
        new_duration = f"PT{hours}H0M0S"
        task["duration"] = new_duration

        return {
            "success": True,
            "message": f"Extended task {task_outline} '{task['name']}' duration from {old_days} to {new_days} days (+{days_to_add} days)",
            "changes": [{
                "type": "duration",
                "task": task_outline,
                "task_name": task["name"],
                "old_value": old_duration,
                "new_value": new_duration,
                "old_days": old_days,
                "new_days": new_days
            }]
        }

    def _reduce_task_duration(self, project: Dict[str, Any], task_outline: str, days_to_subtract: int) -> Dict[str, Any]:
        """Reduce task duration by subtracting days from current duration"""
        task = self._find_task_by_outline(project, task_outline)
        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

        if task.get("milestone", False):
            return {
                "success": False,
                "message": f"Cannot reduce duration for milestone task {task_outline} '{task['name']}'. Milestone tasks must have zero duration.",
                "changes": []
            }

        if task.get("summary", False):
            return {
                "success": False,
                "message": f"Cannot reduce duration for summary task {task_outline} '{task['name']}'. Summary task durations are calculated from their children.",
                "changes": []
            }

        old_duration = task.get("duration", "PT8H0M0S")
        old_days = self._parse_duration_to_days(old_duration)
        new_days = old_days - days_to_subtract

        if new_days < 0:
            new_days = 0

        hours = int(new_days * 8)
        new_duration = f"PT{hours}H0M0S"
        task["duration"] = new_duration

        return {
            "success": True,
            "message": f"Reduced task {task_outline} '{task['name']}' duration from {old_days} to {new_days} days (-{days_to_subtract} days)",
            "changes": [{
                "type": "duration",
                "task": task_outline,
                "task_name": task["name"],
                "old_value": old_duration,
                "new_value": new_duration,
                "old_days": old_days,
                "new_days": new_days
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
        """Fix all common validation issues in the project including dependencies"""
        changes = []

        # 1. Fix broken predecessor references (references to non-existent tasks)
        broken_result = self._fix_broken_predecessors(project)
        changes.extend(broken_result.get("changes", []))

        # 2. Fix circular dependencies
        circular_result = self._fix_circular_dependencies(project)
        changes.extend(circular_result.get("changes", []))

        # 3. Fix milestone durations
        milestone_result = self._fix_milestone_durations(project)
        changes.extend(milestone_result.get("changes", []))

        # 4. Fix summary task predecessors
        summary_result = self._fix_summary_predecessors(project)
        changes.extend(summary_result.get("changes", []))

        # 5. Fix unreasonable lag values (>2 years)
        lag_result = self._fix_unreasonable_lags(project)
        changes.extend(lag_result.get("changes", []))

        # 6. Recalculate all dates after fixes
        if changes:
            _recalculate_dates_standalone(project)
            changes.append({
                "type": "dates_recalculated",
                "message": "All task dates recalculated after fixes"
            })

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

    def _fix_broken_predecessors(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """Remove predecessor references to tasks that don't exist"""
        tasks = project.get("tasks", [])
        changes = []

        # Build set of valid outline numbers
        valid_outlines = {task.get("outline_number") for task in tasks}

        for task in tasks:
            predecessors = task.get("predecessors", [])
            if not predecessors:
                continue

            # Find broken references
            broken_refs = []
            valid_preds = []

            for pred in predecessors:
                pred_outline = pred.get("outline_number")
                if pred_outline not in valid_outlines:
                    broken_refs.append(pred_outline)
                else:
                    valid_preds.append(pred)

            if broken_refs:
                task["predecessors"] = valid_preds
                changes.append({
                    "type": "broken_predecessor_fix",
                    "task": task.get("outline_number"),
                    "task_name": task.get("name"),
                    "removed_references": broken_refs
                })

        if not changes:
            return {
                "success": True,
                "message": "No broken predecessor references found",
                "changes": []
            }

        return {
            "success": True,
            "message": f"Removed {len(changes)} broken predecessor reference(s)",
            "changes": changes
        }

    def _fix_circular_dependencies(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """Detect and break circular dependencies by removing the last link in the cycle"""
        tasks = project.get("tasks", [])
        changes = []

        # Build task lookup
        task_by_outline = {t.get("outline_number"): t for t in tasks}

        # Build dependency graph
        def get_predecessors(outline):
            task = task_by_outline.get(outline)
            if not task:
                return []
            return [p.get("outline_number") for p in task.get("predecessors", [])]

        # Find cycles using DFS
        def find_cycle(start, current, path, visited):
            if current in path:
                # Found cycle - return the cycle path
                cycle_start = path.index(current)
                return path[cycle_start:] + [current]

            if current in visited:
                return None

            visited.add(current)
            path.append(current)

            for pred in get_predecessors(current):
                cycle = find_cycle(start, pred, path[:], visited)
                if cycle:
                    return cycle

            return None

        # Check each task for cycles
        cycles_fixed = set()
        for task in tasks:
            outline = task.get("outline_number")
            cycle = find_cycle(outline, outline, [], set())

            if cycle and tuple(cycle) not in cycles_fixed:
                cycles_fixed.add(tuple(cycle))

                # Break the cycle by removing the last predecessor link
                # This removes the link from cycle[-2] -> cycle[-1]
                if len(cycle) >= 2:
                    task_to_fix = task_by_outline.get(cycle[-2])
                    pred_to_remove = cycle[-1]

                    if task_to_fix:
                        old_preds = task_to_fix.get("predecessors", [])
                        new_preds = [p for p in old_preds if p.get("outline_number") != pred_to_remove]

                        if len(new_preds) < len(old_preds):
                            task_to_fix["predecessors"] = new_preds
                            changes.append({
                                "type": "circular_dependency_fix",
                                "task": cycle[-2],
                                "task_name": task_to_fix.get("name"),
                                "removed_predecessor": pred_to_remove,
                                "cycle": cycle
                            })

        if not changes:
            return {
                "success": True,
                "message": "No circular dependencies found",
                "changes": []
            }

        return {
            "success": True,
            "message": f"Fixed {len(changes)} circular dependency(ies)",
            "changes": changes
        }

    def _fix_all_dependencies(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """Fix all dependency-related issues: broken refs, circular deps, and recalculate dates"""
        changes = []

        # 1. Fix broken predecessor references
        broken_result = self._fix_broken_predecessors(project)
        changes.extend(broken_result.get("changes", []))

        # 2. Fix circular dependencies
        circular_result = self._fix_circular_dependencies(project)
        changes.extend(circular_result.get("changes", []))

        # 3. Fix unreasonable lag values
        lag_result = self._fix_unreasonable_lags(project)
        changes.extend(lag_result.get("changes", []))

        # 4. Fix summary task predecessors
        summary_result = self._fix_summary_predecessors(project)
        changes.extend(summary_result.get("changes", []))

        # 5. Recalculate all dates
        if changes:
            _recalculate_dates_standalone(project)
            changes.append({
                "type": "dates_recalculated",
                "message": "All task dates recalculated after dependency fixes"
            })

        if not changes:
            return {
                "success": True,
                "message": "No dependency issues found to fix",
                "changes": []
            }

        return {
            "success": True,
            "message": f"Fixed {len(changes)} dependency issue(s)",
            "changes": changes
        }

    def _fix_unreasonable_lags(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """Fix lag values that are unreasonably large (>2 years = 730 days)"""
        tasks = project.get("tasks", [])
        changes = []

        for task in tasks:
            predecessors = task.get("predecessors", [])
            modified = False

            for pred in predecessors:
                lag_value = pred.get("lag", 0)
                lag_format = pred.get("lag_format", 7)

                # Convert to days
                if lag_format == 3:  # Minutes
                    lag_days = lag_value / 480
                elif lag_format in [5, 6]:  # Hours
                    lag_days = lag_value / 8
                elif lag_format in [7, 8]:  # Days
                    lag_days = lag_value
                elif lag_format in [9, 10]:  # Weeks
                    lag_days = lag_value * 5
                elif lag_format in [11, 12]:  # Months
                    lag_days = lag_value * 20
                else:
                    lag_days = lag_value

                if abs(lag_days) > 730:  # More than 2 years
                    old_lag = lag_value
                    pred["lag"] = 0
                    pred["lag_format"] = 7
                    modified = True
                    changes.append({
                        "type": "unreasonable_lag_fix",
                        "task": task.get("outline_number"),
                        "task_name": task.get("name"),
                        "predecessor": pred.get("outline_number"),
                        "old_lag_days": lag_days,
                        "new_lag": 0
                    })

        if not changes:
            return {
                "success": True,
                "message": "No unreasonable lag values found",
                "changes": []
            }

        return {
            "success": True,
            "message": f"Fixed {len(changes)} unreasonable lag value(s)",
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

    def _move_task(self, project: Dict[str, Any], task_outline: str, target_outline: str, position: str = "after") -> Dict[str, Any]:
        """Move a task to a new position relative to target task"""
        tasks = project.get("tasks", [])

        # Find source and target tasks
        source_task = self._find_task_by_outline(project, task_outline)
        target_task = self._find_task_by_outline(project, target_outline)

        if not source_task:
            return {"success": False, "message": f"Source task {task_outline} not found", "changes": []}
        if not target_task:
            return {"success": False, "message": f"Target task {target_outline} not found", "changes": []}

        # Cannot move summary task
        if source_task.get("summary"):
            return {"success": False, "message": f"Cannot move summary task {task_outline}", "changes": []}

        # Find indices
        source_idx = next((i for i, t in enumerate(tasks) if t.get("outline_number") == task_outline), -1)
        target_idx = next((i for i, t in enumerate(tasks) if t.get("outline_number") == target_outline), -1)

        if source_idx == -1 or target_idx == -1:
            return {"success": False, "message": "Could not find task positions", "changes": []}

        # Remove source task
        task_to_move = tasks.pop(source_idx)

        # Recalculate target index after removal
        if source_idx < target_idx:
            target_idx -= 1

        # Insert at new position
        if position == "before":
            insert_idx = target_idx
        elif position == "after":
            insert_idx = target_idx + 1
        elif position == "under":
            # Find last child of target and insert after
            target_prefix = target_outline + "."
            last_child_idx = target_idx
            for i, t in enumerate(tasks):
                if t.get("outline_number", "").startswith(target_prefix):
                    last_child_idx = i
            insert_idx = last_child_idx + 1
        else:
            insert_idx = target_idx + 1

        tasks.insert(insert_idx, task_to_move)

        # Renumber tasks
        self._renumber_tasks(tasks)

        new_outline = task_to_move.get("outline_number", "?")

        return {
            "success": True,
            "message": f"Moved task '{source_task['name']}' from {task_outline} to {position} {target_outline} (new position: {new_outline})",
            "changes": [{
                "type": "move_task",
                "task": task_outline,
                "task_name": source_task["name"],
                "target": target_outline,
                "position": position,
                "new_outline": new_outline
            }]
        }

    def _insert_task(self, project: Dict[str, Any], task_name: str, reference_outline: str, position: str = "after") -> Dict[str, Any]:
        """Insert a new task at a position relative to reference task"""
        import uuid

        tasks = project.get("tasks", [])
        reference_task = self._find_task_by_outline(project, reference_outline)

        if not reference_task:
            return {"success": False, "message": f"Reference task {reference_outline} not found", "changes": []}

        # Find reference index
        ref_idx = next((i for i, t in enumerate(tasks) if t.get("outline_number") == reference_outline), -1)
        if ref_idx == -1:
            return {"success": False, "message": "Could not find reference task position", "changes": []}

        # Determine insert position
        if position == "before":
            insert_idx = ref_idx
        elif position == "after":
            insert_idx = ref_idx + 1
        elif position == "under":
            # Insert as first child
            insert_idx = ref_idx + 1
        else:
            insert_idx = ref_idx + 1

        # Create new task
        new_task = {
            "id": str(uuid.uuid4()),
            "uid": str(max([int(t.get("uid", 0)) for t in tasks] + [0]) + 1),
            "name": task_name,
            "outline_number": "",  # Will be set by renumber
            "outline_level": reference_task.get("outline_level", 1),
            "duration": "PT8H0M0S",  # 1 day default
            "milestone": False,
            "summary": False,
            "predecessors": [],
            "percent_complete": 0
        }

        if position == "under":
            new_task["outline_level"] = reference_task.get("outline_level", 1) + 1

        tasks.insert(insert_idx, new_task)

        # Renumber tasks
        self._renumber_tasks(tasks)

        new_outline = new_task.get("outline_number", "?")

        return {
            "success": True,
            "message": f"Inserted new task '{task_name}' {position} {reference_outline} (new position: {new_outline})",
            "changes": [{
                "type": "insert_task",
                "task_name": task_name,
                "reference": reference_outline,
                "position": position,
                "new_outline": new_outline
            }]
        }

    def _delete_task(self, project: Dict[str, Any], task_outline: str) -> Dict[str, Any]:
        """Delete a task from the project"""
        tasks = project.get("tasks", [])
        task = self._find_task_by_outline(project, task_outline)

        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

        task_name = task.get("name", "Unknown")

        # If summary task, also delete children
        deleted_tasks = []
        if task.get("summary"):
            prefix = task_outline + "."
            tasks_to_remove = [t for t in tasks if t.get("outline_number") == task_outline or t.get("outline_number", "").startswith(prefix)]
            for t in tasks_to_remove:
                deleted_tasks.append({"outline": t.get("outline_number"), "name": t.get("name")})
                tasks.remove(t)
        else:
            deleted_tasks.append({"outline": task_outline, "name": task_name})
            tasks.remove(task)

        # Update predecessors that reference deleted task
        for t in tasks:
            preds = t.get("predecessors", [])
            t["predecessors"] = [p for p in preds if p.get("outline_number") not in [d["outline"] for d in deleted_tasks]]

        # Renumber tasks
        self._renumber_tasks(tasks)

        return {
            "success": True,
            "message": f"Deleted {len(deleted_tasks)} task(s): {task_outline} '{task_name}'",
            "changes": [{
                "type": "delete_task",
                "deleted_tasks": deleted_tasks
            }]
        }

    def _merge_tasks(self, project: Dict[str, Any], task_outline_1: str, task_outline_2: str) -> Dict[str, Any]:
        """Merge two tasks into one (combines durations, keeps first task's position)"""
        task1 = self._find_task_by_outline(project, task_outline_1)
        task2 = self._find_task_by_outline(project, task_outline_2)

        if not task1:
            return {"success": False, "message": f"Task {task_outline_1} not found", "changes": []}
        if not task2:
            return {"success": False, "message": f"Task {task_outline_2} not found", "changes": []}

        if task1.get("summary") or task2.get("summary"):
            return {"success": False, "message": "Cannot merge summary tasks", "changes": []}

        # Combine durations
        dur1 = self._parse_duration_to_days(task1.get("duration", "PT8H0M0S"))
        dur2 = self._parse_duration_to_days(task2.get("duration", "PT8H0M0S"))
        new_duration_days = dur1 + dur2
        new_duration = f"PT{int(new_duration_days * 8)}H0M0S"

        # Merge names
        task1["name"] = f"{task1['name']} + {task2['name']}"
        task1["duration"] = new_duration

        # Combine predecessors (unique)
        all_preds = task1.get("predecessors", []) + task2.get("predecessors", [])
        seen = set()
        unique_preds = []
        for p in all_preds:
            key = p.get("outline_number")
            if key and key not in seen and key != task_outline_1 and key != task_outline_2:
                seen.add(key)
                unique_preds.append(p)
        task1["predecessors"] = unique_preds

        # Delete task2
        tasks = project.get("tasks", [])
        tasks.remove(task2)

        # Update any predecessors pointing to task2 to point to task1
        for t in tasks:
            for p in t.get("predecessors", []):
                if p.get("outline_number") == task_outline_2:
                    p["outline_number"] = task_outline_1

        # Renumber
        self._renumber_tasks(tasks)

        return {
            "success": True,
            "message": f"Merged '{task2['name']}' into '{task1['name']}' (combined duration: {new_duration_days} days)",
            "changes": [{
                "type": "merge_tasks",
                "kept_task": task_outline_1,
                "merged_task": task_outline_2,
                "new_duration_days": new_duration_days
            }]
        }

    def _split_task(self, project: Dict[str, Any], task_outline: str, parts: int = 2) -> Dict[str, Any]:
        """Split a task into multiple equal parts"""
        import uuid

        task = self._find_task_by_outline(project, task_outline)
        if not task:
            return {"success": False, "message": f"Task {task_outline} not found", "changes": []}

        if task.get("summary"):
            return {"success": False, "message": "Cannot split summary task", "changes": []}

        if parts < 2 or parts > 10:
            return {"success": False, "message": "Parts must be between 2 and 10", "changes": []}

        tasks = project.get("tasks", [])
        task_idx = next((i for i, t in enumerate(tasks) if t.get("outline_number") == task_outline), -1)

        # Calculate split duration
        original_duration = self._parse_duration_to_days(task.get("duration", "PT8H0M0S"))
        split_duration = original_duration / parts
        split_duration_str = f"PT{int(split_duration * 8)}H0M0S"

        # Update original task
        original_name = task["name"]
        task["name"] = f"{original_name} (Part 1)"
        task["duration"] = split_duration_str

        # Create additional parts
        new_tasks = []
        prev_outline = task_outline
        for i in range(2, parts + 1):
            new_task = {
                "id": str(uuid.uuid4()),
                "uid": str(max([int(t.get("uid", 0)) for t in tasks] + [0]) + i),
                "name": f"{original_name} (Part {i})",
                "outline_number": "",
                "outline_level": task.get("outline_level", 1),
                "duration": split_duration_str,
                "milestone": False,
                "summary": False,
                "predecessors": [{"outline_number": prev_outline, "type": 1, "lag": 0}],
                "percent_complete": 0
            }
            new_tasks.append(new_task)

        # Insert new tasks after original
        for i, new_task in enumerate(new_tasks):
            tasks.insert(task_idx + 1 + i, new_task)

        # Renumber
        self._renumber_tasks(tasks)

        return {
            "success": True,
            "message": f"Split '{original_name}' into {parts} parts ({split_duration} days each)",
            "changes": [{
                "type": "split_task",
                "original_task": task_outline,
                "parts": parts,
                "duration_per_part": split_duration
            }]
        }

    def _scale_all_durations(self, project: Dict[str, Any], scale_factor: float) -> Dict[str, Any]:
        """Scale all task durations by a factor"""
        tasks = project.get("tasks", [])
        changes = []

        if scale_factor <= 0 or scale_factor > 10:
            return {"success": False, "message": "Scale factor must be between 0 and 10", "changes": []}

        for task in tasks:
            if task.get("summary") or task.get("milestone"):
                continue

            old_duration = task.get("duration", "PT8H0M0S")
            old_days = self._parse_duration_to_days(old_duration)
            new_days = old_days * scale_factor
            new_duration = f"PT{int(new_days * 8)}H0M0S"

            if old_duration != new_duration:
                task["duration"] = new_duration
                changes.append({
                    "task": task.get("outline_number"),
                    "task_name": task.get("name"),
                    "old_days": old_days,
                    "new_days": new_days
                })

        return {
            "success": True,
            "message": f"Scaled {len(changes)} task durations by {scale_factor}x",
            "changes": [{
                "type": "scale_durations",
                "scale_factor": scale_factor,
                "tasks_modified": len(changes)
            }]
        }

    def _renumber_tasks(self, tasks: List[Dict]) -> None:
        """Renumber task outline numbers based on their position and level"""
        counters = {}  # level -> current number
        parent_stack = []  # stack of (level, outline_number)

        for task in tasks:
            level = task.get("outline_level", 1)

            # Reset counters for levels deeper than current
            counters = {k: v for k, v in counters.items() if k <= level}

            # Find parent
            while parent_stack and parent_stack[-1][0] >= level:
                parent_stack.pop()

            # Increment counter for this level
            counters[level] = counters.get(level, 0) + 1

            # Build outline number
            if parent_stack:
                parent_outline = parent_stack[-1][1]
                new_outline = f"{parent_outline}.{counters[level]}"
            else:
                new_outline = str(counters[level])

            task["outline_number"] = new_outline

            # Add to parent stack if this could be a parent
            parent_stack.append((level, new_outline))

    def _organize_project(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """
        Intelligently organize a flat task list into a hierarchical structure.

        Strategy:
        1. First detect building/unit markers (Building 1, Unit A, Phase 1, etc.)
        2. If buildings found: group site-wide tasks, then each building, then closeout
        3. If no buildings: fall back to phase-based grouping
        """
        import uuid
        import re

        tasks = project.get("tasks", [])
        changes = []

        if not tasks:
            return {
                "success": False,
                "message": "No tasks to organize",
                "changes": []
            }

        # Check if already organized (has summary tasks, excluding project-level task "0")
        existing_summaries = [t for t in tasks if t.get("summary") and t.get("outline_number") != "0"]
        print(f"[Organize] Total tasks: {len(tasks)}, Summary tasks (excl 0): {len(existing_summaries)}")
        if existing_summaries:
            summary_names = [f"{t.get('outline_number')}: {t.get('name')}" for t in existing_summaries[:5]]
            print(f"[Organize] Existing summaries: {summary_names}")
            return {
                "success": False,
                "message": f"Project already has {len(existing_summaries)} summary task(s): {summary_names}. Delete project and re-upload original XML.",
                "changes": []
            }

        # Filter out project-level task (outline "0") and sort by outline number
        work_tasks = [t for t in tasks if t.get("outline_number") != "0"]
        # Sort by outline number to ensure correct order
        def outline_sort_key(t):
            outline = t.get("outline_number", "0")
            try:
                return int(outline.split('.')[0]), int(outline.split('.')[1]) if '.' in outline else 0
            except:
                return 9999, 0
        work_tasks.sort(key=outline_sort_key)
        print(f"[Organize] First 5 tasks: {[(t.get('outline_number'), t.get('name')[:20]) for t in work_tasks[:5]]}")
        print(f"[Organize] Last 5 tasks: {[(t.get('outline_number'), t.get('name')[:20]) for t in work_tasks[-5:]]}")

        # Find max existing UID to avoid conflicts when creating summary tasks
        max_existing_uid = 0
        for t in work_tasks:
            try:
                uid = int(t.get("uid", 0))
                if uid > max_existing_uid:
                    max_existing_uid = uid
            except (ValueError, TypeError):
                pass
        print(f"[Organize] Max existing UID: {max_existing_uid}")

        if not work_tasks:
            return {
                "success": False,
                "message": "No work tasks to organize",
                "changes": []
            }

        # Detect building markers
        building_pattern = re.compile(
            r'^(building|bldg|unit|structure|phase|area|block|tower|wing|section)\s*[#]?\s*(\d+|[a-z])\s*$',
            re.IGNORECASE
        )

        building_indices = []
        for idx, task in enumerate(work_tasks):
            task_name = task.get("name", "").strip()
            if building_pattern.match(task_name):
                building_indices.append((idx, task_name))

        # If we found building markers, use building-based organization
        if len(building_indices) >= 2:
            return self._organize_by_buildings(project, work_tasks, building_indices, changes, max_existing_uid)
        else:
            return self._organize_by_phases(project, work_tasks, changes, max_existing_uid)

    def _organize_by_buildings(self, project: Dict[str, Any], work_tasks: list,
                                building_indices: list, changes: list, max_existing_uid: int = 1000) -> Dict[str, Any]:
        """Organize project that has building/unit markers."""
        import uuid

        new_tasks = []
        phase_number = 0
        num_buildings = len(building_indices)

        # Site-wide keywords (tasks before first building)
        site_wide_keywords = [
            'pre construction', 'preconstruction', 'project award', 'notice', 'permit',
            'mobilization', 'site', 'survey', 'erosion', 'demolition', 'grading',
            'sewer', 'storm', 'water', 'underground', 'road', 'curb', 'asphalt',
            'retaining', 'final grade', 'utility', 'utilities'
        ]

        # Closeout section headers (NOT individual tasks like "Punch" which appear in buildings)
        closeout_section_headers = [
            'closeout', 'close-out', 'project closeout', 'final closeout',
            'substantial completion', 'certificate of occupancy', 'co issued', 'c of o'
        ]

        first_building_idx = building_indices[0][0]
        last_building_idx = building_indices[-1][0]

        # === DETECT: Building markers at end with no tasks between them ===
        # If building markers are consecutive (within 2 indices of each other),
        # it means they're placeholder markers at the end, not section headers
        markers_are_consecutive = all(
            building_indices[i+1][0] - building_indices[i][0] <= 2
            for i in range(len(building_indices) - 1)
        )

        if markers_are_consecutive:
            print(f"[Organize] DETECTED: Building markers are consecutive placeholders at end")
            print(f"[Organize] Will distribute construction tasks across {num_buildings} buildings")
            return self._organize_with_distributed_buildings(
                project, work_tasks, building_indices, changes, max_existing_uid
            )

        # Section headers that indicate post-building work (not closeout)
        post_building_sections = [
            'exterior improvements', 'site improvements', 'site finishing',
            'external works', 'sitework completion', 'site completion',
            'hardscape', 'landscape', 'paving', 'parking'
        ]

        # Find where the last building's tasks end and detect post-building sections
        last_building_end = len(work_tasks)
        post_building_section_idx = None
        post_building_section_name = None

        print(f"[Organize] Looking for post-building sections after index {last_building_idx}")
        print(f"[Organize] Tasks after last building marker:")
        for idx in range(last_building_idx + 1, min(last_building_idx + 15, len(work_tasks))):
            tn = work_tasks[idx].get("name", "")
            on = work_tasks[idx].get("outline_number", "")
            print(f"[Organize]   idx {idx}: outline {on} = '{tn}'")

        for idx in range(last_building_idx + 1, len(work_tasks)):
            task_name = work_tasks[idx].get("name", "").lower().strip()
            # Check for post-building section headers
            if any(section in task_name for section in post_building_sections):
                print(f"[Organize] Found post-building section at idx {idx}: '{task_name}'")
                last_building_end = idx
                post_building_section_idx = idx
                post_building_section_name = work_tasks[idx].get("name", "").strip()
                break
            # Check for closeout section headers
            if any(kw in task_name for kw in closeout_section_headers):
                print(f"[Organize] Found closeout at idx {idx}: '{task_name}'")
                last_building_end = idx
                break

        print(f"[Organize] post_building_section_idx: {post_building_section_idx}, last_building_end: {last_building_end}")

        # === 1. Site-Wide / Preconstruction Tasks ===
        site_tasks = []
        for idx in range(first_building_idx):
            task = work_tasks[idx]
            task_name = task.get("name", "").lower()
            # Skip building marker tasks
            if not any(kw in task_name for kw in ['building', 'bldg', 'unit']):
                site_tasks.append(task)

        if site_tasks:
            phase_number += 1
            summary_task = self._create_summary_task(phase_number, "Site Work & Preconstruction", max_existing_uid)
            new_tasks.append(summary_task)
            changes.append({
                "type": "summary_created",
                "task": str(phase_number),
                "task_name": "Site Work & Preconstruction",
                "child_count": len(site_tasks)
            })

            prev_outline = None
            for child_idx, task in enumerate(site_tasks, 1):
                child_outline = f"{phase_number}.{child_idx}"
                old_outline = task.get("outline_number")

                task["outline_number"] = child_outline
                task["outline_level"] = 2
                task["summary"] = False

                if prev_outline:
                    task["predecessors"] = [{
                        "outline_number": prev_outline,
                        "type": 1,
                        "lag": 0,
                        "lag_format": 7
                    }]
                else:
                    task["predecessors"] = []

                new_tasks.append(task)
                prev_outline = child_outline

                if old_outline != child_outline:
                    changes.append({
                        "type": "task_renumbered",
                        "old_outline": old_outline,
                        "new_outline": child_outline,
                        "task_name": task.get("name")
                    })

        # Track last task of site work for building dependencies
        last_site_task = new_tasks[-1]["outline_number"] if new_tasks and not new_tasks[-1].get("summary") else None
        if new_tasks:
            # Find the last non-summary task in site work
            for t in reversed(new_tasks):
                if not t.get("summary"):
                    last_site_task = t["outline_number"]
                    break

        # Track last tasks of all buildings for closeout dependency
        all_building_last_tasks = []

        # Track first task of previous building for staggered starts
        prev_building_first_task = None

        # Stagger lag between building starts (in days) - creates rolling schedule
        BUILDING_STAGGER_LAG = 15  # Each building starts ~15 days after previous

        # === 2. Building-Specific Tasks (STAGGERED starts for realistic scheduling) ===
        for bldg_idx, (start_idx, building_name) in enumerate(building_indices):
            # Determine where this building's tasks end
            if bldg_idx + 1 < len(building_indices):
                end_idx = building_indices[bldg_idx + 1][0]
            else:
                end_idx = last_building_end

            # Get tasks for this building (excluding the building marker itself)
            building_tasks = work_tasks[start_idx + 1:end_idx]

            if not building_tasks:
                continue

            phase_number += 1
            summary_task = self._create_summary_task(phase_number, building_name, max_existing_uid)
            new_tasks.append(summary_task)
            changes.append({
                "type": "summary_created",
                "task": str(phase_number),
                "task_name": building_name,
                "child_count": len(building_tasks)
            })

            prev_outline = None
            first_task_in_building = True
            current_building_first_task = None

            for child_idx, task in enumerate(building_tasks, 1):
                child_outline = f"{phase_number}.{child_idx}"
                old_outline = task.get("outline_number")

                task["outline_number"] = child_outline
                task["outline_level"] = 2
                task["summary"] = False

                if prev_outline:
                    # Sequential within building
                    task["predecessors"] = [{
                        "outline_number": prev_outline,
                        "type": 1,
                        "lag": 0,
                        "lag_format": 7
                    }]
                elif first_task_in_building:
                    # First task of this building
                    current_building_first_task = child_outline

                    if bldg_idx == 0 and last_site_task:
                        # First building starts after site work
                        task["predecessors"] = [{
                            "outline_number": last_site_task,
                            "type": 1,
                            "lag": 0,
                            "lag_format": 7
                        }]
                        changes.append({
                            "type": "phase_dependency_created",
                            "from_task": last_site_task,
                            "to_task": child_outline
                        })
                    elif prev_building_first_task:
                        # Subsequent buildings start with lag after previous building starts
                        # This creates staggered/rolling schedule
                        task["predecessors"] = [{
                            "outline_number": prev_building_first_task,
                            "type": 1,  # Finish-to-Start
                            "lag": BUILDING_STAGGER_LAG,  # Days lag
                            "lag_format": 7
                        }]
                        changes.append({
                            "type": "phase_dependency_created",
                            "from_task": prev_building_first_task,
                            "to_task": child_outline,
                            "lag": BUILDING_STAGGER_LAG
                        })
                    else:
                        task["predecessors"] = []
                else:
                    task["predecessors"] = []

                new_tasks.append(task)
                prev_outline = child_outline
                first_task_in_building = False

                if old_outline != child_outline:
                    changes.append({
                        "type": "task_renumbered",
                        "old_outline": old_outline,
                        "new_outline": child_outline,
                        "task_name": task.get("name")
                    })

            # Track this building's last task and first task
            if prev_outline:
                all_building_last_tasks.append(prev_outline)
            if current_building_first_task:
                prev_building_first_task = current_building_first_task

        # === 3. Post-Building Site Work (Exterior Improvements, etc.) ===
        if post_building_section_idx is not None:
            # Find where this section ends (at closeout or end of tasks)
            section_end = len(work_tasks)
            for idx in range(post_building_section_idx + 1, len(work_tasks)):
                task_name = work_tasks[idx].get("name", "").lower()
                if any(kw in task_name for kw in closeout_section_headers):
                    section_end = idx
                    break

            # Get tasks for this section (excluding the section header itself)
            post_building_tasks = work_tasks[post_building_section_idx + 1:section_end]

            if post_building_tasks:
                phase_number += 1
                summary_task = self._create_summary_task(phase_number, post_building_section_name or "Exterior Improvements", max_existing_uid)
                new_tasks.append(summary_task)
                changes.append({
                    "type": "summary_created",
                    "task": str(phase_number),
                    "task_name": post_building_section_name or "Exterior Improvements",
                    "child_count": len(post_building_tasks)
                })

                prev_outline = None
                first_task = True

                for child_idx, task in enumerate(post_building_tasks, 1):
                    child_outline = f"{phase_number}.{child_idx}"
                    old_outline = task.get("outline_number")

                    task["outline_number"] = child_outline
                    task["outline_level"] = 2
                    task["summary"] = False

                    if prev_outline:
                        task["predecessors"] = [{
                            "outline_number": prev_outline,
                            "type": 1,
                            "lag": 0,
                            "lag_format": 7
                        }]
                    elif first_task and all_building_last_tasks:
                        # First task depends on ALL buildings' last tasks
                        task["predecessors"] = [{
                            "outline_number": last_task,
                            "type": 1,
                            "lag": 0,
                            "lag_format": 7
                        } for last_task in all_building_last_tasks]
                        for last_task in all_building_last_tasks:
                            changes.append({
                                "type": "phase_dependency_created",
                                "from_task": last_task,
                                "to_task": child_outline
                            })
                    else:
                        task["predecessors"] = []

                    new_tasks.append(task)
                    prev_outline = child_outline
                    first_task = False

                    if old_outline != child_outline:
                        changes.append({
                            "type": "task_renumbered",
                            "old_outline": old_outline,
                            "new_outline": child_outline,
                            "task_name": task.get("name")
                        })

                # Update last tasks for closeout dependency
                all_building_last_tasks = [prev_outline] if prev_outline else all_building_last_tasks

            # Update where closeout starts
            last_building_end = section_end

        # === 4. Closeout Tasks (depends on ALL previous sections) ===
        closeout_tasks = []
        for idx in range(last_building_end, len(work_tasks)):
            task = work_tasks[idx]
            closeout_tasks.append(task)

        if closeout_tasks:
            phase_number += 1
            summary_task = self._create_summary_task(phase_number, "Closeout", max_existing_uid)
            new_tasks.append(summary_task)
            changes.append({
                "type": "summary_created",
                "task": str(phase_number),
                "task_name": "Closeout",
                "child_count": len(closeout_tasks)
            })

            prev_outline = None
            first_task = True

            for child_idx, task in enumerate(closeout_tasks, 1):
                child_outline = f"{phase_number}.{child_idx}"
                old_outline = task.get("outline_number")

                task["outline_number"] = child_outline
                task["outline_level"] = 2
                task["summary"] = False

                if prev_outline:
                    task["predecessors"] = [{
                        "outline_number": prev_outline,
                        "type": 1,
                        "lag": 0,
                        "lag_format": 7
                    }]
                elif first_task and all_building_last_tasks:
                    # First closeout task depends on ALL buildings' last tasks
                    task["predecessors"] = [{
                        "outline_number": last_task,
                        "type": 1,
                        "lag": 0,
                        "lag_format": 7
                    } for last_task in all_building_last_tasks]
                    for last_task in all_building_last_tasks:
                        changes.append({
                            "type": "phase_dependency_created",
                            "from_task": last_task,
                            "to_task": child_outline
                        })
                else:
                    task["predecessors"] = []

                new_tasks.append(task)
                prev_outline = child_outline
                first_task = False

                if old_outline != child_outline:
                    changes.append({
                        "type": "task_renumbered",
                        "old_outline": old_outline,
                        "new_outline": child_outline,
                        "task_name": task.get("name")
                    })

        # === SAFEGUARD: Check for any unassigned tasks and add them ===
        assigned_task_ids = {t.get("id") for t in new_tasks if not t.get("summary")}
        unassigned_tasks = [t for t in work_tasks if t.get("id") not in assigned_task_ids]

        if unassigned_tasks:
            print(f"[Organize] WARNING: Found {len(unassigned_tasks)} unassigned tasks, adding to Miscellaneous section")
            for ut in unassigned_tasks[:5]:
                print(f"[Organize]   - {ut.get('name', 'Unknown')}")

            phase_number += 1
            summary_task = self._create_summary_task(phase_number, "Miscellaneous", max_existing_uid)
            new_tasks.append(summary_task)
            changes.append({
                "type": "summary_created",
                "task": str(phase_number),
                "task_name": "Miscellaneous",
                "child_count": len(unassigned_tasks)
            })

            prev_outline = None
            for child_idx, task in enumerate(unassigned_tasks, 1):
                child_outline = f"{phase_number}.{child_idx}"
                old_outline = task.get("outline_number")

                task["outline_number"] = child_outline
                task["outline_level"] = 2
                task["summary"] = False

                if prev_outline:
                    task["predecessors"] = [{
                        "outline_number": prev_outline,
                        "type": 1,
                        "lag": 0,
                        "lag_format": 7
                    }]
                else:
                    task["predecessors"] = []

                new_tasks.append(task)
                prev_outline = child_outline

                if old_outline != child_outline:
                    changes.append({
                        "type": "task_renumbered",
                        "old_outline": old_outline,
                        "new_outline": child_outline,
                        "task_name": task.get("name")
                    })

        # Update project
        project["tasks"] = new_tasks

        # Recalculate dates
        _recalculate_dates_standalone(project)
        changes.append({
            "type": "dates_recalculated",
            "message": "All task dates recalculated"
        })

        summary_count = len([t for t in new_tasks if t.get("summary")])
        building_count = len(building_indices)
        task_count = len([t for t in new_tasks if not t.get("summary")])

        # Verify all tasks were organized
        original_task_count = len(work_tasks)
        if task_count != original_task_count:
            print(f"[Organize] WARNING: Task count mismatch! Original: {original_task_count}, Organized: {task_count}")

        return {
            "success": True,
            "message": f"Organized project with {building_count} buildings: Created {summary_count} sections with {task_count} tasks.",
            "changes": changes
        }

    def _organize_with_distributed_buildings(self, project: Dict[str, Any], work_tasks: list,
                                              building_indices: list, changes: list,
                                              max_existing_uid: int = 1000) -> Dict[str, Any]:
        """
        Organize project where building markers are placeholders at the end.
        Distributes construction tasks evenly across buildings based on repeating patterns.
        """
        import uuid

        num_buildings = len(building_indices)
        new_tasks = []
        phase_number = 0

        # Site-wide keywords
        site_wide_keywords = [
            'pre construction', 'preconstruction', 'project award', 'notice', 'permit',
            'mobilization', 'site', 'survey', 'erosion', 'demolition', 'grading',
            'sewer', 'storm', 'water', 'underground', 'road', 'curb', 'asphalt',
            'retaining', 'final grade', 'utility', 'utilities', 'building permit'
        ]

        # Closeout/exterior keywords (shared across all buildings)
        closeout_keywords = [
            'exterior improvement', 'landscape', 'irrigation', 'paver', 'top coat',
            'fine grading', 'flatwork', 'closeout', 'substantial completion'
        ]

        # Separate tasks into categories
        site_tasks = []
        building_work_tasks = []
        closeout_tasks = []

        # Get indices of building markers to exclude them
        building_marker_indices = set(idx for idx, _ in building_indices)

        for idx, task in enumerate(work_tasks):
            # Skip building marker tasks themselves
            if idx in building_marker_indices:
                continue

            task_name = task.get("name", "").lower()

            # Check if it's site work
            if any(kw in task_name for kw in site_wide_keywords):
                site_tasks.append(task)
            # Check if it's closeout/exterior work
            elif any(kw in task_name for kw in closeout_keywords):
                closeout_tasks.append(task)
            else:
                # It's building-specific work
                building_work_tasks.append(task)

        print(f"[Organize-Dist] Site tasks: {len(site_tasks)}, Building tasks: {len(building_work_tasks)}, Closeout: {len(closeout_tasks)}")

        # === 1. Site Work & Preconstruction ===
        if site_tasks:
            phase_number += 1
            summary_task = self._create_summary_task(phase_number, "Site Work & Preconstruction", max_existing_uid)
            new_tasks.append(summary_task)
            changes.append({
                "type": "summary_created",
                "task": str(phase_number),
                "task_name": "Site Work & Preconstruction",
                "child_count": len(site_tasks)
            })

            prev_outline = None
            for child_idx, task in enumerate(site_tasks, 1):
                child_outline = f"{phase_number}.{child_idx}"
                old_outline = task.get("outline_number")

                task["outline_number"] = child_outline
                task["outline_level"] = 2
                task["summary"] = False

                if prev_outline:
                    task["predecessors"] = [{"outline_number": prev_outline, "type": 1, "lag": 0, "lag_format": 7}]
                else:
                    task["predecessors"] = []

                new_tasks.append(task)
                prev_outline = child_outline

                if old_outline != child_outline:
                    changes.append({"type": "task_renumbered", "old_outline": old_outline, "new_outline": child_outline, "task_name": task.get("name")})

        last_site_task = new_tasks[-1]["outline_number"] if new_tasks and not new_tasks[-1].get("summary") else None

        # === 2. Distribute Building Tasks ===
        # Calculate tasks per building (divide evenly)
        if building_work_tasks:
            tasks_per_building = len(building_work_tasks) // num_buildings
            remainder = len(building_work_tasks) % num_buildings

            print(f"[Organize-Dist] Distributing {len(building_work_tasks)} tasks across {num_buildings} buildings ({tasks_per_building} each, {remainder} extra)")

            task_index = 0
            prev_building_first_task = None
            all_building_last_tasks = []
            BUILDING_STAGGER_LAG = 15

            for bldg_idx, (_, building_name) in enumerate(building_indices):
                # Calculate how many tasks this building gets
                num_tasks_for_building = tasks_per_building + (1 if bldg_idx < remainder else 0)

                if num_tasks_for_building == 0:
                    continue

                # Get tasks for this building
                building_tasks = building_work_tasks[task_index:task_index + num_tasks_for_building]
                task_index += num_tasks_for_building

                phase_number += 1
                summary_task = self._create_summary_task(phase_number, building_name, max_existing_uid)
                new_tasks.append(summary_task)
                changes.append({
                    "type": "summary_created",
                    "task": str(phase_number),
                    "task_name": building_name,
                    "child_count": len(building_tasks)
                })

                prev_outline = None
                first_task_in_building = True
                current_building_first_task = None

                for child_idx, task in enumerate(building_tasks, 1):
                    child_outline = f"{phase_number}.{child_idx}"
                    old_outline = task.get("outline_number")

                    task["outline_number"] = child_outline
                    task["outline_level"] = 2
                    task["summary"] = False

                    if prev_outline:
                        task["predecessors"] = [{"outline_number": prev_outline, "type": 1, "lag": 0, "lag_format": 7}]
                    elif first_task_in_building:
                        current_building_first_task = child_outline
                        if bldg_idx == 0 and last_site_task:
                            task["predecessors"] = [{"outline_number": last_site_task, "type": 1, "lag": 0, "lag_format": 7}]
                            changes.append({"type": "phase_dependency_created", "from_task": last_site_task, "to_task": child_outline})
                        elif prev_building_first_task:
                            task["predecessors"] = [{"outline_number": prev_building_first_task, "type": 1, "lag": BUILDING_STAGGER_LAG, "lag_format": 7}]
                            changes.append({"type": "phase_dependency_created", "from_task": prev_building_first_task, "to_task": child_outline, "lag": BUILDING_STAGGER_LAG})
                        else:
                            task["predecessors"] = []

                    new_tasks.append(task)
                    prev_outline = child_outline
                    first_task_in_building = False

                    if old_outline != child_outline:
                        changes.append({"type": "task_renumbered", "old_outline": old_outline, "new_outline": child_outline, "task_name": task.get("name")})

                if prev_outline:
                    all_building_last_tasks.append(prev_outline)
                if current_building_first_task:
                    prev_building_first_task = current_building_first_task

        # === 3. Closeout / Exterior Improvements ===
        if closeout_tasks:
            phase_number += 1
            summary_task = self._create_summary_task(phase_number, "Closeout & Exterior", max_existing_uid)
            new_tasks.append(summary_task)
            changes.append({
                "type": "summary_created",
                "task": str(phase_number),
                "task_name": "Closeout & Exterior",
                "child_count": len(closeout_tasks)
            })

            prev_outline = None
            for child_idx, task in enumerate(closeout_tasks, 1):
                child_outline = f"{phase_number}.{child_idx}"
                old_outline = task.get("outline_number")

                task["outline_number"] = child_outline
                task["outline_level"] = 2
                task["summary"] = False

                if prev_outline:
                    task["predecessors"] = [{"outline_number": prev_outline, "type": 1, "lag": 0, "lag_format": 7}]
                elif all_building_last_tasks:
                    # First closeout task depends on all buildings
                    task["predecessors"] = [{"outline_number": lt, "type": 1, "lag": 0, "lag_format": 7} for lt in all_building_last_tasks]
                else:
                    task["predecessors"] = []

                new_tasks.append(task)
                prev_outline = child_outline

                if old_outline != child_outline:
                    changes.append({"type": "task_renumbered", "old_outline": old_outline, "new_outline": child_outline, "task_name": task.get("name")})

        # Update project
        project["tasks"] = new_tasks

        # Recalculate dates
        _recalculate_dates_standalone(project)
        changes.append({"type": "dates_recalculated", "message": "All task dates recalculated"})

        summary_count = len([t for t in new_tasks if t.get("summary")])
        task_count = len([t for t in new_tasks if not t.get("summary")])

        return {
            "success": True,
            "message": f"Organized project with {num_buildings} buildings: Created {summary_count} sections with {task_count} tasks (distributed evenly).",
            "changes": changes
        }

    def _organize_by_phases(self, project: Dict[str, Any], work_tasks: list,
                            changes: list, max_existing_uid: int = 1000) -> Dict[str, Any]:
        """Organize project by construction phases (no building markers found)."""
        import uuid

        # Construction phase keywords for intelligent grouping
        phase_keywords = {
            'preconstruction': ['preconstruction', 'pre-construction', 'pre construction', 'planning', 'design', 'permit', 'approval', 'contract', 'mobilization', 'notice to proceed', 'ntp', 'award'],
            'sitework': ['site', 'excavat', 'grading', 'clearing', 'demolition', 'earthwork', 'survey', 'erosion', 'sewer', 'storm', 'water', 'underground', 'utilities'],
            'foundation': ['foundation', 'footing', 'footer', 'slab', 'concrete', 'rebar', 'formwork', 'pour', 'dig'],
            'structure': ['structural', 'steel', 'framing', 'frame', 'erect', 'column', 'beam', 'joist', 'truss', 'deck'],
            'exterior': ['exterior', 'roofing', 'roof', 'siding', 'facade', 'window', 'door', 'waterproof', 'envelope', 'cladding', 'masonry', 'brick'],
            'rough_ins': ['rough', 'mep', 'm/e/p', 'mechanical', 'electrical', 'plumbing', 'hvac', 'duct', 'conduit', 'pipe', 'wire'],
            'interior': ['interior', 'drywall', 'insulation', 'partition', 'ceiling', 'floor', 'tile', 'paint', 'finish', 'cabinet', 'millwork', 'trim', 'vanit', 'counter'],
            'fixtures': ['fixture', 'equipment', 'appliance', 'install', 'hook-up', 'connection', 'trim out'],
            'closeout': ['closeout', 'close-out', 'punch', 'final inspection', 'commissioning', 'turnover', 'substantial completion', 'certificate']
        }

        phase_order = ['preconstruction', 'sitework', 'foundation', 'structure', 'exterior', 'rough_ins', 'interior', 'fixtures', 'closeout']

        def detect_phase(task_name: str) -> str:
            name_lower = task_name.lower()
            for phase, keywords in phase_keywords.items():
                if any(kw in name_lower for kw in keywords):
                    return phase
            return 'general'

        # Group tasks by phase
        phase_tasks = {phase: [] for phase in phase_order}
        phase_tasks['general'] = []

        for task in work_tasks:
            phase = detect_phase(task.get("name", ""))
            phase_tasks[phase].append(task)

        # Build new task list
        new_tasks = []
        phase_number = 0
        last_phase_task = None

        for phase in phase_order + ['general']:
            phase_task_list = phase_tasks.get(phase, [])
            if not phase_task_list:
                continue

            phase_number += 1

            phase_display_name = phase.replace('_', ' ').title()
            if phase == 'rough_ins':
                phase_display_name = 'Rough-Ins (MEP)'

            summary_task = self._create_summary_task(phase_number, phase_display_name, max_existing_uid)
            new_tasks.append(summary_task)
            changes.append({
                "type": "summary_created",
                "task": str(phase_number),
                "task_name": phase_display_name,
                "child_count": len(phase_task_list)
            })

            prev_outline = None
            first_task = True

            for child_idx, task in enumerate(phase_task_list, 1):
                child_outline = f"{phase_number}.{child_idx}"
                old_outline = task.get("outline_number")

                task["outline_number"] = child_outline
                task["outline_level"] = 2
                task["summary"] = False

                if prev_outline:
                    task["predecessors"] = [{
                        "outline_number": prev_outline,
                        "type": 1,
                        "lag": 0,
                        "lag_format": 7
                    }]
                elif first_task and last_phase_task:
                    task["predecessors"] = [{
                        "outline_number": last_phase_task,
                        "type": 1,
                        "lag": 0,
                        "lag_format": 7
                    }]
                    changes.append({
                        "type": "phase_dependency_created",
                        "from_task": last_phase_task,
                        "to_task": child_outline
                    })
                else:
                    task["predecessors"] = []

                new_tasks.append(task)
                prev_outline = child_outline
                first_task = False

                if old_outline != child_outline:
                    changes.append({
                        "type": "task_renumbered",
                        "old_outline": old_outline,
                        "new_outline": child_outline,
                        "task_name": task.get("name")
                    })

            last_phase_task = prev_outline

        # Update project
        project["tasks"] = new_tasks

        # Recalculate dates
        _recalculate_dates_standalone(project)
        changes.append({
            "type": "dates_recalculated",
            "message": "All task dates recalculated"
        })

        summary_count = len([t for t in new_tasks if t.get("summary")])
        task_count = len([t for t in new_tasks if not t.get("summary")])

        return {
            "success": True,
            "message": f"Organized project: Created {summary_count} phases with {task_count} tasks.",
            "changes": changes
        }

    def _create_summary_task(self, phase_number: int, name: str, max_existing_uid: int = 1000) -> Dict[str, Any]:
        """Create a summary task for a phase or building.

        Uses UIDs starting from max_existing_uid + phase_number to avoid conflicts.
        """
        import uuid
        # Use high UID to avoid conflicts with existing tasks
        new_uid = max_existing_uid + phase_number
        return {
            "id": str(uuid.uuid4()),
            "uid": str(new_uid),
            "name": name,
            "outline_number": str(phase_number),
            "outline_level": 1,
            "summary": True,
            "milestone": False,
            "duration": "PT0H0M0S",
            "predecessors": [],
            "percent_complete": 0,
            "constraint_type": 0,
        }


# Singleton instance
ai_command_handler = AICommandHandler()

