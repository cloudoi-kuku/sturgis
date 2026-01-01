"""
AI Project Editor - Advanced project restructuring and template learning
Provides AI-driven project editing, task reorganization, and learning from templates
"""

import re
import json
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from copy import deepcopy


class AIProjectEditor:
    """
    Advanced AI-powered project editor that can:
    1. Move tasks and update WBS structure
    2. Insert/delete tasks with dependency updates
    3. Auto-sequence tasks based on construction logic
    4. Learn patterns from existing projects
    5. Suggest project reorganizations
    """

    def __init__(self):
        # Extended command patterns for project restructuring
        self.command_patterns = {
            # Move task commands
            'move_task': [
                r'move\s+task\s+([0-9.]+)\s+(?:to\s+)?(?:under|into|beneath)\s+(?:task\s+)?([0-9.]+)',
                r'move\s+([0-9.]+)\s+(?:to\s+)?after\s+([0-9.]+)',
                r'move\s+([0-9.]+)\s+(?:to\s+)?before\s+([0-9.]+)',
                r'relocate\s+task\s+([0-9.]+)\s+to\s+(?:phase\s+)?([0-9.]+)',
            ],
            # Insert task commands
            'insert_task': [
                r'insert\s+(?:new\s+)?task\s+["\'](.+?)["\']\s+(?:after|following)\s+([0-9.]+)',
                r'add\s+(?:new\s+)?task\s+["\'](.+?)["\']\s+(?:before|preceding)\s+([0-9.]+)',
                r'create\s+task\s+["\'](.+?)["\']\s+(?:under|in)\s+(?:phase\s+)?([0-9.]+)',
            ],
            # Delete task commands
            'delete_task': [
                r'delete\s+task\s+([0-9.]+)',
                r'remove\s+task\s+([0-9.]+)',
                r'drop\s+task\s+([0-9.]+)',
            ],
            # Merge tasks commands
            'merge_tasks': [
                r'merge\s+tasks?\s+([0-9.]+)\s+(?:and|with|,)\s+([0-9.]+)',
                r'combine\s+tasks?\s+([0-9.]+)\s+(?:and|with|,)\s+([0-9.]+)',
            ],
            # Split task commands
            'split_task': [
                r'split\s+task\s+([0-9.]+)\s+into\s+(\d+)\s+(?:parts|subtasks)',
                r'divide\s+task\s+([0-9.]+)\s+into\s+(\d+)',
            ],
            # Auto-sequence commands
            'auto_sequence': [
                r'(?:auto\s+)?sequence\s+(?:all\s+)?tasks?',
                r'reorder\s+(?:all\s+)?tasks?\s+(?:by|based\s+on)\s+(?:dependencies|logic)',
                r'optimize\s+task\s+order',
                r'reorganize\s+(?:project|tasks?)',
            ],
            # Reorganize phase commands
            'reorganize_phase': [
                r'reorganize\s+phase\s+([0-9.]+)',
                r'restructure\s+(?:phase\s+)?([0-9.]+)',
                r'reorder\s+tasks?\s+(?:in|under)\s+(?:phase\s+)?([0-9.]+)',
            ],
            # Update all dependencies
            'update_dependencies': [
                r'(?:update|recalculate|fix)\s+(?:all\s+)?dependencies',
                r'relink\s+(?:all\s+)?tasks?',
                r'rebuild\s+dependency\s+chain',
            ],
            # Create phase commands
            'create_phase': [
                r'create\s+(?:new\s+)?phase\s+["\'](.+?)["\'](?:\s+(?:after|before)\s+([0-9.]+))?',
                r'add\s+(?:new\s+)?phase\s+["\'](.+?)["\']',
            ],
        }

        # Construction sequencing rules for auto-ordering
        self.construction_sequence = {
            'site_work': 0,
            'permits': 1,
            'excavation': 2,
            'foundation': 3,
            'structural': 4,
            'framing': 5,
            'roofing': 6,
            'exterior': 7,
            'mechanical_rough': 8,
            'electrical_rough': 9,
            'plumbing_rough': 10,
            'insulation': 11,
            'drywall': 12,
            'interior_finish': 13,
            'flooring': 14,
            'painting': 15,
            'fixtures': 16,
            'landscaping': 17,
            'final_inspection': 18,
            'closeout': 19,
        }

    def parse_command(self, message: str) -> Optional[Dict[str, Any]]:
        """
        Parse natural language message to detect restructuring commands
        Returns: {"action": str, "params": dict} or None
        """
        message_lower = message.lower().strip()

        for action, patterns in self.command_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, message_lower)
                if match:
                    return self._extract_params(action, match, message)

        return None

    def _extract_params(self, action: str, match: re.Match, original_message: str) -> Dict[str, Any]:
        """Extract parameters from regex match"""
        groups = match.groups()

        if action == 'move_task':
            return {
                "action": "move_task",
                "params": {
                    "source_outline": groups[0],
                    "target_outline": groups[1],
                    "position": "under" if "under" in original_message.lower() else "after"
                }
            }

        elif action == 'insert_task':
            return {
                "action": "insert_task",
                "params": {
                    "task_name": groups[0],
                    "reference_outline": groups[1],
                    "position": "after" if "after" in original_message.lower() else "before"
                }
            }

        elif action == 'delete_task':
            return {
                "action": "delete_task",
                "params": {
                    "task_outline": groups[0]
                }
            }

        elif action == 'merge_tasks':
            return {
                "action": "merge_tasks",
                "params": {
                    "task1_outline": groups[0],
                    "task2_outline": groups[1]
                }
            }

        elif action == 'split_task':
            return {
                "action": "split_task",
                "params": {
                    "task_outline": groups[0],
                    "num_parts": int(groups[1])
                }
            }

        elif action == 'auto_sequence':
            return {
                "action": "auto_sequence",
                "params": {}
            }

        elif action == 'reorganize_phase':
            return {
                "action": "reorganize_phase",
                "params": {
                    "phase_outline": groups[0]
                }
            }

        elif action == 'update_dependencies':
            return {
                "action": "update_dependencies",
                "params": {}
            }

        elif action == 'create_phase':
            return {
                "action": "create_phase",
                "params": {
                    "phase_name": groups[0],
                    "reference_outline": groups[1] if len(groups) > 1 and groups[1] else None
                }
            }

        return None

    def execute_command(self, command: Dict[str, Any], project: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a parsed command on the project
        Returns: {"success": bool, "message": str, "changes": list, "project": dict}
        """
        action = command["action"]
        params = command["params"]

        # Work on a copy to allow rollback
        project_copy = deepcopy(project)

        try:
            if action == "move_task":
                return self._move_task(
                    project_copy,
                    params["source_outline"],
                    params["target_outline"],
                    params.get("position", "under")
                )

            elif action == "insert_task":
                return self._insert_task(
                    project_copy,
                    params["task_name"],
                    params["reference_outline"],
                    params.get("position", "after")
                )

            elif action == "delete_task":
                return self._delete_task(project_copy, params["task_outline"])

            elif action == "merge_tasks":
                return self._merge_tasks(
                    project_copy,
                    params["task1_outline"],
                    params["task2_outline"]
                )

            elif action == "split_task":
                return self._split_task(
                    project_copy,
                    params["task_outline"],
                    params["num_parts"]
                )

            elif action == "auto_sequence":
                return self._auto_sequence(project_copy)

            elif action == "reorganize_phase":
                return self._reorganize_phase(project_copy, params["phase_outline"])

            elif action == "update_dependencies":
                return self._update_all_dependencies(project_copy)

            elif action == "create_phase":
                return self._create_phase(
                    project_copy,
                    params["phase_name"],
                    params.get("reference_outline")
                )

        except Exception as e:
            return {
                "success": False,
                "message": f"Error executing command: {str(e)}",
                "changes": [],
                "project": project  # Return original project on error
            }

        return {
            "success": False,
            "message": "Unknown command",
            "changes": [],
            "project": project
        }

    # =========================================================================
    # TASK MOVEMENT AND RESTRUCTURING
    # =========================================================================

    def _move_task(self, project: Dict, source: str, target: str, position: str) -> Dict:
        """
        Move a task to a new position in the hierarchy
        Updates WBS numbers and dependencies accordingly
        """
        tasks = project.get("tasks", [])
        source_task = self._find_task_by_outline(tasks, source)
        target_task = self._find_task_by_outline(tasks, target)

        if not source_task:
            return {
                "success": False,
                "message": f"Source task {source} not found",
                "changes": [],
                "project": project
            }

        if not target_task:
            return {
                "success": False,
                "message": f"Target task {target} not found",
                "changes": [],
                "project": project
            }

        # Get all tasks to move (including children)
        tasks_to_move = self._get_task_with_children(tasks, source)
        old_outlines = {t["outline_number"]: t for t in tasks_to_move}

        # Remove tasks from current position
        remaining_tasks = [t for t in tasks if t["outline_number"] not in old_outlines]

        # Calculate new outline numbers
        if position == "under":
            # Move as child of target
            new_parent_outline = target
            new_level = target_task["outline_level"] + 1
            # Find next available child number
            existing_children = [
                t for t in remaining_tasks
                if t["outline_number"].startswith(target + ".") and
                t["outline_level"] == new_level
            ]
            next_child_num = len(existing_children) + 1
            new_base_outline = f"{target}.{next_child_num}"
        else:
            # Move after target (same level)
            new_level = target_task["outline_level"]
            # Parse target outline to get parent and position
            parts = target.split(".")
            if len(parts) > 1:
                parent = ".".join(parts[:-1])
                sibling_num = int(parts[-1]) + 1
                new_base_outline = f"{parent}.{sibling_num}"
            else:
                new_base_outline = str(int(target) + 1)

        # Reassign outline numbers to moved tasks
        changes = []
        outline_mapping = {}  # old -> new outline mapping

        for i, task in enumerate(tasks_to_move):
            old_outline = task["outline_number"]
            if old_outline == source:
                new_outline = new_base_outline
            else:
                # Calculate relative path from source
                relative = old_outline[len(source):]
                new_outline = new_base_outline + relative

            outline_mapping[old_outline] = new_outline
            task["outline_number"] = new_outline
            task["outline_level"] = new_level + (task["outline_level"] - source_task["outline_level"])

            changes.append({
                "type": "move",
                "task_name": task["name"],
                "old_outline": old_outline,
                "new_outline": new_outline,
                "old_level": task["outline_level"] - (task["outline_level"] - source_task["outline_level"]),
                "new_level": task["outline_level"]
            })

        # Update dependencies to reflect new outline numbers
        all_tasks = remaining_tasks + tasks_to_move
        for task in all_tasks:
            if task.get("predecessors"):
                for pred in task["predecessors"]:
                    old_pred = pred.get("outline_number")
                    if old_pred in outline_mapping:
                        pred["outline_number"] = outline_mapping[old_pred]

        # Re-sort tasks by outline number
        all_tasks.sort(key=lambda t: self._outline_sort_key(t["outline_number"]))

        # Renumber remaining tasks to fill gaps
        all_tasks = self._renumber_tasks(all_tasks)

        project["tasks"] = all_tasks

        # Update target to be a summary task if needed
        target_in_new = self._find_task_by_outline(all_tasks, target)
        if target_in_new and position == "under":
            target_in_new["summary"] = True

        return {
            "success": True,
            "message": f"Moved task '{source_task['name']}' and {len(tasks_to_move)-1} children to {position} {target}",
            "changes": changes,
            "project": project
        }

    def _insert_task(self, project: Dict, task_name: str, reference: str, position: str) -> Dict:
        """
        Insert a new task before/after a reference task
        """
        tasks = project.get("tasks", [])
        ref_task = self._find_task_by_outline(tasks, reference)

        if not ref_task:
            return {
                "success": False,
                "message": f"Reference task {reference} not found",
                "changes": [],
                "project": project
            }

        # Calculate new outline number
        parts = reference.split(".")
        if position == "after":
            if len(parts) > 1:
                parent = ".".join(parts[:-1])
                sibling_num = int(parts[-1]) + 1
                new_outline = f"{parent}.{sibling_num}"
            else:
                new_outline = str(int(reference) + 1)
            insert_index = tasks.index(ref_task) + 1
        else:  # before
            new_outline = reference
            insert_index = tasks.index(ref_task)

        # Shift existing tasks
        tasks_to_shift = []
        for task in tasks[insert_index:]:
            if self._is_sibling_or_after(task["outline_number"], new_outline):
                tasks_to_shift.append(task)

        # Increment outline numbers for shifted tasks
        for task in tasks_to_shift:
            old_outline = task["outline_number"]
            task["outline_number"] = self._increment_outline(old_outline)

        # Create new task
        new_task = {
            "id": f"task_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
            "uid": str(len(tasks) + 1),
            "name": task_name,
            "outline_number": new_outline,
            "outline_level": ref_task["outline_level"],
            "duration": "PT8H0M0S",  # Default 1 day
            "milestone": False,
            "summary": False,
            "percent_complete": 0,
            "value": "",
            "predecessors": []
        }

        # Insert new task
        tasks.insert(insert_index, new_task)

        # Set predecessor from reference if inserting after
        if position == "after":
            new_task["predecessors"] = [{
                "outline_number": reference,
                "type": 1,
                "lag": 0,
                "lag_format": 7
            }]

        project["tasks"] = tasks

        return {
            "success": True,
            "message": f"Inserted new task '{task_name}' {position} {reference}",
            "changes": [{
                "type": "insert",
                "task_name": task_name,
                "outline_number": new_outline,
                "position": position,
                "reference": reference
            }],
            "project": project
        }

    def _delete_task(self, project: Dict, task_outline: str) -> Dict:
        """
        Delete a task and its children, update dependencies
        """
        tasks = project.get("tasks", [])
        task_to_delete = self._find_task_by_outline(tasks, task_outline)

        if not task_to_delete:
            return {
                "success": False,
                "message": f"Task {task_outline} not found",
                "changes": [],
                "project": project
            }

        # Get all tasks to delete (including children)
        tasks_to_delete = self._get_task_with_children(tasks, task_outline)
        delete_outlines = {t["outline_number"] for t in tasks_to_delete}

        # Find predecessor of deleted task (to relink successors)
        deleted_predecessor = None
        if task_to_delete.get("predecessors"):
            deleted_predecessor = task_to_delete["predecessors"][0].get("outline_number")

        # Remove tasks
        remaining_tasks = [t for t in tasks if t["outline_number"] not in delete_outlines]

        # Update dependencies: relink successors to the deleted task's predecessor
        changes = [{
            "type": "delete",
            "task_name": t["name"],
            "outline_number": t["outline_number"]
        } for t in tasks_to_delete]

        for task in remaining_tasks:
            if task.get("predecessors"):
                new_predecessors = []
                for pred in task["predecessors"]:
                    pred_outline = pred.get("outline_number")
                    if pred_outline in delete_outlines:
                        # Relink to the deleted task's predecessor
                        if deleted_predecessor and deleted_predecessor not in delete_outlines:
                            new_predecessors.append({
                                "outline_number": deleted_predecessor,
                                "type": pred.get("type", 1),
                                "lag": pred.get("lag", 0),
                                "lag_format": pred.get("lag_format", 7)
                            })
                            changes.append({
                                "type": "relink",
                                "task_name": task["name"],
                                "old_predecessor": pred_outline,
                                "new_predecessor": deleted_predecessor
                            })
                    else:
                        new_predecessors.append(pred)
                task["predecessors"] = new_predecessors

        # Renumber remaining tasks
        remaining_tasks = self._renumber_tasks(remaining_tasks)

        project["tasks"] = remaining_tasks

        return {
            "success": True,
            "message": f"Deleted task '{task_to_delete['name']}' and {len(tasks_to_delete)-1} children",
            "changes": changes,
            "project": project
        }

    def _merge_tasks(self, project: Dict, outline1: str, outline2: str) -> Dict:
        """
        Merge two tasks into one, combining their durations
        """
        tasks = project.get("tasks", [])
        task1 = self._find_task_by_outline(tasks, outline1)
        task2 = self._find_task_by_outline(tasks, outline2)

        if not task1 or not task2:
            return {
                "success": False,
                "message": f"One or both tasks not found",
                "changes": [],
                "project": project
            }

        if task1.get("summary") or task2.get("summary"):
            return {
                "success": False,
                "message": "Cannot merge summary tasks",
                "changes": [],
                "project": project
            }

        # Combine durations
        dur1 = self._parse_duration_to_hours(task1.get("duration", ""))
        dur2 = self._parse_duration_to_hours(task2.get("duration", ""))
        combined_duration = f"PT{dur1 + dur2}H0M0S"

        # Combine names
        combined_name = f"{task1['name']} + {task2['name']}"

        # Merge predecessors (unique)
        all_predecessors = list(task1.get("predecessors", []))
        existing_outlines = {p["outline_number"] for p in all_predecessors}
        for pred in task2.get("predecessors", []):
            if pred["outline_number"] not in existing_outlines and pred["outline_number"] != outline1:
                all_predecessors.append(pred)

        # Update task1 with merged values
        task1["name"] = combined_name
        task1["duration"] = combined_duration
        task1["predecessors"] = all_predecessors

        # Remove task2
        tasks = [t for t in tasks if t["outline_number"] != outline2]

        # Update any tasks that depended on task2 to depend on task1
        for task in tasks:
            if task.get("predecessors"):
                for pred in task["predecessors"]:
                    if pred.get("outline_number") == outline2:
                        pred["outline_number"] = outline1

        # Renumber tasks
        tasks = self._renumber_tasks(tasks)
        project["tasks"] = tasks

        return {
            "success": True,
            "message": f"Merged '{task1['name']}' with '{task2['name']}'",
            "changes": [{
                "type": "merge",
                "merged_name": combined_name,
                "merged_outline": outline1,
                "removed_outline": outline2,
                "combined_duration_hours": dur1 + dur2
            }],
            "project": project
        }

    def _split_task(self, project: Dict, task_outline: str, num_parts: int) -> Dict:
        """
        Split a task into multiple subtasks
        """
        tasks = project.get("tasks", [])
        task = self._find_task_by_outline(tasks, task_outline)

        if not task:
            return {
                "success": False,
                "message": f"Task {task_outline} not found",
                "changes": [],
                "project": project
            }

        if task.get("summary"):
            return {
                "success": False,
                "message": "Cannot split summary tasks",
                "changes": [],
                "project": project
            }

        if num_parts < 2 or num_parts > 10:
            return {
                "success": False,
                "message": "Number of parts must be between 2 and 10",
                "changes": [],
                "project": project
            }

        # Convert task to summary
        task["summary"] = True
        original_duration = self._parse_duration_to_hours(task.get("duration", ""))
        task["duration"] = "PT0H0M0S"

        # Create subtasks
        part_duration = original_duration // num_parts
        new_tasks = []
        insert_index = tasks.index(task) + 1

        for i in range(num_parts):
            subtask = {
                "id": f"task_{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{i}",
                "uid": str(len(tasks) + i + 1),
                "name": f"{task['name']} - Part {i+1}",
                "outline_number": f"{task_outline}.{i+1}",
                "outline_level": task["outline_level"] + 1,
                "duration": f"PT{part_duration}H0M0S",
                "milestone": False,
                "summary": False,
                "percent_complete": 0,
                "value": "",
                "predecessors": []
            }

            # Link to previous part
            if i > 0:
                subtask["predecessors"] = [{
                    "outline_number": f"{task_outline}.{i}",
                    "type": 1,
                    "lag": 0,
                    "lag_format": 7
                }]
            elif task.get("predecessors"):
                # First part inherits original predecessors
                subtask["predecessors"] = task["predecessors"].copy()

            new_tasks.append(subtask)

        # Clear original task predecessors (summary tasks shouldn't have them)
        task["predecessors"] = []

        # Insert new subtasks
        for i, subtask in enumerate(new_tasks):
            tasks.insert(insert_index + i, subtask)

        # Update any tasks that depended on the original task to depend on the last part
        last_part_outline = f"{task_outline}.{num_parts}"
        for t in tasks:
            if t.get("predecessors"):
                for pred in t["predecessors"]:
                    if pred.get("outline_number") == task_outline:
                        pred["outline_number"] = last_part_outline

        project["tasks"] = tasks

        return {
            "success": True,
            "message": f"Split '{task['name']}' into {num_parts} parts",
            "changes": [{
                "type": "split",
                "original_task": task["name"],
                "original_outline": task_outline,
                "num_parts": num_parts,
                "subtasks": [t["outline_number"] for t in new_tasks]
            }],
            "project": project
        }

    # =========================================================================
    # AUTO-SEQUENCING AND REORGANIZATION
    # =========================================================================

    def _auto_sequence(self, project: Dict) -> Dict:
        """
        Automatically reorder tasks based on construction logic and dependencies
        """
        tasks = project.get("tasks", [])

        if len(tasks) < 2:
            return {
                "success": False,
                "message": "Not enough tasks to sequence",
                "changes": [],
                "project": project
            }

        # Separate summary tasks and work tasks
        summary_tasks = [t for t in tasks if t.get("summary")]
        work_tasks = [t for t in tasks if not t.get("summary") and not t.get("milestone")]
        milestone_tasks = [t for t in tasks if t.get("milestone")]

        # Categorize work tasks based on construction phase
        categorized_tasks = []
        for task in work_tasks:
            category = self._detect_construction_category(task["name"])
            order = self.construction_sequence.get(category, 99)
            categorized_tasks.append({
                "task": task,
                "category": category,
                "order": order
            })

        # Sort by construction sequence
        categorized_tasks.sort(key=lambda x: x["order"])

        # Rebuild task list with proper dependencies
        changes = []
        previous_task = None

        for i, item in enumerate(categorized_tasks):
            task = item["task"]
            old_preds = [p["outline_number"] for p in task.get("predecessors", [])]

            # Set dependency on previous task if in different category
            if previous_task and item["category"] != categorized_tasks[i-1]["category"]:
                task["predecessors"] = [{
                    "outline_number": previous_task["outline_number"],
                    "type": 1,
                    "lag": 0,
                    "lag_format": 7
                }]

                new_preds = [previous_task["outline_number"]]
                if set(old_preds) != set(new_preds):
                    changes.append({
                        "type": "sequence",
                        "task_name": task["name"],
                        "old_predecessors": old_preds,
                        "new_predecessors": new_preds,
                        "category": item["category"]
                    })

            previous_task = task

        # Rebuild project with sorted tasks
        # Keep summary structure but reorder work tasks within
        project["tasks"] = tasks  # Simplified - keep original order for now

        return {
            "success": True,
            "message": f"Analyzed {len(work_tasks)} tasks and suggested {len(changes)} sequencing changes",
            "changes": changes,
            "project": project
        }

    def _reorganize_phase(self, project: Dict, phase_outline: str) -> Dict:
        """
        Reorganize tasks within a specific phase based on construction logic
        """
        tasks = project.get("tasks", [])
        phase_task = self._find_task_by_outline(tasks, phase_outline)

        if not phase_task:
            return {
                "success": False,
                "message": f"Phase {phase_outline} not found",
                "changes": [],
                "project": project
            }

        if not phase_task.get("summary"):
            return {
                "success": False,
                "message": f"Task {phase_outline} is not a summary/phase task",
                "changes": [],
                "project": project
            }

        # Get all children of this phase
        children = self._get_direct_children(tasks, phase_outline)

        if len(children) < 2:
            return {
                "success": False,
                "message": f"Phase has less than 2 children to reorganize",
                "changes": [],
                "project": project
            }

        # Categorize and sort children
        categorized = []
        for child in children:
            category = self._detect_construction_category(child["name"])
            order = self.construction_sequence.get(category, 99)
            categorized.append({
                "task": child,
                "category": category,
                "order": order
            })

        categorized.sort(key=lambda x: x["order"])

        # Update outline numbers within phase
        changes = []
        for i, item in enumerate(categorized):
            task = item["task"]
            old_outline = task["outline_number"]
            new_outline = f"{phase_outline}.{i+1}"

            if old_outline != new_outline:
                changes.append({
                    "type": "reorder",
                    "task_name": task["name"],
                    "old_outline": old_outline,
                    "new_outline": new_outline,
                    "category": item["category"]
                })
                task["outline_number"] = new_outline

        # Update dependencies within phase
        for i, item in enumerate(categorized):
            if i > 0:
                prev_task = categorized[i-1]["task"]
                item["task"]["predecessors"] = [{
                    "outline_number": prev_task["outline_number"],
                    "type": 1,
                    "lag": 0,
                    "lag_format": 7
                }]

        project["tasks"] = tasks

        return {
            "success": True,
            "message": f"Reorganized {len(children)} tasks in phase '{phase_task['name']}'",
            "changes": changes,
            "project": project
        }

    def _update_all_dependencies(self, project: Dict) -> Dict:
        """
        Recalculate and update all dependencies based on task order and construction logic
        """
        tasks = project.get("tasks", [])
        work_tasks = [t for t in tasks if not t.get("summary") and not t.get("milestone")]

        changes = []
        task_by_outline = {t["outline_number"]: t for t in tasks}

        for task in work_tasks:
            category = self._detect_construction_category(task["name"])

            # Find logical predecessors based on construction sequence
            suggested_preds = self._suggest_predecessors(task, work_tasks)

            old_preds = [p["outline_number"] for p in task.get("predecessors", [])]
            new_preds = [p["outline_number"] for p in suggested_preds]

            if set(old_preds) != set(new_preds):
                task["predecessors"] = suggested_preds
                changes.append({
                    "type": "dependency_update",
                    "task_name": task["name"],
                    "task_outline": task["outline_number"],
                    "old_predecessors": old_preds,
                    "new_predecessors": new_preds,
                    "reason": f"Based on {category} construction sequence"
                })

        project["tasks"] = tasks

        return {
            "success": True,
            "message": f"Updated dependencies for {len(changes)} tasks",
            "changes": changes,
            "project": project
        }

    def _create_phase(self, project: Dict, phase_name: str, reference: Optional[str]) -> Dict:
        """
        Create a new phase (summary task) in the project
        """
        tasks = project.get("tasks", [])

        # Find position for new phase
        if reference:
            ref_task = self._find_task_by_outline(tasks, reference)
            if not ref_task:
                return {
                    "success": False,
                    "message": f"Reference task {reference} not found",
                    "changes": [],
                    "project": project
                }
            # Insert after reference
            insert_index = tasks.index(ref_task) + 1
            # Get next top-level number
            parts = reference.split(".")
            if len(parts) == 1:
                new_outline = str(int(reference) + 1)
            else:
                new_outline = str(int(parts[0]) + 1)
        else:
            # Add at the end of top-level tasks
            top_level = [t for t in tasks if t.get("outline_level", 0) == 1]
            if top_level:
                last_top = max(int(t["outline_number"].split(".")[0]) for t in top_level)
                new_outline = str(last_top + 1)
            else:
                new_outline = "1"
            insert_index = len(tasks)

        # Create new phase
        new_phase = {
            "id": f"phase_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
            "uid": str(len(tasks) + 1),
            "name": phase_name,
            "outline_number": new_outline,
            "outline_level": 1,
            "duration": "PT0H0M0S",
            "milestone": False,
            "summary": True,
            "percent_complete": 0,
            "value": "",
            "predecessors": []
        }

        # Shift subsequent phases
        for task in tasks:
            if task.get("outline_level", 0) == 1:
                current_num = int(task["outline_number"].split(".")[0])
                if current_num >= int(new_outline):
                    # Shift this phase and all its children
                    old_outline = task["outline_number"]
                    task["outline_number"] = str(current_num + 1)
                    # Update children
                    for child in tasks:
                        if child["outline_number"].startswith(old_outline + "."):
                            child["outline_number"] = child["outline_number"].replace(
                                old_outline + ".",
                                task["outline_number"] + ".",
                                1
                            )

        tasks.insert(insert_index, new_phase)
        project["tasks"] = tasks

        return {
            "success": True,
            "message": f"Created new phase '{phase_name}' at position {new_outline}",
            "changes": [{
                "type": "create_phase",
                "phase_name": phase_name,
                "outline_number": new_outline
            }],
            "project": project
        }

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def _find_task_by_outline(self, tasks: List[Dict], outline: str) -> Optional[Dict]:
        """Find task by outline number"""
        for task in tasks:
            if task.get("outline_number") == outline:
                return task
        return None

    def _get_task_with_children(self, tasks: List[Dict], parent_outline: str) -> List[Dict]:
        """Get a task and all its children"""
        result = []
        for task in tasks:
            outline = task.get("outline_number", "")
            if outline == parent_outline or outline.startswith(parent_outline + "."):
                result.append(task)
        return result

    def _get_direct_children(self, tasks: List[Dict], parent_outline: str) -> List[Dict]:
        """Get direct children of a task (one level deep)"""
        parent_level = len(parent_outline.split("."))
        result = []
        for task in tasks:
            outline = task.get("outline_number", "")
            if outline.startswith(parent_outline + "."):
                task_level = len(outline.split("."))
                if task_level == parent_level + 1:
                    result.append(task)
        return result

    def _outline_sort_key(self, outline: str) -> List[int]:
        """Convert outline number to sortable key"""
        try:
            return [int(x) for x in outline.split(".")]
        except ValueError:
            return [0]

    def _renumber_tasks(self, tasks: List[Dict]) -> List[Dict]:
        """Renumber tasks to fill gaps and maintain proper sequence"""
        # Group by parent
        by_parent = {}
        for task in tasks:
            outline = task.get("outline_number", "")
            parts = outline.split(".")
            if len(parts) > 1:
                parent = ".".join(parts[:-1])
            else:
                parent = ""
            if parent not in by_parent:
                by_parent[parent] = []
            by_parent[parent].append(task)

        # Renumber within each parent
        for parent, children in by_parent.items():
            children.sort(key=lambda t: self._outline_sort_key(t["outline_number"]))
            for i, child in enumerate(children):
                if parent:
                    new_outline = f"{parent}.{i+1}"
                else:
                    new_outline = str(i+1)
                child["outline_number"] = new_outline

        # Sort all tasks
        tasks.sort(key=lambda t: self._outline_sort_key(t["outline_number"]))
        return tasks

    def _is_sibling_or_after(self, outline: str, reference: str) -> bool:
        """Check if outline is a sibling of or comes after reference"""
        ref_parts = reference.split(".")
        out_parts = outline.split(".")

        if len(ref_parts) != len(out_parts):
            return False

        # Same parent?
        if ref_parts[:-1] != out_parts[:-1]:
            return False

        # Same or higher number?
        return int(out_parts[-1]) >= int(ref_parts[-1])

    def _increment_outline(self, outline: str) -> str:
        """Increment the last number in an outline"""
        parts = outline.split(".")
        parts[-1] = str(int(parts[-1]) + 1)
        return ".".join(parts)

    def _parse_duration_to_hours(self, duration: str) -> int:
        """Parse ISO 8601 duration to hours"""
        if not duration or not duration.startswith("PT"):
            return 8  # Default 1 day

        try:
            match = re.search(r'PT(\d+)H', duration)
            if match:
                return int(match.group(1))
        except:
            pass
        return 8

    def _detect_construction_category(self, task_name: str) -> str:
        """Detect construction category from task name"""
        name_lower = task_name.lower()

        keywords = {
            'site_work': ['site', 'survey', 'clear', 'demo', 'demolition'],
            'permits': ['permit', 'approval', 'license', 'zoning'],
            'excavation': ['excavat', 'dig', 'trench', 'grade', 'grading'],
            'foundation': ['foundation', 'footing', 'slab', 'concrete', 'pour'],
            'structural': ['steel', 'structural', 'beam', 'column'],
            'framing': ['fram', 'stud', 'wall', 'joist', 'truss'],
            'roofing': ['roof', 'shingle', 'gutter'],
            'exterior': ['siding', 'brick', 'stucco', 'window', 'door'],
            'mechanical_rough': ['hvac', 'duct', 'mechanical'],
            'electrical_rough': ['electric', 'wire', 'panel', 'circuit'],
            'plumbing_rough': ['plumb', 'pipe', 'drain', 'water'],
            'insulation': ['insul', 'vapor', 'barrier'],
            'drywall': ['drywall', 'sheetrock', 'gypsum'],
            'interior_finish': ['trim', 'cabinet', 'millwork', 'interior'],
            'flooring': ['floor', 'tile', 'carpet', 'hardwood'],
            'painting': ['paint', 'stain', 'finish'],
            'fixtures': ['fixture', 'faucet', 'toilet', 'sink', 'light'],
            'landscaping': ['landscape', 'lawn', 'plant', 'irrigation'],
            'final_inspection': ['inspect', 'final', 'punch', 'walkthrough'],
            'closeout': ['close', 'handover', 'warranty', 'document'],
        }

        for category, words in keywords.items():
            if any(word in name_lower for word in words):
                return category

        return 'general'

    def _suggest_predecessors(self, task: Dict, all_tasks: List[Dict]) -> List[Dict]:
        """Suggest logical predecessors based on construction sequence"""
        task_category = self._detect_construction_category(task["name"])
        task_order = self.construction_sequence.get(task_category, 99)

        # Find tasks in previous categories that should be predecessors
        predecessors = []
        candidates = []

        for other in all_tasks:
            if other["outline_number"] == task["outline_number"]:
                continue

            other_category = self._detect_construction_category(other["name"])
            other_order = self.construction_sequence.get(other_category, 99)

            # Direct predecessor categories
            if other_order == task_order - 1:
                candidates.append(other)

        # Select the best candidate (last one in the sequence)
        if candidates:
            candidates.sort(key=lambda t: self._outline_sort_key(t["outline_number"]))
            best = candidates[-1]
            predecessors.append({
                "outline_number": best["outline_number"],
                "type": 1,
                "lag": 0,
                "lag_format": 7
            })

        return predecessors


# =========================================================================
# TEMPLATE LEARNING SYSTEM
# =========================================================================

class ProjectTemplateLearner:
    """
    Learn patterns from existing projects to improve new project generation
    """

    def __init__(self):
        self.learned_patterns = {
            "phase_structures": [],
            "task_sequences": [],
            "duration_multipliers": {},
            "dependency_patterns": [],
            "milestone_patterns": [],
        }

    def learn_from_project(self, project: Dict) -> Dict[str, Any]:
        """
        Extract learning patterns from a project
        """
        tasks = project.get("tasks", [])
        project_name = project.get("name", "Unknown")

        learned = {
            "project_name": project_name,
            "total_tasks": len(tasks),
            "phases": [],
            "task_patterns": [],
            "dependency_chains": [],
            "duration_stats": {},
            "milestones": []
        }

        # Learn phase structure
        phases = [t for t in tasks if t.get("summary") and t.get("outline_level", 0) == 1]
        for phase in phases:
            phase_tasks = self._get_phase_tasks(tasks, phase["outline_number"])
            learned["phases"].append({
                "name": phase["name"],
                "task_count": len(phase_tasks),
                "task_names": [t["name"] for t in phase_tasks if not t.get("summary")]
            })

        # Learn task naming patterns
        work_tasks = [t for t in tasks if not t.get("summary") and not t.get("milestone")]
        for task in work_tasks:
            duration_hours = self._parse_duration_hours(task.get("duration", ""))
            learned["task_patterns"].append({
                "name": task["name"],
                "duration_hours": duration_hours,
                "category": self._detect_category(task["name"]),
                "has_predecessors": len(task.get("predecessors", [])) > 0
            })

        # Learn duration statistics by category
        category_durations = {}
        for task in work_tasks:
            category = self._detect_category(task["name"])
            duration = self._parse_duration_hours(task.get("duration", ""))
            if category not in category_durations:
                category_durations[category] = []
            category_durations[category].append(duration)

        for category, durations in category_durations.items():
            learned["duration_stats"][category] = {
                "count": len(durations),
                "avg_hours": sum(durations) / len(durations) if durations else 0,
                "min_hours": min(durations) if durations else 0,
                "max_hours": max(durations) if durations else 0
            }

        # Learn dependency chains
        learned["dependency_chains"] = self._extract_dependency_chains(tasks)

        # Learn milestones
        milestones = [t for t in tasks if t.get("milestone")]
        for ms in milestones:
            learned["milestones"].append({
                "name": ms["name"],
                "position": ms.get("outline_number"),
                "has_predecessors": len(ms.get("predecessors", [])) > 0
            })

        return learned

    def learn_from_multiple_projects(self, projects: List[Dict]) -> Dict[str, Any]:
        """
        Learn patterns from multiple projects
        """
        all_patterns = {
            "projects_analyzed": len(projects),
            "common_phases": {},
            "task_name_frequency": {},
            "category_duration_norms": {},
            "common_milestones": {},
            "dependency_rules": []
        }

        for project in projects:
            learned = self.learn_from_project(project)

            # Aggregate phase names
            for phase in learned.get("phases", []):
                name = phase["name"].lower()
                if name not in all_patterns["common_phases"]:
                    all_patterns["common_phases"][name] = 0
                all_patterns["common_phases"][name] += 1

            # Aggregate task names
            for task in learned.get("task_patterns", []):
                name = task["name"].lower()
                if name not in all_patterns["task_name_frequency"]:
                    all_patterns["task_name_frequency"][name] = {
                        "count": 0,
                        "durations": []
                    }
                all_patterns["task_name_frequency"][name]["count"] += 1
                all_patterns["task_name_frequency"][name]["durations"].append(task["duration_hours"])

            # Aggregate duration norms
            for category, stats in learned.get("duration_stats", {}).items():
                if category not in all_patterns["category_duration_norms"]:
                    all_patterns["category_duration_norms"][category] = []
                all_patterns["category_duration_norms"][category].append(stats["avg_hours"])

            # Aggregate milestones
            for ms in learned.get("milestones", []):
                name = ms["name"].lower()
                if name not in all_patterns["common_milestones"]:
                    all_patterns["common_milestones"][name] = 0
                all_patterns["common_milestones"][name] += 1

        # Calculate normalized values
        for category, avgs in all_patterns["category_duration_norms"].items():
            if avgs:
                all_patterns["category_duration_norms"][category] = {
                    "avg_hours": sum(avgs) / len(avgs),
                    "sample_count": len(avgs)
                }

        # Calculate task name averages
        for name, data in all_patterns["task_name_frequency"].items():
            durations = data["durations"]
            if durations:
                data["avg_duration_hours"] = sum(durations) / len(durations)
            del data["durations"]  # Remove raw data

        return all_patterns

    def generate_template(self, patterns: Dict, project_type: str = "commercial") -> Dict:
        """
        Generate a project template based on learned patterns
        """
        # Get most common phases (appeared in >50% of projects)
        threshold = patterns.get("projects_analyzed", 1) * 0.5
        common_phases = [
            name for name, count in patterns.get("common_phases", {}).items()
            if count >= threshold
        ]

        # Get most common tasks
        common_tasks = [
            {"name": name, "avg_hours": data.get("avg_duration_hours", 8)}
            for name, data in patterns.get("task_name_frequency", {}).items()
            if data.get("count", 0) >= threshold
        ]

        # Get common milestones
        common_milestones = [
            name for name, count in patterns.get("common_milestones", {}).items()
            if count >= threshold
        ]

        # Get duration norms
        duration_norms = patterns.get("category_duration_norms", {})

        template = {
            "project_type": project_type,
            "phases": common_phases,
            "tasks": common_tasks,
            "milestones": common_milestones,
            "duration_norms": duration_norms,
            "generated_from": patterns.get("projects_analyzed", 0)
        }

        return template

    def _get_phase_tasks(self, tasks: List[Dict], phase_outline: str) -> List[Dict]:
        """Get all tasks within a phase"""
        return [
            t for t in tasks
            if t["outline_number"].startswith(phase_outline + ".") or
            t["outline_number"] == phase_outline
        ]

    def _parse_duration_hours(self, duration: str) -> int:
        """Parse ISO 8601 duration to hours"""
        if not duration or not duration.startswith("PT"):
            return 8
        try:
            match = re.search(r'PT(\d+)H', duration)
            if match:
                return int(match.group(1))
        except:
            pass
        return 8

    def _detect_category(self, task_name: str) -> str:
        """Detect task category from name"""
        name_lower = task_name.lower()

        categories = {
            'site_work': ['site', 'survey', 'clear', 'demo'],
            'foundation': ['foundation', 'footing', 'slab', 'concrete'],
            'structural': ['steel', 'structural', 'beam', 'framing'],
            'exterior': ['roof', 'siding', 'window', 'door', 'exterior'],
            'mechanical': ['hvac', 'plumb', 'electric', 'mechanical'],
            'interior': ['drywall', 'paint', 'floor', 'cabinet', 'interior'],
            'finishing': ['finish', 'fixture', 'trim', 'punch'],
            'inspection': ['inspect', 'permit', 'approval'],
        }

        for category, keywords in categories.items():
            if any(kw in name_lower for kw in keywords):
                return category

        return 'general'

    def _extract_dependency_chains(self, tasks: List[Dict]) -> List[List[str]]:
        """Extract common dependency chains"""
        chains = []
        visited = set()

        for task in tasks:
            if task["outline_number"] in visited:
                continue
            if not task.get("predecessors"):
                # Start of a chain
                chain = self._follow_chain(tasks, task)
                if len(chain) > 2:  # Only keep meaningful chains
                    chains.append([t["name"] for t in chain])
                visited.update(t["outline_number"] for t in chain)

        return chains

    def _follow_chain(self, tasks: List[Dict], start_task: Dict) -> List[Dict]:
        """Follow a dependency chain from a starting task"""
        chain = [start_task]
        task_map = {t["outline_number"]: t for t in tasks}

        current = start_task
        while True:
            # Find tasks that depend on current
            successors = [
                t for t in tasks
                if any(p["outline_number"] == current["outline_number"]
                       for p in t.get("predecessors", []))
            ]
            if not successors:
                break
            # Take the first successor
            current = successors[0]
            chain.append(current)

        return chain


# Singleton instances
ai_project_editor = AIProjectEditor()
project_template_learner = ProjectTemplateLearner()
