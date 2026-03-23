import { createContext, useContext, useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet-button";
import { TooltipProvider } from "@/components/ui/tooltip";

interface CreateLayoutHeaderState {
  title: string;
  onBack?: (() => void | Promise<void>) | null;
}

interface CreateLayoutContextValue {
  setHeader: (state: CreateLayoutHeaderState) => void;
}

const CreateLayoutContext = createContext<CreateLayoutContextValue | null>(null);

export function useCreateLayout() {
  const context = useContext(CreateLayoutContext);
  if (!context) {
    throw new Error("useCreateLayout must be used within CreateLayout");
  }
  return context;
}

export function CreateLayout() {
  const navigate = useNavigate();
  const [header, setHeaderState] = useState<CreateLayoutHeaderState>({
    title: "Create Generator",
    onBack: null,
  });

  const contextValue = useMemo(
    () => ({
      setHeader: (state: CreateLayoutHeaderState) => {
        setHeaderState(state);
      },
    }),
    []
  );

  const handleBack = async () => {
    if (header.onBack) {
      await header.onBack();
      return;
    }
    navigate("/");
  };

  return (
    <TooltipProvider>
      <CreateLayoutContext.Provider value={contextValue}>
        <div className="flex h-screen flex-col">
          <header className="flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => void handleBack()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <span className="text-sm font-medium">{header.title}</span>
            </div>
            <WalletButton />
          </header>

          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </CreateLayoutContext.Provider>
    </TooltipProvider>
  );
}
