import { useState } from "react";

import StructureDesigner from "../features/structure/StructureDesigner";
import ProteinViewer from "../features/proteins/ProteinViewer";

export default function StructureDesignerPage() {
  const [pdbData, setPdbData] = useState("");

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:h-16 sm:py-0 sm:px-6">
        <a
          href="/"
          className="rounded text-base font-semibold tracking-[0.25em] outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:text-lg sm:tracking-[0.3em]"
        >
          PROTEUS
        </a>

        <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">
          Structure Designer
        </div>
      </header>

      {/* Main */}
      <main className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[380px_1fr]">
        {/* Designer */}
        <aside className="border-b border-white/10 p-4 sm:p-6 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <StructureDesigner onGenerated={setPdbData} />
        </aside>

        {/* Viewer */}
        <section className="relative min-h-[60vh] lg:min-h-[calc(100vh-4rem)]">
          {pdbData ? (
            <ProteinViewer pdbData={pdbData} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-xs text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/20">
                  Structure Designer
                </div>

                <p className="mt-3 text-sm leading-6 text-white/30">
                  Define a sequence and generate a structure
                  to visualize it here.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
