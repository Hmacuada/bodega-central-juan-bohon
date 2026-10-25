# Bodega Central · CFT Juan Bohón

Prototipo para organizar una bodega central de materiales, herramientas y equipos compartida entre las carreras del CFT Juan Bohón, en reemplazo del pañol actual.

## Contenido de este repositorio

- **`web/index.html`** — Prototipo de plataforma web (inventario, solicitudes de préstamo y seguimiento "Mis pedidos") organizado por carrera, con panel de administración para quien quede a cargo de la bodega. Pensado como demo visual; para funcionar en vivo con datos compartidos necesita desplegarse detrás de un backend propio (actualmente usa el almacén de datos de Claude Artifacts solo como prototipo).
- **`planilla/Bodega_Instrumentos_Inventario.xlsx`** — Alternativa en planilla: inventario y control de préstamos con fórmulas automáticas, para levantar el inventario inicial sin depender de la plataforma web.

## Roles de la plataforma

| Rol | Puede |
| --- | --- |
| **Alumno** | Pedir préstamos. Para equipos marcados "Requiere docente" debe elegir un docente de respaldo, que confirma antes de la aprobación. No solicita compras. |
| **Docente** | Pedir préstamos (queda como su propio respaldo), solicitar compras y confirmar o rechazar los respaldos que le piden sus alumnos. El encargado valida el rol. |
| **Encargado de pañol** | Ver todo: solicitudes, préstamos, inventario, usuarios, proveedores y compras. Valida docentes, aprueba, entrega y recibe equipos. |

Cada solicitud registra un **responsable que retira** (dato obligatorio). Cada persona completa su perfil (nombre, carrera, alumno o docente) la primera vez que entra.

## Pase QR

Cada solicitud aprobada genera un pase QR que enlaza directamente a esa solicitud en el portal. En el pañol, el encargado lo escanea (foto con la cámara del celular o subiendo una imagen, o escribiendo el código `CFT-xxxxx`), ve si el pase es válido, confirma la identidad del responsable y el estado de los equipos, y registra la entrega. Con el mismo pase se registra después la devolución.

## Enlaces al prototipo

- Propuesta completa (contexto, gobernanza, flujo de préstamo, layout de bodega, plan de implementación): documento compartido aparte.
- Plataforma web en vivo (prototipo): enlace de Claude Artifacts compartido aparte.

## Próximos pasos

Ver la sección "Siguientes pasos" de la propuesta: validar con jefaturas de carrera, definir encargado de bodega, cargar el inventario inicial y fijar fecha de piloto con 2-3 carreras.
