import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { Layout } from './components/layout/Layout'
import Overview from './pages/Overview'
import ByLLM from './pages/ByLLM'
import ByPrompt from './pages/ByPrompt'
import Competitors from './pages/Competitors'
import Sources from './pages/Sources'
import Trends from './pages/Trends'
import Recommendations from './pages/Recommendations'
import AIX from './pages/AIX'
import Sentiment from './pages/Sentiment'
import Report from './pages/Report'

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/report" element={<Report />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/aix" element={<AIX />} />
          <Route path="/by-llm" element={<ByLLM />} />
          <Route path="/by-prompt" element={<ByPrompt />} />
          <Route path="/sentiment" element={<Sentiment />} />
          <Route path="/competitors" element={<Competitors />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/recommendations" element={<Recommendations />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  )
}
