import { Outlet, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet-button";
import { TooltipProvider } from "@/components/ui/tooltip";

export function CreateLayout() {
  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col">
        {/* Compact header for create mode */}
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <span className="text-sm font-medium">Create Generator</span>
          </div>
          <WalletButton />
        </header>

        {/* Main create area - fills remaining space */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}
