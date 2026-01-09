import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Any
from datetime import datetime
import copy


class MSProjectXMLProcessor:
    """Handles MS Project XML parsing and manipulation"""
    
    NS = {'msproj': 'http://schemas.microsoft.com/project'}
    
    def __init__(self):
        self.xml_root = None
        self.xml_string = None
    
    def parse_xml(self, xml_content: str) -> Dict[str, Any]:
        """Parse MS Project XML and extract project data"""
        self.xml_string = xml_content
        self.xml_root = ET.fromstring(xml_content)

        # Extract project metadata
        name_elem = self.xml_root.find('msproj:Name', self.NS)
        start_date_elem = self.xml_root.find('msproj:StartDate', self.NS)
        status_date_elem = self.xml_root.find('msproj:StatusDate', self.NS)

        project_data = {
            "name": name_elem.text if name_elem is not None else "Untitled Project",
            "start_date": start_date_elem.text if start_date_elem is not None else "",
            "status_date": status_date_elem.text if status_date_elem is not None else "",
            "tasks": []
        }

        # Extract tasks
        tasks_elem = self.xml_root.find('msproj:Tasks', self.NS)
        if tasks_elem is not None:
            for task_elem in tasks_elem.findall('msproj:Task', self.NS):
                task = self._parse_task_element(task_elem)
                if task:
                    project_data["tasks"].append(task)

        # Rebuild hierarchical outline numbers from OutlineLevel
        # MS Project XML may have flat outline numbers (1, 2, 3...) instead of hierarchical (1, 1.1, 1.2...)
        project_data["tasks"] = self._rebuild_hierarchical_outline_numbers(project_data["tasks"])

        # Skip project summary task (outline_level=0 or outline_number="0") and renumber remaining tasks
        # This keeps the WBS clean with unique top-level numbers starting from 1
        project_data["tasks"] = self._skip_project_summary_and_renumber(project_data["tasks"])

        return project_data

    def _rebuild_hierarchical_outline_numbers(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Rebuild hierarchical outline numbers (1, 1.1, 1.2, 2, 2.1...) from OutlineLevel.

        MS Project XML often has flat outline numbers (1, 2, 3, 4...) where hierarchy
        is determined by OutlineLevel (0=project, 1=top level, 2=child, etc.).

        This function converts flat numbering to proper WBS hierarchy.
        """
        if not tasks:
            return tasks

        # Check if outline numbers are already hierarchical
        has_hierarchical = any('.' in str(t.get('outline_number', '')) for t in tasks)
        if has_hierarchical:
            print("[XML Import] Outline numbers already hierarchical, skipping rebuild")
            return tasks

        print("[XML Import] Rebuilding hierarchical outline numbers from OutlineLevel")

        # Build old -> new outline number mapping for predecessor updates
        outline_mapping = {}

        # Track counters at each level: level_counters[level] = current count at that level
        level_counters = {}
        # Track the parent outline at each level
        parent_outlines = {0: ""}  # Level 0 has empty parent

        for task in tasks:
            old_outline = task.get("outline_number", "")
            level = task.get("outline_level", 1)

            # Skip project summary (level 0)
            if level == 0:
                outline_mapping[old_outline] = "0"
                task["outline_number"] = "0"
                parent_outlines[0] = ""
                continue

            # Reset counters for levels deeper than current (we're going back up)
            levels_to_remove = [l for l in level_counters.keys() if l > level]
            for l in levels_to_remove:
                del level_counters[l]
                if l in parent_outlines:
                    del parent_outlines[l]

            # Increment counter at current level
            if level not in level_counters:
                level_counters[level] = 0
            level_counters[level] += 1

            # Build new outline number
            if level == 1:
                new_outline = str(level_counters[level])
            else:
                parent_level = level - 1
                parent_outline = parent_outlines.get(parent_level, "")
                if parent_outline:
                    new_outline = f"{parent_outline}.{level_counters[level]}"
                else:
                    # Fallback if parent not found
                    new_outline = str(level_counters[level])

            # Store this outline as potential parent for next level
            parent_outlines[level] = new_outline

            # Update mapping and task
            outline_mapping[old_outline] = new_outline
            task["outline_number"] = new_outline
            task["outline_level"] = len(new_outline.split('.'))

        # Update predecessor references to use new outline numbers
        for task in tasks:
            if task.get("predecessors"):
                for pred in task["predecessors"]:
                    old_pred_outline = pred.get("outline_number", "")
                    if old_pred_outline in outline_mapping:
                        pred["outline_number"] = outline_mapping[old_pred_outline]

        # Debug output
        sample_outlines = [t["outline_number"] for t in tasks[:10]]
        print(f"[XML Import] Sample rebuilt outlines: {sample_outlines}")

        return tasks

    def _skip_project_summary_and_renumber(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Skip project summary tasks and renumber remaining tasks.
        Handles nested project summaries (e.g., task "0" and task "1" both being project summaries).
        Promotes children to become top-level tasks with unique WBS numbers.
        """
        if not tasks:
            return tasks

        result_tasks = tasks.copy()
        iteration = 0
        max_iterations = 5  # Safety limit

        while iteration < max_iterations:
            iteration += 1
            project_summary_task = None
            project_summary_outline = None

            # First, check for task with outline_level=0, outline_number="0", or UID="0"
            for task in result_tasks:
                outline_level = task.get("outline_level", 1)
                outline_number = task.get("outline_number", "")
                uid = str(task.get("uid", ""))

                if outline_level == 0 or outline_number == "0" or uid == "0":
                    project_summary_task = task
                    project_summary_outline = outline_number
                    break

            # If no level-0 summary found, check if there's a single top-level task with children
            if not project_summary_task:
                # Find the minimum outline level in the remaining tasks
                min_level = min((t.get("outline_level", 1) for t in result_tasks), default=1)
                top_level_tasks = [t for t in result_tasks if t.get("outline_level", 1) == min_level]

                if len(top_level_tasks) == 1:
                    potential_summary = top_level_tasks[0]
                    potential_outline = potential_summary.get("outline_number", "")

                    # Check if it has children (other tasks start with its outline number + ".")
                    has_children = any(
                        t.get("outline_number", "").startswith(potential_outline + ".")
                        for t in result_tasks if t != potential_summary
                    )

                    if has_children:
                        project_summary_task = potential_summary
                        project_summary_outline = potential_outline

            if not project_summary_task:
                # No more project summaries to skip
                break

            print(f"[XML Import] Iteration {iteration}: Skipping project summary task: '{project_summary_task.get('name')}' (outline: {project_summary_outline})")

            # Filter out the project summary task
            result_tasks = [t for t in result_tasks if t != project_summary_task]

            # Renumber tasks - strip the project summary's outline prefix
            prefix = project_summary_outline + "." if project_summary_outline else ""

            # Build mapping from old outline numbers to new ones
            outline_mapping = {}

            for task in result_tasks:
                old_outline = task.get("outline_number", "")

                if prefix and old_outline.startswith(prefix):
                    # Remove the prefix to promote the task
                    new_outline = old_outline[len(prefix):]
                else:
                    new_outline = old_outline

                outline_mapping[old_outline] = new_outline
                task["outline_number"] = new_outline
                task["outline_level"] = len(new_outline.split('.')) if new_outline else 0

            # Update predecessor references to use new outline numbers
            for task in result_tasks:
                if "predecessors" in task and task["predecessors"]:
                    for pred in task["predecessors"]:
                        old_pred_outline = pred.get("outline_number", "")
                        if old_pred_outline in outline_mapping:
                            pred["outline_number"] = outline_mapping[old_pred_outline]

        print(f"[XML Import] Final: {len(result_tasks)} tasks after removing {iteration} project summary level(s)")

        return result_tasks
    
    def _parse_task_element(self, task_elem: ET.Element) -> Optional[Dict[str, Any]]:
        """Parse a single task element"""
        try:
            uid_elem = task_elem.find('msproj:UID', self.NS)
            id_elem = task_elem.find('msproj:ID', self.NS)
            name_elem = task_elem.find('msproj:Name', self.NS)
            outline_elem = task_elem.find('msproj:OutlineNumber', self.NS)
            outline_level_elem = task_elem.find('msproj:OutlineLevel', self.NS)
            duration_elem = task_elem.find('msproj:Duration', self.NS)
            milestone_elem = task_elem.find('msproj:Milestone', self.NS)
            summary_elem = task_elem.find('msproj:Summary', self.NS)
            # Try Start first, then fall back to EarlyStart (MS Project uses different elements)
            start_elem = task_elem.find('msproj:Start', self.NS)
            if start_elem is None:
                start_elem = task_elem.find('msproj:EarlyStart', self.NS)
            finish_elem = task_elem.find('msproj:Finish', self.NS)
            if finish_elem is None:
                finish_elem = task_elem.find('msproj:EarlyFinish', self.NS)

            # Read PhysicalPercentComplete (preferred for construction projects)
            # Fall back to PercentComplete if PhysicalPercentComplete doesn't exist
            physical_percent_elem = task_elem.find('msproj:PhysicalPercentComplete', self.NS)
            percent_complete_elem = task_elem.find('msproj:PercentComplete', self.NS)
            percent_complete = 0
            if physical_percent_elem is not None:
                percent_complete = int(physical_percent_elem.text)
            elif percent_complete_elem is not None:
                percent_complete = int(percent_complete_elem.text)

            # Preserve CreateDate from original XML
            create_date_elem = task_elem.find('msproj:CreateDate', self.NS)
            create_date = create_date_elem.text if create_date_elem is not None else None

            # Read Actual dates for in-progress tasks
            actual_start_elem = task_elem.find('msproj:ActualStart', self.NS)
            actual_finish_elem = task_elem.find('msproj:ActualFinish', self.NS)
            actual_duration_elem = task_elem.find('msproj:ActualDuration', self.NS)

            # Extract custom field value
            value = ""
            ext_attr = task_elem.find('msproj:ExtendedAttribute', self.NS)
            if ext_attr is not None:
                value_elem = ext_attr.find('msproj:Value', self.NS)
                if value_elem is not None:
                    value = value_elem.text or ""

            # Extract predecessors
            predecessors = []
            for pred_link in task_elem.findall('msproj:PredecessorLink', self.NS):
                pred_uid_elem = pred_link.find('msproj:PredecessorUID', self.NS)
                pred_type_elem = pred_link.find('msproj:Type', self.NS)
                pred_lag_elem = pred_link.find('msproj:LinkLag', self.NS)
                pred_lag_format_elem = pred_link.find('msproj:LagFormat', self.NS)

                if pred_uid_elem is not None:
                    # Find the outline number for this UID
                    pred_outline = self._find_outline_by_uid(pred_uid_elem.text)
                    if pred_outline:
                        # Parse lag value from XML
                        # IMPORTANT: MS Project XML ALWAYS stores LinkLag in tenth-minutes
                        # regardless of LagFormat. LagFormat only affects display.
                        # 48000 tenth-minutes = 4800 minutes = 80 hours = 10 days (8hr/day)
                        raw_lag = int(pred_lag_elem.text) if pred_lag_elem is not None else 0
                        lag_format = int(pred_lag_format_elem.text) if pred_lag_format_elem is not None else 7

                        # Convert tenth-minutes to days for internal storage
                        # Formula: tenth-minutes / 10 / 60 / 8 = days (8-hour workday)
                        # Simplified: tenth-minutes / 4800 = days
                        lag_in_days = raw_lag / 4800.0 if raw_lag != 0 else 0

                        # Store internally as days with lag_format=7
                        predecessors.append({
                            "outline_number": pred_outline,
                            "type": int(pred_type_elem.text) if pred_type_elem is not None else 1,
                            "lag": lag_in_days,
                            "lag_format": 7  # Always store as days internally
                        })

            # Extract task constraints (MS Project compatible)
            constraint_type_elem = task_elem.find('msproj:ConstraintType', self.NS)
            constraint_date_elem = task_elem.find('msproj:ConstraintDate', self.NS)
            constraint_type = int(constraint_type_elem.text) if constraint_type_elem is not None else 0
            constraint_date = constraint_date_elem.text if constraint_date_elem is not None else None

            # Extract baselines (MS Project supports up to 11 baselines: 0-10)
            baselines = []
            for baseline_elem in task_elem.findall('msproj:Baseline', self.NS):
                baseline = self._parse_baseline_element(baseline_elem)
                if baseline:
                    baselines.append(baseline)

            return {
                "id": id_elem.text if id_elem is not None else "",
                "uid": uid_elem.text if uid_elem is not None else "",
                "name": name_elem.text if name_elem is not None else "",
                "outline_number": outline_elem.text if outline_elem is not None else "",
                "outline_level": int(outline_level_elem.text) if outline_level_elem is not None else 1,
                "duration": duration_elem.text if duration_elem is not None else "PT8H0M0S",
                "milestone": milestone_elem.text == "1" if milestone_elem is not None else False,
                "summary": summary_elem.text == "1" if summary_elem is not None else False,
                "percent_complete": percent_complete,
                "create_date": create_date,
                "actual_start": actual_start_elem.text if actual_start_elem is not None else None,
                "actual_finish": actual_finish_elem.text if actual_finish_elem is not None else None,
                "actual_duration": actual_duration_elem.text if actual_duration_elem is not None else None,
                "value": value,
                "predecessors": predecessors,
                "start_date": start_elem.text if start_elem is not None else None,
                "finish_date": finish_elem.text if finish_elem is not None else None,
                "constraint_type": constraint_type,
                "constraint_date": constraint_date,
                "baselines": baselines
            }
        except Exception as e:
            print(f"Error parsing task: {e}")
            return None

    def _parse_baseline_element(self, baseline_elem: ET.Element) -> Optional[Dict[str, Any]]:
        """Parse a single Baseline element from MS Project XML"""
        try:
            number_elem = baseline_elem.find('msproj:Number', self.NS)
            start_elem = baseline_elem.find('msproj:Start', self.NS)
            finish_elem = baseline_elem.find('msproj:Finish', self.NS)
            duration_elem = baseline_elem.find('msproj:Duration', self.NS)
            duration_format_elem = baseline_elem.find('msproj:DurationFormat', self.NS)
            work_elem = baseline_elem.find('msproj:Work', self.NS)
            cost_elem = baseline_elem.find('msproj:Cost', self.NS)
            bcws_elem = baseline_elem.find('msproj:BCWS', self.NS)
            bcwp_elem = baseline_elem.find('msproj:BCWP', self.NS)
            fixed_cost_elem = baseline_elem.find('msproj:FixedCost', self.NS)
            estimated_duration_elem = baseline_elem.find('msproj:EstimatedDuration', self.NS)
            interim_elem = baseline_elem.find('msproj:Interim', self.NS)

            # Number is required for a valid baseline
            if number_elem is None:
                return None

            return {
                "number": int(number_elem.text),
                "start": start_elem.text if start_elem is not None else None,
                "finish": finish_elem.text if finish_elem is not None else None,
                "duration": duration_elem.text if duration_elem is not None else None,
                "duration_format": int(duration_format_elem.text) if duration_format_elem is not None else 7,
                "work": work_elem.text if work_elem is not None else None,
                "cost": float(cost_elem.text) if cost_elem is not None else None,
                "bcws": float(bcws_elem.text) if bcws_elem is not None else None,
                "bcwp": float(bcwp_elem.text) if bcwp_elem is not None else None,
                "fixed_cost": float(fixed_cost_elem.text) if fixed_cost_elem is not None else None,
                "estimated_duration": estimated_duration_elem.text == "true" if estimated_duration_elem is not None else None,
                "interim": interim_elem.text == "true" if interim_elem is not None else False
            }
        except Exception as e:
            print(f"Error parsing baseline: {e}")
            return None

    def _find_outline_by_uid(self, uid: str) -> Optional[str]:
        """Find outline number by UID"""
        if self.xml_root is None:
            return None
        
        tasks_elem = self.xml_root.find('msproj:Tasks', self.NS)
        if tasks_elem is not None:
            for task_elem in tasks_elem.findall('msproj:Task', self.NS):
                uid_elem = task_elem.find('msproj:UID', self.NS)
                if uid_elem is not None and uid_elem.text == uid:
                    outline_elem = task_elem.find('msproj:OutlineNumber', self.NS)
                    if outline_elem is not None:
                        return outline_elem.text
        return None
    
    def add_task(self, project_data: Dict[str, Any], task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Add a new task to the project with auto-renumbering if needed.

        If the requested outline_number already exists, this will shift existing tasks
        to make room for the new task at the requested position.
        """
        import uuid

        requested_outline = task_data["outline_number"]
        tasks = project_data["tasks"]

        # Check if outline_number already exists
        existing_task = next((t for t in tasks if t["outline_number"] == requested_outline), None)

        if existing_task:
            # Need to shift existing tasks to make room
            self._shift_tasks_for_insert(tasks, requested_outline)

        # Always use UUIDs for new tasks to avoid database ID collisions
        new_id = str(uuid.uuid4())
        new_uid = str(uuid.uuid4())

        new_task = {
            "id": new_id,
            "uid": new_uid,
            **task_data,
            "outline_level": len(task_data["outline_number"].split('.')),
            "summary": False,
            "start_date": None,
            "finish_date": None
        }

        project_data["tasks"].append(new_task)

        # Recalculate summary tasks after adding new task
        project_data["tasks"] = self._calculate_summary_tasks(project_data["tasks"])

        # Return the updated task (with potentially updated summary status)
        return next((t for t in project_data["tasks"] if t["id"] == new_id), new_task)

    def _shift_tasks_for_insert(self, tasks: List[Dict[str, Any]], insert_outline: str) -> None:
        """Shift tasks at and after the insert position to make room for a new task.

        This shifts the task at insert_outline and all siblings after it (including their children)
        by incrementing their outline numbers.
        """
        parts = insert_outline.split(".")
        insert_num = int(parts[-1])
        parent = ".".join(parts[:-1]) if len(parts) > 1 else ""
        level = len(parts)

        # Find all sibling outline numbers at the same level that need to shift
        siblings_to_shift = set()
        for task in tasks:
            task_parts = task["outline_number"].split(".")
            task_parent = ".".join(task_parts[:-1]) if len(task_parts) > 1 else ""

            # Must be same parent and same level
            if task_parent == parent and len(task_parts) == level:
                task_num = int(task_parts[-1])
                if task_num >= insert_num:
                    siblings_to_shift.add(task["outline_number"])

        # Build old -> new outline mapping
        outline_mapping = {}

        # Shift siblings and all their descendants
        for task in tasks:
            outline = task["outline_number"]

            # Check if this task is a sibling to shift or a descendant of one
            for sibling in siblings_to_shift:
                if outline == sibling or outline.startswith(sibling + "."):
                    # Calculate new outline by incrementing the sibling number
                    sibling_parts = sibling.split(".")
                    old_num = int(sibling_parts[-1])
                    new_num = old_num + 1

                    if parent:
                        new_sibling = f"{parent}.{new_num}"
                    else:
                        new_sibling = str(new_num)

                    # Apply the shift
                    if outline == sibling:
                        old_outline = outline
                        task["outline_number"] = new_sibling
                        outline_mapping[old_outline] = new_sibling
                    else:
                        # Descendant - replace prefix
                        old_outline = outline
                        task["outline_number"] = new_sibling + outline[len(sibling):]
                        outline_mapping[old_outline] = task["outline_number"]

                    # Update outline_level if changed
                    task["outline_level"] = len(task["outline_number"].split("."))
                    break

        # Update predecessor references to point to new outline numbers
        if outline_mapping:
            for task in tasks:
                if "predecessors" in task and task["predecessors"]:
                    for pred in task["predecessors"]:
                        old_pred_outline = pred.get("outline_number", "")
                        if old_pred_outline in outline_mapping:
                            pred["outline_number"] = outline_mapping[old_pred_outline]

    def update_task(self, project_data: Dict[str, Any], task_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing task"""
        updated_task = None
        for task in project_data["tasks"]:
            if task["id"] == task_id or task["outline_number"] == task_id:
                task.update(updates)
                if "outline_number" in updates:
                    task["outline_level"] = len(updates["outline_number"].split('.'))
                updated_task = task
                break

        if updated_task:
            # Recalculate summary tasks after update
            project_data["tasks"] = self._calculate_summary_tasks(project_data["tasks"])
            # Return the updated task with potentially updated summary status
            return next((t for t in project_data["tasks"] if t["id"] == updated_task["id"]), updated_task)

        return None

    def delete_task(self, project_data: Dict[str, Any], task_id: str) -> bool:
        """
        Delete a task from the project.
        If the task is a summary task, also delete all child tasks.
        Remove any predecessor references to the deleted task(s) from remaining tasks.
        """
        # Find the task to delete
        task_to_delete = None
        for task in project_data["tasks"]:
            if task["id"] == task_id or task["outline_number"] == task_id:
                task_to_delete = task
                break

        if not task_to_delete:
            return False

        # Collect all tasks to delete (task + children if summary)
        tasks_to_delete = [task_to_delete]
        deleted_outline_numbers = {task_to_delete["outline_number"]}

        # If this is a summary task, find and mark all children for deletion
        outline_prefix = task_to_delete["outline_number"] + "."
        for task in project_data["tasks"]:
            if task["outline_number"].startswith(outline_prefix):
                tasks_to_delete.append(task)
                deleted_outline_numbers.add(task["outline_number"])

        # Remove all marked tasks
        for task in tasks_to_delete:
            project_data["tasks"].remove(task)

        # Remove predecessor references to deleted tasks from remaining tasks
        for task in project_data["tasks"]:
            if "predecessors" in task and task["predecessors"]:
                # Filter out predecessors that reference deleted tasks
                task["predecessors"] = [
                    pred for pred in task["predecessors"]
                    if pred["outline_number"] not in deleted_outline_numbers
                ]

        # Recalculate summary tasks after deletion
        project_data["tasks"] = self._calculate_summary_tasks(project_data["tasks"])

        return True

    def _calculate_summary_tasks(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Automatically detect summary tasks and calculate their properties based on children.
        A task is a summary task if other tasks have outline numbers that start with its outline number.
        Summary task dates are calculated as: start = min(children starts), finish = max(children finishes)
        IMPORTANT: This function preserves the original task order - do NOT sort!
        MS Project uses OutlineNumber to determine hierarchy, not task order in the file.
        """

        # Build a lookup by outline number for faster access
        task_by_outline = {task["outline_number"]: task for task in tasks}
        all_outlines = set(task_by_outline.keys())

        # First pass: Identify which tasks are summary tasks
        for task in tasks:
            outline = task["outline_number"]
            has_children = False

            # Check if any other task is a child of this task
            for other_outline in all_outlines:
                # A task is a child if its outline starts with parent's outline + "."
                if other_outline.startswith(outline + ".") and other_outline != outline:
                    has_children = True
                    break

            # Mark as summary task if it has children
            task["summary"] = has_children

            # Summary tasks cannot be milestones
            if has_children:
                task["milestone"] = False

        # Second pass: Calculate summary task dates from children (bottom-up)
        # Sort by outline level descending so we process deepest summary tasks first
        sorted_outlines = sorted(all_outlines, key=lambda x: (-len(x.split('.')), x))

        for outline in sorted_outlines:
            task = task_by_outline[outline]
            if not task.get("summary"):
                continue

            # Find all direct and indirect children
            child_starts = []
            child_finishes = []

            for child_outline in all_outlines:
                if child_outline.startswith(outline + ".") and child_outline != outline:
                    child = task_by_outline[child_outline]
                    if child.get("start_date"):
                        child_starts.append(child["start_date"])
                    if child.get("finish_date"):
                        child_finishes.append(child["finish_date"])

            # Set summary task dates from children (min start, max finish)
            if child_starts:
                task["start_date"] = min(child_starts)
            if child_finishes:
                task["finish_date"] = max(child_finishes)

        # Return tasks in original order - do NOT sort!
        return tasks

    def generate_xml(self, project_data: Dict[str, Any]) -> str:
        """Generate MS Project XML from project data"""
        if self.xml_root is None:
            raise ValueError("No XML template loaded. Upload a project first.")

        # Calculate summary tasks before generating XML
        project_data["tasks"] = self._calculate_summary_tasks(project_data["tasks"])

        # Create a copy of the root to modify
        root = copy.deepcopy(self.xml_root)

        # Update project metadata
        name_elem = root.find('msproj:Name', self.NS)
        if name_elem is not None:
            name_elem.text = project_data["name"]

        start_date_elem = root.find('msproj:StartDate', self.NS)
        if start_date_elem is not None:
            start_date_elem.text = project_data["start_date"]

        status_date_elem = root.find('msproj:StatusDate', self.NS)
        if status_date_elem is not None:
            status_date_elem.text = project_data["status_date"]

        ext_edited_elem = root.find('msproj:ProjectExternallyEdited', self.NS)
        if ext_edited_elem is not None:
            ext_edited_elem.text = '0'

        # Rebuild tasks
        tasks_elem = root.find('msproj:Tasks', self.NS)
        if tasks_elem is not None:
            # Clear existing tasks
            tasks_elem.clear()

            # Sort tasks by outline number to match frontend display order
            # This ensures row numbers in the app match MS Project
            def outline_sort_key(task):
                outline = task.get("outline_number", "0")
                try:
                    # Split by dots and convert to integers for proper numeric sorting
                    return [int(p) for p in outline.split('.')]
                except ValueError:
                    return [0]

            sorted_tasks = sorted(project_data["tasks"], key=outline_sort_key)

            # Build UID mapping: map ALL UIDs to sequential numbers
            # MS Project displays predecessors by row number, and expects UID to match ID
            # This ensures predecessor "3" in the app shows as "3" in MS Project
            uid_mapping = {}
            next_uid = 1  # Start from 1 (0 is reserved for project summary)
            for task_data in sorted_tasks:
                original_uid = str(task_data.get("uid", ""))
                # Check if this is the project summary task (UID 0)
                if original_uid == "0" or task_data.get("outline_number") == "0":
                    uid_mapping[original_uid] = "0"
                else:
                    # Map ALL UIDs to sequential numbers to match row positions
                    uid_mapping[original_uid] = str(next_uid)
                    next_uid += 1

            # Add tasks from project data with sequential IDs for MS Project
            for index, task_data in enumerate(sorted_tasks):
                task_elem = self._create_task_element(task_data, sorted_tasks, index, uid_mapping)
                tasks_elem.append(task_elem)

        # Convert to string with proper XML declaration
        # Register the namespace to ensure proper xmlns attribute
        ET.register_namespace('', 'http://schemas.microsoft.com/project')

        xml_bytes = ET.tostring(root, encoding='utf-8', xml_declaration=True)
        xml_string = xml_bytes.decode('utf-8')

        return xml_string

    def _create_task_element(self, task_data: Dict[str, Any], all_tasks: List[Dict[str, Any]], task_index: int = 0, uid_mapping: Dict[str, str] = None) -> ET.Element:
        """Create an XML element for a task"""
        # Helper function to create namespaced elements
        def create_elem(parent, tag, text=None):
            elem = ET.SubElement(parent, f'{{http://schemas.microsoft.com/project}}{tag}')
            if text is not None:
                elem.text = str(text)
            return elem

        task_elem = ET.Element('{http://schemas.microsoft.com/project}Task')

        # Get the mapped UID (numeric) for MS Project compatibility
        original_uid = str(task_data.get("uid", ""))
        mapped_uid = uid_mapping.get(original_uid, original_uid) if uid_mapping else original_uid

        # Check if this is the project summary task (UID=0 or outline_number=0)
        is_project_summary = original_uid == "0" or task_data.get("outline_number") == "0"
        is_summary = task_data.get("summary", False) or is_project_summary

        # Add basic fields
        # UID must be numeric for MS Project
        create_elem(task_elem, 'UID', mapped_uid)
        # ID must match UID for MS Project to display predecessors correctly
        # MS Project shows predecessors by ID, so ID must equal UID
        create_elem(task_elem, 'ID', mapped_uid)
        create_elem(task_elem, 'Name', task_data["name"])

        # Project summary task has minimal fields
        if is_project_summary:
            create_elem(task_elem, 'OutlineNumber', task_data["outline_number"])
            create_elem(task_elem, 'OutlineLevel', task_data["outline_level"])
            create_elem(task_elem, 'Summary', '1')
            return task_elem

        create_elem(task_elem, 'Type', '1')
        create_elem(task_elem, 'IsNull', '0')

        # Preserve original CreateDate if it exists, otherwise use current time for new tasks
        create_date = task_data.get("create_date")
        if create_date:
            create_elem(task_elem, 'CreateDate', create_date)
        else:
            create_elem(task_elem, 'CreateDate', datetime.now().strftime('%Y-%m-%dT%H:%M:%S'))

        create_elem(task_elem, 'OutlineNumber', task_data["outline_number"])
        create_elem(task_elem, 'OutlineLevel', task_data["outline_level"])
        create_elem(task_elem, 'Priority', '500')

        # Start and Finish dates (CRITICAL for MS Project)
        # These are required for MS Project to properly calculate schedule
        start_date = task_data.get("start_date")
        if start_date:
            create_elem(task_elem, 'Start', start_date)

        finish_date = task_data.get("finish_date")
        if finish_date:
            create_elem(task_elem, 'Finish', finish_date)

        # Duration - only for non-summary tasks (MS Project calculates summary task durations)
        if not is_summary:
            duration = task_data.get("duration", "PT8H0M0S")
            if task_data.get("milestone", False) and duration == "PT8H0M0S":
                duration = "PT0H0M0S"
            create_elem(task_elem, 'Duration', duration)
            create_elem(task_elem, 'DurationFormat', '7')

        # Milestone
        create_elem(task_elem, 'Milestone', '1' if task_data.get("milestone", False) else '0')
        create_elem(task_elem, 'Summary', '1' if is_summary else '0')

        # MS Project Compliance: Use ONLY PhysicalPercentComplete for construction projects
        # Do NOT write PercentComplete to avoid conflicts with MS Project
        percent_complete = task_data.get("percent_complete", 0)
        create_elem(task_elem, 'PhysicalPercentComplete', percent_complete)

        create_elem(task_elem, 'EffortDriven', '0')
        create_elem(task_elem, 'CalendarUID', '1')

        # Task Constraints (MS Project compatible)
        constraint_type = task_data.get("constraint_type", 0)
        create_elem(task_elem, 'ConstraintType', constraint_type)
        # ConstraintDate is required for constraint types 2-7
        constraint_date = task_data.get("constraint_date")
        if constraint_date and constraint_type >= 2:
            create_elem(task_elem, 'ConstraintDate', constraint_date)

        # Preserve Actual dates if they exist (for in-progress tasks)
        actual_start = task_data.get("actual_start")
        if actual_start:
            create_elem(task_elem, 'ActualStart', actual_start)

        actual_finish = task_data.get("actual_finish")
        if actual_finish:
            create_elem(task_elem, 'ActualFinish', actual_finish)

        actual_duration = task_data.get("actual_duration")
        if actual_duration:
            create_elem(task_elem, 'ActualDuration', actual_duration)

        # Extended attribute (custom field)
        if task_data.get("value"):
            ext_attr = create_elem(task_elem, 'ExtendedAttribute')
            create_elem(ext_attr, 'UID', '1')
            create_elem(ext_attr, 'FieldID', '188743731')
            create_elem(ext_attr, 'Value', task_data["value"])

        # Predecessors - use mapped UIDs for MS Project compatibility
        outline_to_uid = {t["outline_number"]: str(t["uid"]) for t in all_tasks}
        for pred in task_data.get("predecessors", []):
            pred_outline = pred["outline_number"]
            if pred_outline in outline_to_uid:
                original_pred_uid = outline_to_uid[pred_outline]
                # Map the predecessor UID to numeric if needed
                mapped_pred_uid = uid_mapping.get(original_pred_uid, original_pred_uid) if uid_mapping else original_pred_uid
                link = create_elem(task_elem, 'PredecessorLink')
                create_elem(link, 'PredecessorUID', mapped_pred_uid)
                create_elem(link, 'Type', pred.get("type", 1))
                create_elem(link, 'CrossProject', '0')
                # Convert lag from days back to tenth-minutes for MS Project XML
                # Formula: days * 8 * 60 * 10 = tenth-minutes
                # Simplified: days * 4800 = tenth-minutes
                lag_in_days = pred.get("lag", 0)
                lag_tenth_minutes = int(lag_in_days * 4800) if lag_in_days else 0
                create_elem(link, 'LinkLag', lag_tenth_minutes)
                create_elem(link, 'LagFormat', 7)  # Always export as days format

        # Baselines (MS Project supports up to 11 baselines: 0-10)
        for baseline in task_data.get("baselines", []):
            baseline_elem = create_elem(task_elem, 'Baseline')
            create_elem(baseline_elem, 'Number', baseline.get("number", 0))

            if baseline.get("interim") is not None:
                create_elem(baseline_elem, 'Interim', 'true' if baseline.get("interim") else 'false')

            if baseline.get("start"):
                create_elem(baseline_elem, 'Start', baseline["start"])

            if baseline.get("finish"):
                create_elem(baseline_elem, 'Finish', baseline["finish"])

            if baseline.get("duration"):
                create_elem(baseline_elem, 'Duration', baseline["duration"])
                create_elem(baseline_elem, 'DurationFormat', baseline.get("duration_format", 7))

            if baseline.get("estimated_duration") is not None:
                create_elem(baseline_elem, 'EstimatedDuration', 'true' if baseline.get("estimated_duration") else 'false')

            if baseline.get("work"):
                create_elem(baseline_elem, 'Work', baseline["work"])

            if baseline.get("cost") is not None:
                create_elem(baseline_elem, 'Cost', baseline["cost"])

            if baseline.get("bcws") is not None:
                create_elem(baseline_elem, 'BCWS', baseline["bcws"])

            if baseline.get("bcwp") is not None:
                create_elem(baseline_elem, 'BCWP', baseline["bcwp"])

            if baseline.get("fixed_cost") is not None:
                create_elem(baseline_elem, 'FixedCost', baseline["fixed_cost"])

        return task_elem

