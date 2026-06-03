import type { Rol } from './auth'

export type UsuarioInput = {
  email?: string
  first_name?: string
  last_name?: string
  rol?: Rol
  rut?: string | null
}
