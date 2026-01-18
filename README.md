# Ponedor de Guardias

Automated Scheduling System for Healthcare Professionals.

## Overview
**Ponedor de Guardias** is a robust web-based tool designed to automate and optimize the scheduling of on-call shifts ("guardias"). It balances workload, respects individual preferences (blocked days, max shifts), and enforces strict rules regarding consecutive work days and rest periods.

## Features
*   **Automated Generation**: Creates a full monthly schedule in seconds using a weighted priority algorithm.
*   **Rules Engine**:
    *   **Consecutive Ban**: Strictly forbids working two days in a row (e.g., Monday and Tuesday).
    *   **Doublet Management**: Controls "Day-Gap-Day" patterns based on user preference ("Accepts Doublets").
    *   **Quotas**: Enforces Minimum and Maximum shifts per person.
*   **User Management**:
    *   **Smart History**: Imports CSV/JSON history, deduplicates overlaps, and handles "Deleted" (Baja) users correctly.
    *   **Detailed Stats (Spyglass)**: Inspect specific assignment dates per person (aggregated by month).
    *   **Manual Control**: Edit min/max/doublets anytime.
*   **Visual Interface**:
    *   **Interactive Calendar**: Initialize empty, then click to assign manually (with Lock/Block logic).
    *   **Exceptions & Holidays**: Mark specific staffing needs (blue) or holidays (orange) directly on the grid.
    *   **Real-time Feedback**: Visual warnings for rule violations.
*   **Reporting**:
    *   **PDF Export**: Generates professional, monthly-paginated calendars and accounting summaries.
    *   **JSON Import/Export**: Backup and restore state, or export usage data.

## Installation & Usage
No backend server is required. The application runs entirely in the browser.

1.  **Open**: Double-click `index.html` to launch the application in your web browser.
2.  **Configure**:
    *   Set the **Start Date** and **End Date** for the schedule.
    *   Add **People** or Import History (new users imported with empty Min/Max by default).
    *   Define **Holidays** and **Exceptions** using the buttons under configuration.
3.  **Prepare**:
    *   (Optional) Click empty slots in the calendar to manually assign people *before* generating.
    *   These manual assignments are **Locked**. Deleting them **Blocks** the person for that day.
4.  **Generate**: Click "Generar Todo" to run the algorithm from scratch, or "Rellenar Huecos" to respect existing/locked slots.
5.  **Refine**:
    *   Use the trash icon to clear slots.
    *   Use the "Spyglass" icon in the results table to audit specific assignments.
6.  **Export**: Click "Descargar PDF" to save the final schedule.

## Tech Stack
*   **Frontend**: HTML5, JavaScript (ES6+)
*   **Styling**: Tailwind CSS (CDN)
*   **Icons**: Font Awesome
*   **Libraries**:
    *   `SweetAlert2` (Modals/Alerts)
    *   `jsPDF` & `jspdf-autotable` (PDF Generation)

## Project Structure
*   `index.html`: Main application entry point.
*   `js/main.js`: Core application logic, event handlers, and export functions.
*   `js/algorithm.js`: The scheduling engine (simulation, validation, gap filling).
*   `js/ui.js`: DOM manipulation, rendering, and modal management.
*   `docs/`: Detailed documentation files.
