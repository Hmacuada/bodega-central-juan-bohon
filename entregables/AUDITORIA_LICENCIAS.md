# AUDITORÍA DE LICENCIAS — OpenEduCat Community 19.0

**Fecha:** 2026-11-21 · **Commit auditado:** `ad47dbf8` (rama 19.0)

> **Aviso importante.** Este documento es un **análisis técnico de licencias**, no asesoría jurídica. Cada conclusión se marca como:
> - **[TÉCNICO]**: se desprende del texto de la licencia y del código, con consenso amplio en la comunidad de software libre.
> - **[JURÍDICO]**: requiere opinión de un abogado especializado en propiedad intelectual y software (en Chile y en cada país de comercialización) antes de tomar decisiones comerciales.
> No se utilizó ni revisó código Enterprise.

---

## 1. Conclusión corta

**Es técnicamente viable construir y vender un SaaS propio usando OpenEduCat Community como base, sin publicar el código de nuestros módulos**, siempre que:
1. no se distribuya el software a clientes (o, si se distribuye, se cumplan las condiciones de la LGPL-3 para las partes LGPL),
2. nuestros desarrollos sean **módulos separados** que extiendan por herencia, sin copiar código de OpenEduCat,
3. no se usen las marcas “OpenEduCat” ni “Odoo” como marca del producto,
4. no se use ningún componente Enterprise de OpenEduCat ni de Odoo,
5. se elimine la telemetría y se revise el tratamiento de datos personales.

El riesgo legal **no es** la licencia en sí; los riesgos reales son de **marca**, de **dependencia comercial de un proveedor que vende Enterprise** y de **privacidad**. [TÉCNICO, confirmar en JURÍDICO]

---

## 2. Licencias verificadas

| Componente | Licencia | Evidencia | Observación |
|---|---|---|---|
| Repositorio | LGPL-3 | `LICENSE` en raíz | El archivo dice que incluye la GPL “al final”, **pero no la incluye**; menciona un archivo `COPYRIGHT` **inexistente**. Defecto formal del proveedor; al redistribuir debemos incluir los textos completos de GPL-3 y LGPL-3. |
| 13 módulos + tema | `'license': 'LGPL-3'` en los 14 `__manifest__.py` | verificado manifiesto por manifiesto | Uniforme |
| Archivos `.py` | Cabecera LGPL-3 “or any later version”, © OpenEduCat Inc | p.ej. [course.py#L1-L18](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/models/course.py#L1) | 7 archivos sin cabecera (p.ej. `op_academic_year.py`, `bonafide_report.py`); quedan cubiertos por la licencia del módulo/repositorio. |
| Dependencias Python propias | `requests`, `pytz`, `dateutil` | imports | Apache-2.0 / MIT / BSD-Apache — compatibles; ya las trae Odoo |
| JS/CSS de terceros incluidos | **Ninguno** | Solo 11 archivos JS/SCSS propios | No se encontró librería de terceros embebida |
| Imágenes (615) | Sin licencia específica | `static/description`, tema | Incluyen **logos y marca OpenEduCat**. Licencia de imágenes de stock no verificable → **no reutilizar** imágenes en nuestra marca. |
| Odoo 19 Community (framework) | LGPL-3 | Documentación oficial de Odoo (licenses.html) | Incluye librerías JS de terceros con licencias MIT/BSD/etc. propias. |
| Odoo Enterprise | Propietaria (“Odoo Enterprise Edition License v1.0”) | Documentación oficial (vía resumen; verificar texto) | **No usar.** |
| OpenEduCat Enterprise | Propietaria (“Enterprise License Agreement”, mencionado en Términos de Servicio §7, no localizado públicamente) | https://openeducat.org/terms-of-service/ | **No usar.** |
| wkhtmltopdf (PDF) | LGPL-3 | — | Herramienta externa, ejecutada como proceso |
| PostgreSQL | PostgreSQL License (permisiva) | — | |

---

## 3. Qué permite y qué exige la LGPL-3 (aplicado a nuestro caso)

La LGPL-3 es la GPL-3 más permisos adicionales. Sus obligaciones se activan al **“transmitir” (*convey*)** el software, es decir, al entregar copias a terceros.

### 3.1 SaaS sin distribución
- Ofrecer el sistema como servicio a través de la red, **sin entregar copias**, **no es** transmitir. La LGPL-3 (a diferencia de la AGPL-3) **no tiene cláusula de red**. → No hay obligación de publicar ni entregar código fuente, ni del núcleo ni de nuestros módulos. **[TÉCNICO]**
- Comprobación de que ninguna parte usada sea AGPL: Odoo Community y OpenEduCat Community son LGPL-3; **si en el futuro se incorpora un módulo AGPL (p.ej. muchos de OCA son AGPL-3), el análisis cambia**: la AGPL sí obliga a ofrecer el código a los usuarios remotos. Política recomendada: lista blanca de licencias (LGPL, MIT, BSD, Apache) y revisión de cada dependencia. **[TÉCNICO]**

### 3.2 Si entregamos software al cliente (on-premise, instalación local, copia de respaldo con código)
Entonces sí transmitimos y debemos:
- Entregar las partes LGPL (Odoo, OpenEduCat y **cualquier modificación a sus archivos**) bajo LGPL-3, con código fuente, avisos de copyright y textos de licencia completos. **[TÉCNICO]**
- Para nuestros módulos propietarios que solo *usan* la biblioteca: cumplir la sección 4 (“Combined Works”): aviso de uso de la biblioteca, copia de la licencia, no impedir modificar/reemplazar la parte LGPL ni la ingeniería inversa necesaria para depurar esas modificaciones. **[TÉCNICO; la calificación exacta como “Application” es JURÍDICO]**

### 3.3 Modificar módulos de OpenEduCat
- Cambiar directamente archivos de OpenEduCat genera una **obra derivada de la biblioteca** → esa parte queda bajo LGPL-3. En SaaS puro no obliga a publicarla, pero contamina la separación si luego se distribuye. **[TÉCNICO]**
- Recomendación: **nunca editar el código original**; extender con módulos propios (`_inherit`, herencia de vistas). Si hay que corregir un bug, hacerlo en un *fork* LGPL público y separado. **[TÉCNICO]**
- **No copiar/pegar** fragmentos de OpenEduCat en módulos propietarios: el archivo resultante sería derivado. Si se necesita lógica equivalente, reescribirla. **[TÉCNICO]**

### 3.4 Módulos propietarios sobre base LGPL
- Es una práctica consolidada en el ecosistema Odoo: Odoo SA vende módulos Enterprise propietarios sobre Community LGPL, y el mercado de apps de Odoo admite licencias propietarias (OPL-1) sobre módulos LGPL. Esto apoya la viabilidad. **[TÉCNICO]**
- Sin embargo, el punto de si un módulo Python que hereda clases de una biblioteca LGPL es una “Application” o una obra derivada **no ha sido zanjado por tribunales chilenos** (ni, que sepamos, latinoamericanos). **[JURÍDICO]**

### 3.5 Cobrar suscripción
- La LGPL no prohíbe cobrar. Se puede cobrar por el servicio, el hosting, la implementación, el soporte y los módulos propios. **[TÉCNICO]**
- Los Términos de Servicio de OpenEduCat prohíben revender **sus Servicios** sin permiso (§5). Esa cláusula rige el uso de su nube/Enterprise; **no** limita el código Community recibido bajo LGPL. No debemos contratar sus servicios si queremos evitar esa restricción. **[TÉCNICO; confirmar JURÍDICO]**

### 3.6 Revocabilidad
- La licencia LGPL de las versiones ya publicadas es irrevocable para quien la recibió. OpenEduCat Inc (titular del copyright) podría licenciar **versiones futuras** de otra forma; el riesgo es quedar atado a una versión que deja de recibir mejoras, no perder el derecho a usar la actual. **[TÉCNICO]**
- No se encontró CLA ni `CONTRIBUTING`; no se puede determinar si OpenEduCat posee todo el copyright. **[PENDIENTE]**

---

## 4. Marca y comercialización

| Tema | Hallazgo | Riesgo | Acción |
|---|---|---|---|
| Marca “OpenEduCat” | La licencia Community no concede derechos de marca (https://openeducat.org/community-license/); TdS §7 exige consentimiento escrito | Alto si se usa en nombre/logo/dominio | Nombre propio; eliminar `theme_web_openeducat`, logos, favicon, textos “OpenEduCat” en UI y correos |
| Marca “Odoo” | Odoo SA protege su marca (política de marca no revisada en esta auditoría) | Medio | No usar “Odoo” en nombre ni logo; uso nominativo (“construido sobre tecnología de código abierto”) solo tras revisión **[JURÍDICO]** |
| Menciones en UI | Los módulos muestran “OpenEduCat” en menús, categorías, reportes | Medio | Módulo de rebranding (herencia de vistas/traducciones), sin modificar originales |
| Programa OEM de OpenEduCat | Ofrece “white-label” y acceso a código (página OEM); términos no publicados | — | Alternativa comercial si se quisiera Enterprise; implica dependencia contractual |

---

## 5. Riesgos de dependencia de Enterprise

1. **Funcionalidad crítica fuera de Community**: según el propio fabricante, LMS completo, GPA/gradebook central, portal completo de apoderados y optimización de horarios son Enterprise (https://openeducat.org/compare-editions/). Nuestro producto necesita equivalentes → hay que construirlos.
2. **Código Community preparado para Enterprise**: ~80 interruptores `module_openeducat_*` en Ajustes y redirecciones a rutas Enterprise ([AUDITORIA_TECNICA §12](AUDITORIA_TECNICA.md)). Un usuario podría activar un interruptor que intenta instalar un módulo inexistente; hay que ocultarlos.
3. **Riesgo de “contaminación”**: un desarrollador podría, por error, estudiar o copiar código Enterprise (p.ej. de instalaciones de terceros). Política: prohibido acceder a código Enterprise; registro de procedencia de cada componente.
4. **Incentivo del proveedor**: el negocio de OpenEduCat Inc es vender Enterprise; las mejoras sustantivas probablemente aterrizarán allí, no en Community. [HIPÓTESIS razonable a partir de la página de comparación]

---

## 6. Privacidad y telemetría (riesgo de cumplimiento)

El cron oculto de `openeducat_core` envía diariamente a `srv.openeducat.org` nombre de la base, URL, usuarios, apps y **nombre/email/teléfono de la institución** ([update.py#L32-L92](https://github.com/openeducat/openeducat_erp/blob/ad47dbf8c77b2884fe37629349898af9b31eee7d/openeducat_core/models/update.py#L32)). En un SaaS, eso es una transferencia de datos de nuestros clientes a un tercero extranjero sin contrato. Debe **eliminarse/neutralizarse** (módulo propio que sobrescriba el método y desactive el cron) y documentarse. La evaluación bajo la Ley 19.628 y la Ley 21.719 de protección de datos personales es **[JURÍDICO]**.

---

## 7. Matriz de decisión de licencias

| Pregunta | Respuesta | Tipo |
|---|---|---|
| ¿Se puede usar Community comercialmente? | Sí | TÉCNICO |
| ¿Se puede cobrar suscripción SaaS? | Sí | TÉCNICO |
| ¿Hay que publicar nuestro código si solo ofrecemos SaaS? | No (LGPL sin cláusula de red), salvo que incorporemos AGPL | TÉCNICO |
| ¿Nuestros módulos pueden ser propietarios? | Sí, si son módulos separados que no copian código LGPL; práctica común en Odoo | TÉCNICO / confirmar JURÍDICO |
| ¿Si modificamos archivos de OpenEduCat? | Esos cambios son LGPL; publicarlos si distribuimos | TÉCNICO |
| ¿Si damos instalación on-premise? | Cumplir LGPL §4 y entregar fuentes de las partes LGPL | TÉCNICO / JURÍDICO |
| ¿Podemos usar el nombre/logo OpenEduCat? | No sin autorización escrita | TÉCNICO (texto explícito) |
| ¿Podemos decir “basado en Odoo”? | Solo con revisión de la política de marca de Odoo | JURÍDICO |
| ¿Riesgo de que nos “quiten” la licencia? | No para versiones ya publicadas | TÉCNICO |
| ¿Usar módulos OCA? | Revisar uno a uno; muchos son AGPL-3 | TÉCNICO |

## 8. Pendientes para el abogado

1. Calificación de módulos Odoo propietarios que heredan modelos LGPL (sección 4 LGPL-3) bajo derecho chileno.
2. Uso nominativo de las marcas Odoo/OpenEduCat en material comercial.
3. Contratos SaaS: licencia de uso, SLA, propiedad de datos, salida/portabilidad, subencargados.
4. Cumplimiento de Ley 21.719 (encargado de tratamiento, transferencias internacionales, brechas) y normativa sectorial de educación superior.
5. Condiciones si un cliente exige el código fuente o instalación local (cláusulas de escrow, LGPL).
