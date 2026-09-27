import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  searchPdb,
  type PdbSearchResult,
} from "../features/search/pdbSearch";

function HomePage() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(event: FormEvent) {
    event.preventDefault();

    const value = query.trim();

    if (!value || loading) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const data = await searchPdb(value);

      setResults(data);

      if (data.length === 0) {
        setError("No structures found.");
      }
    } catch {
      setError("Unable to search the PDB.");
    } finally {
      setLoading(false);
    }
  }

  function openDesigner() {
    navigate("/design");
  }

  return (
    <main className="min-h-screen bg-[#05070a] text-white">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-white/10 px-4 sm:px-6">
        <div className="text-lg font-semibold tracking-[0.3em]">
          PROTEUS
        </div>

        <button
          onClick={openDesigner}
          className="group flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/50 outline-none transition hover:border-white/30 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 sm:px-4"
        >
          <span className="text-white/30 transition group-hover:text-white">
            +
          </span>

          <span className="hidden sm:inline">
            Design Structure
          </span>

          <span className="sm:hidden">
            Design
          </span>
        </button>
      </header>

      {/* Hero */}
      <section className="flex min-h-[calc(100vh-4rem)] flex-col items-center px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
        <div className="mb-5 font-mono text-[10px] uppercase tracking-[0.35em] text-white/30 sm:text-xs sm:tracking-[0.4em]">
          Open Molecular Research
        </div>

        <h1 className="max-w-4xl text-center text-4xl font-light tracking-tight sm:text-5xl md:text-7xl">
          Explore the machinery
          <br />
          <span className="text-white/40">
            of life.
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-center text-sm leading-6 text-white/40 sm:mt-6">
          Explore protein structures and research-driven
          analysis through an interactive molecular interface.
        </p>

        {/* Primary Actions */}
        <div className="mt-10 w-full max-w-2xl sm:mt-12">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-white/25">
            Explore existing structures
          </div>

          {/* Search */}
          <form onSubmit={handleSearch}>
            <div className="flex w-full flex-col border border-white/15 bg-white/[0.02] transition focus-within:border-white/40 sm:flex-row">
              <input
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Search protein or PDB ID..."
                className="min-w-0 flex-1 bg-transparent px-4 py-4 text-sm outline-none placeholder:text-white/20 sm:px-5"
              />

              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="border-t border-white/10 px-5 py-3 font-mono text-xs uppercase tracking-wider text-white/60 outline-none transition hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black disabled:cursor-not-allowed disabled:opacity-30 sm:border-l sm:border-t-0 sm:px-6"
              >
                {loading ? "Searching" : "Search"}
              </button>
            </div>
          </form>

          {/* Search Examples */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] text-white/25">
            <span>TRY</span>

            {["1A3N", "1CRN", "6VXX"].map((id) => (
              <button
                key={id}
                onClick={() =>
                  navigate(`/protein/${id}`)
                }
                className="rounded-sm border-b border-transparent outline-none transition hover:border-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        {/* Structure Designer */}
        <div className="mt-10 w-full max-w-2xl">
          <button
            onClick={openDesigner}
            className="group w-full border border-white/10 bg-white/[0.015] p-5 text-left outline-none transition hover:border-white/25 hover:bg-white/[0.035] focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/40 sm:p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
                  Structure Designer
                </div>

                <h2 className="mt-2 text-lg font-light text-white sm:text-xl">
                  Build your own protein structure
                </h2>

                <p className="mt-2 max-w-lg text-xs leading-5 text-white/35 sm:text-sm">
                  Define a sequence, shape its secondary structure,
                  and generate a molecular model directly in Proteus.
                </p>
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 font-mono text-lg text-white/30 transition group-hover:border-white/30 group-hover:text-white">
                →
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-wider text-white/25">
              <span className="border border-white/10 px-2 py-1">
                Sequence
              </span>

              <span className="border border-white/10 px-2 py-1">
                Secondary Structure
              </span>

              <span className="border border-white/10 px-2 py-1">
                3D Model
              </span>
            </div>
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-12 w-full max-w-2xl">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-white/30">
              Structures
            </div>

            <div className="divide-y divide-white/10 border-y border-white/10">
              {results.map((result) => (
                <button
                  key={result.pdbId}
                  onClick={() =>
                    navigate(`/protein/${result.pdbId}`)
                  }
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left outline-none transition hover:bg-white/5 focus-visible:bg-white/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40"
                >
                  <span className="truncate font-mono text-sm">
                    {result.pdbId}
                  </span>

                  <span className="shrink-0 font-mono text-[10px] text-white/30">
                    OPEN →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 w-full max-w-2xl border border-white/10 px-4 py-3 text-center font-mono text-xs text-white/40">
            {error}
          </div>
        )}
      </section>
    </main>
  );
}

export default HomePage;
