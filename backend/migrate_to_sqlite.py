"""
Migration script to move existing JSON project data to SQLite database
"""
import json
from pathlib import Path
from database import DatabaseService
import xml.etree.ElementTree as ET


def migrate_json_to_sqlite():
    """Migrate all existing JSON projects to SQLite"""
    
    # Initialize database
    db = DatabaseService()
    
    # Find all existing projects
    projects_dir = Path("project_data/projects")
    if not projects_dir.exists():
        print("No existing projects found.")
        return
    
    migrated_count = 0
    failed_count = 0
    
    for project_dir in projects_dir.iterdir():
        if not project_dir.is_dir():
            continue
        
        project_file = project_dir / "project.json"
        xml_file = project_dir / "template.xml"
        
        if not project_file.exists():
            print(f"Skipping {project_dir.name}: No project.json found")
            continue
        
        try:
            # Load project data
            with open(project_file, 'r', encoding='utf-8') as f:
                project_data = json.load(f)
            
            # Load XML template if exists
            xml_content = None
            if xml_file.exists():
                with open(xml_file, 'r', encoding='utf-8') as f:
                    xml_content = f.read()
            
            # Create project in database
            project_id = db.create_project(
                name=project_data.get('name', 'Unnamed Project'),
                start_date=project_data.get('start_date', '2024-01-01'),
                status_date=project_data.get('status_date', '2024-01-01'),
                xml_template=xml_content
            )
            
            # Bulk insert tasks - ensure unique IDs per project
            tasks = project_data.get('tasks', [])
            if tasks:
                # Generate new unique IDs for tasks to avoid conflicts
                import uuid
                for task in tasks:
                    old_id = task.get('id')
                    new_id = str(uuid.uuid4())
                    task['id'] = new_id
                    # Also update uid if it matches the old id
                    if task.get('uid') == old_id:
                        task['uid'] = new_id

                count = db.bulk_create_tasks(project_id, tasks)
                print(f"✓ Migrated project '{project_data.get('name')}' with {count} tasks")
            else:
                print(f"✓ Migrated project '{project_data.get('name')}' (no tasks)")
            
            migrated_count += 1
            
        except Exception as e:
            print(f"✗ Failed to migrate {project_dir.name}: {e}")
            failed_count += 1
    
    print(f"\nMigration complete:")
    print(f"  Successfully migrated: {migrated_count} projects")
    print(f"  Failed: {failed_count} projects")
    
    # Set the first project as active if any were migrated
    if migrated_count > 0:
        projects = db.list_projects()
        if projects:
            db.switch_project(projects[0]['id'])
            print(f"\nSet '{projects[0]['name']}' as active project")


if __name__ == "__main__":
    print("Starting migration from JSON to SQLite...")
    print("=" * 60)
    migrate_json_to_sqlite()
    print("=" * 60)
    print("Migration finished!")

