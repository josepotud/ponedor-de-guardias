# Scheduling Algorithm Logic

The core engine (`js/algorithm.js`) uses a multi-pass weighted priority system to generate fair and compliant schedules.

## 1. Boolean Constraints (Hard Rules)
Before assigning any person to a slot, the system runs strict boolean checks. If any check fails, the assignment is strictly forbidden.

### A. Blocked Days
*   Checks `p.blocked` array.
*   Enforces `manualBans` (created dynamically during generation).

### B. Consecutive Days (Strict Ban)
*   **Rule**: A person cannot work on `Day N` if they worked on `Day N-1` or `Day N+1`.
*   **Implementation**: `checkConsecutive` function checks neighbors.
*   **Scope**: Universal. Applies to all users.

### C. Doublets (Alternating Shifts)
*   **Definition**: A "Doublet" is a Day-Gap-Day pattern (e.g., Working Monday AND Wednesday).
*   **Constraint**:
    *   If `p.doublets === true`: Allowed.
    *   If `p.doublets === false`: Forbidden. The person cannot work `N+2` or `N-2` if they work `N`.
*   **Correction**: Previous versions treated this loosely. Current version strictly enforces `=== true`.

## 2. Priority Scoring (Soft Rules)
Candidates who pass the Hard Rules are ranked by a numerical score. The highest score gets the slot.

### Scoring Factors
1.  **High Priority Days (Holidays/Weekends)**:
    *   **History**: Users with FEWER past holidays/weekends get a massive boost.
    *   **Doublet Bonus**: Users who accept doublets AND have a holiday assignment get a bonus to encourage clustering (if safe), freeing up other weekends.
2.  **Fridays**:
    *   Balanced separately from standard weekdays to ensure fair distribution of "long weekends".
3.  **Thursdays (Penalty)**:
    *   **Rule**: "If assigned Thursday, reduce probability of Sat/Sun".
    *   **Implementation**: If user works Thursday, they receive a **Penalty** (Score increase) for Saturday or Sunday slots in the same week.

4.  **Friday-Sunday Pairing (Bonus)**:
    *   **Rule**: "If user accepts Doublets and works Friday, prioritize Sunday".
    *   **Implementation**: If `p.doublets === true` and user is assigned Friday, they receive a **Bonus** (Score reduction) for Sunday. This encourages the "Weekend Doublet" pattern (Fri + Sun).

5.  **Global Load**:
    *   Users with total shifts below their average get a boost to catch up.
6.  **Quotas**:
    *   Users below their `Min` shifts get a massive boost.
    *   Users above their `Max` shifts are disqualified (Hard Rule).

## 3. Gap Filling & "Fill Gaps" Strategy
The system runs in multiple passes. If gaps remain after the initial pass:

1.  **Direct Fill**: Try to find *any* valid candidate who was skipped previously.
2.  **Swap Maneuver** (Optimization):
    *   If Slot S is empty, try to move Person P from Day N-1 or N+1 to Slot S *if* it resolves the gap.
    *   **Protection**: The swap logic checks `seat.locked`. If a seat was manually assigned or fixed, it **cannot** be moved.

### "Rellenar Huecos" (Fill Gaps) Mode
When running in this mode (`startGeneration(true)`):
1.  **Preservation**: All existing assignments in the schedule are fed into the algorithm as `fixedSlots`.
2.  **Locking Distinction**:
    *   Slots that were **Manually Assigned** (by clicking) retain their `locked: true` status (visible padlock).
    *   Slots that were previously generated are preserved but treated as `locked: false` visually (though effectively fixed for this run).
3.  **New Assignments**: The algorithm only fills the remaining empty slots (`unassigned`).

## 4. Manual Intervention Logic
*   **Manual Assignment**: Clicking an empty slot assigns a user and sets `locked: true`. This slot is immune to the algorithm.
*   **Deletion (Trash)**: Deleting a manual assignment:
    1.  Clears the slot (`pid: null`).
    2.  **Unlocks** the slot (`locked: false`).
    3.  **Blocks** the user (`p.blocked.push(date)`) to prevent auto-reassignment to the same day.

## 5. Validation
After generation, `validateSchedule` runs a final integrity check:
*   Reports "Consecutivo no permitido" for any N+1 violation.
*   Reports "Doblete no permitido" for any N+2 violation (if user didn't accept doublets).
*   Reports "Triplete" for N+N+1+N+2 patterns.
