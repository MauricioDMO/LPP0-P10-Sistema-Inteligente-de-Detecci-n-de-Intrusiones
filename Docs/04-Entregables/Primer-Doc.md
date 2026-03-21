# Sistema de monitoreo y análisis de tráfico de red

- [Sistema de monitoreo y análisis de tráfico de red](#sistema-de-monitoreo-y-análisis-de-tráfico-de-red)
  - [1. Descripción general del proyecto](#1-descripción-general-del-proyecto)
  - [2. Objetivo de la fase desarrollada](#2-objetivo-de-la-fase-desarrollada)
  - [3. Alcance de la fase actual](#3-alcance-de-la-fase-actual)
  - [4. Arquitectura técnica implementada](#4-arquitectura-técnica-implementada)
    - [Flujo técnico](#flujo-técnico)
  - [5. Tecnologías utilizadas](#5-tecnologías-utilizadas)
    - [5.1 Suricata](#51-suricata)
    - [5.2 Filebeat](#52-filebeat)
    - [5.3 Elasticsearch](#53-elasticsearch)
    - [5.4 Kibana](#54-kibana)
    - [5.5 FastAPI](#55-fastapi)
  - [6. Trabajo asignado a cada miembro del equipo](#6-trabajo-asignado-a-cada-miembro-del-equipo)
  - [7. Resumen funcional del trabajo por subequipos](#7-resumen-funcional-del-trabajo-por-subequipos)
  - [8. Reuniones sostenidas](#8-reuniones-sostenidas)
  - [9. Resultados técnicos obtenidos hasta el momento](#9-resultados-técnicos-obtenidos-hasta-el-momento)
  - [10. Dificultades encontradas](#10-dificultades-encontradas)
  - [11. Estado actual del proyecto](#11-estado-actual-del-proyecto)
  - [12. Próximas actividades](#12-próximas-actividades)
  - [13. Conclusión](#13-conclusión)


## 1. Descripción general del proyecto

El proyecto consiste en el desarrollo de un sistema para el monitoreo y análisis de tráfico de red, orientado a la captura, procesamiento, almacenamiento y visualización de eventos generados dentro de una red. La solución se diseñó para observar tráfico, identificar eventos relevantes y centralizar la información para su posterior análisis técnico.

En esta fase del proyecto se implementó la capa de captura e ingestión de datos, compuesta por Suricata, Filebeat, Elasticsearch y Kibana. El objetivo de esta etapa fue validar el flujo de extremo a extremo, desde la generación del evento en red hasta su almacenamiento y visualización inicial.

---

## 2. Objetivo de la fase desarrollada

Implementar y validar una arquitectura funcional de monitoreo de red que permita:

* capturar tráfico y eventos relevantes desde la red,
* generar registros estructurados en formato JSON,
* transportar dichos registros hacia un motor de almacenamiento y búsqueda,
* consultar y visualizar la información de forma centralizada,
* dejar preparada la base técnica para una siguiente fase de desarrollo con backend en FastAPI y posterior consumo desde un frontend.

---

## 3. Alcance de la fase actual

Durante esta fase se desarrolló y verificó lo siguiente:

* instalación y configuración inicial de Suricata como motor de inspección de tráfico,
* validación de generación de eventos mediante `eve.json`,
* configuración de Filebeat para la lectura y envío de logs,
* integración de Filebeat con Elasticsearch,
* validación del almacenamiento e indexación de eventos,
* conexión de Kibana con Elasticsearch,
* creación de una visualización inicial para comprobar el flujo de datos.

No forma parte del alcance actual la implementación final del backend en FastAPI ni del frontend de consumo; ambos componentes quedan definidos como la siguiente etapa del proyecto.

---

## 4. Arquitectura técnica implementada

La arquitectura implementada en esta fase puede resumirse de la siguiente manera:

```text
Tráfico de red
   ↓
Suricata
   ↓
Archivo eve.json
   ↓
Filebeat
   ↓
Elasticsearch
   ↓
Kibana
```

### Flujo técnico

1. **Suricata** inspecciona el tráfico de red y genera eventos estructurados en `eve.json`.
2. **Filebeat** monitorea el archivo generado por Suricata, recolecta los eventos y los envía a Elasticsearch.
3. **Elasticsearch** recibe, indexa y almacena los eventos para permitir búsquedas y análisis posteriores.
4. **Kibana** se conecta a Elasticsearch para consultar, filtrar y visualizar los datos recibidos.

---

## 5. Tecnologías utilizadas

### 5.1 Suricata

Suricata se utilizó como motor principal de inspección y monitoreo de tráfico. Es una herramienta orientada a detección y monitoreo de amenazas de red, con capacidad de registrar solicitudes HTTP, información TLS y otros eventos útiles para Network Security Monitoring. Su configuración principal se realiza en `suricata.yaml`, y uno de sus mecanismos de salida más relevantes es EVE JSON.

### 5.2 Filebeat

Filebeat se utilizó como agente liviano para lectura y transporte de logs. Su función en el proyecto fue vigilar el archivo `eve.json`, recolectar los eventos generados y reenviarlos a Elasticsearch para su indexación. Elastic lo describe como un *lightweight shipper* para centralizar y reenviar datos de logs.

### 5.3 Elasticsearch

Elasticsearch se utilizó como motor de almacenamiento, indexación y consulta. Su función fue recibir los eventos enviados por Filebeat, almacenarlos en índices y permitir consultas rápidas sobre la información capturada. La documentación oficial lo define como un motor distribuido de búsqueda y analítica optimizado para almacenar, indexar y analizar datos en tiempo cercano a tiempo real.

### 5.4 Kibana

Kibana se utilizó como interfaz de consulta y visualización. Permitió verificar que los eventos almacenados en Elasticsearch fueran accesibles y representables mediante dashboards y paneles. Elastic lo define como la interfaz para consultar, analizar, visualizar y administrar los datos almacenados en Elasticsearch.

### 5.5 FastAPI

FastAPI fue definido como tecnología para la siguiente etapa del proyecto, en la cual se desarrollará un backend encargado de consultar automáticamente la información procesada en Elasticsearch y exponerla al frontend mediante endpoints propios.

---

## 6. Trabajo asignado a cada miembro del equipo

| Integrante                                    | Trabajo realizado                                                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mauricio Daniel Martínez Orellana - MO100223  | Organización general del proyecto, definición de la arquitectura completa del flujo, selección de tecnologías junto con Luis Alejandro, y supervisión de la integración entre Suricata, Filebeat, Elasticsearch y Kibana. |
| Luis Alejandro Flores Rodríguez - FR100223    | Organización del equipo junto con Mauricio, investigación y selección de tecnologías, definición del flujo de datos y apoyo en la planificación técnica y revisión de integración entre componentes.                      |
| Josué Alexander Guevara Gómez - GG100923      | Configuración inicial de Suricata, revisión del funcionamiento del motor y validación de la generación del archivo de salida con eventos útiles para procesamiento.                                                       |
| Ricardo Alexander Rivas Martínez - RM102323   | Apoyo en la etapa de Suricata, revisión de reglas y pruebas de escaneo, y verificación de consistencia de los eventos generados para integrarlos con el resto del flujo.                                                  |
| Moisés Alexander Rodas Ramírez - RR101023     | Configuración de Filebeat, lectura del archivo generado por Suricata y pruebas iniciales para envío correcto de logs.                                                                                                     |
| Emilton Daniel Alvarenga Flores - AF100420    | Apoyo en Filebeat, revisión de la estructura básica de los eventos y del pipeline de envío hacia Elasticsearch.                                                                                                           |
| Anderson René Cea Henríquez - CH100223        | Configuración de Elasticsearch, validación del almacenamiento de eventos y revisión de índices y estructura de datos recibidos.                                                                                           |
| Christian Alexander Ríos Henríquez - RH100323 | Apoyo en Elasticsearch, revisión de consultas básicas y comprobación de llegada correcta de datos desde Filebeat.                                                                                                         |
| Cristian Marcelo López Huezo - LH100522       | Configuración inicial de Kibana, conexión con Elasticsearch y construcción de visualizaciones o paneles básicos para revisión de eventos.                                                                                 |
| Andrea Michelle Tolentino Castillo - TC200123 | Apoyo en el seguimiento del avance, consolidación de información del equipo y soporte general en la organización de evidencias de trabajo de la fase desarrollada.                                                        |

---

## 7. Resumen funcional del trabajo por subequipos

Para efectos de exposición técnica, el trabajo del grupo puede resumirse de la siguiente forma:

* **Mauricio y Luis Alejandro:** organización del proyecto, definición del flujo de trabajo y selección tecnológica.
* **Josué y Ricardo:** implementación y validación de la capa de captura con Suricata.
* **Moisés y Emilton:** configuración de Filebeat para lectura y envío de eventos.
* **Cea y Christian Ríos:** implementación y validación de Elasticsearch.
* **Marcelo y Andrea:** apoyo en visualización inicial, organización de evidencias y revisión de resultados mostrados en la fase actual.

---

## 8. Reuniones sostenidas

A continuación se presenta un registro técnico resumido de reuniones de trabajo sostenidas desde el inicio del proyecto. Las fechas se presentan como planificación y seguimiento interno de avance.

| Fecha                         | Objetivo de la reunión                            | Resumen técnico                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domingo 15 de marzo de 2026   | Inicio del proyecto                               | Se definió la idea general del sistema, el problema a resolver y el enfoque de monitoreo de red. También se discutió la necesidad de dividir el flujo en captura, transporte, almacenamiento y visualización. |
| Miércoles 18 de marzo de 2026 | Selección preliminar de tecnologías               | Se compararon alternativas para captura de tráfico y almacenamiento. Se acordó trabajar con Suricata para generación de eventos y con Elastic Stack para ingestión y consulta.                                |
| Domingo 22 de marzo de 2026   | Definición de arquitectura y asignación de tareas | Se estableció el flujo Suricata → Filebeat → Elasticsearch → Kibana. Se distribuyeron responsabilidades por componente y se definió la lógica de trabajo por parejas.                                         |
| Miércoles 25 de marzo de 2026 | Configuración inicial de Suricata                 | Se revisó la instalación de Suricata, la selección de interfaz de red y la generación del archivo `eve.json`. Se validó que el sistema comenzara a producir eventos.                                          |
| Domingo 29 de marzo de 2026   | Validación de eventos y pruebas de tráfico        | Se realizaron pruebas de red para comprobar que Suricata generara eventos de tipo `flow`, `dns`, `tls` y otros registros útiles. Se discutieron ajustes en `suricata.yaml`.                                   |
| Miércoles 1 de abril de 2026  | Implementación de Filebeat                        | Se configuró Filebeat para leer `eve.json`. Se revisó el módulo de Suricata, el path de lectura y la salida hacia Elasticsearch.                                                                              |
| Domingo 5 de abril de 2026    | Integración con Elasticsearch                     | Se instalaron y validaron los servicios de Elasticsearch. Se revisaron temas de configuración, autenticación, memoria de la VM y recepción de eventos.                                                        |
| Miércoles 8 de abril de 2026  | Corrección de errores de integración              | Se trabajó en la solución de errores de autenticación, arranque de servicios y lectura de certificados. También se validó la conexión Filebeat → Elasticsearch.                                               |
| Domingo 12 de abril de 2026   | Verificación de índice y almacenamiento           | Se confirmó la existencia de índices de Filebeat en Elasticsearch y se comprobó que los eventos ya estaban siendo almacenados correctamente.                                                                  |
| Miércoles 15 de abril de 2026 | Conexión con Kibana y visualización               | Se conectó Kibana con Elasticsearch y se realizaron pruebas de visualización básica para verificar que los datos ya podían explorarse de forma gráfica.                                                       |
| Domingo 19 de abril de 2026   | Pruebas funcionales de extremo a extremo          | Se ejecutaron pruebas reales con tráfico DNS, TLS e ICMP, comprobando el flujo completo desde la red hasta la indexación en Elasticsearch.                                                                    |
| Martes 21 de abril de 2026    | Consolidación del avance y siguiente fase         | Se revisó el estado actual del proyecto, se consolidó la evidencia técnica y se definió como siguiente fase la construcción del backend en FastAPI y la posterior conexión con frontend.                      |

---

## 9. Resultados técnicos obtenidos hasta el momento

Hasta el cierre de esta fase se logró:

* instalación funcional de Suricata en máquina virtual,
* generación de eventos estructurados en `eve.json`,
* validación de tráfico real capturado por la herramienta,
* instalación y configuración de Filebeat,
* envío exitoso de eventos desde Filebeat hacia Elasticsearch,
* indexación correcta de eventos en Elasticsearch,
* verificación de consultas sobre los índices generados,
* conexión inicial de Kibana con Elasticsearch,
* construcción de una visualización básica para demostrar la llegada de datos.

Desde el punto de vista técnico, el flujo principal del sistema quedó validado.

---

## 10. Dificultades encontradas

Durante la implementación se presentaron principalmente las siguientes dificultades:

* selección correcta de interfaz de red en la máquina virtual para captura con Suricata,
* validación de eventos útiles en `eve.json`,
* problemas de autenticación y certificados en Elasticsearch,
* errores de arranque por uso de memoria limitado en la máquina virtual,
* configuración de Filebeat para lectura correcta del archivo de Suricata,
* validación de que los datos realmente llegaran indexados a Elasticsearch.

Estas dificultades fueron resueltas mediante revisión de configuración, pruebas de tráfico controladas y validación incremental por componente.

---

## 11. Estado actual del proyecto

Al momento de este informe, el proyecto se encuentra en un estado funcional en su capa de monitoreo e ingestión. Ya existe una arquitectura operativa capaz de:

* capturar eventos de red,
* estructurarlos en archivos de salida,
* transportarlos a un motor de indexación,
* consultarlos y visualizarlos.

La siguiente etapa corresponde al desarrollo del backend con FastAPI para automatizar consultas sobre Elasticsearch y servir los resultados a una interfaz frontend.

---

## 12. Próximas actividades

Las actividades planificadas para la siguiente fase son:

* diseñar la estructura del backend en FastAPI,
* crear endpoints para consulta de eventos de red,
* normalizar la información que será enviada al frontend,
* definir filtros por IP, protocolo, dominio y tipo de evento,
* diseñar la interfaz frontend para consumo y visualización de resultados,
* integrar la visualización final sobre la información ya indexada.

---

## 13. Conclusión

La fase actual permitió validar técnicamente el núcleo del sistema de monitoreo de red. Se logró implementar un flujo funcional de captura, envío, almacenamiento y visualización inicial de eventos, lo cual constituye la base operativa del proyecto. El avance obtenido confirma la viabilidad técnica de la solución y deja preparada la infraestructura necesaria para continuar con la etapa de backend y presentación final al usuario.
