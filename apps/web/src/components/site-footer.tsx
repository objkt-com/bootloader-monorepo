import { Link } from "react-router-dom";
import { Github, Twitter } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col items-center gap-4 py-6 md:grid md:h-16 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-6 md:py-0">
        <div className="flex flex-col items-center md:items-start">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            <span className="font-medium text-foreground">bootloader:</span>{" "}
            open experimental generative art
          </p>
        </div>

        <a
          href="https://tzkt.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Built with TzKT API
        </a>

        <div className="flex items-center space-x-4 md:justify-self-end">
          <Link
            to="/resources"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Resources
          </Link>
          <a
            href="https://github.com/objkt-com/bootloader-monorepo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <Github className="h-4 w-4" />
            <span className="sr-only">GitHub</span>
          </a>
          <a
            href="https://x.com/bootloader_art"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <Twitter className="h-4 w-4" />
            <span className="sr-only">Twitter</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
