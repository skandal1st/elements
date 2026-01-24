import { useMemo } from 'react'
import { User } from 'lucide-react'
import { NotificationBell } from '../notifications/NotificationBell'
import { useAuthStore } from '../../store/auth.store'

/**
 * Форматирует ФИО в формат "Фамилия И.О."
 */
function formatNameWithInitials(fullName: string): string {
  if (!fullName) return 'Пользователь'
  
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return 'Пользователь'
  
  // Если только одно слово - возвращаем как есть
  if (parts.length === 1) return parts[0]
  
  // Формат: Фамилия И.О. (предполагаем порядок: Фамилия Имя Отчество)
  const surname = parts[0]
  const initials = parts
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + '.')
    .join('')
  
  return `${surname} ${initials}`
}

export function Header() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)

  // Получаем имя пользователя из store или декодируем из токена
  const displayName = useMemo(() => {
    if (user?.full_name) {
      return formatNameWithInitials(user.full_name)
    }
    
    // Пробуем получить из токена
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.full_name) {
          return formatNameWithInitials(payload.full_name)
        }
      } catch {
        // Игнорируем ошибки декодирования
      }
    }
    
    return 'Пользователь'
  }, [user, token])

  // Получаем инициалы для аватара
  const avatarInitials = useMemo(() => {
    const fullName = user?.full_name || ''
    if (!fullName) return ''
    
    const parts = fullName.trim().split(/\s+/)
    if (parts.length >= 2) {
      // Первая буква фамилии + первая буква имени
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
    }
    return parts[0].charAt(0).toUpperCase()
  }, [user])

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Elements Platform</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <NotificationBell />
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              {avatarInitials ? (
                <span className="text-sm font-medium text-white">{avatarInitials}</span>
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <span className="text-sm font-medium">{displayName}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
