# 🗳️ Sistema de Votación Escolar (Vercel + Supabase)

Sistema real de votación escolar en internet.

- 100% GRATIS
- Funciona en celulares y computadores
- Panel de administración
- Importación desde Excel (.xlsx, .xls, .csv)
- Códigos únicos por estudiante
- Un voto por código (imposible votar 2 veces)
- Sin Firebase
- Sin servidores
- 1 sola función Serverless (Vercel Hobby)

---

## 📁 Estructura

```
votacion-escolar/
├── api/
│   └── [...path].js
├── public/
│   ├── index.html
│   ├── admin.html
│   ├── css/styles.css
│   └── js/
│       ├── app.js
│       └── admin.js
├── sql/
│   └── setup.sql
├── package.json
├── vercel.json
└── README.md
```

---

## ✅ PASO 1 — Crear Supabase

1. Ve a https://supabase.com
2. Clic en **New Project**
3. Espera a que termine de crear

### Ejecutar SQL

1. En Supabase ve a **SQL Editor**
2. Clic en **New query**
3. Copia y pega TODO el archivo:

`sql/setup.sql`

4. Clic en **Run**

---

## 🔑 PASO 2 — Obtener claves (Supabase)

En Supabase:

1. Ve a **Project Settings**
2. Ve a **API**
3. Copia:

- `URL` → SUPABASE_URL
- `service_role secret` → SUPABASE_SERVICE_ROLE_KEY

⚠️ IMPORTANTE: NO uses la anon key. Debe ser service_role.

---

## 🚀 PASO 3 — Subir a GitHub

1. Crea un repositorio en GitHub
2. Sube todos los archivos de esta carpeta

---

## 🌍 PASO 4 — Deploy en Vercel

1. Entra a https://vercel.com
2. Add New Project
3. Importa tu repo

### Variables de entorno

En Vercel agrega:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Deploy.

---

## 🧪 PASO 5 — Probar que funciona

Abre:

`https://TU-PROYECTO.vercel.app/api/health`

Debe mostrar:

```json
{ "ok": true }
```

---

## 🔐 PASO 6 — Panel de Administración

Abre:

`https://TU-PROYECTO.vercel.app/admin.html`

Código por defecto:

`ADMIN2026`

### Cambiar código admin (recomendado)

En Supabase → SQL Editor:

```sql
UPDATE config SET admin_code = 'TU_CODIGO_SEGURO' WHERE id = 1;
```

---

## 👨‍🎓 PASO 7 — Importar estudiantes

En admin → pestaña “Importar Excel”

Formato esperado (columnas):

- Nombre
- Grado (número)
- Curso (número)
- Lista (opcional)

El sistema genera el código así:

- 6°1 lista 12 → 6112
- 7°2 lista 03 → 7203

---

## 🧑‍💼 PASO 8 — Agregar candidatos

En admin → pestaña “Candidatos”

Agrega nombre + partido/lista.

---

## 🟢 PASO 9 — Abrir votación

En admin → Dashboard → botón “Abrir Votación”

---

## 🧯 Problemas típicos

- “La votación está cerrada” → abre desde el admin
- “Código no válido” → no fue importado o el Excel tiene columnas mal
- Error 500 → revisa logs en Vercel y que ejecutaste `setup.sql`

---

¡Listo! 🎉
