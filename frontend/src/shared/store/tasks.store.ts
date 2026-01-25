import { create } from 'zustand'
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client'

// --- Types ---

export interface Project {
  id: string
  owner_id: string
  title: string
  description?: string
  color: string
  icon?: string
  is_personal: boolean
  is_archived: boolean
  settings?: Record<string, unknown>
  created_at?: string
  updated_at?: string
  // Stats
  total_tasks?: number
  completed_tasks?: number
  in_progress_tasks?: number
  overdue_tasks?: number
  shared_with_count?: number
  user_permission?: 'owner' | 'admin' | 'edit' | 'view'
}

export interface Task {
  id: string
  project_id: string
  parent_id?: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  creator_id: string
  assignee_id?: string
  due_date?: string
  start_date?: string
  completed_at?: string
  order_index: number
  labels?: string[]
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly'
    interval: number
    end_date?: string
  }
  estimated_hours?: number
  actual_hours?: number
  linked_ticket_id?: string
  linked_employee_id?: string
  created_at?: string
  updated_at?: string
  // Extended info
  subtasks_count?: number
  subtasks_completed?: number
  comments_count?: number
  checklist_items?: ChecklistItem[]
  creator_name?: string
  assignee_name?: string
}

export interface ChecklistItem {
  id: string
  task_id: string
  title: string
  is_completed: boolean
  order_index: number
  created_at?: string
}

export interface Label {
  id: string
  project_id: string
  name: string
  color: string
  created_at?: string
}

export interface ProjectShare {
  id: string
  project_id: string
  share_type: 'user' | 'department'
  target_id: string
  permission: 'view' | 'edit' | 'admin'
  created_at?: string
  target_name?: string
  target_email?: string
}

export interface KanbanColumn {
  id: string
  title: string
  tasks: Task[]
}

// --- API (общий клиент /api/v1, пути /tasks/...) ---

const TASKS_PREFIX = '/tasks'

async function tasksGet<T>(path: string): Promise<T> {
  return apiGet<T>(`${TASKS_PREFIX}${path}`)
}

async function tasksPost<T>(path: string, body?: unknown): Promise<T> {
  return apiPost<T>(`${TASKS_PREFIX}${path}`, body)
}

async function tasksPatch<T>(path: string, body: unknown): Promise<T> {
  return apiPatch<T>(`${TASKS_PREFIX}${path}`, body)
}

async function tasksDelete(path: string): Promise<void> {
  return apiDelete(`${TASKS_PREFIX}${path}`)
}

// --- Store ---

interface TasksState {
  // Projects
  projects: Project[]
  currentProject: Project | null
  projectsLoading: boolean
  projectsError: string | null

  // Tasks
  tasks: Task[]
  currentTask: Task | null
  tasksLoading: boolean
  tasksError: string | null

  // Kanban
  kanbanColumns: Record<string, Task[]>

  // Labels
  labels: Label[]

  // Actions - Projects
  loadProjects: (includeArchived?: boolean) => Promise<void>
  loadProject: (id: string) => Promise<void>
  createProject: (data: Partial<Project>) => Promise<Project>
  updateProject: (id: string, data: Partial<Project>) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  archiveProject: (id: string) => Promise<void>
  unarchiveProject: (id: string) => Promise<void>

  // Actions - Tasks
  loadTasks: (filters?: {
    project_id?: string
    status?: string
    my_tasks?: boolean
  }) => Promise<void>
  loadTask: (id: string) => Promise<void>
  loadKanban: (projectId: string) => Promise<void>
  createTask: (data: Partial<Task>) => Promise<Task>
  updateTask: (id: string, data: Partial<Task>) => Promise<Task>
  moveTask: (
    id: string,
    status: string,
    orderIndex: number
  ) => Promise<Task>
  deleteTask: (id: string) => Promise<void>

  // Actions - Checklist
  addChecklistItem: (taskId: string, title: string) => Promise<ChecklistItem>
  updateChecklistItem: (
    taskId: string,
    itemId: string,
    data: Partial<ChecklistItem>
  ) => Promise<ChecklistItem>
  deleteChecklistItem: (taskId: string, itemId: string) => Promise<void>

  // Actions - Labels
  loadLabels: (projectId: string) => Promise<void>
  createLabel: (projectId: string, data: Partial<Label>) => Promise<Label>
  deleteLabel: (projectId: string, labelId: string) => Promise<void>

  // Helpers
  setCurrentProject: (project: Project | null) => void
  setCurrentTask: (task: Task | null) => void
  clearError: () => void
}

export const useTasksStore = create<TasksState>((set) => ({
  // Initial state
  projects: [],
  currentProject: null,
  projectsLoading: false,
  projectsError: null,

  tasks: [],
  currentTask: null,
  tasksLoading: false,
  tasksError: null,

  kanbanColumns: {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
    cancelled: [],
  },

  labels: [],

  // --- Projects ---

  loadProjects: async (includeArchived = false) => {
    set({ projectsLoading: true, projectsError: null })
    try {
      const projects = await tasksGet<Project[]>(
        `/projects/?include_archived=${includeArchived}`
      )
      set({ projects, projectsLoading: false })
    } catch (error) {
      set({
        projectsError: (error as Error).message,
        projectsLoading: false,
      })
    }
  },

  loadProject: async (id: string) => {
    set({ projectsLoading: true, projectsError: null })
    try {
      const project = await tasksGet<Project>(`/projects/${id}`)
      set({ currentProject: project, projectsLoading: false })
    } catch (error) {
      set({
        projectsError: (error as Error).message,
        projectsLoading: false,
      })
    }
  },

  createProject: async (data) => {
    const project = await tasksPost<Project>('/projects/', data)
    set((state) => ({ projects: [project, ...state.projects] }))
    return project
  },

  updateProject: async (id, data) => {
    const project = await tasksPatch<Project>(`/projects/${id}`, data)
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? project : p)),
      currentProject:
        state.currentProject?.id === id ? project : state.currentProject,
    }))
    return project
  },

  deleteProject: async (id) => {
    await tasksDelete(`/projects/${id}`)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject:
        state.currentProject?.id === id ? null : state.currentProject,
    }))
  },

  archiveProject: async (id) => {
    const project = await tasksPost<Project>(`/projects/${id}/archive`)
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? project : p)),
    }))
  },

  unarchiveProject: async (id) => {
    const project = await tasksPost<Project>(`/projects/${id}/unarchive`)
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? project : p)),
    }))
  },

  // --- Tasks ---

  loadTasks: async (filters = {}) => {
    set({ tasksLoading: true, tasksError: null })
    try {
      const params = new URLSearchParams()
      if (filters.project_id) params.append('project_id', filters.project_id)
      if (filters.status) params.append('status', filters.status)
      if (filters.my_tasks) params.append('my_tasks', 'true')

      const tasks = await tasksGet<Task[]>(`/tasks/?${params.toString()}`)
      set({ tasks, tasksLoading: false })
    } catch (error) {
      set({
        tasksError: (error as Error).message,
        tasksLoading: false,
      })
    }
  },

  loadTask: async (id: string) => {
    set({ tasksLoading: true, tasksError: null })
    try {
      const task = await tasksGet<Task>(`/tasks/${id}`)
      set({ currentTask: task, tasksLoading: false })
    } catch (error) {
      set({
        tasksError: (error as Error).message,
        tasksLoading: false,
      })
    }
  },

  loadKanban: async (projectId: string) => {
    set({ tasksLoading: true, tasksError: null })
    try {
      const data = await tasksGet<{ columns: Record<string, Task[]> }>(
        `/tasks/kanban/${projectId}`
      )
      set({ kanbanColumns: data.columns, tasksLoading: false })
    } catch (error) {
      set({
        tasksError: (error as Error).message,
        tasksLoading: false,
      })
    }
  },

  createTask: async (data) => {
    const task = await tasksPost<Task>('/tasks/', data)
    set((state) => ({
      tasks: [task, ...state.tasks],
      kanbanColumns: {
        ...state.kanbanColumns,
        [task.status]: [...(state.kanbanColumns[task.status] || []), task],
      },
    }))
    return task
  },

  updateTask: async (id, data) => {
    const task = await tasksPatch<Task>(`/tasks/${id}`, data)
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
      currentTask: state.currentTask?.id === id ? task : state.currentTask,
    }))
    return task
  },

  moveTask: async (id, status, orderIndex) => {
    const task = await tasksPost<Task>(`/tasks/${id}/move`, {
      status,
      order_index: orderIndex,
    })

    // Update kanban columns locally
    set((state) => {
      const newColumns = { ...state.kanbanColumns }

      // Remove from all columns
      for (const col of Object.keys(newColumns)) {
        newColumns[col] = newColumns[col].filter((t) => t.id !== id)
      }

      // Add to new column at correct position
      if (!newColumns[status]) newColumns[status] = []
      const column = [...newColumns[status]]
      column.splice(orderIndex, 0, task)

      // Update order indices
      newColumns[status] = column.map((t, i) => ({ ...t, order_index: i }))

      return { kanbanColumns: newColumns }
    })

    return task
  },

  deleteTask: async (id) => {
    await tasksDelete(`/tasks/${id}`)
    set((state) => {
      const newColumns = { ...state.kanbanColumns }
      for (const col of Object.keys(newColumns)) {
        newColumns[col] = newColumns[col].filter((t) => t.id !== id)
      }
      return {
        tasks: state.tasks.filter((t) => t.id !== id),
        currentTask: state.currentTask?.id === id ? null : state.currentTask,
        kanbanColumns: newColumns,
      }
    })
  },

  // --- Checklist ---

  addChecklistItem: async (taskId, title) => {
    const item = await tasksPost<ChecklistItem>(
      `/tasks/${taskId}/checklist`,
      { title }
    )
    set((state) => {
      if (state.currentTask?.id === taskId) {
        return {
          currentTask: {
            ...state.currentTask,
            checklist_items: [
              ...(state.currentTask.checklist_items || []),
              item,
            ],
          },
        }
      }
      return state
    })
    return item
  },

  updateChecklistItem: async (taskId, itemId, data) => {
    const item = await tasksPatch<ChecklistItem>(
      `/tasks/${taskId}/checklist/${itemId}`,
      data
    )
    set((state) => {
      if (state.currentTask?.id === taskId) {
        return {
          currentTask: {
            ...state.currentTask,
            checklist_items: state.currentTask.checklist_items?.map((i) =>
              i.id === itemId ? item : i
            ),
          },
        }
      }
      return state
    })
    return item
  },

  deleteChecklistItem: async (taskId, itemId) => {
    await tasksDelete(`/tasks/${taskId}/checklist/${itemId}`)
    set((state) => {
      if (state.currentTask?.id === taskId) {
        return {
          currentTask: {
            ...state.currentTask,
            checklist_items: state.currentTask.checklist_items?.filter(
              (i) => i.id !== itemId
            ),
          },
        }
      }
      return state
    })
  },

  // --- Labels ---

  loadLabels: async (projectId) => {
    const labels = await tasksGet<Label[]>(`/projects/${projectId}/labels/`)
    set({ labels })
  },

  createLabel: async (projectId, data) => {
    const label = await tasksPost<Label>(`/projects/${projectId}/labels/`, {
      ...data,
      project_id: projectId,
    })
    set((state) => ({ labels: [...state.labels, label] }))
    return label
  },

  deleteLabel: async (projectId, labelId) => {
    await tasksDelete(`/projects/${projectId}/labels/${labelId}`)
    set((state) => ({ labels: state.labels.filter((l) => l.id !== labelId) }))
  },

  // --- Helpers ---

  setCurrentProject: (project) => set({ currentProject: project }),
  setCurrentTask: (task) => set({ currentTask: task }),
  clearError: () => set({ projectsError: null, tasksError: null }),
}))
