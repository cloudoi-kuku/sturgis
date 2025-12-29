"""
Calendar Service for Project Configuration Tool
Provides calendar-aware date calculations for scheduling
"""
from datetime import datetime, timedelta
from typing import List, Set, Optional, Dict, Any
import math


class CalendarService:
    """
    Calendar service for working day calculations.
    Handles work weeks, holidays, and working day overrides.
    """

    def __init__(self, work_week: List[int] = None, hours_per_day: int = 8, exceptions: List[Dict] = None):
        """
        Initialize calendar service.

        Args:
            work_week: List of working days (1=Monday, 7=Sunday). Default: [1,2,3,4,5] (Mon-Fri)
            hours_per_day: Working hours per day. Default: 8
            exceptions: List of exception dicts with 'exception_date', 'name', 'is_working'
        """
        self.work_week: Set[int] = set(work_week or [1, 2, 3, 4, 5])
        self.hours_per_day = hours_per_day

        # Parse exceptions into holidays and working day overrides
        self.holidays: Set[str] = set()
        self.extra_workdays: Set[str] = set()

        if exceptions:
            for exc in exceptions:
                date_str = exc.get('exception_date', '')
                if exc.get('is_working', False):
                    self.extra_workdays.add(date_str)
                else:
                    self.holidays.add(date_str)

    @classmethod
    def from_calendar_config(cls, calendar_config: Dict[str, Any]) -> 'CalendarService':
        """Create a CalendarService from a calendar configuration dict"""
        return cls(
            work_week=calendar_config.get('work_week', [1, 2, 3, 4, 5]),
            hours_per_day=calendar_config.get('hours_per_day', 8),
            exceptions=calendar_config.get('exceptions', [])
        )

    def is_working_day(self, date: datetime) -> bool:
        """
        Check if a given date is a working day.

        Args:
            date: The date to check

        Returns:
            True if it's a working day, False otherwise
        """
        date_str = date.strftime('%Y-%m-%d')

        # Check if it's a holiday (non-working exception)
        if date_str in self.holidays:
            return False

        # Check if it's a working day override (e.g., Saturday made a working day)
        if date_str in self.extra_workdays:
            return True

        # Check if it falls on a working day of the week
        # isoweekday(): Monday=1, Sunday=7
        return date.isoweekday() in self.work_week

    def get_next_working_day(self, date: datetime) -> datetime:
        """
        Get the next working day from a given date.
        If the date itself is a working day, returns it.

        Args:
            date: The starting date

        Returns:
            The next working day
        """
        current = date
        max_iterations = 365  # Safety limit

        for _ in range(max_iterations):
            if self.is_working_day(current):
                return current
            current += timedelta(days=1)

        # Fallback (should never reach here)
        return date

    def get_previous_working_day(self, date: datetime) -> datetime:
        """
        Get the previous working day from a given date.
        If the date itself is a working day, returns it.

        Args:
            date: The starting date

        Returns:
            The previous working day
        """
        current = date
        max_iterations = 365  # Safety limit

        for _ in range(max_iterations):
            if self.is_working_day(current):
                return current
            current -= timedelta(days=1)

        # Fallback (should never reach here)
        return date

    def add_working_days(self, start_date: datetime, working_days: float) -> datetime:
        """
        Add a number of working days to a start date.
        Handles fractional days.

        Args:
            start_date: The starting date
            working_days: Number of working days to add (can be fractional)

        Returns:
            The resulting date after adding working days
        """
        if working_days == 0:
            return start_date

        # Ensure we start on a working day
        current = self.get_next_working_day(start_date)

        # Handle negative working days
        if working_days < 0:
            return self.subtract_working_days(start_date, abs(working_days))

        # Separate whole days and fractional part
        whole_days = int(working_days)
        fraction = working_days - whole_days

        # Add whole working days
        days_added = 0
        max_iterations = whole_days * 3 + 365  # Safety limit

        for _ in range(max_iterations):
            if days_added >= whole_days:
                break
            current += timedelta(days=1)
            if self.is_working_day(current):
                days_added += 1

        # Handle fractional day
        # For scheduling purposes, we round to the next working day if fraction > 0
        # This keeps task end dates on working days
        if fraction > 0:
            # Move to next working day for the fractional part
            current += timedelta(days=1)
            while not self.is_working_day(current):
                current += timedelta(days=1)

        return current

    def subtract_working_days(self, start_date: datetime, working_days: float) -> datetime:
        """
        Subtract a number of working days from a start date.

        Args:
            start_date: The starting date
            working_days: Number of working days to subtract

        Returns:
            The resulting date after subtracting working days
        """
        if working_days == 0:
            return start_date

        current = self.get_previous_working_day(start_date)
        whole_days = int(working_days)

        days_subtracted = 0
        max_iterations = whole_days * 3 + 365

        for _ in range(max_iterations):
            if days_subtracted >= whole_days:
                break
            current -= timedelta(days=1)
            if self.is_working_day(current):
                days_subtracted += 1

        return current

    def get_working_days_between(self, start_date: datetime, end_date: datetime) -> float:
        """
        Count the number of working days between two dates.

        Args:
            start_date: The start date (inclusive)
            end_date: The end date (exclusive)

        Returns:
            Number of working days
        """
        if end_date <= start_date:
            return 0.0

        count = 0
        current = start_date
        max_iterations = (end_date - start_date).days + 1

        for _ in range(max_iterations):
            if current >= end_date:
                break
            if self.is_working_day(current):
                count += 1
            current += timedelta(days=1)

        return float(count)

    def get_calendar_days_for_working_days(self, working_days: float, start_date: datetime = None) -> int:
        """
        Calculate how many calendar days are needed for N working days.

        Args:
            working_days: Number of working days
            start_date: Optional start date for context (affects holiday calculation)

        Returns:
            Number of calendar days
        """
        if working_days <= 0:
            return 0

        start = start_date or datetime.now()
        end = self.add_working_days(start, working_days)
        return (end - start).days

    def hours_to_days(self, hours: float) -> float:
        """Convert hours to working days"""
        return hours / self.hours_per_day

    def days_to_hours(self, days: float) -> float:
        """Convert working days to hours"""
        return days * self.hours_per_day

    def get_working_days_in_range(self, start_date: datetime, end_date: datetime) -> List[datetime]:
        """
        Get a list of all working days in a date range.

        Args:
            start_date: Start of range (inclusive)
            end_date: End of range (inclusive)

        Returns:
            List of working day dates
        """
        working_days = []
        current = start_date

        while current <= end_date:
            if self.is_working_day(current):
                working_days.append(current)
            current += timedelta(days=1)

        return working_days

    def get_holidays_in_range(self, start_date: datetime, end_date: datetime) -> List[Dict[str, str]]:
        """
        Get holidays that fall within a date range.

        Args:
            start_date: Start of range
            end_date: End of range

        Returns:
            List of holiday dicts with 'date' and 'name' (name not available, returns date)
        """
        holidays_in_range = []

        for holiday_str in self.holidays:
            try:
                holiday_date = datetime.strptime(holiday_str, '%Y-%m-%d')
                if start_date <= holiday_date <= end_date:
                    holidays_in_range.append({
                        'date': holiday_str,
                        'name': ''  # Name not stored in set, would need to be looked up
                    })
            except ValueError:
                continue

        return sorted(holidays_in_range, key=lambda x: x['date'])


def create_default_calendar() -> CalendarService:
    """Create a default calendar service (Mon-Fri, 8 hours/day, no holidays)"""
    return CalendarService(
        work_week=[1, 2, 3, 4, 5],
        hours_per_day=8,
        exceptions=[]
    )
