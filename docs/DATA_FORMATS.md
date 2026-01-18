# Formatos de Datos

Este documento describe las estructuras de datos clave utilizadas en la aplicación "Gestor de Guardias".

## 1. Persona (`Person`)
Representa a u profesional disponible para realizar guardias.

```json
{
  "id": "1768741761362",       // ID único (timestamp string)
  "name": "Nombre Usuario",    // Nombre visible
  "min": "1",                  // Mínimo de guardias (string o number)
  "max": "5",                  // Máximo de guardias (string o number)
  "doublets": true,            // Booleano. Si true, permite días consecutivos (Sáb+Dom, etc.)
  "blocked": ["2026-02-14"],   // Array de fechas (ISO YYYY-MM-DD) bloqueadas por el usuario
  "suggested": ["2026-02-01"]  // Array de fechas preferentes (no garantizado)
}
```

## 2. Calendario (`Schedule`)
El calendario es un array de objetos `Day`, ordenados cronológicamente.

### Estructura Principal
```json
"schedule": [
  {
    "date": "2026-02-01",  // Fecha ISO
    "type": "WEEKEND",     // 'WEEKDAY', 'FRIDAY', 'WEEKEND', 'HOLIDAY', 'EVE'
    "idx": 0,              // Índice del día en el rango seleccionado (0..N)
    "seats": [             // Lista de plazas/turnos para este día
      {
        "pid": null,             // ID de la persona asignada (o null si vacío)
        "name": null,            // Nombre (caché para visualización) o null
        "idx": 0                 // Índice del hueco dentro del día (0, 1...)
      },
      {
        "pid": "1768741752048",
        "name": "B",
        "idx": 1
      }
    ]
  },
  ...
]
```

### Tipos de Día (`type`)
- `WEEKDAY`: Lunes a Jueves (no festivo ni víspera)
- `FRIDAY`: Viernes (no festivo)
- `WEEKEND`: Sábado o Domingo
- `HOLIDAY`: Festivo
- `EVE`: Víspera de festivo

## 3. Historial (`History`)
Seguimiento de guardias pasadas para equidad.

```json
"history": {
  "ID_PERSONA": {
    "name": "Nombre",
    "total": 5,   // Total guardias históricas
    "fri": 1,     // Viernes trabajados
    "sd": 2,      // Sábados/Domingos trabajados
    "hol": 0,     // Festivos trabajados
    "months": 12  // Meses acumulados (para medias)
  }
}
```
