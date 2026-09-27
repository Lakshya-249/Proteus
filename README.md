# Proteus Web

Frontend application for **Proteus**, an interactive protein structure analysis and design platform.

Proteus provides a browser-based environment for exploring protein structures, inspecting residues in 3D, running structural analysis, and generating user-defined protein structures.

---

## Overview

The Proteus frontend connects computational protein-analysis APIs with an interactive molecular visualization interface.

The application currently supports:

* Interactive 3D protein visualization
* RCSB PDB structure loading
* Chain selection
* Cartoon, surface, and stick representations
* Residue-level selection
* DSSP secondary-structure visualization
* Solvent-accessibility analysis
* Residue analysis tables
* User-defined protein sequence input
* User-defined secondary-structure patterns
* Generated PDB visualization
* Synchronization between residue tables and the 3D structure

---

## Architecture

```text
                         Proteus Web
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
       Structure Viewer                 Analysis Interface
          3Dmol.js                           │
              │                              │
              │                       ┌──────┴──────┐
              │                       │             │
              ▼                       ▼             ▼
        PDB Structure                DSSP       Structure
        Visualization              Results      Design
              │                       │             │
              └───────────────┬───────┴─────────────┘
                              │
                              ▼
                         Proteus API
                           FastAPI
```

---

## Technology Stack

| Component               | Technology   |
| ----------------------- | ------------ |
| Framework               | React        |
| Language                | TypeScript   |
| Build tool              | Vite         |
| Styling                 | Tailwind CSS |
| Molecular visualization | 3Dmol.js     |
| API communication       | Fetch        |
| Structure format        | PDB          |
| Backend                 | FastAPI      |

---

# Project Structure

```text
apps/web/
│
├── src/
│   │
│   ├── features/
│   │   │
│   │   ├── analysis/
│   │   │   ├── AnalysisPanel.tsx
│   │   │   └── useProteinAnalysis.ts
│   │   │
│   │   ├── proteins/
│   │   │   └── ProteinViewer.tsx
│   │   │
│   │   └── structure/
│   │       └── ...
│   │
│   ├── pages/
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── public/
├── package.json
└── README.md
```

The frontend is organized around feature-level modules rather than placing all protein functionality into a single component.

---

# Getting Started

## Requirements

Node.js 18+ is recommended.

Check:

```bash
node --version
```

and:

```bash
npm --version
```

---

## Install Dependencies

From:

```text
apps/web
```

run:

```bash
npm install
```

---

## Start Development Server

```bash
npm run dev
```

The application will normally be available at:

```text
http://localhost:5173
```

---

# Protein Structure Viewer

The core visualization component is built using **3Dmol.js**.

The viewer can load:

1. Experimental PDB structures from RCSB
2. Generated PDB structures returned by the Proteus backend

```text
RCSB PDB
   │
   ▼
PDB text
   │
   ▼
3Dmol.js
   │
   ▼
Interactive 3D structure
```

Generated structures follow the same pipeline:

```text
Structure Designer
       │
       ▼
Proteus API
       │
       ▼
Generated PDB
       │
       ▼
3Dmol.js
       │
       ▼
Interactive structure
```

---

# Molecular Representations

The viewer currently supports multiple representations.

### Cartoon

Displays the protein backbone using secondary-structure-aware cartoon geometry.

```text
cartoon
```

### Surface

Displays a molecular surface around the structure.

```text
surface
```

### Stick

Displays atoms and bonds using a stick representation.

```text
stick
```

Users can switch representations without reloading the structure.

---

# Chain Selection

When a PDB structure is loaded, the frontend extracts the available chains from the atomic data.

Example:

```text
ALL CHAINS
CHAIN A
CHAIN B
CHAIN C
```

Selecting a chain updates the molecular visualization and focuses subsequent analysis on that chain.

---

# Residue Mapping

The viewer extracts residue information directly from the loaded PDB model.

The frontend creates a mapping:

```text
Chain
  │
  ├── Residue 1
  ├── Residue 2
  ├── Residue 3
  └── ...
```

Example:

```ts
{
  A: [
    {
      resi: 1,
      resn: "M"
    },
    {
      resi: 2,
      resn: "Q"
    }
  ]
}
```

This allows other components to reference residues without independently parsing the PDB file.

---

# DSSP Analysis

Proteus provides a dedicated analysis interface for DSSP results.

The frontend sends:

```http
POST /api/analysis/dssp
```

with:

```json
{
  "pdb_id": "1UBQ",
  "chain_id": "A"
}
```

The backend returns residue-level information:

```json
{
  "method": "DSSP",
  "pdb_id": "1UBQ",
  "chain_id": "A",
  "residues": [
    {
      "resi": 1,
      "resn": "M",
      "secondary_structure": "C",
      "accessibility": 53
    }
  ]
}
```

The frontend converts these results into:

* secondary-structure labels
* accessibility values
* residue tables
* 3D visualization styles

---

# Secondary Structure Visualization

DSSP assignments are mapped to readable structural labels.

| DSSP | Frontend Label |
| ---- | -------------- |
| H    | α-Helix        |
| G    | 3₁₀ Helix      |
| I    | π-Helix        |
| E    | β-Sheet        |
| B    | β-Bridge       |
| T    | Turn           |
| S    | Bend           |
| C    | Coil           |

The structure viewer can use the DSSP result to recolor residues according to their assigned secondary structure.

---

# Residue Selection

Residues can be selected directly from the analysis table.

For example:

```text
Residue 30
   ↓
Chain A / Residue 30
   ↓
3D viewer
   ↓
Residue highlighted
```

The selection is represented as:

```ts
{
  chain: "A",
  residue: 30
}
```

The viewer then highlights the selected residue and zooms the camera to the corresponding molecular region.

This creates a direct connection between:

```text
Numerical analysis
       ↕
Residue table
       ↕
3D structure
```

---

# Structure Designer

Proteus also provides a user-facing structure-design interface.

Users can specify:

### Amino-acid sequence

```text
MKTAAAAAAKG
```

### Secondary-structure pattern

```text
HHHHHHHHHCC
```

The frontend sends these parameters to:

```http
POST /api/design/structure
```

Example:

```json
{
  "sequence": "MKTAAAAAAKG",
  "structure": "HHHHHHHHHCC"
}
```

The backend returns a generated PDB structure.

The frontend then loads the returned PDB directly into 3Dmol.js.

---

# Designed Structure Workflow

```text
User
 │
 ├── Sequence
 │      MKTAAAAAAKG
 │
 └── Structure
        HHHHHHHHHCC
             │
             ▼
       Proteus API
             │
             ▼
       Generated PDB
             │
             ▼
       3Dmol.js
             │
             ▼
      Interactive model
```

This allows users to move from an abstract sequence/secondary-structure specification to a directly inspectable 3D representation.

---

# State Management

Protein-analysis state is isolated through feature-specific hooks.

For example:

```ts
const {
  runAnalysis,
  result,
  loading,
  error,
} = useProteinAnalysis();
```

This keeps API communication separate from the visual presentation layer.

The analysis component is responsible for:

* initiating analysis
* displaying loading state
* displaying errors
* rendering results

while the viewer remains responsible for molecular visualization.

---

# Component Responsibilities

## `ProteinViewer`

Responsible for:

* PDB loading
* 3Dmol.js initialization
* molecular representation
* chain filtering
* residue mapping
* DSSP visualization
* residue highlighting
* camera positioning

---

## `AnalysisPanel`

Responsible for:

* DSSP analysis controls
* analysis state
* result presentation
* residue table
* structure labels
* accessibility values
* residue selection

---

## `useProteinAnalysis`

Responsible for:

* communicating with the backend
* managing analysis state
* exposing analysis results
* handling loading and errors

---

# Data Flow

The frontend follows a unidirectional data flow.

```text
                    ┌──────────────────┐
                    │   ProteinViewer  │
                    └────────┬─────────┘
                             │
                       Residue Map
                             │
                             ▼
                    ┌──────────────────┐
                    │ Analysis / UI    │
                    └────────┬─────────┘
                             │
                       API Request
                             │
                             ▼
                    ┌──────────────────┐
                    │  Proteus Server  │
                    └────────┬─────────┘
                             │
                       DSSP Result
                             │
                             ▼
                    ┌──────────────────┐
                    │ Analysis Panel   │
                    └────────┬─────────┘
                             │
                     Residue Selection
                             │
                             ▼
                    ┌──────────────────┐
                    │   3D Viewer      │
                    └──────────────────┘
```

---

# Error and Loading States

The UI handles API and structure-loading states explicitly.

### Loading

```text
Analyzing...
```

### Analysis failure

```text
Unable to run structural analysis.
```

### Structure failure

```text
Failed to load PDB structure.
```

### Missing sequence

```text
No sequence available for analysis.
```

This prevents computational failures from appearing as silent UI failures.

---

# Research-Oriented Interface

Proteus is designed around the idea that molecular visualization should be connected directly to computational analysis.

Instead of treating the 3D viewer as an isolated visualization component, the interface connects:

```text
Sequence
   │
   ▼
Structure
   │
   ▼
Secondary Structure
   │
   ▼
Residue Properties
   │
   ▼
3D Inspection
```

This makes individual computational results directly inspectable in the molecular structure.

---

# Current Capabilities

* [x] Interactive PDB visualization
* [x] RCSB structure loading
* [x] Generated PDB loading
* [x] Cartoon representation
* [x] Surface representation
* [x] Stick representation
* [x] Chain selection
* [x] Residue mapping
* [x] Residue selection
* [x] 3D residue highlighting
* [x] DSSP integration
* [x] Secondary-structure visualization
* [x] Solvent-accessibility display
* [x] Residue analysis table
* [x] User-defined structure generation
* [x] Generated-structure visualization

---

# Future Work

Potential frontend extensions include:

* interactive sequence-to-structure mapping
* residue-property heatmaps
* contact-map visualization
* distance-matrix visualization
* Ramachandran plot
* hydrogen-bond visualization
* ligand interaction visualization
* structural alignment UI
* RMSD comparison
* multiple-structure comparison
* mutation visualization
* residue interaction networks
* structure-quality dashboards
* interactive structure-design constraints

---

# Development Philosophy

Proteus treats molecular visualization as an interactive research interface rather than a static 3D viewer.

The goal is to make computational results directly explorable:

```text
Calculate
   ↓
Visualize
   ↓
Select
   ↓
Inspect
   ↓
Understand
```

---

## Project

**Proteus Web**

Interactive frontend for protein structure analysis and computational structure design.

```
```
