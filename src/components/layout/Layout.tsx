import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { PartialDataNotice } from '../ui/DataHealth'

export function Layout() {
  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-screen-xl">
          <Outlet />
        </div>
      </main>
      <PartialDataNotice />
    </div>
  )
}
