"""
AI Service using local Llama 3.2 via Ollama
Provides task duration estimation, dependency detection, and categorization
"""

import httpx
import json
from typing import List, Dict, Optional
from models import Task


class LocalAIService:
    """Local LLM service using Ollama"""

    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self.model = "llama3.2:3b"  # Fast, lightweight model
        self.chat_history: List[Dict[str, str]] = []  # Store conversation history
    
    async def _generate(self, prompt: str, system: str = "") -> str:
        """Call Ollama API"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "system": system,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,  # Lower = more consistent
                        "top_p": 0.9,
                    }
                }
            )
            result = response.json()
            return result.get("response", "")
    
    async def estimate_duration(self, task_name: str, task_type: str = "", project_context: Optional[Dict] = None) -> Dict:
        """
        Estimate task duration in days for CONSTRUCTION PROJECTS with project context
        Returns: {"days": float, "confidence": float, "reasoning": str}
        """
        system = """You are a construction project management expert. Estimate task durations in working days.
Consider typical construction timelines, weather delays, material delivery, inspections, and crew availability.
Use the project context to make more accurate estimates based on similar tasks already in the project.
Be realistic and conservative. Respond ONLY with JSON format: {"days": <number>, "confidence": <0-100>, "reasoning": "<brief explanation>"}"""

        # Build context from existing project tasks
        context_info = ""
        if project_context and project_context.get("tasks"):
            tasks = project_context["tasks"]
            project_name = project_context.get("name", "Unknown Project")

            # Extract similar tasks for context
            similar_tasks = []
            task_name_lower = task_name.lower()
            keywords = set(task_name_lower.split())

            for task in tasks:
                if task.get("summary") or task.get("milestone"):
                    continue  # Skip summary and milestone tasks

                task_name_existing = task.get("name", "").lower()
                # Check for keyword overlap
                existing_keywords = set(task_name_existing.split())
                overlap = keywords & existing_keywords

                if overlap or any(keyword in task_name_existing for keyword in keywords):
                    duration_str = task.get("duration", "")
                    # Parse ISO 8601 duration (PT8H0M0S format)
                    days = self._parse_duration_to_days(duration_str)
                    if days > 0:
                        similar_tasks.append({
                            "name": task.get("name"),
                            "duration_days": days,
                            "outline": task.get("outline_number", "")
                        })

            context_info = f"\n\nProject Context:\nProject Name: {project_name}\n"

            if similar_tasks:
                context_info += "\nSimilar tasks in this project:\n"
                for st in similar_tasks[:5]:  # Limit to 5 most relevant
                    context_info += f"- {st['name']} ({st['outline']}): {st['duration_days']} days\n"
                context_info += "\nUse these as reference points for your estimate.\n"
            else:
                # Provide general project stats
                total_tasks = len([t for t in tasks if not t.get("summary") and not t.get("milestone")])
                context_info += f"Total tasks in project: {total_tasks}\n"
                context_info += "No directly similar tasks found. Use industry standards.\n"

        prompt = f"""Construction Task: {task_name}
Type: {task_type or 'General Construction'}
{context_info}
Estimate the duration in working days (1 day = 8 hours of work).

Common construction task estimates:
- Site preparation/excavation: 3-7 days
- Foundation work: 5-10 days
- Framing: 10-20 days (depends on size)
- Roofing: 3-7 days
- Electrical rough-in: 3-5 days
- Plumbing rough-in: 3-5 days
- Drywall installation: 5-10 days
- Interior finishing: 10-15 days
- Exterior finishing: 7-14 days
- Inspections: 1-2 days each
- Permits/approvals: 5-15 days
- Concrete curing: 7-28 days (weather dependent)
- Painting: 3-7 days
- Flooring installation: 3-7 days
- HVAC installation: 5-10 days
- Final walkthrough: 1-2 days

Consider:
- Weather delays (add 10-20% buffer)
- Material delivery times
- Inspection requirements
- Crew size and availability
- Complexity of work

Provide your estimate:"""
        
        response = await self._generate(prompt, system)
        
        # Parse JSON response
        try:
            # Extract JSON from response (LLM might add extra text)
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                return {
                    "days": float(result.get("days", 1)),
                    "confidence": int(result.get("confidence", 70)),
                    "reasoning": result.get("reasoning", "AI estimation")
                }
        except Exception as e:
            print(f"Error parsing AI response: {e}")
        
        # Fallback
        return {"days": 1, "confidence": 50, "reasoning": "Default estimate"}

    def _parse_duration_to_days(self, duration_str: str) -> float:
        """
        Parse ISO 8601 duration format (PT8H0M0S) to days
        Returns: float (days)
        """
        if not duration_str or not duration_str.startswith("PT"):
            return 0.0

        try:
            # Remove PT prefix
            duration_str = duration_str[2:]

            hours = 0
            minutes = 0

            # Parse hours
            if 'H' in duration_str:
                h_parts = duration_str.split('H')
                hours = int(h_parts[0])
                duration_str = h_parts[1] if len(h_parts) > 1 else ""

            # Parse minutes
            if 'M' in duration_str:
                m_parts = duration_str.split('M')
                minutes = int(m_parts[0])

            # Convert to days (8 hours = 1 day)
            total_hours = hours + (minutes / 60.0)
            days = total_hours / 8.0

            return round(days, 2)
        except Exception as e:
            print(f"Duration parse error: {e}")
            return 0.0

    async def detect_dependencies(self, tasks: List[Dict]) -> List[Dict]:
        """
        Suggest task dependencies for CONSTRUCTION PROJECTS
        Returns: [{"task_id": str, "depends_on": str, "confidence": int, "reason": str}]
        """
        system = """You are a construction project management expert. Analyze construction task sequences and suggest logical dependencies.
Respond ONLY with JSON array format: [{"task_index": <number>, "depends_on_index": <number>, "confidence": <0-100>, "reason": "<brief>"}]"""

        task_list = "\n".join([f"{i}. {t['name']}" for i, t in enumerate(tasks)])

        prompt = f"""Analyze these construction tasks and suggest dependencies:

{task_list}

Construction sequencing rules:
- Foundation work depends on site preparation/excavation
- Framing depends on foundation completion
- Roofing depends on framing
- Rough-in (electrical, plumbing, HVAC) depends on framing
- Insulation depends on rough-in inspections
- Drywall depends on insulation and rough-in approval
- Interior finishing depends on drywall
- Exterior finishing can be parallel with interior work
- Final inspections depend on all work completion
- Permits/approvals must come before related work
- Concrete work requires curing time before next phase
- Painting depends on drywall/surface preparation
- Flooring depends on painting completion
- Fixture installation depends on finish work

Suggest dependencies (use task indices):"""
        
        response = await self._generate(prompt, system)
        
        try:
            json_start = response.find('[')
            json_end = response.rfind(']') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                suggestions = json.loads(json_str)
                
                # Map indices to task IDs
                result = []
                for sugg in suggestions:
                    task_idx = sugg.get("task_index")
                    depends_idx = sugg.get("depends_on_index")
                    if task_idx < len(tasks) and depends_idx < len(tasks):
                        result.append({
                            "task_id": tasks[task_idx]["id"],
                            "depends_on_id": tasks[depends_idx]["id"],
                            "depends_on_name": tasks[depends_idx]["name"],
                            "confidence": sugg.get("confidence", 70),
                            "reason": sugg.get("reason", "Logical dependency")
                        })
                return result
        except Exception as e:
            print(f"Error parsing dependencies: {e}")
        
        return []
    
    async def categorize_task(self, task_name: str, project_context: Optional[Dict] = None) -> Dict:
        """
        Categorize CONSTRUCTION task by type with project context
        Returns: {"category": str, "confidence": int}
        """
        system = """You are a construction task categorization expert. Categorize construction tasks into one of these types:
- site_work: Site preparation, excavation, grading, demolition, clearing
- foundation: Foundation work, footings, concrete slabs, basement
- structural: Framing, structural steel, load-bearing walls
- exterior: Roofing, siding, windows, doors, exterior finishing
- mechanical: HVAC, plumbing, electrical rough-in and finish
- interior: Drywall, insulation, interior doors, trim, millwork
- finishing: Painting, flooring, tiling, countertops, fixtures
- inspection: Inspections, permits, approvals, code compliance
- landscaping: Landscaping, hardscaping, outdoor features
- specialty: Custom work, specialty installations, unique features

Use project context to understand the type of construction project and categorize accordingly.
Respond ONLY with JSON: {"category": "<type>", "confidence": <0-100>}"""

        # Add project context
        context_info = ""
        if project_context:
            project_name = project_context.get("name", "")
            context_info = f"\n\nProject: {project_name}"

            # Analyze existing task categories to understand project phase
            if project_context.get("tasks"):
                task_keywords = {}
                for task in project_context["tasks"]:
                    if task.get("summary") or task.get("milestone"):
                        continue
                    name = task.get("name", "").lower()
                    # Count keyword occurrences
                    for keyword in ["excavat", "foundation", "fram", "roof", "electric", "plumb", "drywall", "paint", "floor"]:
                        if keyword in name:
                            task_keywords[keyword] = task_keywords.get(keyword, 0) + 1

                if task_keywords:
                    top_keywords = sorted(task_keywords.items(), key=lambda x: x[1], reverse=True)[:3]
                    context_info += f"\nProject appears to focus on: {', '.join([k for k, v in top_keywords])}"

        prompt = f"Construction Task: {task_name}{context_info}\n\nCategorize this task:"
        
        response = await self._generate(prompt, system)
        
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                return {
                    "category": result.get("category", "development"),
                    "confidence": int(result.get("confidence", 70))
                }
        except Exception as e:
            print(f"Error parsing category: {e}")
        
        return {"category": "development", "confidence": 50}
    
    async def health_check(self) -> bool:
        """Check if Ollama is running"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except:
            return False

    async def chat(self, user_message: str, project_context: Optional[Dict] = None) -> str:
        """
        Conversational AI chat for construction project assistance
        Returns: AI response as string
        """
        # Build project context summary
        context_summary = ""
        if project_context:
            project_name = project_context.get("name", "Unknown Project")
            tasks = project_context.get("tasks", [])
            task_count = len([t for t in tasks if not t.get("summary")])

            # Analyze tasks with lags
            tasks_with_lags = []
            for task in tasks:
                if task.get("predecessors"):
                    for pred in task.get("predecessors", []):
                        lag_value = pred.get("lag", 0)
                        if lag_value != 0:
                            # Convert lag from minutes to days (48000 minutes = 100 days)
                            lag_days = lag_value / 480.0  # 480 minutes = 1 day (8 hours)
                            tasks_with_lags.append({
                                "task": task.get("name"),
                                "outline": task.get("outline_number"),
                                "predecessor": pred.get("outline_number"),
                                "lag_days": lag_days,
                                "lag_minutes": lag_value
                            })

            context_summary = f"""
Current Project: {project_name}
Total Tasks: {task_count}
Tasks with Lags: {len(tasks_with_lags)}

Recent Tasks:
"""
            # Show last 5 non-summary tasks
            recent_tasks = [t for t in tasks if not t.get("summary") and not t.get("milestone")][-5:]
            for task in recent_tasks:
                duration_days = self._parse_duration_to_days(task.get("duration", ""))
                context_summary += f"- {task.get('name')} ({duration_days} days)\n"

            # Add lag information if requested
            if tasks_with_lags and ("lag" in user_message.lower() or "delay" in user_message.lower()):
                context_summary += f"\n\nTasks with Lags/Delays:\n"
                for lag_info in tasks_with_lags:
                    context_summary += f"- {lag_info['task']} ({lag_info['outline']}): {lag_info['lag_days']:.1f} day lag after predecessor {lag_info['predecessor']}\n"

        system_prompt = f"""You are an expert construction project manager assistant.
You help with:
- Estimating task durations for construction work
- Suggesting task sequences and dependencies
- Identifying potential issues or conflicts
- Providing construction best practices
- Answering questions about the project

Be concise, practical, and specific to construction projects.
{context_summary}

Conversation history is maintained, so you can reference previous messages.
"""

        # Add user message to history
        self.chat_history.append({"role": "user", "content": user_message})

        # Build conversation context (last 10 messages)
        conversation = "\n".join([
            f"{'User' if msg['role'] == 'user' else 'Assistant'}: {msg['content']}"
            for msg in self.chat_history[-10:]
        ])

        prompt = f"{conversation}\n\nAssistant:"

        try:
            response = await self._generate(prompt, system_prompt)

            # Add assistant response to history
            self.chat_history.append({"role": "assistant", "content": response})

            return response.strip()
        except Exception as e:
            print(f"Chat error: {e}")
            return "I'm having trouble connecting to the AI service. Please make sure Ollama is running."

    def clear_chat_history(self):
        """Clear conversation history"""
        self.chat_history = []


# Singleton instance
ai_service = LocalAIService()

