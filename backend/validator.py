from typing import Dict, List, Any
import re
from datetime import datetime


class ProjectValidator:
    """Validates MS Project configurations"""
    
    def validate_project(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate the entire project"""
        errors = []
        warnings = []
        
        # Validate metadata
        if not project_data.get("name"):
            errors.append({"field": "name", "message": "Project name is required"})
        
        if not project_data.get("start_date"):
            errors.append({"field": "start_date", "message": "Start date is required"})
        else:
            if not self._validate_date_format(project_data["start_date"]):
                errors.append({"field": "start_date", "message": "Invalid date format"})
        
        if not project_data.get("status_date"):
            errors.append({"field": "status_date", "message": "Status date is required"})
        else:
            if not self._validate_date_format(project_data["status_date"]):
                errors.append({"field": "status_date", "message": "Invalid date format"})
        
        # Validate tasks
        tasks = project_data.get("tasks", [])
        outline_numbers = set()
        
        for task in tasks:
            task_errors = self._validate_task_structure(task, tasks)
            for error in task_errors:
                error["task_id"] = task.get("id", task.get("outline_number", "unknown"))
            errors.extend(task_errors)
            
            # Check for duplicate outline numbers
            outline = task.get("outline_number")
            if outline in outline_numbers:
                errors.append({
                    "field": "outline_number",
                    "message": f"Duplicate outline number: {outline}",
                    "task_id": task.get("id")
                })
            outline_numbers.add(outline)
        
        # Validate predecessor relationships
        predecessor_errors = self._validate_predecessors(tasks)
        errors.extend(predecessor_errors)
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    def validate_task(self, task_data: Dict[str, Any], existing_tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate a single task"""
        errors = self._validate_task_structure(task_data, existing_tasks)
        
        return {
            "valid": len(errors) == 0,
            "errors": errors
        }
    
    def _validate_task_structure(self, task: Dict[str, Any], all_tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate task structure and fields"""
        errors = []

        # Validate name
        if not task.get("name"):
            errors.append({"field": "name", "message": "Task name is required"})

        # Validate outline number
        outline = task.get("outline_number")
        if not outline:
            errors.append({"field": "outline_number", "message": "Outline number is required"})
        elif not self._validate_outline_format(outline):
            errors.append({
                "field": "outline_number",
                "message": f"Invalid outline number format: {outline}. Expected format: 1.2.3"
            })

        # Check if this is a summary task (has children)
        is_summary = self._is_summary_task(task, all_tasks)

        # Validate duration format
        duration = task.get("duration")
        if duration and not self._validate_duration_format(duration):
            errors.append({
                "field": "duration",
                "message": f"Invalid duration format: {duration}. Expected ISO 8601 format (e.g., PT8H0M0S)"
            })

        # Validate milestone
        if task.get("milestone"):
            if is_summary:
                errors.append({
                    "field": "milestone",
                    "message": "Summary tasks cannot be milestones"
                })
            elif duration and duration != "PT0H0M0S":
                errors.append({
                    "field": "milestone",
                    "message": "Milestone tasks should have zero duration"
                })

        # Summary tasks should not have predecessors
        if is_summary and task.get("predecessors") and len(task["predecessors"]) > 0:
            errors.append({
                "field": "predecessors",
                "message": "Summary tasks should not have predecessors. Add dependencies to child tasks instead."
            })
        
        # Validate predecessors
        for pred in task.get("predecessors", []):
            if not pred.get("outline_number"):
                errors.append({
                    "field": "predecessors",
                    "message": "Predecessor outline number is required"
                })
            
            # Check if predecessor exists
            pred_exists = any(t.get("outline_number") == pred["outline_number"] for t in all_tasks)
            if not pred_exists and task.get("outline_number") != pred["outline_number"]:
                errors.append({
                    "field": "predecessors",
                    "message": f"Predecessor task {pred['outline_number']} not found"
                })
            
            # Validate dependency type
            # Per MS Project XML Schema (mspdi_pj12.xsd):
            # 0=FF (Finish-to-Finish), 1=FS (Finish-to-Start), 2=SF (Start-to-Finish), 3=SS (Start-to-Start)
            dep_type = pred.get("type", 1)
            if dep_type not in [0, 1, 2, 3]:
                errors.append({
                    "field": "predecessors",
                    "message": f"Invalid dependency type: {dep_type}. Must be 0 (FF), 1 (FS), 2 (SF), or 3 (SS)"
                })
        
        return errors
    
    def _validate_predecessors(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate predecessor relationships for circular dependencies"""
        errors = []
        
        # Build dependency graph
        graph = {}
        for task in tasks:
            outline = task.get("outline_number")
            graph[outline] = [pred["outline_number"] for pred in task.get("predecessors", [])]
        
        # Check for circular dependencies
        for task in tasks:
            outline = task.get("outline_number")
            if self._has_circular_dependency(outline, graph, set()):
                errors.append({
                    "field": "predecessors",
                    "message": f"Circular dependency detected for task {outline}",
                    "task_id": task.get("id")
                })
        
        return errors
    
    def _has_circular_dependency(self, node: str, graph: Dict[str, List[str]], visited: set) -> bool:
        """Check for circular dependencies using DFS"""
        if node in visited:
            return True

        visited.add(node)
        for neighbor in graph.get(node, []):
            if self._has_circular_dependency(neighbor, graph, visited.copy()):
                return True

        return False

    def _is_summary_task(self, task: Dict[str, Any], all_tasks: List[Dict[str, Any]]) -> bool:
        """Check if a task is a summary task (has children)"""
        outline = task.get("outline_number", "")

        # Check if any other task is a child of this task
        for other_task in all_tasks:
            other_outline = other_task.get("outline_number", "")
            # A task is a child if its outline starts with parent's outline + "."
            if other_outline.startswith(outline + ".") and other_outline != outline:
                return True

        return False

    def _validate_outline_format(self, outline: str) -> bool:
        """Validate outline number format (e.g., 1.2.3)"""
        pattern = r'^\d+(\.\d+)*$'
        return bool(re.match(pattern, outline))
    
    def _validate_duration_format(self, duration: str) -> bool:
        """Validate ISO 8601 duration format"""
        pattern = r'^PT\d+H\d+M\d+S$'
        return bool(re.match(pattern, duration))
    
    def _validate_date_format(self, date_str: str) -> bool:
        """Validate ISO 8601 date format"""
        try:
            datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return True
        except:
            return False

