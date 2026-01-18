# System Architecture

## Design Philosophy
The application follows a **Modular Monolith** pattern in Vanilla JavaScript. It runs entirely client-side, using the browser's `localStorage` for persistence. This ensures zero operational cost and maximum privacy (no data leaves the device).

## Modules

### 1. `ui.js`: Presentation Layer
*   **Responsibilities**:
    *   DOM manipulation and event handling.
    *   Rendering the Schedule Table (`renderResults`).
    *   Rendering the People List (`renderPeople`).
    *   Modal Management (Person Config, Staffing, Calendar).
*   **Key Functions**:
    *   `renderResults(unassignedCount)`: Dynamic generation of the main calendar grid.
    *   `saveEditPerson()`: Validates and persists user changes.
    *   `openModal()` / `closeModal()`: Controls UI overlays.

### 2. `algorithm.js`: Logic Layer
*   **Responsibilities**:
    *   Generating the schedule (`runSimulation`).
    *   Validating assignments (`isValidAssignment`, `checkConsecutive`).
    *   Optimizing gaps (`fillGaps`).
    *   Reporting errors (`validateSchedule`).
*   **Key Concepts**:
    *   **Day Objects**: The schedule is an array of `Day` objects, each containing a `seats` array.
    *   **Strict Validation**: Boolean enforcement for critical rules like `doublets`.
    *   **Locked Slots**: Mechanism to protect manual assignments from automated overwrites.

### 3. `main.js`: Controller Layer
*   **Responsibilities**:
    *   Application initialization (`window.onload`).
    *   Orchestrating the generation process (`startGeneration`).
    *   Handling Global State (`window.appData`).
    *   Export/Import functionality (PDF, JSON).
*   **Data Sanitization**:
    *   Ensures legacy data types (e.g., string booleans) are converted before processing.

## Data Structures

### `window.appData`
The central state object, persisted to `localStorage`.
```json
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "defaultSlots": 1,
  "people": [
    {
      "id": "uuid",
      "name": "Name",
      "min": 0,
      "max": 5,
      "doublets": true, // User accepts Day-Gap-Day pattern
      "blocked": ["YYYY-MM-DD"],
      "suggested": ["YYYY-MM-DD"]
    }
  ],
  "schedule": [
    {
      "date": "YYYY-MM-DD",
      "type": "WEEKDAY|WEEKEND|HOLIDAY",
      "seats": [
        { "pid": "uuid", "name": "Name", "locked": false }
      ]
    }
  ],
  "history": { ... } // Historical accounting data
}
```
