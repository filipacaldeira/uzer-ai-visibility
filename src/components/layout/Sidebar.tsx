import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Radio, Tags, Users2, Link2, TrendingUp, Lightbulb, Layers,
  ChevronRight, ChevronDown, Building2, Sun, Moon, Smile
} from 'lucide-react'
import { api, type Brand } from '../../api/client'
import { useTheme } from '../../context/ThemeContext'

const NAV = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/by-prompt', label: 'Topics | Prompts', icon: Tags },
  { path: '/sentiment', label: 'Sentiment', icon: Smile },
  { path: '/sources', label: 'Sources', icon: Link2 },
  { path: '/by-llm', label: 'By LLM', icon: Radio },
  { path: '/aix', label: 'AIR Framework', icon: Layers },
  { path: '/competitors', label: 'Competitors', icon: Users2 },
  { path: '/trends', label: 'Trends', icon: TrendingUp },
  { path: '/recommendations', label: 'Actions', icon: Lightbulb },
]

export function Sidebar() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()

  useEffect(() => {
    api.brands().then(data => {
      setBrands(data)
      setSelectedBrand(data.find(b => b.id === 'c727ae2e-28f3-40f9-8e79-bc83ee402cbb') || data[0])
    }).catch(() => {})
  }, [])

  return (
    <aside className="w-56 flex-shrink-0 bg-brand-sidebar border-r border-white/5 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-extrabold tracking-tight">U</span>
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-tight">UZER</span>
            <div className="text-2xs text-white/60">AI Visibility</div>
          </div>
        </div>
      </div>

      {/* Brand Selector */}
      <div className="px-3 py-3 border-b border-white/10 relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/10 border border-white/10 hover:border-white/25 transition-colors text-left"
        >
          <Building2 size={13} className="text-white flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">
              {selectedBrand?.name?.replace('Oficinas ', '').replace(' Portugal', '') || 'Loading…'}
            </div>
            <div className="text-2xs text-white/60 capitalize">{selectedBrand?.industry || ''}</div>
          </div>
          <ChevronDown size={12} className={`text-white/70 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && brands.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-brand-elevated border border-brand-border rounded-lg shadow-xl z-50 overflow-hidden">
            {brands.map(b => (
              <button
                key={b.id}
                onClick={() => { setSelectedBrand(b); setOpen(false); navigate('/') }}
                className={`w-full flex items-start gap-2 px-3 py-2.5 hover:bg-brand-bg text-left transition-colors ${selectedBrand?.id === b.id ? 'bg-brand-primary/10' : ''}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 flex-shrink-0 opacity-60" />
                <div>
                  <div className="text-xs font-medium text-brand-text">{b.name}</div>
                  <div className="text-2xs text-brand-dim capitalize">{b.industry}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-white/20 text-white font-medium shadow-sm'
                  : 'text-white/75 hover:text-white hover:bg-white/10'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={15} className={isActive ? 'text-white' : ''} />
                <span className="flex-1 text-sm">{item.label}</span>
                {isActive && <ChevronRight size={11} className="text-white/80" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-secondary animate-pulse" />
          <span className="text-2xs text-white/60">Live data · updated daily</span>
        </div>
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-colors text-xs"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
      </div>
    </aside>
  )
}
