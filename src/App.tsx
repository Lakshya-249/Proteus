import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ProteinPage from "./pages/ProteinPage";
import "./index.css";
import StructureDesignerPage from "./pages/StructureDesignerPage";
import AIInsightsPage from "./pages/AIInsightsPage";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/protein/:pdbId" element={<ProteinPage />} />
        <Route path="/protein/:pdbId/insights" element={<AIInsightsPage />} />
        <Route
          path="/design"
          element={<StructureDesignerPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
