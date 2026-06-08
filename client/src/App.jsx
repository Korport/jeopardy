import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HostBoard from './pages/HostBoard.jsx';
import PlayerView from './pages/PlayerView.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HostBoard />} />
        <Route path="/host" element={<Navigate to="/" replace />} />
        <Route path="/join/:sessionId" element={<PlayerView />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
