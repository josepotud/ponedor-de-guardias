# ponedor-de-guardias
Gestor de Guardias Pro

Aplicación web autónoma (single-file HTML) para la gestión equitativa de turnos de guardia, diseñada para equipos médicos o de urgencias. Funciona completamente en el navegador sin necesidad de servidores ni instalación.

Características Principales

1. Gestión de Fechas y Tipos de Día

Festivos: Marcado manual de días festivos.

Vísperas: Detección automática de vísperas de festivo.

Fines de Semana: Tratamiento diferenciado para Sábados y Domingos.

Viernes: Agrupados con las Vísperas como "Carga Media".

2. Gestión de Personal

Límites: Posibilidad de establecer un número Mínimo y Máximo de guardias por persona.

Dobletes: Configuración individual para permitir o prohibir trabajar con el patrón Guardia - Descanso - Guardia.

Bloqueos (Rojo): Días en los que una persona NO puede trabajar.

Peticiones (Verde): Días en los que una persona QUIERE trabajar (Prioridad absoluta).

3. Configuración de Plazas

Plazas Variables: Posibilidad de definir hasta N personas de guardia por día mediante un calendario interactivo.

Click izquierdo para aumentar plazas.

Click derecho para disminuir plazas.

4. Contabilidad e Histórico

Persistencia: Los datos se guardan automáticamente en el navegador.

Histórico Acumulativo: Posibilidad de importar archivos JSON de meses anteriores. El sistema suma las guardias históricas para equilibrar la carga a largo plazo (quien hizo más en el pasado, hace menos ahora).

Reportes: Exportación de datos contables en JSON y listados visuales en PDF.

Normas del Algoritmo

El sistema utiliza un algoritmo de puntuación ponderada con reparación de huecos. Las reglas se aplican en este orden de prioridad:

Peticiones (Sugerencias): Si un usuario marca un día en verde, se le asigna sí o sí (siempre que haya plazas).

Corrección: Si se piden dos días consecutivos, el sistema elimina uno automáticamente.

Regla de Descanso: No se puede trabajar dos días consecutivos bajo ninguna circunstancia.

Equidad de Viernes/Vísperas: La diferencia de guardias de tipo "Viernes/Víspera" entre la persona que más tiene y la que menos tiene nunca será mayor a 1 (salvo que los bloqueos lo impidan).

Carga Ponderada: Se prioriza a quien tenga menos carga acumulada (Histórico + Actual), con especial énfasis en igualar primero los Festivos, luego Sábados/Domingos y finalmente Viernes.

Reparación de Huecos: Si un día queda vacío por conflictos de reglas, el sistema intenta mover la guardia del día anterior de un candidato válido para liberar al candidato y cubrir el hueco.

Uso

Abrir el archivo index.html en cualquier navegador moderno (Chrome, Edge, Firefox).

Configurar fechas de inicio y fin.

Añadir personal y configurar sus restricciones (bloqueos/peticiones).

Pulsar "Calcular Periodo".

Revisar la tabla y descargar el PDF o guardar el JSON para el mes siguiente.
