import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, roleId: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (module: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Usar useRef para control síncrono e inmediato de cargas duplicadas (useState es asíncrono)
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const isLoadingProfileRef = useRef(false);
  
  // Función para cargar el perfil del usuario (con protección contra duplicados)
  const loadUserProfile = async (userId: string) => {
    console.log('[AUTH] 🔍 loadUserProfile llamado para userId:', userId);
    console.log('[AUTH] 📋 Estado actual antes de verificaciones:', {
      isLoadingProfile: isLoadingProfileRef.current,
      lastLoadedUserId: lastLoadedUserIdRef.current,
      currentProfileId: profile?.id,
      willLoad: !isLoadingProfileRef.current && !(profile && profile.id === userId)
    });

    // Evitar cargas duplicadas del mismo usuario
    if (isLoadingProfileRef.current) {
      console.log('[AUTH] ⏭️ Ya hay una carga de perfil en progreso, omitiendo...');
      console.log('[AUTH] 📋 Detalles:', {
        isLoadingProfile: isLoadingProfileRef.current,
        requestedUserId: userId,
        currentUserId: profile?.id
      });
      return;
    }

    // Verificación mejorada: si ya tenemos un perfil cargado para el mismo usuario y no hay errores, omitir
    if (profile && profile.id === userId) {
      console.log('[AUTH] ⏭️ Perfil ya cargado y válido para este usuario, omitiendo...');
      console.log('[AUTH] 📋 Detalles:', {
        profileId: profile.id,
        requestedUserId: userId,
        profileName: profile.full_name
      });
      return;
    }

    const queryStartTime = Date.now();
    isLoadingProfileRef.current = true;
    console.log('[AUTH] 🔒 isLoadingProfileRef seteado a true para bloquear cargas duplicadas');

    try {
      console.log('[AUTH] 🔄 Iniciando carga de perfil para usuario:', userId);
      console.log('[AUTH] 📡 Ejecutando consulta a user_profiles con JOIN a roles...');

      // Configurar timeout para la consulta (8 segundos)
      const timeoutMs = 8000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout de ${timeoutMs}ms en consulta de perfil`));
        }, timeoutMs);
      });

      console.log('[AUTH] ⏱️ Configurado timeout de', timeoutMs, 'ms para consulta de perfil');

      // Crear la consulta
      const profileQuery = supabase
        .from('user_profiles')
        .select('*, role:roles(*)')
        .eq('id', userId)
        .maybeSingle();

      console.log('[AUTH] 🔍 Detalles de la consulta:', {
        table: 'user_profiles',
        select: '*, role:roles(*)',
        filter: `id=eq.${userId}`,
        single: true
      });

      // Competir entre consulta y timeout
      const { data: profileData, error: profileError } = await Promise.race([
        profileQuery,
        timeoutPromise.then(() => {
          throw new Error(`Timeout de ${timeoutMs}ms en consulta de perfil`);
        })
      ]);

      const queryEndTime = Date.now();
      const queryDuration = queryEndTime - queryStartTime;

      console.log('[AUTH] 📊 Respuesta de BD recibida:', {
        duration: `${queryDuration}ms`,
        hasData: !!profileData,
        hasError: !!profileError,
        dataKeys: profileData ? Object.keys(profileData) : null,
        errorMessage: profileError?.message
      });

      console.log('[AUTH] 📊 Datos completos recibidos:', {
        data: profileData,
        error: profileError
      });

      if (profileError) {
        console.error('[AUTH] ❌ Error en consulta de perfil:', profileError);
        console.error('[AUTH] 📝 Detalles completos del error:', {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code
        });
        setProfile(null);
        return;
      }

      if (!profileData) {
        console.warn('[AUTH] ⚠️ No se encontró perfil para usuario:', userId);
        console.warn('[AUTH] 📝 Análisis de posibles causas:');
        console.warn('[AUTH]   - Usuario no tiene registro en user_profiles');
        console.warn('[AUTH]   - ID de usuario mal formateado o incorrecto');
        console.warn('[AUTH]   - Problemas de permisos RLS en la tabla');
        console.warn('[AUTH]   - Usuario inactivo (is_active=false)');
        setProfile(null);
        return;
      }

      console.log('[AUTH] ✅ Perfil cargado exitosamente:', {
        user_id: profileData.id,
        full_name: profileData.full_name,
        role_id: profileData.role_id,
        role_name: profileData.role?.name,
        is_active: profileData.is_active,
        role_permissions: profileData.role?.permissions
      });

      if (!profileData.role) {
        console.warn('[AUTH] ⚠️ El perfil no tiene rol asociado (role: null)');
        console.warn('[AUTH] 📝 Esto causará que todos los permisos sean denegados');
        console.warn('[AUTH] 📝 Verificar la relación user_profiles.role_id -> roles.id');
      }

      setProfile(profileData);
      lastLoadedUserIdRef.current = userId;
      console.log('[AUTH] ✅ Perfil establecido en el estado correctamente');
      console.log('[AUTH] 🔖 lastLoadedUserIdRef actualizado a:', userId);
      console.log('[AUTH] ⏱️ Duración total de carga de perfil:', `${queryDuration}ms`);

    } catch (error) {
      const queryEndTime = Date.now();
      const queryDuration = queryEndTime - queryStartTime;

      console.error('[AUTH] 💥 Error en carga de perfil después de', `${queryDuration}ms:`, error);

      if (error.message.includes('Timeout')) {
        console.error('[AUTH] ⏱️ La consulta a la base de datos está tardando demasiado');
        console.error('[AUTH] 📝 Posibles causas del timeout:');
        console.error('[AUTH]   - Problemas de conexión a Supabase');
        console.error('[AUTH]   - La consulta está siendo bloqueada por la BD');
        console.error('[AUTH]   - Problemas de red o firewall');
        console.error('[AUTH]   - Tablas muy grandes sin índices adecuados');

        // En caso de timeout, también actualizar el lastLoadedUserId para evitar reintentos
        lastLoadedUserIdRef.current = userId;
        console.log('[AUTH] 🔖 lastLoadedUserIdRef actualizado a:', userId, '(para evitar reintentos infinitos)');
      }

      console.error('[AUTH] 📝 Error completo:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      // Establecer perfil como null para continuar la ejecución
      setProfile(null);
      console.log('[AUTH] ⚠️ Perfil establecido en null debido a error - la aplicación continuará sin permisos');
    } finally {
      isLoadingProfileRef.current = false;
      console.log('[AUTH] 🔓 isLoadingProfileRef seteado a false - permitiendo nuevas cargas');
    }
  };

  useEffect(() => {
    console.log('[AUTH] 🏗️ AuthProvider montado - configurando autenticación');
    let mounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    async function loadUser() {
      try {
        console.log('[AUTH] 🚀 Iniciando carga inicial de usuario...');
        console.log('[AUTH] 📡 Obteniendo sesión actual...');

        const { data: { session }, error } = await supabase.auth.getSession();

        console.log('[AUTH] 📊 Respuesta de sesión:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          error
        });

        if (error) {
          console.error('[AUTH] ❌ Error obteniendo sesión:', error);
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
            console.log('[AUTH] ✅ Loading establecido en false por error de sesión');
          }
          return;
        }

        if (!mounted) {
          console.log('[AUTH] ⏹️ Componente desmontado, cancelando carga inicial');
          return;
        }

        setUser(session?.user || null);
        console.log('[AUTH] 👤 Usuario establecido:', !!session?.user ? session.user.id : null);

        // Cargar el perfil del usuario
        if (session?.user) {
          console.log('[AUTH] 📋 Sesión válida encontrada, iniciando carga de perfil...');
          console.log('[AUTH] 📋 Verificando si ya se ha intentado cargar:', {
            sessionUserId: session.user.id,
            lastLoadedUserId: lastLoadedUserIdRef.current,
            shouldLoad: lastLoadedUserIdRef.current !== session.user.id
          });

          // Setear ANTES de cargar para evitar race conditions
          lastLoadedUserIdRef.current = session.user.id;
          console.log('[AUTH] 🔖 lastLoadedUserIdRef pre-seteado a:', session.user.id);

          await loadUserProfile(session.user.id);
          console.log('[AUTH] ✅ Carga de perfil completada');
        } else {
          console.log('[AUTH] ⚠️ No hay sesión activa');
        }

        if (mounted) {
          setLoading(false);
          console.log('[AUTH] ✅ Loading establecido en false - carga inicial completada');
        }
      } catch (error) {
        console.error('[AUTH] 💥 Error inesperado en carga inicial:', error);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          console.log('[AUTH] ✅ Loading establecido en false por error inesperado');
        }
      }
    }

    // Suscribirse a cambios de autenticación
    const { data } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const eventStartTime = Date.now();
        console.log('[AUTH] 🔄 Cambio de estado de autenticación:', event);
        console.log('[AUTH] 👤 Datos del usuario:', {
          hasUser: !!session?.user,
          userId: session?.user?.id,
          email: session?.user?.email,
          sessionValid: !!session
        });

        if (!mounted) {
          console.log('[AUTH] ⏹️ Componente desmontado, ignorando cambio de auth');
          return;
        }

        // Manejo específico para cada evento
        switch (event) {
          case 'SIGNED_IN':
            console.log('[AUTH] 🔑 Evento SIGNED_IN detectado');
            console.log('[AUTH] 📊 Estado actual al recibir SIGNED_IN:', {
              hasSession: !!session,
              hasUser: !!session?.user,
              userId: session?.user?.id,
              lastLoadedUserId: lastLoadedUserIdRef.current,
              isLoadingProfile: isLoadingProfileRef.current,
              hasProfile: !!profile,
              profileId: profile?.id
            });

            setUser(session?.user || null);

            if (session?.user) {
              console.log('[AUTH] 🔍 Verificando si se debe cargar perfil...');
              console.log('[AUTH] 📋 Condiciones:', {
                lastLoadedUserId: lastLoadedUserIdRef.current,
                sessionUserId: session.user.id,
                sonDiferentes: lastLoadedUserIdRef.current !== session.user.id,
                seDebeCargar: lastLoadedUserIdRef.current !== session.user.id
              });

              // Evitar ciclo infinito: solo cargar si no hemos intentado cargar para este usuario
              if (lastLoadedUserIdRef.current !== session.user.id) {
                console.log('[AUTH] ✅ Condición cumplida - se procederá a cargar perfil');
                console.log('[AUTH] 🔄 Login activo, cargando perfil...');

                // Setear ANTES de cargar para evitar race conditions
                lastLoadedUserIdRef.current = session.user.id;
                console.log('[AUTH] 🔖 lastLoadedUserIdRef pre-seteado a:', session.user.id);

                await loadUserProfile(session.user.id);
                console.log('[AUTH] ✅ Perfil cargado por SIGNED_IN');
              } else {
                console.log('[AUTH] ⏭️ SIGNED_IN ignorado - ya se intentó cargar perfil para este usuario');
                console.log('[AUTH] 📋 Razón del skip:', {
                  mensaje: 'lastLoadedUserIdRef.current === session.user.id',
                  lastLoadedUserId: lastLoadedUserIdRef.current,
                  sessionUserId: session.user.id
                });
              }
            } else {
              console.log('[AUTH] ⚠️ SIGNED_IN sin usuario en sesión');
            }
            break;

          case 'SIGNED_OUT':
            console.log('[AUTH] 🚪 Evento SIGNED_OUT detectado - limpiando todo');
            console.log('[AUTH] 🧹 Limpiando estados por SIGNED_OUT...');

            // Medir tiempo de limpieza
            const cleanupStart = Date.now();

            setUser(null);
            setProfile(null);
            lastLoadedUserIdRef.current = null;
            isLoadingProfileRef.current = false;
            setLoading(false);

            const cleanupEnd = Date.now();
            const cleanupDuration = cleanupEnd - cleanupStart;

            console.log('[AUTH] ✅ Estados limpiados por SIGNED_OUT en', `${cleanupDuration}ms`);
            console.log('[AUTH] 📝 Estados finales:', {
              hasUser: false,
              hasProfile: false,
              loading: false,
              lastLoadedUserId: lastLoadedUserIdRef.current,
              isLoadingProfile: isLoadingProfileRef.current
            });
            break;

          case 'TOKEN_REFRESHED':
            console.log('[AUTH] 🔄 Token refrescado automáticamente');
            setUser(session?.user || null);
            // No recargar perfil en TOKEN_REFRESHED para evitar ciclos
            console.log('[AUTH] ⏭️ Perfil no recargado en TOKEN_REFRESHED (evitar ciclos)');
            break;

          case 'INITIAL_SESSION':
            console.log('[AUTH] 🔄 Evento INITIAL_SESSION detectado');
            console.log('[AUTH] 📊 Estado actual al recibir INITIAL_SESSION:', {
              hasSession: !!session,
              hasUser: !!session?.user,
              userId: session?.user?.id,
              lastLoadedUserId: lastLoadedUserIdRef.current,
              isLoadingProfile: isLoadingProfileRef.current,
              hasProfile: !!profile,
              profileId: profile?.id
            });

            setUser(session?.user || null);

            if (session?.user) {
              console.log('[AUTH] 🔍 Verificando si se debe cargar perfil en INITIAL_SESSION...');
              console.log('[AUTH] 📋 Condiciones:', {
                hasProfile: !!profile,
                profileId: profile?.id,
                sessionUserId: session.user.id,
                sonDiferentes: !profile || profile.id !== session.user.id,
                seDebeCargar: !profile || profile.id !== session.user.id
              });

              // Para INITIAL_SESSION, cargar perfil solo si no hay perfil o es diferente usuario
              if (!profile || profile.id !== session.user.id) {
                console.log('[AUTH] ✅ Condición cumplida - se procederá a cargar perfil');
                console.log('[AUTH] 🔄 Carga inicial - perfil no existe o es diferente usuario');

                // Setear ANTES de cargar para evitar race conditions
                lastLoadedUserIdRef.current = session.user.id;
                console.log('[AUTH] 🔖 lastLoadedUserIdRef pre-seteado a:', session.user.id);

                await loadUserProfile(session.user.id);
                console.log('[AUTH] ✅ Perfil cargado por INITIAL_SESSION');
              } else {
                console.log('[AUTH] ⏭️ Perfil ya existe para este usuario en INITIAL_SESSION, omitiendo');
                console.log('[AUTH] 📋 Razón del skip:', {
                  mensaje: 'profile existe y profile.id === session.user.id',
                  profileId: profile.id,
                  sessionUserId: session.user.id
                });
              }
            } else {
              console.log('[AUTH] ⚠️ INITIAL_SESSION sin usuario en sesión');
            }
            break;

          default:
            console.log('[AUTH] ⏭️ Evento', event, 'no manejado específicamente');
            setUser(session?.user || null);
            break;
        }

        const eventEndTime = Date.now();
        const eventDuration = eventEndTime - eventStartTime;

        console.log('[AUTH] ⏱️ Evento', event, 'procesado en', `${eventDuration}ms`);

        if (mounted) {
          setLoading(false);
          console.log('[AUTH] ✅ Loading establecido en false - evento procesado');
        }
      }
    );

    authSubscription = data.subscription;
    console.log('[AUTH] 📡 Suscripción a cambios de auth establecida');

    // Cargar usuario inicial
    console.log('[AUTH] 🚀 Iniciando carga inicial...');
    loadUser();

    return () => {
      console.log('[AUTH] 🧹 AuthProvider desmontado - limpiando efectos');
      console.log('[AUTH] 📊 Estado final al desmontar:', {
        loading,
        hasUser: !!user,
        hasProfile: !!profile
      });

      // Forzar loading a false por si acaso
      setLoading(false);

      mounted = false;
      if (authSubscription) {
        console.log('[AUTH] 📡 Cancelando suscripción a auth');
        authSubscription.unsubscribe();
      }
    };
  }, []); // Sin dependencias - solo ejecutar una vez


  const signIn = useCallback(async (usernameOrEmail: string, password: string) => {
    console.log('[AUTH] 🔑 Iniciando proceso de login para:', usernameOrEmail);
    let loginEmail = usernameOrEmail;

    try {
      // Si no contiene @, es un username - buscar el email asociado
      if (!usernameOrEmail.includes('@')) {
        console.log('[AUTH] 👤 Detectado username, buscando email asociado...');

        const { data, error: emailError } = await supabase.rpc('get_email_by_username', {
          p_username: usernameOrEmail
        });

        console.log('[AUTH] 📊 Respuesta de búsqueda de email:', { data, error: emailError });

        if (emailError) {
          console.error('[AUTH] ❌ Error buscando email por username:', emailError);
          throw new Error('Error al buscar nombre de usuario');
        }

        // El RPC devuelve directamente el email como string
        if (!data) {
          console.warn('[AUTH] ⚠️ Username no encontrado o inactivo:', usernameOrEmail);
          throw new Error('Nombre de usuario no encontrado o usuario inactivo');
        }

        loginEmail = data;
        console.log('[AUTH] ✅ Email encontrado para username:', loginEmail);
      } else {
        console.log('[AUTH] 📧 Detectado email directo:', loginEmail);
      }

      console.log('[AUTH] 🔐 Autenticando con Supabase...');
      // Autenticar con el email
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password
      });

      console.log('[AUTH] 📊 Respuesta de autenticación:', {
        hasData: !!data,
        hasUser: !!data?.user,
        hasSession: !!data?.session,
        error: error?.message
      });

      if (error) {
        console.error('[AUTH] ❌ Error de autenticación:', error);
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Usuario o contraseña incorrectos');
        }
        throw error;
      }

      console.log('[AUTH] ✅ Login exitoso, usuario:', data.user?.id);
      // Nota: El perfil se cargará automáticamente por el evento SIGNED_IN

    } catch (error) {
      console.error('[AUTH] 💥 Error en proceso de login:', error);
      throw error;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, roleId: string) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    if (authData.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          full_name: fullName,
          role_id: roleId,
          is_active: true
        });

      if (profileError) throw profileError;
    }
  }, []);

  const signOut = useCallback(async () => {
    const startTime = Date.now();
    console.log('[AUTH] 🚪 Iniciando proceso de cierre de sesión...');
    console.log('[AUTH] 👤 Estado actual antes del cierre:', {
      hasUser: !!user,
      userId: user?.id,
      hasProfile: !!profile,
      loading
    });

    try {
      // Implementar timeout para evitar esperas infinitas
      const timeoutMs = 10000; // 10 segundos máximo
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout de ${timeoutMs}ms en cierre de sesión`));
        }, timeoutMs);
      });

      console.log('[AUTH] ⏱️ Configurado timeout de', timeoutMs, 'ms para signOut');
      console.log('[AUTH] 📡 Ejecutando supabase.auth.signOut()...');

      const signOutPromise = supabase.auth.signOut();

      // Competir entre signOut y timeout
      const signOutResult = await Promise.race([signOutPromise, timeoutPromise]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log('[AUTH] 📊 Respuesta de signOut recibida:', {
        duration: `${duration}ms`,
        result: signOutResult
      });

      // Cast del resultado para TypeScript
      const result = signOutResult as { error?: { message: string } | null };

      if (result.error) {
        console.error('[AUTH] ❌ Error en cierre de sesión:', result.error);
        console.error('[AUTH] 📝 Detalles del error:', {
          message: result.error.message
        });
        throw new Error(result.error.message);
      }

      console.log('[AUTH] ✅ Cierre de sesión exitoso');
      console.log('[AUTH] ⏱️ Duración total del cierre:', `${duration}ms`);

      // Forzar limpieza de estados inmediatamente por si hay delay en el evento
      console.log('[AUTH] 🧹 Forzando limpieza de estados...');
      setUser(null);
      setProfile(null);
      setLoading(false);

      console.log('[AUTH] ✅ Estados limpiados manualmente');
      console.log('[AUTH] 📝 Nota: El evento SIGNED_OUT también debería limpiar los estados');

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error('[AUTH] 💥 Error en proceso de signOut después de', `${duration}ms:`, error);

      if (error.message.includes('Timeout')) {
        console.warn('[AUTH] ⚠️ Timeout detectado - limpiando estados manualmente');
        console.warn('[AUTH] 📝 Esto puede indicar problemas de conexión o del servidor Supabase');

        // Forzar limpieza de estados incluso con timeout
        setUser(null);
        setProfile(null);
        setLoading(false);

        console.log('[AUTH] 🧹 Estados forzados a null por timeout');

        // No lanzar error para que la UI no se quede bloqueada
        console.warn('[AUTH] ⚠️ Continuando sin error para no bloquear la UI');
        return;
      }

      console.error('[AUTH] 📝 Error completo:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      throw error;
    }
  }, [user, profile, loading]);

  const hasPermission = useCallback((module: string, action: string): boolean => {
    if (!profile?.role) {
      console.log('[AUTH] 🔒 hasPermission denegado - sin perfil o rol:', {
        hasProfile: !!profile,
        hasRole: !!profile?.role,
        profileId: profile?.id,
        roleId: profile?.role_id
      });
      return false;
    }

    const permissions = profile.role.permissions;

    // Debug detallado de permisos
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH] 🔍 Verificando permiso:', {
        module,
        action,
        permissions,
        hasAll: permissions.all,
        modulePermissions: permissions[module]
      });
    }

    if (permissions.all === true) {
      console.log('[AUTH] ✅ Permiso concedido - todos los permisos activos');
      return true;
    }

    if (permissions[module]) {
      if (typeof permissions[module] === 'boolean') {
        const result = permissions[module];
        console.log('[AUTH]', result ? '✅' : '❌', `Permiso ${module} (boolean):`, result);
        return result;
      }
      if (Array.isArray(permissions[module])) {
        const result = permissions[module].includes(action);
        console.log('[AUTH]', result ? '✅' : '❌', `Permiso ${module}.${action} (array):`, result);
        return result;
      }
    }

    console.log('[AUTH] ❌ Permiso denegado - módulo o acción no encontrada:', {
      module,
      action,
      availableModules: Object.keys(permissions)
    });
    return false;
  }, [profile]);

  
  const value = useMemo(() => ({
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    hasPermission
  }), [user, profile, loading, signIn, signUp, signOut, hasPermission]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
