import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "./index.css";

// Route-level code splitting keeps the heavy 3Dmol bundle off the home page.
const HomePage = lazy(() => import("./pages/HomePage"));
const ProteinPage = lazy(() => import("./pages/ProteinPage"));
const AIInsightsPage = lazy(() => import("./pages/AIInsightsPage"));
const StructureDesignerPage = lazy(() => import("./pages/StructureDesignerPage"));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070a] font-mono text-xs text-white/40">
      LOADING…
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#05070a] p-6 text-center text-white">
      <div className="font-mono text-xs text-white/40">404 · PAGE NOT FOUND</div>
      <Link
        to="/"
        className="rounded text-sm text-white/60 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
      >
        ← Return to Proteus
      </Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/protein/:pdbId" element={<ProteinPage />} />
          <Route path="/protein/:pdbId/insights" element={<AIInsightsPage />} />
          <Route path="/design" element={<StructureDesignerPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
