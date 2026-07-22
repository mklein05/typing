import { useState } from 'react';
import TypingTest from './components/TypingTest';
import Dashboard from './components/Dashboard';

function App() {
  const [view, setView] = useState('test');

  if (view === 'dashboard') {
    return <Dashboard onBackToTest={() => setView('test')} />;
  }

  return <TypingTest onViewDashboard={() => setView('dashboard')} />;
}

export default App;
