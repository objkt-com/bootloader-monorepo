import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface P5JsInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function P5JsInfoDialog({
  open,
  onOpenChange,
}: P5JsInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl gap-5">
        <DialogHeader>
          <DialogTitle>About this p5.js editor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-6">
          <p>
            You only edit <code>sketch.js</code> here. Bootloader packages the
            runtime, manifest, and published artifact around it.
          </p>
          <div className="border-t pt-4 space-y-3">
            <p>
              The runtime is deterministic. The token seed drives p5&apos;s{" "}
              <code>random()</code>, <code>noise()</code>, and related
              randomness used during rendering.
            </p>
            <p>
              Bootloader also seeds <code>Math.random()</code>, which helps
              keep p5.sound and other library code paths aligned with the same
              token seed when they rely on random values internally.
            </p>
            <p>
              The publish or save step uploads the current sketch to IPFS first,
              then lets you render and choose the cover image for the
              generator.
            </p>
            <p>
              Generators stay updateable, so you can return later and publish a
              new version of the code or metadata.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button asChild variant="outline">
            <Link to="/bootloaders/p5-js" onClick={() => onOpenChange(false)}>
              Open Full Guide
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
