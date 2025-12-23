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
        
        return project_data
    
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
            start_elem = task_elem.find('msproj:Start', self.NS)
            finish_elem = task_elem.find('msproj:Finish', self.NS)

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
                        predecessors.append({
                            "outline_number": pred_outline,
                            "type": int(pred_type_elem.text) if pred_type_elem is not None else 1,
                            "lag": int(pred_lag_elem.text) if pred_lag_elem is not None else 0,
                            "lag_format": int(pred_lag_format_elem.text) if pred_lag_format_elem is not None else 7
                        })

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
                "finish_date": finish_elem.text if finish_elem is not None else None
            }
        except Exception as e:
            print(f"Error parsing task: {e}")
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
        """Add a new task to the project"""
        # Generate new UID and ID
        max_uid = max([int(t["uid"]) for t in project_data["tasks"]], default=0)
        max_id = max([int(t["id"]) for t in project_data["tasks"]], default=0)

        new_task = {
            "id": str(max_id + 1),
            "uid": str(max_uid + 1),
            **task_data,
            "outline_level": len(task_data["outline_number"].split('.')),
            "summary": False,
            "start_date": None,
            "finish_date": None
        }

        project_data["tasks"].append(new_task)
        return new_task

    def update_task(self, project_data: Dict[str, Any], task_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing task"""
        for task in project_data["tasks"]:
            if task["id"] == task_id or task["outline_number"] == task_id:
                print(f"DEBUG xml_processor: Found task {task_id}, current predecessors: {task.get('predecessors', [])}")
                print(f"DEBUG xml_processor: Applying updates: {updates}")
                task.update(updates)
                if "outline_number" in updates:
                    task["outline_level"] = len(updates["outline_number"].split('.'))
                print(f"DEBUG xml_processor: After update, predecessors: {task.get('predecessors', [])}")
                return task
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

        return True

    def _calculate_summary_tasks(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Automatically detect summary tasks and calculate their properties based on children.
        A task is a summary task if other tasks have outline numbers that start with its outline number.
        """
        # Sort tasks by outline number for proper hierarchy
        sorted_tasks = sorted(tasks, key=lambda t: [int(x) for x in t["outline_number"].split('.')])

        # Identify which tasks are summary tasks
        for i, task in enumerate(sorted_tasks):
            outline = task["outline_number"]
            has_children = False

            # Check if any other task is a child of this task
            for other_task in sorted_tasks:
                other_outline = other_task["outline_number"]
                # A task is a child if its outline starts with parent's outline + "."
                if other_outline.startswith(outline + ".") and other_outline != outline:
                    has_children = True
                    break

            # Mark as summary task if it has children
            task["summary"] = has_children

            # Summary tasks cannot be milestones
            if has_children:
                task["milestone"] = False

        return sorted_tasks

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

            # Add tasks from project data
            for task_data in project_data["tasks"]:
                task_elem = self._create_task_element(task_data, project_data["tasks"])
                tasks_elem.append(task_elem)

        # Convert to string
        xml_string = ET.tostring(root, encoding='unicode', xml_declaration=True)
        return xml_string

    def _create_task_element(self, task_data: Dict[str, Any], all_tasks: List[Dict[str, Any]]) -> ET.Element:
        """Create an XML element for a task"""
        task_elem = ET.Element('{http://schemas.microsoft.com/project}Task')

        # Add basic fields
        ET.SubElement(task_elem, 'UID').text = task_data["uid"]
        ET.SubElement(task_elem, 'ID').text = task_data["id"]
        ET.SubElement(task_elem, 'Name').text = task_data["name"]
        ET.SubElement(task_elem, 'Type').text = '1'
        ET.SubElement(task_elem, 'IsNull').text = '0'

        # Preserve original CreateDate if it exists, otherwise use current time for new tasks
        create_date = task_data.get("create_date")
        if create_date:
            ET.SubElement(task_elem, 'CreateDate').text = create_date
        else:
            ET.SubElement(task_elem, 'CreateDate').text = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')

        ET.SubElement(task_elem, 'OutlineNumber').text = task_data["outline_number"]
        ET.SubElement(task_elem, 'OutlineLevel').text = str(task_data["outline_level"])
        ET.SubElement(task_elem, 'Priority').text = '500'

        # Duration - only for non-summary tasks (MS Project calculates summary task durations)
        is_summary = task_data.get("summary", False)
        if not is_summary:
            duration = task_data.get("duration", "PT8H0M0S")
            if task_data.get("milestone", False) and duration == "PT8H0M0S":
                duration = "PT0H0M0S"
            ET.SubElement(task_elem, 'Duration').text = duration
            ET.SubElement(task_elem, 'DurationFormat').text = '7'

        # Milestone
        ET.SubElement(task_elem, 'Milestone').text = '1' if task_data.get("milestone", False) else '0'
        ET.SubElement(task_elem, 'Summary').text = '1' if is_summary else '0'

        # MS Project Compliance: Use ONLY PhysicalPercentComplete for construction projects
        # Do NOT write PercentComplete to avoid conflicts with MS Project
        percent_complete = task_data.get("percent_complete", 0)
        ET.SubElement(task_elem, 'PhysicalPercentComplete').text = str(percent_complete)

        ET.SubElement(task_elem, 'EffortDriven').text = '0'
        ET.SubElement(task_elem, 'CalendarUID').text = '1'

        # Preserve Actual dates if they exist (for in-progress tasks)
        actual_start = task_data.get("actual_start")
        if actual_start:
            ET.SubElement(task_elem, 'ActualStart').text = actual_start

        actual_finish = task_data.get("actual_finish")
        if actual_finish:
            ET.SubElement(task_elem, 'ActualFinish').text = actual_finish

        actual_duration = task_data.get("actual_duration")
        if actual_duration:
            ET.SubElement(task_elem, 'ActualDuration').text = actual_duration

        # Extended attribute (custom field)
        if task_data.get("value"):
            ext_attr = ET.SubElement(task_elem, 'ExtendedAttribute')
            ET.SubElement(ext_attr, 'UID').text = '1'
            ET.SubElement(ext_attr, 'FieldID').text = '188743731'
            ET.SubElement(ext_attr, 'Value').text = task_data["value"]

        # Predecessors
        outline_to_uid = {t["outline_number"]: t["uid"] for t in all_tasks}
        for pred in task_data.get("predecessors", []):
            pred_outline = pred["outline_number"]
            if pred_outline in outline_to_uid:
                link = ET.SubElement(task_elem, 'PredecessorLink')
                ET.SubElement(link, 'PredecessorUID').text = outline_to_uid[pred_outline]
                ET.SubElement(link, 'Type').text = str(pred.get("type", 1))
                ET.SubElement(link, 'CrossProject').text = '0'
                ET.SubElement(link, 'LinkLag').text = str(pred.get("lag", 0))
                ET.SubElement(link, 'LagFormat').text = str(pred.get("lag_format", 7))

        return task_elem

