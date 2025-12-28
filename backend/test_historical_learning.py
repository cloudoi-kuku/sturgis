#!/usr/bin/env python3
"""Test historical project learning feature"""

from database import Database

def test_historical_data_retrieval():
    """Test retrieving historical project data for AI learning"""
    
    db = Database()
    
    print("=" * 80)
    print("HISTORICAL PROJECT DATA RETRIEVAL TEST")
    print("=" * 80)
    print()
    
    # Get historical data
    historical_data = db.get_historical_project_data(limit=5)
    
    print(f"Found {len(historical_data)} historical projects with sufficient data")
    print()
    
    if not historical_data:
        print("⚠️  No historical projects found!")
        print("   This is normal if you haven't imported any projects yet.")
        print("   Import some .xml projects first to build historical data.")
        return
    
    # Analyze patterns
    all_task_names = []
    all_durations = []
    all_phases = []
    dependency_count = 0
    
    for i, project in enumerate(historical_data, 1):
        print(f"\n📁 Project {i}: {project['name']}")
        print(f"   Start Date: {project['start_date']}")
        print(f"   Tasks: {len(project['tasks'])}")
        print(f"   Dependencies: {len(project.get('dependencies', []))}")
        
        # Collect task data
        for task in project['tasks']:
            task_name = task.get('name', '').lower()
            if task_name and not task.get('summary'):
                all_task_names.append(task_name)
                
                # Parse duration
                duration = task.get('duration', 'PT0H0M0S')
                import re
                match = re.search(r'PT(\d+)H', duration)
                if match:
                    hours = int(match.group(1))
                    days = hours / 8
                    all_durations.append((task_name, days))
            
            # Collect phases
            if task.get('summary') and task.get('outline_level') == 1:
                all_phases.append(task.get('name', ''))
        
        dependency_count += len(project.get('dependencies', []))
    
    print("\n" + "=" * 80)
    print("PATTERN ANALYSIS")
    print("=" * 80)
    
    # Most common task names
    from collections import Counter
    task_counter = Counter(all_task_names)
    
    print("\n📊 Most Common Tasks (across all projects):")
    for task_name, count in task_counter.most_common(15):
        # Find average duration for this task
        task_durations = [d for n, d in all_durations if n == task_name]
        if task_durations:
            avg_duration = sum(task_durations) / len(task_durations)
            print(f"   • '{task_name}': appears {count}x, avg {avg_duration:.1f} days")
    
    # Common phases
    phase_counter = Counter(all_phases)
    print("\n📋 Common Phases:")
    for phase_name, count in phase_counter.most_common(10):
        print(f"   • {phase_name}: appears {count}x")
    
    # Dependency patterns
    print(f"\n🔗 Total Dependencies: {dependency_count}")
    
    print("\n" + "=" * 80)
    print("HOW THIS HELPS AI GENERATION")
    print("=" * 80)
    print("""
When you create a new project or populate an empty one, the AI will:

1. ✅ Use similar task names from your past projects
2. ✅ Apply realistic durations based on your company's historical data
3. ✅ Follow your standard phase structure
4. ✅ Maintain consistency with your company's project management style

This ensures new projects match your company's standards and practices!
""")
    
    print("=" * 80)
    print("✅ Test completed!")
    print("=" * 80)

if __name__ == "__main__":
    test_historical_data_retrieval()

