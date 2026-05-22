# PostgreSQL + ORM + JWT

## Objetivo

Agregar base de datos PostgreSQL con ORM para usuarios, roles, configuracion administrativa y entidades futuras.

Este plan es prerequisito para los modulos administrativos: gestion Suricata, listas negras/blancas, threat intel local, PCAP e incidentes. Implementarlo antes evita guardar configuracion critica en memoria, archivos sueltos o endpoints sin auditoria.

## Stack propuesto

- PostgreSQL 16.
- SQLAlchemy 2 async.
- asyncpg.
- Alembic para migraciones.
- Passlib/bcrypt para passwords.
- PyJWT o python-jose para JWT.

## Docker Compose

Agregar servicio:

- `postgres`

Variables:

- `POSTGRES_DB=suricata`
- `POSTGRES_USER=suricata`
- `POSTGRES_PASSWORD=suricata`

Backend env:

- `BACKEND_DATABASE_URL=postgresql+asyncpg://suricata:suricata@postgres:5432/suricata`
- `BACKEND_JWT_SECRET`
- `BACKEND_JWT_EXPIRES_MINUTES=480`

## Modelos iniciales

- `User`
- `Role`
- `UserRole`
- base de auditoria minima (`created_by`, `created_at`, `updated_at`) para entidades administrativas futuras.

Roles:

- `admin`
- `analyst`
- `viewer`

## Endpoints

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/users`
- `GET /api/auth/users`
- `PATCH /api/auth/users/{id}`
- `DELETE /api/auth/users/{id}`

## Seguridad

Proteger endpoints administrativos con JWT.

Permisos sugeridos:

- `admin`: todo.
- `analyst`: ver dashboard, gestionar configuracion Suricata, gestionar incidentes, capturar PCAP.
- `viewer`: solo lectura.

## Frontend

Agregar:

- `/login`
- estado de sesion.
- helper para requests autenticados.
- proteccion visual de rutas administrativas.

## Validacion

- Crear usuario admin inicial.
- Login devuelve JWT.
- `/api/auth/me` responde usuario autenticado.
- Endpoint protegido rechaza requests sin token.
- Endpoint protegido rechaza usuario sin rol requerido.
