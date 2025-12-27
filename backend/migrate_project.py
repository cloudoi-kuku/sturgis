#!/usr/bin/env python3
"""
Migration script to convert old single-project format to new multi-project format
"""
import json
import shutil
from pathlib import Path
import uuid

# Paths
PROJECT_DATA_DIR = Path(__file__).parent / "project_data"
OLD_PROJECT_FILE = PROJECT_DATA_DIR / "current_project.json"
OLD_XML_FILE = PROJECT_DATA_DIR / "xml_template.xml"
PROJECTS_DIR = PROJECT_DATA_DIR / "projects"
CURRENT_PROJECT_ID_FILE = PROJECT_DATA_DIR / "current_project_id.txt"

def migrate():
    """Migrate old project format to new multi-project format"""
    
    # Check if old files exist
    if not OLD_PROJECT_FILE.exists():
        print("No old project file found. Nothing to migrate.")
        return
    
    # Check if already migrated
    if CURRENT_PROJECT_ID_FILE.exists():
        print("Migration already completed (current_project_id.txt exists).")
        return
    
    print("Starting migration...")
    
    # Load old project data
    with open(OLD_PROJECT_FILE, 'r', encoding='utf-8') as f:
        project_data = json.load(f)
    
    # Generate a new project ID
    project_id = str(uuid.uuid4())
    
    # Create new project directory
    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy project data to new location
    new_project_file = project_dir / "project.json"
    with open(new_project_file, 'w', encoding='utf-8') as f:
        json.dump(project_data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Migrated project data to {new_project_file}")
    
    # Copy XML template if it exists
    if OLD_XML_FILE.exists():
        new_xml_file = project_dir / "template.xml"
        shutil.copy2(OLD_XML_FILE, new_xml_file)
        print(f"✓ Migrated XML template to {new_xml_file}")
    
    # Save current project ID
    with open(CURRENT_PROJECT_ID_FILE, 'w') as f:
        f.write(project_id)
    
    print(f"✓ Set current project ID to {project_id}")
    
    # Backup old files
    backup_dir = PROJECT_DATA_DIR / "backup_old_format"
    backup_dir.mkdir(exist_ok=True)
    
    shutil.copy2(OLD_PROJECT_FILE, backup_dir / "current_project.json")
    print(f"✓ Backed up old project file to {backup_dir}")
    
    if OLD_XML_FILE.exists():
        shutil.copy2(OLD_XML_FILE, backup_dir / "xml_template.xml")
        print(f"✓ Backed up old XML file to {backup_dir}")
    
    # Remove old files
    OLD_PROJECT_FILE.unlink()
    print(f"✓ Removed old project file")
    
    if OLD_XML_FILE.exists():
        OLD_XML_FILE.unlink()
        print(f"✓ Removed old XML file")
    
    print("\n✅ Migration completed successfully!")
    print(f"Project Name: {project_data.get('name', 'Unknown')}")
    print(f"Project ID: {project_id}")
    print(f"Tasks: {len(project_data.get('tasks', []))}")

if __name__ == "__main__":
    migrate()

