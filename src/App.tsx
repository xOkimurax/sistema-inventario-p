import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/auth/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/dashboard/Dashboard';
import { Productos } from './components/productos/Productos';
import { Ventas } from './components/ventas/Ventas';
import { Proveedores } from './components/proveedores/Proveedores';
import { Categorias } from './components/categorias/Categorias';
import { Tickets } from './components/tickets/Tickets';
import { Fiados } from './components/fiados/Fiados';
import { Usuarios } from './components/usuarios/Usuarios';
import { Roles } from './components/roles/Roles';
import { Reportes } from './components/reportes/Reportes';
import { Toaster, toast } from 'sonner';

const AppContent: React.FC = () => {
  const { user, loading, hasPermission } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Mapeo de páginas a módulos de permisos
  const pagePermissionMap: Record<string, { module: string; action: string } | null> = {
    'dashboard': null, // Dashboard siempre accesible
    'productos': { module: 'inventario', action: 'view' },
    'ventas': { module: 'ventas', action: 'view' },
    'proveedores': { module: 'proveedores', action: 'view' },
    'categorias': { module: 'categorias', action: 'view' },
    'tickets': { module: 'tickets', action: 'view' },
    'fiados': { module: 'fiados', action: 'view' },
    'usuarios': { module: 'usuarios', action: 'view' },
    'roles': { module: 'usuarios', action: 'manage_roles' },
    'reportes': { module: 'reportes', action: 'view' }
  };

  // Verificar permisos para la página actual
  const checkPagePermission = (page: string): boolean => {
    const permission = pagePermissionMap[page];
    if (!permission) return true; // Dashboard siempre accesible
    return hasPermission(permission.module, permission.action);
  };

  // Prevenir cambio de valores con rueda del mouse en inputs tipo number
  useEffect(() => {
    const preventScrollChange = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', preventScrollChange, { passive: false });

    return () => {
      document.removeEventListener('wheel', preventScrollChange);
    };
  }, []);

  // Sincronizar el estado con la URL
  useEffect(() => {
    const path = window.location.pathname;
    const page = path.substring(1) || 'dashboard'; // Remover la / inicial
    const validPages = ['dashboard', 'productos', 'ventas', 'proveedores', 'categorias', 'tickets', 'fiados', 'usuarios', 'roles', 'reportes'];

    if (validPages.includes(page)) {
      // Verificar si tiene permiso para esta página
      if (checkPagePermission(page)) {
        setCurrentPage(page);
      } else {
        // Si no tiene permiso, redirigir al dashboard
        setCurrentPage('dashboard');
        window.history.pushState({}, '', '/dashboard');
      }
    }
  }, []);

  
  // Función para cambiar página y actualizar URL
  const handleNavigate = (page: string) => {
    // Verificar permisos antes de navegar
    if (!checkPagePermission(page)) {
      toast.error('No tienes permisos para acceder a esta página');
      return;
    }

    setCurrentPage(page);
    window.history.pushState({}, '', `/${page}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'productos':
        return <Productos />;
      case 'categorias':
        return <Categorias />;
      case 'ventas':
        return <Ventas />;
      case 'proveedores':
        return <Proveedores />;
      case 'tickets':
        return <Tickets />;
      case 'fiados':
        return <Fiados />;
      case 'usuarios':
        return <Usuarios />;
      case 'roles':
        return <Roles />;
      case 'reportes':
        return <Reportes />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors closeButton />
      <AppContent />
    </AuthProvider>
  );
}

export default App;
