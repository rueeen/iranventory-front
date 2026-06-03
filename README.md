# Iranventory Front

Frontend del sistema de inventario IRA. La aplicación consume un backend HTTP configurable y presenta una interfaz protegida para consultar el dashboard y módulos principales del inventario.

## Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Axios
- React Query (`@tanstack/react-query`)
- React Router (`react-router-dom`)

## Variables de entorno

Crear un archivo `.env` en la raíz del frontend con la URL del backend:

```env
VITE_API_URL=http://localhost:8000
```

Si la variable no está definida, el frontend usa `http://localhost:8000` como valor por defecto.

## Comandos

Instalar dependencias:

```bash
npm install
```

Levantar el entorno de desarrollo:

```bash
npm run dev
```

Generar build de producción:

```bash
npm run build
```

Previsualizar el build de producción:

```bash
npm run preview
```

## Rutas implementadas

| Ruta | Estado | Acceso |
| --- | --- | --- |
| `/login` | Implementada. Formulario de inicio de sesión con validación y autenticación JWT. | Pública |
| `/` | Implementada. Dashboard inicial con resumen consultado al backend y accesos rápidos según rol. | Protegida: `ALUMNO`, `DOCENTE`, `PANOLERO`, `DIRECTOR` |
| `/inventario` | Ruta implementada como módulo base/placeholder. El listado real de inventario en solo lectura está pendiente. | Protegida: `PANOLERO`, `DIRECTOR` |
| `/prestamos` | Implementada en solo lectura. Permite listar préstamos y filtrar por texto/estado. | Protegida: `ALUMNO`, `DOCENTE`, `PANOLERO`, `DIRECTOR` |
| `/compras` | Implementada en solo lectura. Permite listar órdenes de compra y filtrar por texto/estado. | Protegida: `PANOLERO`, `DIRECTOR` |
| `/usuarios` | Ruta implementada como módulo base/placeholder. La administración real de usuarios está pendiente. | Protegida: `DIRECTOR` |

## Estado actual

- Autenticación JWT implementada: login, almacenamiento de tokens, carga del usuario actual, refresh automático y cierre de sesión.
- Dashboard inicial implementado con métricas básicas obtenidas desde el backend.
- Inventario: existe ruta protegida y cliente API para consultar unidades, pero la pantalla actual es un placeholder; el listado de inventario en solo lectura sigue pendiente.
- Préstamos solo lectura implementado.
- Compras solo lectura implementado.
- Formularios de creación/edición pendientes para los módulos principales.

## Backend esperado

La aplicación espera que el backend exponga endpoints bajo la URL configurada en `VITE_API_URL`, incluyendo autenticación JWT y recursos como préstamos, órdenes de compra, tipos de equipo y unidades.
