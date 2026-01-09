"""
LLM-based Command Parser using Azure OpenAI
Alternative to regex-based parsing for natural language understanding

This module provides intelligent command parsing that understands:
- Natural language variations ("make task 1.2 take 5 days")
- Context-aware task matching ("the foundation task")
- Multi-step commands in one message
- Typos and informal phrasing

Uses your existing Azure OpenAI setup (GPT-4o-mini or GPT-4o)
Toggle via environment variable: USE_LLM_PARSER=true
"""

import os
import json
import httpx
from typing import Dict, Optional, List, Any


class LLMCommandParser:
    """
    LLM-based command parser using Azure OpenAI
    Provides intelligent natural language understanding for project commands
    """

    def __init__(self):
        # Azure OpenAI configuration (same as ai_service.py)
        self.azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
        self.azure_api_key = os.getenv("AZURE_OPENAI_API_KEY", "")
        self.azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
        self.azure_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

        # Feature toggle
        self.enabled = os.getenv("USE_LLM_PARSER", "false").lower() == "true"

        # Model info for status endpoint
        self.model = self.azure_deployment if self.enabled else None

        if self.enabled and self.azure_endpoint and self.azure_api_key:
            print(f"LLM Parser: Enabled using Azure OpenAI ({self.azure_deployment})")
        elif self.enabled:
            print("LLM Parser: Enabled but Azure OpenAI not configured, will fallback to regex")
            self.enabled = False
        else:
            print("LLM Parser: Disabled (set USE_LLM_PARSER=true to enable)")

    def is_available(self) -> bool:
        """Check if LLM parser is available and configured"""
        return self.enabled and bool(self.azure_endpoint and self.azure_api_key)

    async def parse_command(self, user_message: str, project_context: Optional[Dict] = None) -> Optional[Dict]:
        """
        Parse a natural language command using Azure OpenAI

        Args:
            user_message: The user's natural language input
            project_context: Optional project data for context-aware parsing

        Returns:
            Parsed command dict or None if not a command
        """
        if not self.is_available():
            return None

        # Build context about available tasks if project provided
        task_context = ""
        if project_context and project_context.get("tasks"):
            tasks = project_context["tasks"]
            task_list = []
            for t in tasks[:50]:  # Limit to 50 tasks for context
                task_list.append(f"  - {t.get('outline_number')}: {t.get('name')} (duration: {t.get('duration', 'N/A')}, summary: {t.get('summary', False)})")
            task_context = f"""
Current project tasks:
{chr(10).join(task_list)}
"""

        system_prompt = f"""You are a command parser for a construction project management system.
Your job is to extract structured commands from natural language input.

{task_context}

IMPORTANT: You must respond with ONLY a JSON object, no other text.

If the user message is a command (action to modify the project), extract it into this JSON format:
{{
    "is_command": true,
    "action": "<action_type>",
    "parameters": {{...action-specific parameters...}},
    "confidence": <0.0-1.0>,
    "interpretation": "<brief explanation of what you understood>"
}}

If the message is NOT a command (just a question or chat), respond with:
{{
    "is_command": false,
    "reason": "<why this is not a command>"
}}

SUPPORTED ACTIONS AND THEIR PARAMETERS:

1. "set_duration" - Change task duration to a specific value
   Parameters: {{"task_id": "<outline_number>", "duration_days": <number>}}
   Examples: "set task 1.2 to 5 days", "make the foundation take a week", "task 2.3 should be 10 days"

2. "extend_duration" - Add days to current task duration (relative change)
   Parameters: {{"task_id": "<outline_number>", "days_to_add": <number>}}
   Examples: "extend task 2.3 by 3 days", "add 5 days to the framing task", "increase 1.4 by 2 days"

3. "reduce_duration" - Subtract days from current task duration (relative change)
   Parameters: {{"task_id": "<outline_number>", "days_to_subtract": <number>}}
   Examples: "shorten task 2.3 by 2 days", "reduce 1.4 by 3 days", "cut framing by 5 days"

4. "set_lag" - Set dependency lag
   Parameters: {{"task_id": "<outline_number>", "lag_days": <number>}}
   Examples: "add 3 days lag to task 2.1", "put a gap before concrete pouring"

5. "remove_lag" - Remove lag from task
   Parameters: {{"task_id": "<outline_number>"}}
   Examples: "remove lag from 1.3", "clear the delay on framing"

6. "set_start_date" - Change project start date
   Parameters: {{"date": "<YYYY-MM-DD>"}}
   Examples: "start the project on 2024-03-01", "project begins March 1st 2024"

7. "set_project_duration" - Set target project duration
   Parameters: {{"duration_days": <number>}}
   Examples: "project should be 90 days", "compress to 3 months"

8. "add_buffer" - Add percentage buffer to all tasks
   Parameters: {{"buffer_percent": <number>}}
   Examples: "add 15% buffer", "increase all tasks by 20%"

9. "set_constraint" - Set task constraint
   Parameters: {{"task_id": "<outline_number>", "constraint_type": "<type>", "constraint_date": "<YYYY-MM-DD or null>"}}
   Constraint types: "asap", "alap", "must_start_on", "must_finish_on", "start_no_earlier_than", "start_no_later_than", "finish_no_earlier_than", "finish_no_later_than"
   Examples: "task 1.2 must start on 2024-02-15", "make 2.3 as late as possible"

10. "make_milestone" - Convert task to milestone
    Parameters: {{"task_id": "<outline_number>"}}
    Examples: "make task 3.1 a milestone", "1.5 is a milestone"

11. "remove_milestone" - Convert milestone back to regular task
    Parameters: {{"task_id": "<outline_number>"}}
    Examples: "task 2.1 is not a milestone anymore"

12. "fix_validation" - Fix all validation issues
    Parameters: {{}}
    Examples: "fix all issues", "repair the project", "clean up validation errors"

13. "fix_dependencies" - Fix broken dependencies
    Parameters: {{}}
    Examples: "fix dependencies", "repair broken predecessors"

14. "fix_milestones" - Fix milestone durations
    Parameters: {{}}
    Examples: "fix milestones", "set all milestones to zero duration"

15. "organize_project" - Intelligently organize/restructure the project
    Parameters: {{}}
    Examples: "organize the project", "create WBS structure", "group tasks into phases"

16. "remove_predecessors" - Remove all predecessors from a task
    Parameters: {{"task_id": "<outline_number>"}}
    Examples: "remove predecessors from task 1.2", "clear dependencies on 2.3"

17. "move_task" - Move a task to a new position
    Parameters: {{"task_id": "<outline_number>", "target_id": "<outline_number>", "position": "under|before|after"}}
    Examples: "move task 1.2 under 2", "put 3.1 after 2.5"

18. "insert_task" - Insert a new task
    Parameters: {{"task_name": "<name>", "reference_id": "<outline_number>", "position": "before|after|under"}}
    Examples: "insert task 'Site Survey' after 1.1", "add 'Inspection' before 2.3"

19. "delete_task" - Delete a task
    Parameters: {{"task_id": "<outline_number>"}}
    Examples: "delete task 1.4", "remove 2.3"

20. "merge_tasks" - Merge two tasks
    Parameters: {{"task_id_1": "<outline_number>", "task_id_2": "<outline_number>"}}
    Examples: "merge tasks 1.2 and 1.3", "combine 2.1 with 2.2"

21. "split_task" - Split a task into multiple parts
    Parameters: {{"task_id": "<outline_number>", "parts": <number>}}
    Examples: "split task 1.2 into 3 parts"

22. "scale_durations" - Scale all task durations
    Parameters: {{"scale_factor": <number>}}
    Examples: "double all durations", "reduce all tasks by half"

TASK MATCHING RULES:
- If user says "task 1.2" or just "1.2", use that as task_id
- If user refers to task by name ("the foundation task"), find the matching outline_number from the task list
- If user says "all tasks" or "every task", this might be a bulk operation
- IMPORTANT: For "extend by X days" or "add X days", use extend_duration action with days_to_add
- IMPORTANT: For "shorten by X days" or "reduce by X days", use reduce_duration action with days_to_subtract

CONFIDENCE SCORING:
- 1.0: Exact match to expected phrasing
- 0.8-0.9: Clear intent, slight variation in phrasing
- 0.6-0.7: Probable intent, some ambiguity
- Below 0.6: Uncertain, might need clarification

Remember: ONLY output valid JSON, nothing else."""

        try:
            # Build Azure OpenAI URL
            endpoint = self.azure_endpoint.rstrip('/')
            url = f"{endpoint}/openai/deployments/{self.azure_deployment}/chat/completions?api-version={self.azure_api_version}"

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    headers={
                        "Content-Type": "application/json",
                        "api-key": self.azure_api_key,
                    },
                    json={
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_message}
                        ],
                        "temperature": 0.3,
                        "max_tokens": 1024,
                    }
                )
                response.raise_for_status()
                result = response.json()

                # Extract the text content
                content = result["choices"][0]["message"]["content"]
                print(f"[LLM Parser] Raw response: {content[:200]}...")

                # Parse JSON from response (handle markdown code blocks)
                json_content = content.strip()
                if json_content.startswith("```"):
                    # Remove markdown code block
                    lines = json_content.split("\n")
                    json_content = "\n".join(lines[1:-1])

                parsed = json.loads(json_content)

                if parsed.get("is_command"):
                    print(f"[LLM Parser] Detected command: {parsed.get('action')} with confidence {parsed.get('confidence', 'N/A')}")
                    return self._convert_to_internal_format(parsed)
                else:
                    print(f"[LLM Parser] Not a command: {parsed.get('reason', 'unknown')}")
                    return None

        except httpx.HTTPStatusError as e:
            print(f"[LLM Parser] API error: {e.response.status_code} - {e.response.text}")
            return None
        except json.JSONDecodeError as e:
            print(f"[LLM Parser] JSON parse error: {e}")
            return None
        except Exception as e:
            print(f"[LLM Parser] Error: {str(e)}")
            return None

    def _convert_to_internal_format(self, parsed: Dict) -> Optional[Dict]:
        """
        Convert LLM parsed output to the internal command format
        expected by ai_command_handler.execute_command()

        The ai_command_handler expects format:
        {
            "action": "action_name",
            "params": { ...action-specific params... }
        }
        """
        action = parsed.get("action")
        llm_params = parsed.get("parameters", {})
        confidence = parsed.get("confidence", 0.5)

        # Only process if confidence is reasonable
        if confidence < 0.5:
            print(f"[LLM Parser] Low confidence ({confidence}), skipping")
            return None

        # Map LLM actions to internal action format
        action_mapping = {
            "set_duration": "set_duration",
            "extend_duration": "extend_duration",
            "reduce_duration": "reduce_duration",
            "set_lag": "set_lag",
            "remove_lag": "remove_lag",
            "set_start_date": "set_start_date",
            "set_project_duration": "set_project_duration",
            "add_buffer": "add_buffer",
            "set_constraint": "set_constraint",
            "make_milestone": "make_milestone",
            "remove_milestone": "remove_milestone",
            "fix_validation": "fix_validation",
            "fix_dependencies": "fix_dependencies",
            "fix_milestones": "fix_milestones",
            "organize_project": "organize_project",
            "remove_predecessors": "remove_predecessors",
            "move_task": "move_task",
            "insert_task": "insert_task",
            "delete_task": "delete_task",
            "merge_tasks": "merge_tasks",
            "split_task": "split_task",
            "scale_durations": "scale_durations",
        }

        internal_action = action_mapping.get(action)
        if not internal_action:
            print(f"[LLM Parser] Unknown action: {action}")
            return None

        # Build internal command format matching ai_command_handler expectations
        # IMPORTANT: Must use "params" dict with correct parameter names
        command = {
            "action": internal_action,
            "params": {},  # Will be filled based on action type
            "_llm_metadata": {
                "source": "llm_parser",
                "confidence": confidence,
                "interpretation": parsed.get("interpretation", "")
            }
        }

        # Map parameters based on action type
        # Parameter names must match what ai_command_handler.execute_command() expects
        if internal_action == "set_duration":
            command["params"] = {
                "task_outline": llm_params.get("task_id"),  # Note: task_outline not task_id
                "duration_days": llm_params.get("duration_days")
            }

        elif internal_action == "extend_duration":
            command["params"] = {
                "task_outline": llm_params.get("task_id"),
                "days_to_add": llm_params.get("days_to_add")
            }

        elif internal_action == "reduce_duration":
            command["params"] = {
                "task_outline": llm_params.get("task_id"),
                "days_to_subtract": llm_params.get("days_to_subtract")
            }

        elif internal_action == "set_lag":
            command["params"] = {
                "task_outline": llm_params.get("task_id"),
                "lag_days": llm_params.get("lag_days")
            }

        elif internal_action == "remove_lag":
            command["params"] = {
                "task_outline": llm_params.get("task_id")
            }

        elif internal_action == "set_start_date":
            command["params"] = {
                "date": llm_params.get("date")
            }

        elif internal_action == "set_project_duration":
            command["params"] = {
                "duration_days": llm_params.get("duration_days")
            }

        elif internal_action == "add_buffer":
            command["params"] = {
                "buffer_percent": llm_params.get("buffer_percent")
            }

        elif internal_action == "set_constraint":
            command["params"] = {
                "task_outline": llm_params.get("task_id"),
                "constraint_type": self._map_constraint_type(llm_params.get("constraint_type")),
                "constraint_date": llm_params.get("constraint_date")
            }

        elif internal_action == "make_milestone":
            command["params"] = {
                "task_outline": llm_params.get("task_id")
            }

        elif internal_action == "remove_milestone":
            command["params"] = {
                "task_outline": llm_params.get("task_id")
            }

        elif internal_action == "remove_predecessors":
            command["params"] = {
                "task_outline": llm_params.get("task_id")
            }

        elif internal_action == "delete_task":
            command["params"] = {
                "task_outline": llm_params.get("task_id")
            }

        elif internal_action == "move_task":
            command["params"] = {
                "task_outline": llm_params.get("task_id"),
                "target_outline": llm_params.get("target_id"),
                "position": llm_params.get("position", "after")
            }

        elif internal_action == "insert_task":
            command["params"] = {
                "task_name": llm_params.get("task_name"),
                "reference_outline": llm_params.get("reference_id"),
                "position": llm_params.get("position", "after")
            }

        elif internal_action == "merge_tasks":
            command["params"] = {
                "task_outline_1": llm_params.get("task_id_1"),
                "task_outline_2": llm_params.get("task_id_2")
            }

        elif internal_action == "split_task":
            command["params"] = {
                "task_outline": llm_params.get("task_id"),
                "parts": llm_params.get("parts", 2)
            }

        elif internal_action == "scale_durations":
            command["params"] = {
                "scale_factor": llm_params.get("scale_factor", 1.0)
            }

        elif internal_action in ["fix_validation", "fix_dependencies", "fix_milestones", "organize_project"]:
            # These actions don't need parameters
            command["params"] = {}

        return command

    def _map_constraint_type(self, constraint_str: Optional[str]) -> int:
        """Map constraint string to MS Project constraint type number"""
        if not constraint_str:
            return 0

        constraint_map = {
            "asap": 0,
            "as_soon_as_possible": 0,
            "alap": 1,
            "as_late_as_possible": 1,
            "must_start_on": 2,
            "mso": 2,
            "must_finish_on": 3,
            "mfo": 3,
            "start_no_earlier_than": 4,
            "snet": 4,
            "start_no_later_than": 5,
            "snlt": 5,
            "finish_no_earlier_than": 6,
            "fnet": 6,
            "finish_no_later_than": 7,
            "fnlt": 7,
        }

        return constraint_map.get(constraint_str.lower().replace(" ", "_"), 0)


# Singleton instance
llm_parser = LLMCommandParser()
