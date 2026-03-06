import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBootloader } from "@/lib/bootloader-registry";
import type { BootloaderId } from "@/types/bootloader";

export function BootloaderGeneratorEditPage() {
  const { bootloader, id } = useParams<{ bootloader: string; id: string }>();
  const definition = bootloader
    ? getBootloader(bootloader as BootloaderId)
    : undefined;

  if (!definition?.EditPageComponent) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Editing not supported</h1>
        <p className="text-muted-foreground mb-8">
          This bootloader does not define a dedicated edit workflow.
        </p>
        <Button asChild>
          <Link to={id && bootloader ? `/generator/${bootloader}/${id}` : "/explore"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
    );
  }

  const EditPageComponent = definition.EditPageComponent;
  return <EditPageComponent />;
}
