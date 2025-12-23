import xml.etree.ElementTree as ET
import json
import tkinter as tk
from tkinter import filedialog, messagebox
import os

def modify_xml(config):
    NS = {'msproj': 'http://schemas.microsoft.com/project'}
    with open('Mulit Family  - Schedule.xml', 'r') as f:
        xml_content = f.read()
    root = ET.fromstring(xml_content)
    name = root.find('msproj:Name', NS)
    name.text = config['project_name']
    start_date = root.find('msproj:StartDate', NS)
    start_date.text = config['start_date']
    status_date = root.find('msproj:StatusDate', NS)
    status_date.text = config['status_date']
    ext_edited = root.find('msproj:ProjectExternallyEdited', NS)
    ext_edited.text = '0'
    tasks_elem = root.find('msproj:Tasks', NS)
    tasks = tasks_elem.findall('msproj:Task', NS)
    tasks.sort(key=lambda t: int(t.find('msproj:ID', NS).text))
    for remove_outline in config.get('remove_tasks', []):
        to_remove = None
        level_parts = remove_outline.split('.')
        level_len = len(level_parts)
        for i, task in enumerate(tasks):
            outline = task.find('msproj:OutlineNumber', NS).text
            if outline == remove_outline:
                to_remove = task
                for subsequent in tasks[i+1:]:
                    id_elem = subsequent.find('msproj:ID', NS)
                    id_elem.text = str(int(id_elem.text) - 1)
                parent_prefix = '.'.join(level_parts[:-1])
                removed_num = int(level_parts[-1])
                for sibling in tasks:
                    sib_outline = sibling.find('msproj:OutlineNumber', NS)
                    sib_parts = sib_outline.text.split('.')
                    if '.'.join(sib_parts[:-1]) == parent_prefix and int(sib_parts[-1]) > removed_num:
                        sib_parts[-1] = str(int(sib_parts[-1]) - 1)
                        sib_outline.text = '.'.join(sib_parts)
                        child_prefix = sib_outline.text
                        for child in tasks:
                            child_outline = child.find('msproj:OutlineNumber', NS)
                            if child_outline.text.startswith(child_prefix + '.'):
                                child_parts = child_outline.text.split('.')
                                child_parts[:len(sib_parts)] = sib_parts
                                child_outline.text = '.'.join(child_parts)
                break
        if to_remove:
            tasks_elem.remove(to_remove)
        tasks = tasks_elem.findall('msproj:Task', NS)
        tasks.sort(key=lambda t: int(t.find('msproj:ID', NS).text))
    max_uid = max(int(task.find('msproj:UID', NS).text) for task in tasks)
    new_outline_to_elem = {}
    for new_task_config in config.get('new_tasks', []):
        max_uid += 1
        new_uid = max_uid
        target_outline = new_task_config['outline_number']
        insert_index = len(tasks)
        shift_start_id = None
        for i, task in enumerate(tasks):
            outline = task.find('msproj:OutlineNumber', NS).text
            if outline >= target_outline:
                insert_index = i
                shift_start_id = int(task.find('msproj:ID', NS).text)
                break
        for task in tasks[insert_index:]:
            id_elem = task.find('msproj:ID', NS)
            id_val = int(id_elem.text)
            id_elem.text = str(id_val + 1)
            outline_elem = task.find('msproj:OutlineNumber', NS)
            parts = outline_elem.text.split('.')
            target_parts = target_outline.split('.')
            if len(parts) == len(target_parts) and '.'.join(parts[:-1]) == '.'.join(target_parts[:-1]):
                parts[-1] = str(int(parts[-1]) + 1)
                outline_elem.text = '.'.join(parts)
        new_task = ET.Element('{http://schemas.microsoft.com/project}Task')
        ET.SubElement(new_task, 'UID').text = str(new_uid)
        ET.SubElement(new_task, 'ID').text = str(shift_start_id if shift_start_id else (len(tasks) + 1))
        ET.SubElement(new_task, 'Name').text = new_task_config['name']
        ET.SubElement(new_task, 'Type').text = '1'
        ET.SubElement(new_task, 'IsNull').text = '0'
        ET.SubElement(new_task, 'CreateDate').text = '2025-12-20T15:38:23'
        ET.SubElement(new_task, 'OutlineNumber').text = target_outline
        ET.SubElement(new_task, 'OutlineLevel').text = str(len(target_outline.split('.')))
        ET.SubElement(new_task, 'Priority').text = '500'
        duration = new_task_config.get('duration', 'PT8H0M0S')
        ET.SubElement(new_task, 'Duration').text = duration
        ET.SubElement(new_task, 'DurationFormat').text = '7'
        ET.SubElement(new_task, 'EffortDriven').text = '0'
        milestone = '1' if new_task_config.get('milestone', False) else '0'
        ET.SubElement(new_task, 'Milestone').text = milestone
        if milestone == '1' and not new_task_config.get('duration'):
            new_task.find('Duration').text = 'PT0H0M0S'
        ET.SubElement(new_task, 'Summary').text = '0'
        ET.SubElement(new_task, 'CalendarUID').text = '1'
        ET.SubElement(new_task, 'PhysicalPercentComplete').text = '0'
        ext_attr = ET.SubElement(new_task, 'ExtendedAttribute')
        ET.SubElement(ext_attr, 'UID').text = '1'
        ET.SubElement(ext_attr, 'FieldID').text = '188743731'
        ET.SubElement(ext_attr, 'Value').text = new_task_config['value']
        tasks_elem.insert(insert_index, new_task)
        new_outline_to_elem[target_outline] = new_task
    tasks = tasks_elem.findall('msproj:Task', NS)
    outline_to_uid = {task.find('msproj:OutlineNumber', NS).text: task.find('msproj:UID', NS).text for task in tasks}
    for new_task_config in config.get('new_tasks', []):
        if 'predecessors' in new_task_config:
            target_outline = new_task_config['outline_number']
            new_task = [t for t in tasks if t.find('msproj:OutlineNumber', NS).text == target_outline][0]
            for pred in new_task_config['predecessors']:
                pred_outline = pred['outline_number']
                if pred_outline not in outline_to_uid:
                    continue
                pred_uid = outline_to_uid[pred_outline]
                link = ET.SubElement(new_task, 'PredecessorLink')
                ET.SubElement(link, 'PredecessorUID').text = pred_uid
                ET.SubElement(link, 'Type').text = str(pred.get('type', 1))
                ET.SubElement(link, 'CrossProject').text = '0'
                ET.SubElement(link, 'LinkLag').text = str(pred.get('lag', 0))
                ET.SubElement(link, 'LagFormat').text = str(pred.get('lag_format', 7))
    for mod_config in config.get('modify_tasks', []):
        target_outline = mod_config['outline_number']
        for task in tasks:
            if task.find('msproj:OutlineNumber', NS).text == target_outline:
                if 'name' in mod_config:
                    task.find('msproj:Name', NS).text = mod_config['name']
                if 'duration' in mod_config:
                    task.find('msproj:Duration', NS).text = mod_config['duration']
                    task.find('msproj:RemainingDuration', NS).text = mod_config['duration']
                if 'predecessors' in mod_config:
                    for pred in mod_config['predecessors']:
                        pred_outline = pred['outline_number']
                        if pred_outline not in outline_to_uid:
                            continue
                        pred_uid = outline_to_uid[pred_outline]
                        link = ET.SubElement(task, 'PredecessorLink')
                        ET.SubElement(link, 'PredecessorUID').text = pred_uid
                        ET.SubElement(link, 'Type').text = str(pred.get('type', 1))
                        ET.SubElement(link, 'CrossProject').text = '0'
                        ET.SubElement(link, 'LinkLag').text = str(pred.get('lag', 0))
                        ET.SubElement(link, 'LagFormat').text = str(pred.get('lag_format', 7))
                break
    for task in tasks:
        summary = task.find('msproj:Summary', NS)
        if summary.text == '1':
            continue
        to_remove = ['ActualStart', 'ActualFinish', 'EarlyStart', 'EarlyFinish', 'LateStart', 'LateFinish']
        for elem_name in to_remove:
            elem = task.find(f'msproj:{elem_name}', NS)
            if elem is not None:
                task.remove(elem)
        actual_dur = task.find('msproj:ActualDuration', NS)
        if actual_dur is not None:
            actual_dur.text = 'PT0H0M0S'
        else:
            ET.SubElement(task, 'msproj:ActualDuration').text = 'PT0H0M0S'
        dur = task.find('msproj:Duration', NS)
        if dur is not None:
            rem_dur = task.find('msproj:RemainingDuration', NS)
            if rem_dur is not None:
                rem_dur.text = dur.text
            else:
                ET.SubElement(task, 'msproj:RemainingDuration').text = dur.text
        ppc = task.find('msproj:PhysicalPercentComplete', NS)
        if ppc is not None:
            ppc.text = '0'
    return ET.tostring(root, encoding='unicode', xml_declaration=True, short_empty_elements=False)

class ConfigEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("MS Project Config Editor")
        self.root.geometry("600x800")
        tk.Label(root, text="Project Name", font=("Arial", 12)).grid(row=0, column=0, sticky="w", padx=10, pady=5)
        self.project_name = tk.Entry(root, width=50)
        self.project_name.grid(row=0, column=1, padx=10, pady=5)
        tk.Label(root, text="Start Date", font=("Arial", 12)).grid(row=1, column=0, sticky="w", padx=10, pady=5)
        self.start_date = tk.Entry(root, width=50)
        self.start_date.grid(row=1, column=1, padx=10, pady=5)
        tk.Label(root, text="Status Date", font=("Arial", 12)).grid(row=2, column=0, sticky="w", padx=10, pady=5)
        self.status_date = tk.Entry(root, width=50)
        self.status_date.grid(row=2, column=1, padx=10, pady=5)
        tk.Label(root, text="New Tasks", font=("Arial", 12)).grid(row=3, column=0, sticky="w", padx=10, pady=5)
        self.new_tasks_list = tk.Listbox(root, height=5, width=50)
        self.new_tasks_list.grid(row=3, column=1, padx=10, pady=5)
        tk.Button(root, text="Add New Task", command=self.add_new_task).grid(row=4, column=1, sticky="w", padx=10)
        tk.Button(root, text="Edit New Task", command=self.edit_new_task).grid(row=4, column=1)
        tk.Button(root, text="Delete New Task", command=self.delete_new_task).grid(row=4, column=1, sticky="e", padx=10)
        tk.Label(root, text="Modify Tasks", font=("Arial", 12)).grid(row=5, column=0, sticky="w", padx=10, pady=5)
        self.modify_tasks_list = tk.Listbox(root, height=5, width=50)
        self.modify_tasks_list.grid(row=5, column=1, padx=10, pady=5)
        tk.Button(root, text="Add Modify Task", command=self.add_modify_task).grid(row=6, column=1, sticky="w", padx=10)
        tk.Button(root, text="Edit Modify Task", command=self.edit_modify_task).grid(row=6, column=1)
        tk.Button(root, text="Delete Modify Task", command=self.delete_modify_task).grid(row=6, column=1, sticky="e", padx=10)
        tk.Label(root, text="Remove Tasks", font=("Arial", 12)).grid(row=7, column=0, sticky="w", padx=10, pady=5)
        self.remove_tasks_list = tk.Listbox(root, height=3, width=50)
        self.remove_tasks_list.grid(row=7, column=1, padx=10, pady=5)
        tk.Button(root, text="Add Remove Task", command=self.add_remove_task).grid(row=8, column=1, sticky="w", padx=10)
        tk.Button(root, text="Delete Remove Task", command=self.delete_remove_task).grid(row=8, column=1, sticky="e", padx=10)
        tk.Button(root, text="Load Config", command=self.load_config, bg="lightblue").grid(row=9, column=0, padx=10, pady=20)
        tk.Button(root, text="Save Config", command=self.save_config, bg="lightgreen").grid(row=9, column=1, padx=10, pady=20)
        tk.Button(root, text="Generate XML", command=self.generate_xml, bg="orange").grid(row=9, column=2, padx=10, pady=20)
        self.new_tasks = []
        self.modify_tasks = []
        self.remove_tasks = []
        self.update_lists()

    def update_lists(self):
        self.new_tasks_list.delete(0, tk.END)
        for t in self.new_tasks:
            self.new_tasks_list.insert(tk.END, f"{t['name']} ({t['outline_number']})")
        self.modify_tasks_list.delete(0, tk.END)
        for m in self.modify_tasks:
            self.modify_tasks_list.insert(tk.END, m['outline_number'])
        self.remove_tasks_list.delete(0, tk.END)
        for r in self.remove_tasks:
            self.remove_tasks_list.insert(tk.END, r)

    def add_new_task(self):
        self.task_popup("Add New Task", {})

    def edit_new_task(self):
        sel = self.new_tasks_list.curselection()
        if sel:
            self.task_popup("Edit New Task", self.new_tasks[sel[0]], is_new=True, index=sel[0])

    def task_popup(self, title, task, is_new=True, index=None):
        popup = tk.Toplevel(self.root)
        popup.title(title)
        tk.Label(popup, text="Name").grid(row=0, column=0)
        name = tk.Entry(popup)
        name.insert(0, task.get('name', ''))
        name.grid(row=0, column=1)
        tk.Label(popup, text="Outline Number").grid(row=1, column=0)
        outline = tk.Entry(popup)
        outline.insert(0, task.get('outline_number', ''))
        outline.grid(row=1, column=1)
        tk.Label(popup, text="Duration").grid(row=2, column=0)
        duration = tk.Entry(popup)
        duration.insert(0, task.get('duration', ''))
        duration.grid(row=2, column=1)
        tk.Label(popup, text="Value").grid(row=3, column=0)
        value = tk.Entry(popup)
        value.insert(0, task.get('value', ''))
        value.grid(row=3, column=1)
        milestone_var = tk.BooleanVar(value=task.get('milestone', False))
        tk.Checkbutton(popup, text="Milestone", variable=milestone_var).grid(row=4, column=0)
        tk.Label(popup, text="Predecessors").grid(row=5, column=0)
        pred_list = tk.Listbox(popup, height=5)
        pred_list.grid(row=5, column=1)
        predecessors = task.get('predecessors', [])
        for p in predecessors:
            pred_list.insert(tk.END, f"{p['outline_number']} (type:{p.get('type', 1)}, lag:{p.get('lag', 0)}, format:{p.get('lag_format', 7)})")
        tk.Button(popup, text="Add Predecessor", command=lambda: self.pred_popup(popup, pred_list)).grid(row=6, column=1)
        tk.Button(popup, text="Delete Predecessor", command=lambda: pred_list.delete(tk.ANCHOR)).grid(row=7, column=1)
        save = tk.Button(popup, text="Save", command=lambda: self.save_task(popup, name.get(), outline.get(), duration.get(), value.get(), milestone_var.get(), pred_list, is_new, index))
        save.grid(row=8, column=1)

    def pred_popup(self, parent, pred_list):
        popup = tk.Toplevel(parent)
        tk.Label(popup, text="Outline Number").grid(row=0, column=0)
        pred_outline = tk.Entry(popup)
        pred_outline.grid(row=0, column=1)
        tk.Label(popup, text="Type").grid(row=1, column=0)
        pred_type = tk.Entry(popup)
        pred_type.insert(0, '1')
        pred_type.grid(row=1, column=1)
        tk.Label(popup, text="Lag").grid(row=2, column=0)
        pred_lag = tk.Entry(popup)
        pred_lag.insert(0, '0')
        pred_lag.grid(row=2, column=1)
        tk.Label(popup, text="Lag Format").grid(row=3, column=0)
        pred_lag_format = tk.Entry(popup)
        pred_lag_format.insert(0, '7')
        pred_lag_format.grid(row=3, column=1)
        tk.Button(popup, text="Add", command=lambda: self.add_pred(pred_list, pred_outline.get(), pred_type.get(), pred_lag.get(), pred_lag_format.get(), popup)).grid(row=4, column=1)

    def add_pred(self, pred_list, outline, type_, lag, format_, popup):
        if outline:
            pred_str = f"{outline} (type:{type_}, lag:{lag}, format:{format_})"
            pred_list.insert(tk.END, pred_str)
            popup.destroy()

    def save_task(self, popup, name, outline, duration, value, milestone, pred_list, is_new, index):
        predecessors = []
        for i in range(pred_list.size()):
            str_ = pred_list.get(i)
            parts = str_.split(' (type:')
            o = parts[0]
            rest = parts[1].rstrip(')')
            t, rest = rest.split(', lag:')
            l, f = rest.split(', format:')
            predecessors.append({'outline_number': o, 'type': int(t), 'lag': int(l), 'lag_format': int(f)})
        task = {'name': name, 'outline_number': outline, 'duration': duration, 'value': value, 'predecessors': predecessors}
        if milestone:
            task['milestone'] = True
        if is_new:
            self.new_tasks.append(task)
        else:
            self.new_tasks[index] = task
        self.update_lists()
        popup.destroy()

    def delete_new_task(self):
        sel = self.new_tasks_list.curselection()
        if sel:
            del self.new_tasks[sel[0]]
            self.update_lists()

    def add_modify_task(self):
        self.modify_popup("Add Modify Task", {})

    def edit_modify_task(self):
        sel = self.modify_tasks_list.curselection()
        if sel:
            self.modify_popup("Edit Modify Task", self.modify_tasks[sel[0]], index=sel[0])

    def modify_popup(self, title, mod, index=None):
        popup = tk.Toplevel(self.root)
        popup.title(title)
        tk.Label(popup, text="Outline Number").grid(row=0, column=0)
        outline = tk.Entry(popup)
        outline.insert(0, mod.get('outline_number', ''))
        outline.grid(row=0, column=1)
        tk.Label(popup, text="New Name (optional)").grid(row=1, column=0)
        name = tk.Entry(popup)
        name.insert(0, mod.get('name', ''))
        name.grid(row=1, column=1)
        tk.Label(popup, text="New Duration (optional)").grid(row=2, column=0)
        duration = tk.Entry(popup)
        duration.insert(0, mod.get('duration', ''))
        duration.grid(row=2, column=1)
        tk.Label(popup, text="Predecessors").grid(row=3, column=0)
        pred_list = tk.Listbox(popup, height=5)
        pred_list.grid(row=3, column=1)
        predecessors = mod.get('predecessors', [])
        for p in predecessors:
            pred_list.insert(tk.END, f"{p['outline_number']} (type:{p.get('type', 1)}, lag:{p.get('lag', 0)}, format:{p.get('lag_format', 7)})")
        tk.Button(popup, text="Add Predecessor", command=lambda: self.pred_popup(popup, pred_list)).grid(row=4, column=1)
        tk.Button(popup, text="Delete Predecessor", command=lambda: pred_list.delete(tk.ANCHOR)).grid(row=5, column=1)
        save = tk.Button(popup, text="Save", command=lambda: self.save_modify(popup, outline.get(), name.get(), duration.get(), pred_list, index))
        save.grid(row=6, column=1)

    def save_modify(self, popup, outline, name, duration, pred_list, index):
        predecessors = []
        for i in range(pred_list.size()):
            str_ = pred_list.get(i)
            parts = str_.split(' (type:')
            o = parts[0]
            rest = parts[1].rstrip(')')
            t, rest = rest.split(', lag:')
            l, f = rest.split(', format:')
            predecessors.append({'outline_number': o, 'type': int(t), 'lag': int(l), 'lag_format': int(f)})
        mod = {'outline_number': outline, 'predecessors': predecessors}
        if name:
            mod['name'] = name
        if duration:
            mod['duration'] = duration
        if index is None:
            self.modify_tasks.append(mod)
        else:
            self.modify_tasks[index] = mod
        self.update_lists()
        popup.destroy()

    def delete_modify_task(self):
        sel = self.modify_tasks_list.curselection()
        if sel:
            del self.modify_tasks[sel[0]]
            self.update_lists()

    def add_remove_task(self):
        popup = tk.Toplevel(self.root)
        tk.Label(popup, text="Outline Number").grid(row=0, column=0)
        outline = tk.Entry(popup)
        outline.grid(row=0, column=1)
        tk.Button(popup, text="Add", command=lambda: self.save_remove(popup, outline.get())).grid(row=1, column=1)

    def save_remove(self, popup, outline):
        if outline:
            self.remove_tasks.append(outline)
            self.update_lists()
            popup.destroy()

    def delete_remove_task(self):
        sel = self.remove_tasks_list.curselection()
        if sel:
            del self.remove_tasks[sel[0]]
            self.update_lists()

    def load_config(self):
        file = filedialog.askopenfilename(filetypes=[("JSON files", "*.json")])
        if file:
            with open(file, 'r') as f:
                config = json.load(f)
            self.project_name.delete(0, tk.END)
            self.project_name.insert(0, config.get('project_name', ''))
            self.start_date.delete(0, tk.END)
            self.start_date.insert(0, config.get('start_date', ''))
            self.status_date.delete(0, tk.END)
            self.status_date.insert(0, config.get('status_date', ''))
            self.new_tasks = config.get('new_tasks', [])
            self.modify_tasks = config.get('modify_tasks', [])
            self.remove_tasks = config.get('remove_tasks', [])
            self.update_lists()

    def save_config(self):
        config = {
            'project_name': self.project_name.get(),
            'start_date': self.start_date.get(),
            'status_date': self.status_date.get(),
            'new_tasks': self.new_tasks,
            'modify_tasks': self.modify_tasks,
            'remove_tasks': self.remove_tasks
        }
        file = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON files", "*.json")])
        if file:
            with open(file, 'w') as f:
                json.dump(config, f, indent=4)
            messagebox.showinfo("Success", "Config saved!")

    def generate_xml(self):
        config = {
            'project_name': self.project_name.get(),
            'start_date': self.start_date.get(),
            'status_date': self.status_date.get(),
            'new_tasks': self.new_tasks,
            'modify_tasks': self.modify_tasks,
            'remove_tasks': self.remove_tasks
        }
        try:
            xml_str = modify_xml(config)
            file = filedialog.asksaveasfilename(defaultextension=".xml", filetypes=[("XML files", "*.xml")])
            if file:
                with open(file, 'w') as f:
                    f.write(xml_str)
                messagebox.showinfo("Success", "XML generated!")
        except Exception as e:
            messagebox.showerror("Error", str(e))

if __name__ == "__main__":
    print("Starting MS Project Config Editor...")
    try:
        root = tk.Tk()
        print("Tk root created successfully")
        # Force window to front on macOS
        root.lift()
        root.attributes('-topmost', True)
        root.after_idle(root.attributes, '-topmost', False)
        print("Creating ConfigEditor...")
        app = ConfigEditor(root)
        print("GUI initialized. Starting main loop...")
        root.mainloop()
    except Exception as e:
        print(f"Error starting GUI: {e}")
        import traceback
        traceback.print_exc()