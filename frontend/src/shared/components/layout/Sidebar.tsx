import { useState, useEffect, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, Users, Server, Wallet, 
  Menu, X, LogOut, User
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

interface Module {
  code: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  path: string
}

const modules: Module[] = [
  { code: 'hr', name: 'HR', icon: Users, path: '/hr' },
  { code: 'it', name: 'IT', icon: Server, path: '/it' },
  { code: 'finance', name: 'Финансы', icon: Wallet, path: '/finance' },
]

/**
 * Форматирует ФИО в формат "Фамилия И.О."
 */
function formatNameWithInitials(fullName: string): string {
  if (!fullName) return 'Пользователь'
  
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return 'Пользователь'
  
  if (parts.length === 1) return parts[0]
  
  const surname = parts[0]
  const initials = parts
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + '.')
    .join('')
  
  return `${surname} ${initials}`
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [availableModules, setAvailableModules] = useState<string[]>([])
  const [userFullName, setUserFullName] = useState<string>('')
  const location = useLocation()
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    // Получаем список доступных модулей из токена или API
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const modules = payload.modules || []
        const isSuperuser = payload.is_superuser || false
        
        // Получаем имя пользователя из токена
        if (payload.full_name) {
          setUserFullName(payload.full_name)
        }
        
        // Суперпользователь видит все модули
        if (isSuperuser) {
          setAvailableModules(['hr', 'it', 'finance'])
        } else {
          setAvailableModules(modules)
        }
      } catch (e) {
        console.error('Ошибка декодирования токена:', e)
      }
    }
  }, [])

  // Отображаемое имя пользователя
  const displayName = useMemo(() => {
    if (user?.full_name) {
      return formatNameWithInitials(user.full_name)
    }
    if (userFullName) {
      return formatNameWithInitials(userFullName)
    }
    return 'Пользователь'
  }, [user, userFullName])

  const filteredModules = modules.filter(m => 
    availableModules.includes(m.code) || availableModules.length === 0
  )

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded shadow"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-gray-900 text-white transform transition-transform duration-300 z-40
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-8">Elements</h1>
          
          <nav className="space-y-2">
            <Link
              to="/"
              className={`
                flex items-center gap-3 p-3 rounded-lg transition-colors
                ${location.pathname === '/' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-800'
                }
              `}
              onClick={() => setIsOpen(false)}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span>Главная</span>
            </Link>

            {filteredModules.map((module) => {
              const Icon = module.icon
              const isActive = location.pathname.startsWith(module.path)
              
              return (
                <Link
                  key={module.code}
                  to={module.path}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-800'
                    }
                  `}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span>{module.name}</span>
                </Link>
              )
            })}
          </nav>

          <div className="mt-8 pt-8 border-t border-gray-700">
            <div className="flex items-center gap-3 p-3 text-gray-300">
              <User className="w-5 h-5" />
              <span className="text-sm">{displayName}</span>
            </div>
            <button
              className="flex items-center gap-3 p-3 w-full text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              onClick={() => {
                logout()
                navigate('/login')
                setIsOpen(false)
              }}
            >
              <LogOut className="w-5 h-5" />
              <span>Выход</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
