import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useState, useEffect } from "react";
import { Sidebar } from "./shared/components/layout/Sidebar";
import { Header } from "./shared/components/layout/Header";
import { useUIStore } from "./shared/store/ui.store";
import { Dashboard } from "./modules/portal/Dashboard";
import { LoginPage } from "./pages/LoginPage";
import { useAuthStore } from "./shared/store/auth.store";
import { HRLayout } from "./modules/hr/HRLayout";
import { ITLayout } from "./modules/it/ITLayout";
import { TasksLayout } from "./modules/tasks/TasksLayout";
import { Phonebook } from "./modules/hr/pages/Phonebook";
import { Birthdays } from "./modules/hr/pages/Birthdays";
import { OrgChart } from "./modules/hr/pages/OrgChart";
import { HRPanel } from "./modules/hr/pages/HRPanel";
import { UsersPage } from "./modules/hr/pages/UsersPage";
import { EquipmentPage } from "./modules/it/pages/EquipmentPage";
import { TicketsPage } from "./modules/it/pages/TicketsPage";
import { KnowledgeBasePage } from "./modules/it/pages/KnowledgeBasePage";
import { ConsumablesPage } from "./modules/it/pages/ConsumablesPage";
import { EquipmentRequestsPage } from "./modules/it/pages/EquipmentRequestsPage";
import { ReportsPage } from "./modules/it/pages/ReportsPage";
import { LicensesPage } from "./modules/it/pages/LicensesPage";
import { DictionariesPage } from "./modules/it/pages/DictionariesPage";
import { SettingsPage } from "./modules/it/pages/SettingsPage";
import { TelegramPage } from "./modules/it/pages/TelegramPage";
import { SettingsLayout } from "./modules/settings/SettingsLayout";
import { ProfilePage } from "./pages/ProfilePage";
import { ProjectsPage } from "./modules/tasks/pages/ProjectsPage";
import { TaskBoardPage } from "./modules/tasks/pages/TaskBoardPage";
import { TaskListPage } from "./modules/tasks/pages/TaskListPage";
import { ZupSyncPage } from "./modules/hr/pages/ZupSyncPage";
import { DocumentsLayout } from "./modules/documents/DocumentsLayout";
import { DocumentsListPage } from "./modules/documents/pages/DocumentsListPage";
import { DocumentCreatePage } from "./modules/documents/pages/DocumentCreatePage";
import { DocumentDetailPage } from "./modules/documents/pages/DocumentDetailPage";
import { DocumentTypesPage } from "./modules/documents/pages/DocumentTypesPage";
import { TemplatesPage } from "./modules/documents/pages/TemplatesPage";
import { TemplateEditorPage } from "./modules/documents/pages/TemplateEditorPage";
import { ApprovalRoutesPage } from "./modules/documents/pages/ApprovalRoutesPage";
import { ApprovalRouteEditorPage } from "./modules/documents/pages/ApprovalRouteEditorPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const checkTokenExpiry = useAuthStore((state) => state.checkTokenExpiry);

  // Проверяем срок действия токена
  useEffect(() => {
    if (token) {
      checkTokenExpiry();
    }
  }, [token, checkTokenExpiry]);

  if (!token || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PortalAdminRoute({ children }: { children: React.ReactNode }) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setHasAccess(false);
      setLoading(false);
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setHasAccess(!!payload.is_superuser);
    } catch {
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-gray-400">Проверка доступа...</div>
      </div>
    );
  }
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Доступ запрещен</h2>
          <p className="text-gray-400 mb-4">
            Раздел «Настройки» доступен только администратору портала.
          </p>
          <Navigate to="/" replace />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function ModuleRoute({
  module,
  children,
}: {
  module: string;
  children: React.ReactNode;
}) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkModuleAccess();
  }, [module]);

  const checkModuleAccess = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    try {
      // Декодируем токен для получения списка модулей
      const payload = JSON.parse(atob(token.split(".")[1]));
      const modules = payload.modules || [];
      const isSuperuser = payload.is_superuser || false;

      // Суперпользователь имеет доступ ко всем модулям
      if (isSuperuser) {
        setHasAccess(true);
        setLoading(false);
        return;
      }

      // Проверяем доступ к модулю
      const access = modules.includes(module);
      setHasAccess(access);
    } catch (error) {
      console.error("Ошибка проверки доступа к модулю:", error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Проверка доступа...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Доступ запрещен</h2>
          <p className="text-gray-600 mb-4">
            У вас нет доступа к модулю {module.toUpperCase()}
          </p>
          <Navigate to="/" replace />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Компонент-обёртка для защищённого layout с Sidebar и Header
 */
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);

  // На странице логина не показываем Sidebar и Header
  if (location.pathname === "/login" || !isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <div
        className={`transition-all duration-300 ${sidebarCollapsed ? "md:ml-20" : "md:ml-72"}`}
      >
        <Header />
        <main className="p-6 bg-dark-900 min-h-[calc(100vh-73px)]">{children}</main>
      </div>
    </>
  );
}

function AppRoutes() {
  return (
    <AuthenticatedLayout>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr"
          element={
            <ProtectedRoute>
              <ModuleRoute module="hr">
                <HRLayout />
              </ModuleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/hr/phonebook" replace />} />
          <Route path="phonebook" element={<Phonebook />} />
          <Route path="birthdays" element={<Birthdays />} />
          <Route path="org" element={<OrgChart />} />
          <Route path="requests" element={<HRPanel />} />
          <Route path="zup-sync" element={<ZupSyncPage />} />
        </Route>
        <Route
          path="/it"
          element={
            <ProtectedRoute>
              <ModuleRoute module="it">
                <ITLayout />
              </ModuleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/it/equipment" replace />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="knowledge" element={<KnowledgeBasePage />} />
          <Route path="consumables" element={<ConsumablesPage />} />
          <Route
            path="equipment-requests"
            element={<EquipmentRequestsPage />}
          />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="licenses" element={<LicensesPage />} />
          <Route path="dictionaries" element={<DictionariesPage />} />
          <Route path="telegram" element={<TelegramPage />} />
        </Route>
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <PortalAdminRoute>
                <SettingsLayout />
              </PortalAdminRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/settings/users" replace />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="it" element={<SettingsPage />} />
        </Route>
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <ModuleRoute module="tasks">
                <TasksLayout />
              </ModuleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/tasks/projects" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="board" element={<TaskBoardPage />} />
          <Route path="my" element={<TaskListPage />} />
        </Route>
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <ModuleRoute module="documents">
                <DocumentsLayout />
              </ModuleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/documents/list" replace />} />
          <Route path="list" element={<DocumentsListPage />} />
          <Route path="types" element={<DocumentTypesPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="routes" element={<ApprovalRoutesPage />} />
        </Route>
        <Route
          path="/documents/create"
          element={
            <ProtectedRoute>
              <ModuleRoute module="documents">
                <DocumentCreatePage />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/view/:id"
          element={
            <ProtectedRoute>
              <ModuleRoute module="documents">
                <DocumentDetailPage />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/template-editor/:id"
          element={
            <ProtectedRoute>
              <ModuleRoute module="documents">
                <TemplateEditorPage />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/route-editor/:id"
          element={
            <ProtectedRoute>
              <ModuleRoute module="documents">
                <ApprovalRouteEditorPage />
              </ModuleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/hr/users" element={<Navigate to="/settings/users" replace />} />
        <Route path="/it/settings" element={<Navigate to="/settings/it" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthenticatedLayout>
  );
}

function App() {
  const loadFromStorage = useAuthStore((state) => state.loadFromStorage);
  const checkTokenExpiry = useAuthStore((state) => state.checkTokenExpiry);
  const loadUIFromStorage = useUIStore((state) => state.loadFromStorage);

  useEffect(() => {
    // Загружаем данные из localStorage при старте
    loadFromStorage();
    loadUIFromStorage();

    // Периодически проверяем срок действия токена (каждые 30 секунд)
    const interval = setInterval(() => {
      checkTokenExpiry();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadFromStorage, checkTokenExpiry, loadUIFromStorage]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-dark-900 transition-colors">
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}

export default App;
