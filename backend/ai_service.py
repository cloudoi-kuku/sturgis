"""
AI Service using Azure OpenAI
Provides task duration estimation, dependency detection, and categorization
"""

import httpx
import json
import os
from typing import List, Dict, Optional
from models import Task


class LocalAIService:
    """AI service using Azure OpenAI (GPT-4o-mini for cost efficiency)"""

    def __init__(self):
        # Azure OpenAI configuration
        self.azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
        self.azure_api_key = os.getenv("AZURE_OPENAI_API_KEY", "")
        self.azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
        self.azure_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

        # Fallback to Ollama if Azure not configured
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.ollama_model = "llama3.2:3b"

        self.chat_history: List[Dict[str, str]] = []  # Store conversation history

        # Determine which service to use
        self.use_azure = bool(self.azure_endpoint and self.azure_api_key)
        if self.use_azure:
            print(f"AI Service: Using Azure OpenAI ({self.azure_deployment})")
        else:
            print("AI Service: Azure OpenAI not configured, falling back to Ollama")

    async def _generate(self, prompt: str, system: str = "") -> str:
        """Generate response using Azure OpenAI or Ollama fallback"""
        if self.use_azure:
            return await self._generate_azure(prompt, system)
        else:
            return await self._generate_ollama(prompt, system)

    async def _generate_azure(self, prompt: str, system: str = "") -> str:
        """Call Azure OpenAI API"""
        url = f"{self.azure_endpoint}/openai/deployments/{self.azure_deployment}/chat/completions?api-version={self.azure_api_version}"

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    url,
                    headers={
                        "Content-Type": "application/json",
                        "api-key": self.azure_api_key,
                    },
                    json={
                        "messages": messages,
                        "temperature": 0.3,
                        "top_p": 0.9,
                        "max_tokens": 2000,
                    }
                )
                response.raise_for_status()
                result = response.json()
                return result["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                print(f"Azure OpenAI API error: {e.response.status_code} - {e.response.text}")
                return ""
            except Exception as e:
                print(f"Azure OpenAI error: {e}")
                return ""

    async def _generate_ollama(self, prompt: str, system: str = "") -> str:
        """Call Ollama API (fallback)"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.ollama_base_url}/api/generate",
                    json={
                        "model": self.ollama_model,
                        "prompt": prompt,
                        "system": system,
                        "stream": False,
                        "options": {
                            "temperature": 0.3,
                            "top_p": 0.9,
                        }
                    }
                )
                result = response.json()
                return result.get("response", "")
            except Exception as e:
                print(f"Ollama error: {e}")
                return ""
    
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

    # ============================================================================
    # MS PROJECT CRITICAL PATH CALCULATION (CPM Algorithm)
    # ============================================================================

    def _calculate_critical_path(self, tasks: list) -> dict:
        """
        Calculate critical path using CPM (Critical Path Method).
        Implements forward pass and backward pass per MS Project standards.

        Returns:
            dict with:
                - critical_tasks: list of tasks on critical path
                - project_duration: total project duration in days
                - task_floats: dict of task_id -> total_float
        """
        if not tasks:
            return {
                "critical_tasks": [],
                "project_duration": 0,
                "task_floats": {}
            }

        # Build task lookup map
        task_map = {t["id"]: t for t in tasks}
        outline_to_id = {t["outline_number"]: t["id"] for t in tasks}

        # Initialize all tasks
        for task in tasks:
            task["early_start"] = 0.0
            task["early_finish"] = 0.0
            task["late_start"] = 0.0
            task["late_finish"] = 0.0
            task["total_float"] = 0.0
            task["is_critical"] = False

        # FORWARD PASS: Calculate Early Start and Early Finish
        # Process tasks in topological order (respecting dependencies)
        processed = set()

        def can_process(task):
            """Check if all predecessors have been processed"""
            if not task.get("predecessors"):
                return True
            for pred in task["predecessors"]:
                pred_id = outline_to_id.get(pred["outline_number"])
                if pred_id and pred_id not in processed:
                    return False
            return True

        while len(processed) < len(tasks):
            made_progress = False
            for task in tasks:
                if task["id"] in processed:
                    continue

                if can_process(task):
                    # Calculate early start
                    if not task.get("predecessors"):
                        task["early_start"] = 0.0
                    else:
                        max_finish = 0.0
                        for pred in task["predecessors"]:
                            pred_id = outline_to_id.get(pred["outline_number"])
                            if pred_id and pred_id in task_map:
                                pred_task = task_map[pred_id]

                                # Get lag in days (MS Project stores in minutes, format 7=days)
                                lag_minutes = pred.get("lag", 0)
                                lag_days = lag_minutes / 480.0  # 480 minutes = 1 day (8 hours)

                                # Dependency type (MS Project standard):
                                # 0 = FF (Finish-to-Finish)
                                # 1 = FS (Finish-to-Start) - DEFAULT
                                # 2 = SF (Start-to-Finish)
                                # 3 = SS (Start-to-Start)
                                dep_type = pred.get("type", 1)

                                if dep_type == 1:  # FS (Finish-to-Start)
                                    finish_time = pred_task["early_finish"] + lag_days
                                elif dep_type == 3:  # SS (Start-to-Start)
                                    finish_time = pred_task["early_start"] + lag_days
                                elif dep_type == 0:  # FF (Finish-to-Finish)
                                    finish_time = pred_task["early_finish"] + lag_days - self._parse_duration_to_days(task.get("duration", ""))
                                elif dep_type == 2:  # SF (Start-to-Finish)
                                    finish_time = pred_task["early_start"] + lag_days - self._parse_duration_to_days(task.get("duration", ""))
                                else:
                                    finish_time = pred_task["early_finish"] + lag_days

                                max_finish = max(max_finish, finish_time)

                        task["early_start"] = max_finish

                    # Calculate early finish
                    duration_days = self._parse_duration_to_days(task.get("duration", ""))
                    task["early_finish"] = task["early_start"] + duration_days

                    processed.add(task["id"])
                    made_progress = True

            if not made_progress:
                # Circular dependency detected - break the loop
                break

        # Find project end date (maximum early finish)
        project_end = max((t["early_finish"] for t in tasks), default=0.0)

        # BACKWARD PASS: Calculate Late Start and Late Finish
        # Process tasks in reverse topological order
        processed = set()

        # Build successor map
        successor_map = {task["id"]: [] for task in tasks}
        for task in tasks:
            for pred in task.get("predecessors", []):
                pred_id = outline_to_id.get(pred["outline_number"])
                if pred_id:
                    successor_map[pred_id].append({
                        "task": task,
                        "type": pred.get("type", 1),
                        "lag": pred.get("lag", 0)
                    })

        def can_process_backward(task):
            """Check if all successors have been processed"""
            successors = successor_map.get(task["id"], [])
            if not successors:
                return True
            for succ_info in successors:
                if succ_info["task"]["id"] not in processed:
                    return False
            return True

        while len(processed) < len(tasks):
            made_progress = False
            for task in reversed(tasks):
                if task["id"] in processed:
                    continue

                if can_process_backward(task):
                    successors = successor_map.get(task["id"], [])

                    if not successors:
                        # No successors - use project end date
                        task["late_finish"] = project_end
                    else:
                        min_start = project_end
                        for succ_info in successors:
                            succ_task = succ_info["task"]
                            dep_type = succ_info["type"]
                            lag_days = succ_info["lag"] / 480.0

                            if dep_type == 1:  # FS (Finish-to-Start)
                                start_time = succ_task["late_start"] - lag_days
                            elif dep_type == 3:  # SS (Start-to-Start)
                                start_time = succ_task["late_start"] - lag_days + self._parse_duration_to_days(task.get("duration", ""))
                            elif dep_type == 0:  # FF (Finish-to-Finish)
                                start_time = succ_task["late_finish"] - lag_days
                            elif dep_type == 2:  # SF (Start-to-Finish)
                                start_time = succ_task["late_finish"] - lag_days + self._parse_duration_to_days(task.get("duration", ""))
                            else:
                                start_time = succ_task["late_start"] - lag_days

                            min_start = min(min_start, start_time)

                        task["late_finish"] = min_start

                    # Calculate late start
                    duration_days = self._parse_duration_to_days(task.get("duration", ""))
                    task["late_start"] = task["late_finish"] - duration_days

                    processed.add(task["id"])
                    made_progress = True

            if not made_progress:
                break

        # Calculate Total Float and identify Critical Path
        critical_tasks = []
        task_floats = {}

        for task in tasks:
            # Total Float = Late Start - Early Start (or Late Finish - Early Finish)
            total_float = task["late_start"] - task["early_start"]
            task["total_float"] = total_float
            task_floats[task["id"]] = total_float

            # Critical if float is approximately zero (within 0.01 days tolerance)
            if abs(total_float) < 0.01:
                task["is_critical"] = True
                critical_tasks.append(task)

        return {
            "critical_tasks": critical_tasks,
            "project_duration": project_end,
            "task_floats": task_floats
        }

    # ============================================================================
    # PROJECT DURATION OPTIMIZATION STRATEGIES
    # ============================================================================

    def optimize_project_duration(self, target_days: int, project_context: dict) -> dict:
        """
        Optimize project to meet target duration.
        Returns multiple strategies with cost/risk analysis.
        MS Project compliant.
        """
        tasks = project_context.get("tasks", [])

        if not tasks:
            return {
                "success": False,
                "message": "No tasks in project",
                "current_duration_days": 0,
                "target_duration_days": target_days,
                "reduction_needed_days": 0,
                "achievable": False,
                "strategies": [],
                "critical_path_tasks": []
            }

        # Calculate critical path
        cp_result = self._calculate_critical_path(tasks)
        current_duration = cp_result["project_duration"]
        critical_tasks = cp_result["critical_tasks"]
        reduction_needed = current_duration - target_days

        if reduction_needed <= 0:
            return {
                "success": True,
                "message": f"Project already meets target ({current_duration:.1f} ≤ {target_days} days)",
                "current_duration_days": current_duration,
                "target_duration_days": target_days,
                "reduction_needed_days": 0,
                "achievable": True,
                "strategies": [],
                "critical_path_tasks": [t["name"] for t in critical_tasks]
            }

        # Generate optimization strategies
        strategies = []

        # Strategy 1: Reduce Lags (Lowest Risk)
        lag_strategy = self._optimize_lags(tasks, critical_tasks, reduction_needed)
        if lag_strategy:
            strategies.append(lag_strategy)

        # Strategy 2: Compress Tasks (Medium Risk)
        compression_strategy = self._compress_tasks(tasks, critical_tasks, reduction_needed)
        if compression_strategy:
            strategies.append(compression_strategy)

        # Determine if target is achievable
        max_savings = sum(s["total_savings_days"] for s in strategies)
        achievable = max_savings >= reduction_needed

        # Rank strategies
        strategies = self._rank_strategies(strategies, reduction_needed)

        return {
            "success": True,
            "message": f"Found {len(strategies)} optimization strategies",
            "current_duration_days": current_duration,
            "target_duration_days": target_days,
            "reduction_needed_days": reduction_needed,
            "achievable": achievable,
            "strategies": strategies,
            "critical_path_tasks": [t["name"] for t in critical_tasks]
        }

    def _optimize_lags(self, tasks: list, critical_tasks: list, reduction_needed: float) -> Optional[dict]:
        """
        Strategy 1: Reduce lags between dependent tasks.
        MS Project compliant - modifies LinkLag values.
        """
        changes = []
        total_savings = 0.0

        # Only look at critical path tasks
        for task in critical_tasks:
            for pred in task.get("predecessors", []):
                lag_minutes = pred.get("lag", 0)

                if lag_minutes > 0:
                    lag_days = lag_minutes / 480.0  # MS Project: 480 min = 1 day

                    # Suggest reducing lag by 40% (conservative approach)
                    reduction_percent = 0.4
                    suggested_reduction = lag_days * reduction_percent
                    new_lag_days = lag_days - suggested_reduction
                    new_lag_minutes = int(new_lag_days * 480)

                    changes.append({
                        "task_id": task["id"],
                        "task_name": task["name"],
                        "task_outline": task["outline_number"],
                        "change_type": "lag_reduction",
                        "current_value": lag_days,
                        "suggested_value": new_lag_days,
                        "savings_days": suggested_reduction,
                        "cost_usd": 0,
                        "risk_level": "Low",
                        "description": f"Reduce lag from {lag_days:.1f} to {new_lag_days:.1f} days",
                        "predecessor_outline": pred["outline_number"],
                        "lag_format": pred.get("lag_format", 7),
                        "new_lag_minutes": new_lag_minutes
                    })

                    total_savings += suggested_reduction

        if not changes:
            return None

        return {
            "strategy_id": "lag_reduction",
            "name": "Reduce Lags",
            "type": "lag_reduction",
            "total_savings_days": total_savings,
            "total_cost_usd": 0,
            "risk_level": "Low",
            "recommended": True,
            "description": f"Reduce buffer time between {len(changes)} dependent tasks on critical path",
            "changes": changes,
            "tasks_affected": len(set(c["task_id"] for c in changes)),
            "critical_path_impact": True
        }

    def _compress_tasks(self, tasks: list, critical_tasks: list, reduction_needed: float) -> Optional[dict]:
        """
        Strategy 2: Compress task durations by adding resources.
        MS Project compliant - modifies Duration field.
        """
        changes = []
        total_savings = 0.0
        total_cost = 0.0

        for task in critical_tasks:
            # Skip summary tasks and milestones
            if task.get("summary") or task.get("milestone"):
                continue

            duration_days = self._parse_duration_to_days(task.get("duration", ""))

            # Only compress tasks longer than 2 days
            if duration_days > 2:
                # Suggest 20% compression (realistic with added resources)
                compression_percent = 0.2
                compression_days = duration_days * compression_percent
                new_duration_days = duration_days - compression_days

                # Convert back to MS Project format
                new_duration_hours = int(new_duration_days * 8)
                new_duration_format = f"PT{new_duration_hours}H0M0S"

                # Estimate cost: $500/day for overtime or extra crew
                cost = compression_days * 500

                changes.append({
                    "task_id": task["id"],
                    "task_name": task["name"],
                    "task_outline": task["outline_number"],
                    "change_type": "duration_compression",
                    "current_value": duration_days,
                    "suggested_value": new_duration_days,
                    "savings_days": compression_days,
                    "cost_usd": cost,
                    "risk_level": "Medium",
                    "description": f"Compress from {duration_days:.1f} to {new_duration_days:.1f} days (add crew/overtime)",
                    "duration_format": new_duration_format
                })

                total_savings += compression_days
                total_cost += cost

                # Stop if we've achieved enough savings
                if total_savings >= reduction_needed:
                    break

        if not changes:
            return None

        return {
            "strategy_id": "task_compression",
            "name": "Compress Tasks",
            "type": "task_compression",
            "total_savings_days": total_savings,
            "total_cost_usd": total_cost,
            "risk_level": "Medium",
            "recommended": False,
            "description": f"Reduce duration of {len(changes)} critical tasks by adding resources",
            "changes": changes,
            "tasks_affected": len(changes),
            "critical_path_impact": True
        }

    def _rank_strategies(self, strategies: list, reduction_needed: float) -> list:
        """Rank strategies by effectiveness, cost, and risk"""
        def strategy_score(s):
            # Prefer strategies that meet the need
            meets_need = 1.0 if s["total_savings_days"] >= reduction_needed else 0.5

            # Prefer lower cost
            cost_factor = 1.0 / (1.0 + s["total_cost_usd"] / 10000.0)

            # Prefer lower risk
            risk_scores = {"Low": 1.0, "Medium": 0.7, "High": 0.4}
            risk_factor = risk_scores.get(s["risk_level"], 0.5)

            return meets_need * cost_factor * risk_factor

        # Sort by score (highest first)
        sorted_strategies = sorted(strategies, key=strategy_score, reverse=True)

        # Mark top strategy as recommended
        if sorted_strategies:
            sorted_strategies[0]["recommended"] = True

        return sorted_strategies

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
        """Check if AI service is available"""
        try:
            if self.use_azure:
                # For Azure, just return True if configured
                return bool(self.azure_endpoint and self.azure_api_key)
            else:
                # For Ollama, check if server is running
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"{self.ollama_base_url}/api/tags")
                    return response.status_code == 200
        except:
            return False

    async def chat(self, user_message: str, project_context: Optional[Dict] = None, historical_data: Optional[List[Dict]] = None) -> str:
        """
        Conversational AI chat for construction project assistance
        Can also detect and handle project generation requests
        Returns: AI response as string OR special JSON for project generation
        """
        # Check if this is a project generation request
        generation_keywords = [
            "generate", "create", "build", "make", "new project",
            "residential", "commercial", "industrial", "warehouse",
            "office building", "home", "house", "renovation"
        ]

        message_lower = user_message.lower()
        is_generation_request = any(keyword in message_lower for keyword in generation_keywords)

        # Additional heuristics: if message is long and descriptive, likely a generation request
        if len(user_message.split()) > 10 and any(word in message_lower for word in ["sq ft", "square", "bedroom", "story", "floor"]):
            is_generation_request = True

        # Check if project is empty (no tasks or very few tasks)
        is_empty_project = False
        if project_context:
            tasks = project_context.get("tasks", [])
            non_summary_tasks = [t for t in tasks if not t.get("summary")]
            is_empty_project = len(non_summary_tasks) == 0

        # If it's a generation request and (no project OR empty project), handle it specially
        if is_generation_request and (not project_context or is_empty_project):
            # Detect project type
            project_type = "commercial"  # default
            if any(word in message_lower for word in ["residential", "home", "house", "bedroom", "family"]):
                project_type = "residential"
            elif any(word in message_lower for word in ["warehouse", "distribution", "storage", "industrial"]):
                project_type = "industrial"
            elif any(word in message_lower for word in ["renovation", "remodel", "retrofit", "upgrade"]):
                project_type = "renovation"

            # Generate the project with historical context
            try:
                result = await self.generate_project(user_message, project_type, historical_data)
                if result.get("success"):
                    # Return special JSON response that frontend can detect
                    historical_note = ""
                    if historical_data and len(historical_data) > 0:
                        historical_note = f" I've used patterns from {len(historical_data)} of your past projects to ensure consistency with your company's standards."

                    return json.dumps({
                        "type": "project_generation",
                        "project_name": result.get("project_name"),
                        "task_count": len(result.get("tasks", [])),
                        "message": f"I've generated a complete {project_type} project based on your description! The project '{result['project_name']}' has {len(result.get('tasks', []))} tasks organized into phases.{historical_note} Would you like me to explain the structure or make any adjustments?"
                    })
                else:
                    return "I tried to generate a project but encountered an issue. Could you provide more details about what you'd like to build?"
            except Exception as e:
                print(f"Project generation error in chat: {e}")
                return "I had trouble generating the project. Please make sure your description includes key details like project type, size, and main features."

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
            return "I'm having trouble connecting to the AI service. Please try again later."

    def clear_chat_history(self):
        """Clear conversation history"""
        self.chat_history = []

    async def generate_project(self, description: str, project_type: str = "commercial", historical_data: Optional[List[Dict]] = None) -> Dict:
        """
        Generate a complete construction project from a description
        Uses historical project data to maintain consistency with company practices
        Returns: {"tasks": [...], "metadata": {...}, "success": bool}
        """
        # Build historical context from past projects
        historical_context = ""
        if historical_data and len(historical_data) > 0:
            historical_context = "\n\nHISTORICAL PROJECT PATTERNS (Use these as guidelines for consistency):\n"

            # Analyze common task names and durations
            task_patterns = {}
            phase_patterns = {}

            for project in historical_data:
                for task in project.get('tasks', []):
                    task_name = task.get('name', '').lower()
                    duration = task.get('duration', 'PT0H0M0S')
                    outline_level = task.get('outline_level', 1)

                    # Extract duration in days
                    import re
                    match = re.search(r'PT(\d+)H', duration)
                    if match:
                        hours = int(match.group(1))
                        days = hours / 8

                        # Track task patterns
                        if not task.get('summary') and task_name:
                            if task_name not in task_patterns:
                                task_patterns[task_name] = []
                            task_patterns[task_name].append(days)

                        # Track phase patterns
                        if task.get('summary') and outline_level == 1:
                            phase_name = task.get('name', '')
                            if phase_name not in phase_patterns:
                                phase_patterns[phase_name] = True

            # Add common task examples
            if task_patterns:
                historical_context += "\nCommon tasks from past projects:\n"
                for task_name, durations in list(task_patterns.items())[:15]:
                    avg_duration = sum(durations) / len(durations)
                    historical_context += f"  - '{task_name}': typically {avg_duration:.1f} days\n"

            # Add common phases
            if phase_patterns:
                historical_context += "\nCommon phases used:\n"
                for phase_name in list(phase_patterns.keys())[:10]:
                    historical_context += f"  - {phase_name}\n"

            historical_context += "\nIMPORTANT: Use similar task names and durations to maintain consistency with company standards.\n"

        system_prompt = f"""You are an expert construction project manager. Generate a complete, realistic construction project schedule.
{historical_context}

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - no markdown, no explanations, no extra text
2. Use this EXACT structure:
{{
  "project_name": "string",
  "start_date": "YYYY-MM-DD",
  "tasks": [
    {{
      "name": "Task name",
      "outline_number": "1.1",
      "outline_level": 1,
      "duration_days": 10,
      "milestone": false,
      "summary": false,
      "predecessors": ["1.0"]
    }}
  ]
}}

3. Create a hierarchical task structure:
   - Level 0: Project root (outline "0", summary=true)
   - Level 1: Major phases (outline "1", "2", "3", summary=true)
   - Level 2: Sub-phases (outline "1.1", "1.2", summary=true)
   - Level 3: Actual tasks (outline "1.1.1", "1.1.2", summary=false)

4. Include realistic construction phases:
   - Pre-Construction (permits, site prep)
   - Foundation & Sitework
   - Structure/Framing
   - MEP (Mechanical, Electrical, Plumbing)
   - Interior Finishes
   - Exterior Finishes
   - Final Inspections & Closeout

5. Set realistic durations (in days):
   - Small tasks: 1-5 days
   - Medium tasks: 5-15 days
   - Large tasks: 15-30 days
   - Phases: sum of subtasks

6. Add logical dependencies using outline numbers:
   - Foundation before framing
   - Rough-in before finishes
   - Inspections after work completion

7. Mark milestones (milestone=true, duration_days=0):
   - Permit approval
   - Foundation complete
   - Building dried-in
   - Certificate of Occupancy

8. Summary tasks (summary=true) should have duration_days = 0 (calculated from children)

RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT"""

        prompt = f"""Generate a construction project schedule for:

Project Type: {project_type}
Description: {description}

Create a complete project with:
- 30-50 tasks organized in a hierarchy
- Realistic durations based on construction industry standards
- Logical dependencies between tasks
- Key milestones
- Proper outline numbering (0, 1, 1.1, 1.1.1, etc.)

Remember: Return ONLY the JSON object, nothing else."""

        try:
            response = await self._generate(prompt, system_prompt)

            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1

            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)

                # Validate and transform the result
                tasks = result.get("tasks", [])
                if not tasks:
                    raise ValueError("No tasks generated")

                # Transform tasks to MS Project format
                formatted_tasks = []
                for task in tasks:
                    # Skip invalid tasks
                    if not isinstance(task, dict):
                        print(f"Skipping invalid task (not a dict): {task}")
                        continue

                    # Convert predecessors from outline numbers to proper format
                    predecessors = []
                    pred_list = task.get("predecessors", [])
                    if isinstance(pred_list, list):
                        for pred_outline in pred_list:
                            if pred_outline and pred_outline != "0":
                                predecessors.append({
                                    "outline_number": str(pred_outline),
                                    "type": 1,  # Finish-to-Start
                                    "lag": 0,
                                    "lag_format": 7  # Days
                                })

                    # Convert duration to ISO 8601 format
                    duration_days = task.get("duration_days", 1)
                    # Ensure duration_days is a number
                    try:
                        duration_days = float(duration_days) if duration_days else 1
                    except (ValueError, TypeError):
                        print(f"Invalid duration_days for task {task.get('name')}: {duration_days}, using 1")
                        duration_days = 1
                    duration_hours = int(duration_days * 8)  # 8-hour workday
                    duration_iso = f"PT{duration_hours}H0M0S"

                    formatted_task = {
                        "name": task.get("name", "Unnamed Task"),
                        "outline_number": task.get("outline_number", "1"),
                        "outline_level": task.get("outline_level", 1),
                        "duration": duration_iso,
                        "milestone": task.get("milestone", False),
                        "summary": task.get("summary", False),
                        "percent_complete": 0,
                        "value": "",
                        "predecessors": predecessors
                    }
                    formatted_tasks.append(formatted_task)

                # Ensure there's a project summary task (outline "0") with correct name
                project_name = result.get("project_name", "Generated Project")
                root_task_index = None
                for i, t in enumerate(formatted_tasks):
                    if t.get("outline_number") == "0":
                        root_task_index = i
                        break

                if root_task_index is not None:
                    # Update existing root task to have project name
                    formatted_tasks[root_task_index]["name"] = project_name
                    formatted_tasks[root_task_index]["summary"] = True
                    formatted_tasks[root_task_index]["outline_level"] = 0
                    formatted_tasks[root_task_index]["duration"] = "PT0H0M0S"
                else:
                    # Create new root task
                    root_task = {
                        "name": project_name,
                        "outline_number": "0",
                        "outline_level": 0,
                        "duration": "PT0H0M0S",
                        "milestone": False,
                        "summary": True,
                        "percent_complete": 0,
                        "value": "",
                        "predecessors": []
                    }
                    # Insert at the beginning
                    formatted_tasks.insert(0, root_task)

                return {
                    "success": True,
                    "project_name": result.get("project_name", "Generated Project"),
                    "start_date": result.get("start_date", "2024-01-01"),
                    "tasks": formatted_tasks
                }
            else:
                raise ValueError("No valid JSON found in response")

        except Exception as e:
            print(f"Project generation error: {e}")
            print(f"Response: {response[:500] if 'response' in locals() else 'No response'}")

            # Return a minimal fallback project
            return {
                "success": False,
                "error": str(e),
                "project_name": "Fallback Project",
                "start_date": "2024-01-01",
                "tasks": self._get_fallback_project_tasks()
            }

    def _get_fallback_project_tasks(self) -> List[Dict]:
        """Return a minimal fallback project structure"""
        return [
            {
                "name": "Construction Project",
                "outline_number": "0",
                "outline_level": 0,
                "duration": "PT0H0M0S",
                "milestone": False,
                "summary": True,
                "percent_complete": 0,
                "value": "",
                "predecessors": []
            },
            {
                "name": "Pre-Construction",
                "outline_number": "1",
                "outline_level": 1,
                "duration": "PT80H0M0S",
                "milestone": False,
                "summary": False,
                "percent_complete": 0,
                "value": "",
                "predecessors": []
            },
            {
                "name": "Foundation",
                "outline_number": "2",
                "outline_level": 1,
                "duration": "PT120H0M0S",
                "milestone": False,
                "summary": False,
                "percent_complete": 0,
                "value": "",
                "predecessors": [{"outline_number": "1", "type": 1, "lag": 0, "lag_format": 7}]
            },
            {
                "name": "Framing",
                "outline_number": "3",
                "outline_level": 1,
                "duration": "PT160H0M0S",
                "milestone": False,
                "summary": False,
                "percent_complete": 0,
                "value": "",
                "predecessors": [{"outline_number": "2", "type": 1, "lag": 0, "lag_format": 7}]
            }
        ]


# Singleton instance
ai_service = LocalAIService()

