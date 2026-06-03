export type Rol = 'ALUMNO' | 'DOCENTE' | 'PANOLERO' | 'DIRECTOR'

export type Usuario = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  rol: Rol
  rut: string
}

export type TokenPair = {
  access: string
  refresh: string
}

export type LoginCredentials = {
  username: string
  password: string
}
