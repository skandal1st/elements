import { Video, Phone, PhoneOff } from 'lucide-react'

interface IncomingCallOverlayProps {
  callerMessage: string
  onAccept: () => void
  onDecline: () => void
}

export function IncomingCallOverlay({
  callerMessage,
  onAccept,
  onDecline,
}: IncomingCallOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-8 p-10 bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl max-w-md w-full mx-4">
        {/* Pulsing video icon */}
        <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
          <Video className="w-10 h-10 text-indigo-400" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white">Входящий звонок</h2>

        {/* Caller message */}
        <p className="text-gray-300 text-center text-lg leading-relaxed">
          {callerMessage}
        </p>

        {/* Action buttons */}
        <div className="flex items-center gap-12 mt-4">
          {/* Decline */}
          <button
            type="button"
            onClick={onDecline}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg cursor-pointer"
            title="Отклонить"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Accept */}
          <button
            type="button"
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center transition-colors shadow-lg animate-bounce cursor-pointer"
            title="Принять"
          >
            <Phone className="w-7 h-7 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
