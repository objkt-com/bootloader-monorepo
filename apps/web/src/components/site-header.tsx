import { Link, useLocation } from "react-router-dom";
import { Search, Menu, X, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet-button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { GeneratorSearchDialog } from "@/components/generator-search-dialog";

const navItems = [
  { href: "/explore", label: "Explore" },
  { href: "/activity", label: "Activity" },
  { href: "/bootloaders", label: "Bootloaders" },
  { href: "/resources", label: "Resources" },
];

export function SiteHeader() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { effectiveTheme, toggle } = useTheme();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const isTextInputTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const tagName = target.tagName;
      return (
        target.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT"
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (event.key === "/" && !isTextInputTarget(event.target)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative">
        <div className="container flex h-14 items-center">
        {/* Logo */}
        <Link to="/" className="mr-2 flex items-center space-x-2 sm:mr-4 md:mr-6">
          <span className="text-lg font-bold sm:text-xl">
            bootloader<span className="text-muted-foreground">:</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "transition-colors hover:text-foreground",
                location.pathname === item.href ||
                  location.pathname.startsWith(item.href + "/")
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side actions */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Theme toggle */}
          <Button variant="ghost" size="icon" onClick={toggle}>
            {effectiveTheme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Search button */}
          <Button
            variant="outline"
            className="hidden md:flex h-9 w-60 justify-between text-muted-foreground hover:text-foreground"
            onClick={() => setSearchOpen(true)}
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Search</span>
            </span>
            <kbd className="hidden lg:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">Search generators</span>
          </Button>

          {/* Create button */}
          <Button asChild size="sm" className="hidden sm:flex">
            <Link to="/create">Create</Link>
          </Button>

          {/* Wallet button */}
          <WalletButton />

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="absolute inset-x-0 top-full z-50 border-t bg-background shadow-md md:hidden">
            <nav className="container py-2 flex flex-col">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "text-sm transition-colors hover:text-foreground py-3",
                    location.pathname === item.href ||
                      location.pathname.startsWith(item.href + "/")
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t mt-1 pt-3 pb-2">
                <Button asChild size="sm" className="w-full">
                  <Link to="/create" onClick={() => setMobileMenuOpen(false)}>
                    Create Generator
                  </Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <GeneratorSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
