import { Route, Routes } from 'react-router-dom'

import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Home } from './pages/Home'
import { Compras } from './pages/Compras'
import { Login } from './pages/Login'
import { Inventario } from './pages/Inventario'
import { NotFound } from './pages/NotFound'
import { Prestamos } from './pages/Prestamos'
import { Usuarios } from './pages/Usuarios'
import type { Rol } from './types/auth'

const ALL_ROLES: Rol[] = ['ALUMNO', 'DOCENTE', 'PANOLERO', 'DIRECTOR']
const STAFF_ROLES: Rol[] = ['PANOLERO', 'DIRECTOR']
const DIRECTOR_ROLES: Rol[] = ['DIRECTOR']

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/"
          element={
            <ProtectedRoute roles={ALL_ROLES}>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventario"
          element={
            <ProtectedRoute roles={STAFF_ROLES}>
              <Inventario />
            </ProtectedRoute>
          }
        />
        <Route
          path="/prestamos"
          element={
            <ProtectedRoute roles={ALL_ROLES}>
              <Prestamos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compras"
          element={
            <ProtectedRoute roles={STAFF_ROLES}>
              <Compras />
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute roles={DIRECTOR_ROLES}>
              <Usuarios />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
