import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Package, ShoppingCart, ShoppingBag, Users, Box, UserCog, BarChart3, LogOut, Menu, X, Tag, FileText, Shield, DollarSign } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate }) => {
  const { user, profile, signOut, hasPermission } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allMenuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, permission: null },
    { id: 'productos', name: 'Inventario', icon: Package, permission: 'inventario' },
    { id: 'categorias', name: 'Categorías', icon: Tag, permission: 'categorias' },
    { id: 'ventas', name: 'Ventas', icon: ShoppingCart, permission: 'ventas' },
    { id: 'proveedores', name: 'Proveedores', icon: Users, permission: 'proveedores' },
    { id: 'tickets', name: 'Tickets', icon: FileText, permission: 'tickets' },
    { id: 'fiados', name: 'Fiados', icon: DollarSign, permission: 'fiados' },
    { id: 'usuarios', name: 'Usuarios', icon: UserCog, permission: 'usuarios' },
    { id: 'roles', name: 'Roles', icon: Shield, permission: 'usuarios' }, // Roles usa permiso de usuarios
    { id: 'reportes', name: 'Reportes', icon: BarChart3, permission: 'reportes' }
  ];

  // Filtrar elementos del menú según permisos
  const menuItems = allMenuItems.filter(item => {
    // Si no requiere permiso o el usuario tiene acceso, mostrarlo
    return !item.permission || hasPermission(item.permission, 'view');
  });

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error cerrando sesión:', error);
    }
  };

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-indigo-600 text-white rounded-lg shadow-lg"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay para móvil */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 bg-white shadow-lg fixed h-full z-40 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b pl-16">
          <h1 className="text-2xl font-bold text-indigo-600">Sistema Inventario</h1>
          {profile && (
            <div className="mt-4">
              <p className="text-xs text-gray-500">{profile.role?.name}</p>
            </div>
          )}
        </div>

        <nav className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  currentPage === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-64 p-4 border-t bg-white">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 flex-1 pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
};
