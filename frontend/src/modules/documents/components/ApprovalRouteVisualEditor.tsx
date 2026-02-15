import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { GripVertical, Plus, Trash2, Users, User } from 'lucide-react'
import { RouteStep } from '@/shared/services/documents.service'
import { apiGet } from '@/shared/api/client'

interface UserOption {
  id: string
  full_name: string
  email: string
}

interface Props {
  steps: RouteStep[]
  onChange: (steps: RouteStep[]) => void
}

export function ApprovalRouteVisualEditor({ steps, onChange }: Props) {
  const [userSearch, setUserSearch] = useState<Record<number, string>>({})
  const [userResults, setUserResults] = useState<Record<number, UserOption[]>>({})
  const [allUsers, setAllUsers] = useState<UserOption[]>([])

  useEffect(() => {
    apiGet<UserOption[]>('/it/users/')
      .then(setAllUsers)
      .catch(() => {})
  }, [])

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const newSteps = [...steps]
    const [moved] = newSteps.splice(result.source.index, 1)
    newSteps.splice(result.destination.index, 0, moved)
    // Reindex orders
    onChange(newSteps.map((s, i) => ({ ...s, order: i + 1 })))
  }

  const addStep = () => {
    onChange([...steps, {
      order: steps.length + 1,
      type: 'sequential',
      name: `Шаг ${steps.length + 1}`,
      approvers: [],
      deadline_hours: 48,
    }])
  }

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }))
    onChange(newSteps)
  }

  const updateStep = (index: number, updates: Partial<RouteStep>) => {
    const newSteps = steps.map((s, i) => i === index ? { ...s, ...updates } : s)
    onChange(newSteps)
  }

  const handleUserSearch = (index: number, query: string) => {
    setUserSearch({ ...userSearch, [index]: query })
    if (query.length >= 1) {
      const results = allUsers.filter(u =>
        u.full_name.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
      setUserResults({ ...userResults, [index]: results })
    } else {
      setUserResults({ ...userResults, [index]: [] })
    }
  }

  const addApprover = (stepIndex: number, user: UserOption) => {
    const step = steps[stepIndex]
    if (step.approvers.find(a => a.user_id === user.id)) return
    updateStep(stepIndex, {
      approvers: [...step.approvers, { user_id: user.id, name: user.full_name }],
    })
    setUserSearch({ ...userSearch, [stepIndex]: '' })
    setUserResults({ ...userResults, [stepIndex]: [] })
  }

  const removeApprover = (stepIndex: number, userId: string) => {
    const step = steps[stepIndex]
    updateStep(stepIndex, {
      approvers: step.approvers.filter(a => a.user_id !== userId),
    })
  }

  return (
    <div className="flex gap-6">
      {/* Left panel — editor */}
      <div className="flex-1 space-y-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="steps">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                {steps.map((step, index) => (
                  <Draggable key={`step-${index}`} draggableId={`step-${index}`} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`p-4 bg-dark-700/50 border rounded-xl transition-colors ${
                          snapshot.isDragging ? 'border-accent-purple/50 shadow-lg' : 'border-dark-600/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div {...provided.dragHandleProps} className="pt-1 cursor-grab">
                            <GripVertical className="w-5 h-5 text-gray-500" />
                          </div>
                          <div className="flex-1 space-y-3">
                            {/* Header */}
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 font-medium">#{step.order}</span>
                              <input
                                type="text"
                                value={step.name}
                                onChange={(e) => updateStep(index, { name: e.target.value })}
                                className="flex-1 px-3 py-1.5 bg-dark-800/50 border border-dark-600/30 rounded-lg text-sm text-white focus:outline-none focus:border-accent-purple/50"
                                placeholder="Название шага"
                              />
                              <button
                                onClick={() => removeStep(index)}
                                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Type toggle */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateStep(index, { type: 'sequential' })}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                  step.type === 'sequential'
                                    ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                                    : 'text-gray-400 border border-dark-600/30 hover:text-white'
                                }`}
                              >
                                <User className="w-3.5 h-3.5" />
                                Последовательный
                              </button>
                              <button
                                onClick={() => updateStep(index, { type: 'parallel' })}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                  step.type === 'parallel'
                                    ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                                    : 'text-gray-400 border border-dark-600/30 hover:text-white'
                                }`}
                              >
                                <Users className="w-3.5 h-3.5" />
                                Параллельный
                              </button>
                              <div className="ml-auto flex items-center gap-2">
                                <span className="text-xs text-gray-500">Срок (ч):</span>
                                <input
                                  type="number"
                                  value={step.deadline_hours || 48}
                                  onChange={(e) => updateStep(index, { deadline_hours: parseInt(e.target.value) || 48 })}
                                  className="w-16 px-2 py-1 bg-dark-800/50 border border-dark-600/30 rounded-lg text-xs text-white text-center focus:outline-none"
                                  min={1}
                                />
                              </div>
                            </div>

                            {/* Approvers */}
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {step.approvers.map((a) => (
                                  <span key={a.user_id} className="flex items-center gap-1.5 px-2.5 py-1 bg-dark-600/50 rounded-lg text-xs text-white">
                                    {a.name}
                                    <button
                                      onClick={() => removeApprover(index, a.user_id)}
                                      className="text-gray-500 hover:text-red-400"
                                    >
                                      &times;
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={userSearch[index] || ''}
                                  onChange={(e) => handleUserSearch(index, e.target.value)}
                                  placeholder="Добавить согласующего..."
                                  className="w-full px-3 py-1.5 bg-dark-800/50 border border-dark-600/30 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50"
                                />
                                {(userResults[index]?.length ?? 0) > 0 && (
                                  <div className="absolute top-full left-0 right-0 mt-1 bg-dark-800 border border-dark-600 rounded-xl shadow-xl z-10 max-h-40 overflow-y-auto">
                                    {userResults[index].map((u) => (
                                      <button
                                        key={u.id}
                                        onClick={() => addApprover(index, u)}
                                        className="w-full px-3 py-2 text-left text-xs text-white hover:bg-dark-700 transition-colors"
                                      >
                                        {u.full_name} <span className="text-gray-500">({u.email})</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <button
          onClick={addStep}
          className="flex items-center gap-2 px-4 py-2.5 w-full justify-center text-sm text-gray-400 border border-dashed border-dark-600/50 rounded-xl hover:text-white hover:border-accent-purple/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить шаг
        </button>
      </div>

      {/* Right panel — preview */}
      <div className="w-64 shrink-0">
        <ApprovalRoutePreview steps={steps} />
      </div>
    </div>
  )
}

function ApprovalRoutePreview({ steps }: { steps: RouteStep[] }) {
  return (
    <div className="p-4 bg-dark-700/30 border border-dark-600/50 rounded-xl">
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Превью маршрута</h4>
      {steps.length === 0 ? (
        <p className="text-xs text-gray-600">Добавьте шаги</p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={idx}>
              <div className={`p-2.5 rounded-lg border text-center ${
                step.type === 'parallel' ? 'border-blue-500/30 bg-blue-500/5' : 'border-dark-600/50 bg-dark-800/50'
              }`}>
                <div className="text-xs text-white font-medium truncate">{step.name || `Шаг ${step.order}`}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {step.type === 'parallel' ? 'Параллельный' : 'Последовательный'}
                  {step.approvers.length > 0 && ` (${step.approvers.length})`}
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <div className="w-px h-4 bg-dark-600" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { ApprovalRoutePreview }
