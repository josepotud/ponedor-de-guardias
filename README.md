# ponedor-de-guardias
Gestor de Guardias Pro

Aplicación web autónoma para la gestión equitativa de turnos de guardia, diseñada para equipos médicos o de urgencias. Ahora refactorizada para mayor mantenibilidad y con reglas lógicas avanzadas.

## Estructura de Archivos
- `index.html`: Estructura principal.
- `styles.css`: Estilos visuales.
- `script.js`: Lógica del algoritmo y gestión de estado.
- `guardiscopio_analysis.md`: Comparativa de funcionalidades.

## Reglas del Algoritmo Implementadas
*   **Fairness:** The algorithm strives for an equal number of shifts (+/- 1) per person.
*   **Consecutive Shifts:**
    *   **Default:** No consecutive shifts allowed.
    *   **Doublets:** Users with 'doublets' permission can work max 2 consecutive days.
    *   **Triplets:** Strictly forbidden.
*   **Thursday Rule:** If you work Thursday, the system tries to avoid assigning you Saturday or Sunday of the same week (Strong Penalty).
*   **Holidays:** Holidays falling on a Friday are treated as Holidays (High Priority), not regular Fridays.
*   **Trash as Block:** Deleting an assignment via the trash icon automatically adds that date to the user's "Blocked" list for better visibility.

## Structure
The project is now modularized:
*   `index.html`: Main entry point.
*   `css/`: Stylesheets.
*   `js/`: JavaScript modules (`state.js`, `algorithm.js`, `ui.js`, `main.js`).
*   `data/`: Configuration and scenario files.
*   `docs/`: Documentation and analysis.md

## Uso
1. Abrir `index.html` en cualquier navegador moderno (Chrome, Edge, Firefox).
2. Configurar fechas de inicio y fin.
3. Añadir personal y configurar sus restricciones (bloqueos/peticiones) y si aceptan dobletes.
4. Pulsar "Generar Todo" para un calendario nuevo, o "Rellenar Huecos" para completar uno existente.
5. Revisar la tabla y descargar el PDF o guardar el JSON.

## Análisis de Competencia
Ver `guardiscopio_analysis.md` para un resumen de funcionalidades avanzadas no implementadas todavía.
