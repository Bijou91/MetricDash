# MetricDash — Sistema de Aseguramiento de Calidad de Software (SQA)

> **Morelosoft International Solutions & co**  
> Alineado al estándar internacional **ISO/IEC 29110-5-1-1:2025** (Gestión de Proyectos y Perfil Básico).

Herramienta web modular para el aseguramiento de la calidad del software. Permite registrar proyectos, configurar umbrales de métricas de calidad, reportar defectos, planificar y auditar actividades SQA mediante checklists y actas formales, capturar resultados de pruebas por corte de evaluación, y detectar automáticamente deterioro para gestionar acciones correctivas con verificación de eficacia.

---

## 🏗️ Arquitectura y Tecnologías

El sistema sigue una arquitectura de 3 capas completamente desacoplada y contenerizada:

* **Frontend (`sqa_web`)**: Single Page Application desarrollada con **React 18**, **Vite** y **Tailwind CSS**. Puerto predeterminado: `3000`.
* **Backend API (`sqa_api`)**: API REST desarrollada en **Node.js 22** con **Express**, transacciones ACID gestionadas por repositorio (`TransaccionManager`) y arquitectura limpia. Puerto predeterminado: `4000`.
* **Base de Datos (`sqa_db`)**: **PostgreSQL 16 Alpine** con persistencia en volumen Docker (`pgdata`) y esquemas relacionales ejecutados de forma automática e idempotente. Puerto predeterminado: `5432`.

---

## 📋 Casos de Uso Implementados

| Módulo | Caso de Uso | Descripción Funcional |
| :--- | :--- | :--- |
| **CU-01** | **Registro de Proyecto y Plan QA** | Registro del proyecto activo del ciclo escolar, asignación de roles (QA, Técnico, Gestión, Developers), generación automática de los 4 cortes de evaluación y propuesta base de 8 actividades SQA. |
| **CU-02** | **Métricas de Calidad y Umbrales** | Configuración versionada de metas y umbrales para las 4 métricas oficiales: *Densidad de Defectos*, *Cobertura de Pruebas*, *Tasa de Éxito de Pruebas* y *Cumplimiento SQA*. |
| **CU-03** | **Registro de Defectos** | Captura y clasificación de defectos (severidad, prioridad, fase de origen y detección), cálculo en tiempo real de densidad de defectos y detección de posibles duplicados. |
| **CU-04** | **Actividades SQA** | Planificación formal de actividades, ejecución mediante checklists normativos ISO/IEC 29110, generación automática de defectos ante hallazgos, emisión de actas de revisión por pares y recálculo de cumplimiento SQA. |
| **CU-05** | **Resultados de Pruebas** | Registro de rondas de pruebas planificadas, ejecutadas, exitosas y fallidas por corte; cálculo automático de cobertura y tasa de éxito con evaluación en semáforo. |
| **CU-06** | **Deterioro y Acciones Correctivas** | Detección automática de deterioro de métricas (caída consecutiva o cruce de umbral crítico), análisis determinista de causas raíz, registro de acciones correctivas y verificación de eficacia cuantitativa ($V_{n+1} \text{ vs } V_\alpha$). |

---

## 💻 Requisitos Previos para Cualquier PC (Windows, macOS o Linux)

Para ejecutar este proyecto en cualquier computadora, únicamente se requiere tener instalado:

1. **Git**: [git-scm.com](https://git-scm.com/)
2. **Docker y Docker Compose**:
   - En **Windows o macOS**: Instalar [Docker Desktop](https://www.docker.com/products/docker-desktop/) (asegúrese de que Docker Desktop esté iniciado).
   - En **Linux**: Instalar Docker Engine y el plugin Docker Compose (`docker-compose-plugin`).

> ℹ️ **Nota**: No es necesario tener instalado Node.js ni PostgreSQL en la máquina anfitriona; Docker se encarga de instalar todas las dependencias y configurar la base de datos automáticamente.

---

## 🚀 Despliegue Rápido (Paso a Paso)

### 1. Clonar el repositorio
Abra una terminal o PowerShell y ejecute:
```bash
git clone https://github.com/Bijou91/MetricDash.git
cd MetricDash
```

### 2. Iniciar los contenedores
Ejecute el siguiente comando en la raíz del proyecto:
```bash
docker compose up --build
```

Docker descargará las imágenes base, compilará los contenedores, inicializará el esquema completo de PostgreSQL en `/docker-entrypoint-initdb.d/` e instalará las dependencias de Node.js automáticamente.

### 3. Abrir en el navegador
Una vez que la terminal indique que los servidores están listos:
* **Aplicación Web**: [http://localhost:3000](http://localhost:3000)
* **API Backend**: [http://localhost:4000](http://localhost:4000)
* **Health Check**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🧪 Ejecución de Pruebas Automatizadas

Para validar que la lógica de negocio, validaciones y cálculos funcionan correctamente en cualquier entorno, ejecute:

```bash
docker exec sqa_api npm test
```

Esto ejecutará la suite de pruebas unitarias y de integración que verifica los criterios de detección de deterioro, validación de acciones correctivas, verificación de eficacia y reglas de negocio con **16/16 pruebas aprobadas**.

---

## ⚙️ Personalización de Puertos (Opcional)

Si en la computadora de destino los puertos `3000`, `4000` o `5432` ya están ocupados por otros servicios locales (como otro servidor web o PostgreSQL local), puede cambiar los puertos creando un archivo `.env` en la raíz del proyecto:

```env
# .env (opcional)
WEB_PORT=3005
API_PORT=4005
DB_PORT=5435
```

Al levantar con `docker compose up --build`, el frontend estará disponible en `http://localhost:3005` y se comunicará automáticamente con la API en el puerto `4005`.

---

## 🔄 Reinicio Limpio de la Base de Datos

Si en algún momento desea borrar todos los datos de prueba y comenzar con una base de datos completamente limpia desde cero:

```bash
# Detiene los contenedores y elimina el volumen de datos
docker compose down -v

# Vuelve a levantar recreando las tablas limpias
docker compose up --build
```

---

## 👥 Equipo de Desarrollo — Morelosoft

* **Carlos Manuel Aguirre Norato** — Líder Técnico
* **Héctor Varela** — Líder QA
* **Karol Espino** — Gestión de Proyecto
