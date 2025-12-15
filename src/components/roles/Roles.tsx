import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Role } from '../../types';
import { Shield, Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { ConfirmModal } from '../common/ConfirmModal';

interface Permission {
  module: string;
  label: string;
  enabled: boolean;
}

const MODULES = [
  { key: 'inventario', label: 'Inventario' },
  { key: 'categorias', label: 'Categorías' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'fiados', label: 'Fiados' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'anulaciones', label: 'Anulaciones' }
];

export const RolesComponent: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const { profile: currentProfile } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: {} as Record<string, boolean>
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {}
  });

  // Verificar si es Admin
  const isAdmin = currentProfile?.role?.name === 'Admin';

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error cargando roles:', error);
      toast.error('Error al cargar roles');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      permissions: {}
    });
    setEditingRole(null);
  };

  const handleOpenModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description || '',
        permissions: role.permissions?.all === true ?
          Object.fromEntries(MODULES.map(m => [m.key, true])) :
          role.permissions as Record<string, boolean>
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handlePermissionToggle = (moduleKey: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: !prev.permissions[moduleKey]
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('El nombre del rol es requerido');
      return;
    }

    try {
      // Verificar si todos los permisos están activados para usar "all: true"
      const allEnabled = MODULES.every(m => formData.permissions[m.key] === true);
      const permissions = allEnabled ? { all: true } : formData.permissions;

      if (editingRole) {
        // Actualizar rol existente
        const { error } = await supabase
          .from('roles')
          .update({
            name: formData.name,
            description: formData.description,
            permissions,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingRole.id);

        if (error) throw error;
        toast.success('Rol actualizado exitosamente');
      } else {
        // Crear nuevo rol
        const { error } = await supabase
          .from('roles')
          .insert({
            name: formData.name,
            description: formData.description,
            permissions,
            is_active: true
          });

        if (error) throw error;
        toast.success('Rol creado exitosamente');
      }

      setShowModal(false);
      resetForm();
      loadRoles();
    } catch (error: any) {
      console.error('Error guardando rol:', error);
      if (error.code === '23505') {
        toast.error('Ya existe un rol con ese nombre');
      } else {
        toast.error(error.message || 'Error al guardar rol');
      }
    }
  };

  const handleDeleteRole = async (role: Role) => {
    try {
      // Verificar si el rol está en uso
      const { data: inUse, error: checkError } = await supabase.rpc('is_role_in_use', {
        p_role_id: role.id
      });

      if (checkError) throw checkError;

      if (inUse) {
        // Obtener lista de usuarios que usan este rol
        const { data: users, error: usersError } = await supabase.rpc('get_users_with_role', {
          p_role_id: role.id
        });

        let usersList = '';
        if (!usersError && users && users.length > 0) {
          usersList = users.map((u: any) => `${u.full_name} (@${u.username})`).join(', ');
        }

        setConfirmModal({
          isOpen: true,
          title: 'No se puede eliminar rol',
          message: `No se puede eliminar el rol "${role.name}" porque está siendo usado por los siguientes usuarios: ${usersList || 'usuarios activos'}. Debe asignar otro rol a estos usuarios primero.`,
          type: 'warning',
          onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
        });
        return;
      }

      // Si no está en uso, proceder con la eliminación
      setConfirmModal({
        isOpen: true,
        title: '¿Eliminar Rol?',
        message: `¿Estás seguro de eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`,
        type: 'danger',
        onConfirm: async () => {
          try {
            const { error } = await supabase
              .from('roles')
              .delete()
              .eq('id', role.id);

            if (error) throw error;
            toast.success('Rol eliminado exitosamente');
            setConfirmModal({ ...confirmModal, isOpen: false });
            loadRoles();
          } catch (error) {
            console.error('Error eliminando rol:', error);
            toast.error('Error al eliminar rol');
            setConfirmModal({ ...confirmModal, isOpen: false });
          }
        }
      });
    } catch (error) {
      console.error('Error verificando uso del rol:', error);
      toast.error('Error al verificar si el rol está en uso');
    }
  };

  const handleToggleActive = async (role: Role) => {
    try {
      // Si se intenta desactivar, verificar si el rol está en uso
      if (role.is_active) {
        const { data: inUse, error: checkError } = await supabase.rpc('is_role_in_use', {
          p_role_id: role.id
        });

        if (checkError) throw checkError;

        if (inUse) {
          // Obtener lista de usuarios que usan este rol
          const { data: users, error: usersError } = await supabase.rpc('get_users_with_role', {
            p_role_id: role.id
          });

          let usersList = '';
          if (!usersError && users && users.length > 0) {
            usersList = users.map((u: any) => `${u.full_name} (@${u.username})`).join(', ');
          }

          setConfirmModal({
            isOpen: true,
            title: 'No se puede desactivar rol',
            message: `No se puede desactivar el rol "${role.name}" porque está siendo usado por los siguientes usuarios: ${usersList || 'usuarios activos'}. Debe asignar otro rol a estos usuarios primero.`,
            type: 'warning',
            onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false })
          });
          return;
        }
      }

      // Si no está en uso o se está activando, proceder con el cambio de estado
      const { error } = await supabase
        .from('roles')
        .update({
          is_active: !role.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', role.id);

      if (error) throw error;
      toast.success(`Rol ${role.is_active ? 'desactivado' : 'activado'} exitosamente`);
      loadRoles();
    } catch (error) {
      console.error('Error actualizando rol:', error);
      toast.error('Error al actualizar estado del rol');
    }
  };

  const renderPermissions = (permissions: any) => {
    if (permissions?.all === true) {
      return (
        <span className="text-xs text-green-600 font-semibold">
          ✓ Acceso completo
        </span>
      );
    }

    const enabledModules = MODULES.filter(m => permissions?.[m.key] === true);
    if (enabledModules.length === 0) {
      return <span className="text-xs text-gray-400">Sin permisos</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {enabledModules.map(m => (
          <span key={m.key} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
            {m.label}
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          No tienes permisos para acceder a esta sección.
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Gestión de Roles y Permisos</h1>
        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm md:text-base"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          Nuevo Rol
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Desktop: Tabla */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Descripción</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Permisos</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Estado</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                    {role.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {role.description || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {renderPermissions(role.permissions)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {role.is_active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                        Activo
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenModal(role)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Editar rol"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(role)}
                        className={`p-2 rounded-lg transition ${
                          role.is_active
                            ? 'text-orange-600 hover:bg-orange-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={role.is_active ? 'Desactivar rol' : 'Activar rol'}
                      >
                        {role.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar rol"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: Tarjetas */}
        <div className="lg:hidden p-4 space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-base">{role.name}</h3>
                  <p className="text-sm text-gray-500">{role.description || 'Sin descripción'}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  role.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {role.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Permisos:</p>
                {renderPermissions(role.permissions)}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleOpenModal(role)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => handleToggleActive(role)}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg transition text-sm ${
                    role.is_active
                      ? 'text-orange-600 hover:bg-orange-50'
                      : 'text-green-600 hover:bg-green-50'
                  }`}
                >
                  {role.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  {role.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => handleDeleteRole(role)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Crear/Editar Rol */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-6 h-6 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-800">
                {editingRole ? 'Editar Rol' : 'Nuevo Rol'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Rol
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ej: Vendedor, Supervisor, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Describe las responsabilidades de este rol"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permisos del Rol
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MODULES.map((module) => (
                    <div
                      key={module.key}
                      className={`flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer transition ${
                        formData.permissions[module.key]
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      onClick={() => handlePermissionToggle(module.key)}
                    >
                      <span className="text-sm font-medium text-gray-700">
                        {module.label}
                      </span>
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center transition ${
                          formData.permissions[module.key]
                            ? 'bg-indigo-600'
                            : 'bg-gray-200'
                        }`}
                      >
                        {formData.permissions[module.key] && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  {editingRole ? 'Actualizar' : 'Crear Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
};

export const Roles = RolesComponent;
