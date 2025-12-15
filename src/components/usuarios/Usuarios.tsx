import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserProfile, Role } from '../../types';
import { Users, Plus, Edit, Trash2, Key, Lock, UserCog, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { ConfirmModal } from '../common/ConfirmModal';
import { AlertModal } from '../common/AlertModal';

export const UsuariosComponent: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const { user: currentUser, profile: currentProfile } = useAuth();
  
  // Estados para modales de confirmación
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

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'warning' | 'info' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  // Estados para modales específicos
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role_id: ''
  });

  // Verificar si el usuario actual es Admin (múltiples verificaciones)
  const isAdmin = React.useMemo(() => {
    // Verificación 1: Por nombre de rol
    if (currentProfile?.role?.name === 'Admin') return true;
    
    // Verificación 2: Por email (fallback para usuario principal)
    if (currentUser?.email === 'wfyjxpqp@minimax.com') return true;
    
    // Verificación 3: Por ID de rol conocido
    const adminRoleId = '2f00cf88-26e7-4553-8ba7-55cc7a64f0f5';
    if (currentProfile?.role_id === adminRoleId) return true;
    
    return false;
  }, [currentProfile, currentUser]);
  
  // Debug: Log del estado de admin
  useEffect(() => {
    console.log('🔍 Debug Usuarios - currentProfile:', currentProfile);
    console.log('🔍 Debug Usuarios - role:', currentProfile?.role);
    console.log('🔍 Debug Usuarios - role.name:', currentProfile?.role?.name);
    console.log('🔍 Debug Usuarios - isAdmin:', isAdmin);
  }, [currentProfile, isAdmin]);

  useEffect(() => {
    loadData();
  }, []);

  // Cerrar modales con Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPasswordModal) {
          setShowPasswordModal(false);
          setUserToEdit(null);
          setNewPassword('');
          setConfirmPassword('');
        } else if (showRoleModal) {
          setShowRoleModal(false);
          setUserToEdit(null);
          setSelectedRole('');
        } else if (showModal) {
          setShowModal(false);
          setEditingUser(null);
          setFormData({
            username: '',
            password: '',
            confirmPassword: '',
            full_name: '',
            role_id: ''
          });
        }
      }
    };

    if (showModal || showPasswordModal || showRoleModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showModal, showPasswordModal, showRoleModal]);

  const loadData = async () => {
    try {
      const [usuariosRes, rolesRes] = await Promise.all([
        supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('roles').select('*').eq('is_active', true).order('name')
      ]);

      if (usuariosRes.data) {
        const usuariosConRoles = await Promise.all(
          usuariosRes.data.map(async (usuario) => {
            if (usuario.role_id) {
              const { data: roleData } = await supabase
                .from('roles')
                .select('*')
                .eq('id', usuario.role_id)
                .maybeSingle();
              
              return {
                ...usuario,
                role: roleData || undefined
              };
            }
            return usuario;
          })
        );
        setUsuarios(usuariosConRoles);
      }

      if (rolesRes.data) setRoles(rolesRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      full_name: '',
      role_id: ''
    });
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser) {
      // Crear nuevo usuario

      // Validar que username no tenga espacios
      if (/\s/.test(formData.username)) {
        toast.error('El nombre de usuario no puede contener espacios');
        return;
      }

      // Validar que username no esté vacío
      if (!formData.username.trim()) {
        toast.error('El nombre de usuario es requerido');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        toast.error('Las contraseñas no coinciden');
        return;
      }

      if (formData.password.length < 6) {
        toast.error('La contraseña debe tener al menos 6 caracteres');
        return;
      }

      try {
        // Usar la función de base de datos para crear usuario con username
        const { data, error } = await supabase.rpc('create_user_with_username', {
          p_username: formData.username,
          p_password: formData.password,
          p_full_name: formData.full_name,
          p_role_id: formData.role_id
        });

        if (error) throw error;

        if (data && !data.success) {
          throw new Error(data.error || 'Error al crear usuario');
        }

        toast.success('Usuario creado exitosamente');
        setShowModal(false);
        resetForm();

        // Recargar lista de usuarios
        await new Promise(resolve => setTimeout(resolve, 500));
        loadData();
      } catch (error: any) {
        console.error('Error creando usuario:', error);
        toast.error(error.message || 'Error al crear usuario');
      }
    } else {
      // Actualizar usuario existente
      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            nombre_usuario: formData.username
          })
          .eq('id', editingUser.id);

        if (error) throw error;

        toast.success('Usuario actualizado exitosamente');
        setShowModal(false);
        resetForm();
        loadData();
      } catch (error: any) {
        console.error('Error actualizando usuario:', error);
        toast.error(error.message || 'Error al actualizar usuario');
      }
    }
  };

  const handleEdit = (usuario: UserProfile) => {
    setEditingUser(usuario);
    setFormData({
      username: usuario.nombre_usuario || '',
      password: '',
      confirmPassword: '',
      full_name: usuario.full_name,
      role_id: usuario.role_id
    });
    setShowModal(true);
  };

  const handleDeleteUser = async (usuario: UserProfile) => {
    if (!isAdmin) {
      setAlertModal({
        isOpen: true,
        title: 'Acceso Denegado',
        message: 'Solo los administradores pueden eliminar usuarios',
        type: 'error'
      });
      return;
    }

    if (usuario.id === currentUser?.id) {
      setAlertModal({
        isOpen: true,
        title: 'Operación No Permitida',
        message: 'No puedes eliminar tu propio usuario',
        type: 'warning'
      });
      return;
    }

    if (usuario.role?.name === 'Admin') {
      setAlertModal({
        isOpen: true,
        title: 'Operación No Permitida',
        message: 'No se puede eliminar un usuario con rol de Administrador',
        type: 'warning'
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar Usuario?',
      message: `¿Estás seguro de eliminar al usuario "${usuario.full_name}"? Esta acción no se puede deshacer.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const { data, error } = await supabase.functions.invoke('eliminar-usuario', {
            body: { user_id: usuario.id }
          });

          if (error) throw error;

          if (data?.error) {
            throw new Error(data.error.message || 'Error al eliminar usuario');
          }

          // Verificar si fue soft delete o eliminación completa
          if (data?.data?.soft_delete) {
            toast.success('Usuario desactivado exitosamente (tiene ventas o compras registradas)');
          } else {
            toast.success('Usuario eliminado exitosamente');
          }

          setConfirmModal({ ...confirmModal, isOpen: false });
          loadData();
        } catch (error: any) {
          console.error('Error eliminando usuario:', error);
          toast.error(error.message || 'Error al eliminar usuario');
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      }
    });
  };

  const handleReactivateUser = async (usuario: UserProfile) => {
    if (!isAdmin) {
      setAlertModal({
        isOpen: true,
        title: 'Acceso Denegado',
        message: 'Solo los administradores pueden reactivar usuarios',
        type: 'error'
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: '¿Reactivar Usuario?',
      message: `¿Estás seguro de reactivar al usuario "${usuario.full_name}"?`,
      type: 'info',
      onConfirm: async () => {
        try {
          // Reactivar el perfil de usuario
          const { error: profileError } = await supabase
            .from('user_profiles')
            .update({ is_active: true })
            .eq('id', usuario.id);

          if (profileError) throw profileError;

          // Desbanear el usuario en Auth usando Admin API
          const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(
            usuario.id,
            { ban_duration: 'none' }
          );

          if (authError) {
            console.warn('Advertencia al actualizar Auth:', authError);
            // No lanzar error, ya que el perfil fue actualizado exitosamente
          }

          toast.success('Usuario reactivado exitosamente');
          setConfirmModal({ ...confirmModal, isOpen: false });
          loadData();
        } catch (error: any) {
          console.error('Error reactivando usuario:', error);
          toast.error(error.message || 'Error al reactivar usuario');
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      }
    });
  };

  const handleChangePassword = async (usuario: UserProfile) => {
    if (!isAdmin) {
      setAlertModal({
        isOpen: true,
        title: 'Acceso Denegado',
        message: 'Solo los administradores pueden cambiar contraseñas',
        type: 'error'
      });
      return;
    }

    setUserToEdit(usuario);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleSubmitPasswordChange = async () => {
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    try {
      // Usar función de base de datos para cambiar la contraseña
      const { data, error } = await supabase.rpc('change_user_password', {
        target_user_id: userToEdit?.id,
        new_password: newPassword
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || 'Error al cambiar contraseña');
      }

      toast.success('Contraseña actualizada exitosamente');
      setShowPasswordModal(false);
      setUserToEdit(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error cambiando contraseña:', error);
      toast.error(error.message || 'Error al cambiar contraseña');
    }
  };

  const handleChangeRole = async (usuario: UserProfile) => {
    if (!isAdmin) {
      setAlertModal({
        isOpen: true,
        title: 'Acceso Denegado',
        message: 'Solo los administradores pueden cambiar roles',
        type: 'error'
      });
      return;
    }

    if (usuario.id === currentUser?.id) {
      setAlertModal({
        isOpen: true,
        title: 'Operación No Permitida',
        message: 'No puedes cambiar tu propio rol',
        type: 'warning'
      });
      return;
    }

    setUserToEdit(usuario);
    setSelectedRole(usuario.role_id);
    setShowRoleModal(true);
  };

  const handleSubmitRoleChange = async () => {
    if (!selectedRole) {
      toast.error('Debes seleccionar un rol');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role_id: selectedRole })
        .eq('id', userToEdit?.id);

      if (error) throw error;

      toast.success('Rol actualizado exitosamente');
      setShowRoleModal(false);
      setUserToEdit(null);
      setSelectedRole('');
      loadData();
    } catch (error: any) {
      console.error('Error actualizando rol:', error);
      toast.error(error.message || 'Error al actualizar rol');
    }
  };

  const handleToggleActive = async (usuario: UserProfile) => {
    setConfirmModal({
      isOpen: true,
      title: usuario.is_active ? '¿Desactivar Usuario?' : '¿Activar Usuario?',
      message: `¿Estás seguro de ${usuario.is_active ? 'desactivar' : 'activar'} al usuario "${usuario.full_name}"?`,
      type: 'warning',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('user_profiles')
            .update({ is_active: !usuario.is_active })
            .eq('id', usuario.id);

          if (error) throw error;
          toast.success(`Usuario ${usuario.is_active ? 'desactivado' : 'activado'} exitosamente`);
          setConfirmModal({ ...confirmModal, isOpen: false });
          loadData();
        } catch (error) {
          console.error('Error actualizando usuario:', error);
          toast.error('Error al actualizar estado del usuario');
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Debug: Mostrar información del perfil actual
  console.log('==== DEBUG USUARIOS ====');
  console.log('👤 Email del usuario:', currentUser?.email);
  console.log('👤 ID del usuario:', currentUser?.id);
  console.log('👤 Perfil completo:', currentProfile);
  console.log('👤 Role ID:', currentProfile?.role_id);
  console.log('👤 Role object:', currentProfile?.role);
  console.log('👤 Role name:', currentProfile?.role?.name);
  console.log('👤 Es Admin:', isAdmin);
  console.log('========================');

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Gestión de Usuarios</h1>
        {isAdmin && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm md:text-base"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            Nuevo Usuario
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Desktop: Tabla */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Usuario</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rol</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Estado</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fecha Creación</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-indigo-600 font-mono">
                    {usuario.nombre_usuario || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                      {usuario.role?.name || 'Sin rol'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {usuario.is_active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                        Activo
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(usuario.created_at).toLocaleDateString('es-PY')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {isAdmin && usuario.id !== currentUser?.id && (
                        <>
                          {usuario.is_active ? (
                            <>
                              <button
                                onClick={() => handleEdit(usuario)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Editar usuario"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleChangePassword(usuario)}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                                title="Cambiar contraseña"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleChangeRole(usuario)}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Cambiar rol"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(usuario)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Eliminar usuario"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleReactivateUser(usuario)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                              title="Reactivar usuario"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: Tarjetas */}
        <div className="lg:hidden p-4 space-y-3">
          {usuarios.map((usuario) => (
            <div key={usuario.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              {/* Header de la tarjeta */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-indigo-600 font-mono text-base">@{usuario.nombre_usuario || 'sin_usuario'}</h3>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    usuario.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {usuario.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  {isAdmin && usuario.id !== currentUser?.id && (
                    usuario.is_active ? (
                      <button
                        onClick={() => handleDeleteUser(usuario)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivateUser(usuario)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="Reactivar usuario"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Información en grid */}
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 block mb-1">Rol</span>
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold inline-block">
                    {usuario.role?.name || 'Sin rol'}
                  </span>
                </div>

                <div>
                  <span className="text-gray-500 block mb-1">Fecha Creación</span>
                  <span className="text-gray-900">
                    {new Date(usuario.created_at).toLocaleDateString('es-PY')}
                  </span>
                </div>

                {/* Acciones */}
                {isAdmin && usuario.id !== currentUser?.id && (
                  <div className="pt-2 border-t border-gray-200">
                    {usuario.is_active ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleEdit(usuario)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm"
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleChangePassword(usuario)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 text-amber-600 hover:bg-amber-50 rounded-lg transition text-sm"
                        >
                          <Key className="w-4 h-4" />
                          Contraseña
                        </button>
                        <button
                          onClick={() => handleChangeRole(usuario)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition text-sm"
                        >
                          <UserCog className="w-4 h-4" />
                          Rol
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleReactivateUser(usuario)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition text-sm font-medium"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Reactivar Usuario
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Crear/Editar Usuario */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de Usuario (sin espacios)
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                    required
                    placeholder="nombre_usuario"
                    pattern="^\S+$"
                    title="No se permiten espacios"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {editingUser ? 'Nombre de Usuario (sin espacios)' : 'Nombre Completo'}
                </label>
                <input
                  type="text"
                  value={editingUser ? formData.username : formData.full_name}
                  onChange={(e) => editingUser
                    ? setFormData({ ...formData, username: e.target.value.replace(/\s/g, '') })
                    : setFormData({ ...formData, full_name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={editingUser ? 'usuario_ejemplo' : 'Juan Pérez'}
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rol
                  </label>
                  <select
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar rol</option>
                    {roles.map((rol) => (
                      <option key={rol.id} value={rol.id}>
                        {rol.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!editingUser && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmar Contraseña
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      minLength={6}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

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
                  {editingUser ? 'Actualizar' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cambiar Contraseña */}
      {showPasswordModal && userToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-6">
              <Lock className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-800">Cambiar Contraseña</h2>
            </div>

            <p className="text-gray-600 mb-6">
              Usuario: <strong>{userToEdit.full_name}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setUserToEdit(null);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitPasswordChange}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Actualizar Contraseña
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Rol */}
      {showRoleModal && userToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-6">
              <Key className="w-6 h-6 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-800">Cambiar Rol</h2>
            </div>

            <p className="text-gray-600 mb-6">
              Usuario: <strong>{userToEdit.full_name}</strong><br />
              Rol actual: <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">{userToEdit.role?.name}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nuevo Rol
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {roles.filter(rol => rol.is_active !== false).map((rol) => (
                    <option key={rol.id} value={rol.id}>
                      {rol.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowRoleModal(false);
                    setUserToEdit(null);
                    setSelectedRole('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitRoleChange}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Actualizar Rol
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />

      {/* Modal de Alerta */}
      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
      />
    </div>
  );
};


export const Usuarios = UsuariosComponent;
