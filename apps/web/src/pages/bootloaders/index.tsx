import { getAllBootloaders } from "@/lib/bootloader-registry";
import { BootloaderCard } from "@/components/bootloader-card";

export function BootloadersPage() {
  const bootloaders = getAllBootloaders();
  const activeBootloaders = bootloaders.filter((b) => b.status === "active");
  const comingSoonBootloaders = bootloaders.filter(
    (b) => b.status === "coming-soon"
  );

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bootloaders</h1>
        <p className="text-muted-foreground max-w-2xl">
          A bootloader is a runtime environment for your generative artwork.
          <br />
          It defines the system in which your code executes — whether that’s an
          emulator, a virtual machine, or a custom engine.
        </p>
      </div>

      {/* Active Bootloaders */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-6">Available Bootloaders</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeBootloaders.map((bootloader) => (
            <BootloaderCard key={bootloader.id} bootloader={bootloader} />
          ))}
        </div>
      </section>

      {/* Coming Soon */}
      {comingSoonBootloaders.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-6 text-muted-foreground">
            Coming Soon
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comingSoonBootloaders.map((bootloader) => (
              <BootloaderCard key={bootloader.id} bootloader={bootloader} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
