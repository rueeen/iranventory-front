import { Outlet } from 'react-router-dom'

import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 md:flex">
      <Sidebar />

      <div className="flex min-h-screen flex-1 flex-col">
        <Header />
        <main className="flex-1 px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
