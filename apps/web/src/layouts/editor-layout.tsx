import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";
import { Outlet, Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet-button";
import { TooltipProvider } from "@/components/ui/tooltip";

interface EditorLayoutHeaderState {
  title: string;
  onBack?: (() => void | Promise<void>) | null;
}

interface EditorLayoutContextValue {
  setHeader: (state: EditorLayoutHeaderState) => void;
}

const EditorLayoutContext = createContext<EditorLayoutContextValue | null>(null);

export function useEditorLayout() {
  const context = useContext(EditorLayoutContext);
  if (!context) {
    throw new Error("useEditorLayout must be used within EditorLayout");
  }
  return context;
}

export function EditorLayout() {
  const { bootloader, id } = useParams<{ bootloader?: string; id?: string }>();
  const backHref =
    bootloader && id ? `/generator/${bootloader}/${id}` : "/explore";
  const [header, setHeaderState] = useState<EditorLayoutHeaderState>({
    title: "Edit Generator",
    onBack: null,
  });

  const contextValue = useMemo(
    () => ({
      setHeader: (state: EditorLayoutHeaderState) => {
        setHeaderState(state);
      },
    }),
    []
  );

  const handleBack = async () => {
    if (header.onBack) {
      await header.onBack();
    }
  };

  return (
    <TooltipProvider>
      <EditorLayoutContext.Provider value={contextValue}>
        <div className="flex h-screen flex-col">
          <header className="flex h-14 items-center justify-between border-b px-4 shrink-0">
            <div className="flex items-center space-x-4">
              {header.onBack ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void handleBack();
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              ) : (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={backHref}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Link>
                </Button>
              )}
              <span className="text-sm font-medium">{header.title}</span>
            </div>
            <WalletButton />
          </header>
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </EditorLayoutContext.Provider>
    </TooltipProvider>
  );
}
