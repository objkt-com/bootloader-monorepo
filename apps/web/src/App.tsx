import { Routes, Route } from 'react-router-dom'
import { RootLayout } from '@/layouts/root-layout'
import { CreateLayout } from '@/layouts/create-layout'
import { HomePage } from '@/pages/home'
import { ExplorePage } from '@/pages/explore'
import { ActivityPage } from '@/pages/activity'
import { BootloadersPage } from '@/pages/bootloaders'
import { BootloaderDetailPage } from '@/pages/bootloaders/[id]'
import { CreatePage } from '@/pages/create'
import { GeneratorDetailPage } from '@/pages/generator/[id]'
import { BootloaderGeneratorEditPage } from '@/pages/generator/edit/router'
import { TokenDetailPage } from '@/pages/token/[id]'
import { ProfilePage } from '@/pages/profile/[id]'
import { ResourcesPage } from '@/pages/resources'
import { EmbedGeneratorPage } from '@/pages/embed/generator'
import { EmbedTokenPage } from '@/pages/embed/token'
import { PlayerPage } from '@/pages/player'
import { WalletProvider } from '@/hooks/use-wallet'

export default function App() {
  return (
    <WalletProvider>
      <Routes>
        {/* Embed routes - no layout, full-screen for Screenshot One */}
        <Route path="/embed/generator/:bootloader/:id" element={<EmbedGeneratorPage />} />
        <Route path="/embed/token/:bootloader/:tokenId" element={<EmbedTokenPage />} />
        <Route path="/player/:kind/:bootloader/:id" element={<PlayerPage />} />

        {/* Routes with standard layout */}
        <Route element={<RootLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/bootloaders" element={<BootloadersPage />} />
          <Route path="/bootloaders/:id" element={<BootloaderDetailPage />} />
          <Route path="/generator/:bootloader/:id" element={<GeneratorDetailPage />} />
          <Route path="/generator/:bootloader/:id/edit" element={<BootloaderGeneratorEditPage />} />
          <Route path="/token/:bootloader/:tokenId" element={<TokenDetailPage />} />
          <Route path="/profile/:address" element={<ProfilePage />} />
          <Route path="/resources" element={<ResourcesPage />} />
        </Route>

        {/* Create route with special layout (code editor + preview) */}
        <Route path="/create" element={<CreateLayout />}>
          <Route index element={<CreatePage />} />
        </Route>
      </Routes>
    </WalletProvider>
  )
}
