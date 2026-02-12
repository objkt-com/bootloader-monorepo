import { Outlet } from 'react-router-dom'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { TooltipProvider } from '@/components/ui/tooltip'

export function RootLayout() {
  return (
    <TooltipProvider>
      <div className="relative flex min-h-screen flex-col overflow-x-hidden">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </TooltipProvider>
  )
}
