import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import CardBrowser from "./pages/CardBrowser";
import Flashcard from "./pages/Flashcard";
import Lexicon from "./pages/Lexicon";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CardBrowser />} />
        <Route path="flashcard" element={<Flashcard />} />
        <Route path="lexicon" element={<Lexicon />} />
      </Route>
    </Routes>
  );
}
