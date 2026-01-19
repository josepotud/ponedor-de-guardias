# User Guide

## Getting Started
1.  **Launch**: Open `index.html`.
2.  **Date Range**: Select the Start and End date for your schedule.
3.  **Holidays**: Click "Festivos" to mark official holidays for the period.

## Managing People
### Adding a Person
1.  Type the **name** in the "2. Personal" box.
2.  Press **Enter** or click "Añadir".
3.  The person appears in the list with a summary of their constraints:
    *   **Min/Max**: Quotas.
    *   **Bloqueos**: Count of days they have marked as "Unavailable".
    *   **Pref**: Count of days they have marked as "Preferred".
4.  The **Calendar Settings** for that person will open immediately.

### Configuring Preferences
*   **Min/Max**: Set the monthly quota.
*   **Accepts Doublets**:
    *   **CHECKED**: Can work alternating days (e.g., Monday + Wednesday).
    *   **UNCHECKED**: Cannot work alternating days (needs 2 days gap).
*   **Blocking Days (Red)**: Click dates in the personal calendar to mark them as "No Disponibles" (Unavailable).
*   **Requesting Days (Green)**: Click dates again to mark them as "Solicitados" (Preferred).

## Generating the Schedule
1.  Click **"Generar Todo"**.
2.  Wait for the progress bar.
3.  Review the result.

## Changing Dates (Dynamic Updates)
If you need to extend or shorten the schedule:
1.  Change the **Start Date** or **End Date** inputs.
2.  If you have existing assignments, the system will ask:
    *   **Mantener (Coincidencias)**: Keeps assignments that fall within the new range. Useful for extending a month.
    *   **Borrar Todo**: Resets the calendar to empty slots.
    *   **Cancelar**: Reverts the date change.

## Manual Adjustments
*   **Assign**: Click on any empty slot or existing name. Select a person from the list. The "Unassigned Slots" alert updates immediately.
*   **Clear (Trash)**: Click the "Trash" icon.
    *   The slot becomes empty.
    *   **Auto-Block**: The day is automatically added to that person's "Blocked" list to prevent re-assignment.
*   **Locked Slots**: Manually assigned slots are **LOCKED** (Padlock icon). If you run "Rellenar Huecos" later, these slots will NOT be moved.

## Auditing & Exporting
*   **Validation**: Look for Red Warning boxes.
    *   *Consecutivo*: Forbidden consecutive days.
    *   *Doblete*: Forbidden alternating days (if not allowed).
*   **PDF**: Click "Descargar PDF" / "Guardar PDF".
    *   The PDF is formatted with **One Month per Page**.
    *   Includes a financial summary on the last page.
