import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { TicketConfig } from '../../types';
import { FileText, Upload, Save, Eye, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from '../common/ConfirmModal';

export const Tickets: React.FC = () => {
  const [config, setConfig] = useState<TicketConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre_empresa: '',
    encabezado: '',
    pie_pagina: '',
    logo_url: ''
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Configuración de generación automática de tickets
  const [autoGenerarTickets, setAutoGenerarTickets] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoGenerarTickets');
    return saved !== null ? saved === 'true' : true; // Por defecto habilitado
  });

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    // Guardar preferencia de generación automática
    localStorage.setItem('autoGenerarTickets', autoGenerarTickets.toString());
  }, [autoGenerarTickets]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ticket_config')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setConfig(data);
        setFormData({
          nombre_empresa: data.nombre_empresa || '',
          encabezado: data.encabezado || '',
          pie_pagina: data.pie_pagina || '',
          logo_url: data.logo_url || ''
        });
        setLogoPreview(data.logo_url || '');
      }
    } catch (error: any) {
      console.error('Error al cargar configuración:', error);
      toast.error('Error al cargar la configuración del ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor selecciona un archivo de imagen válido');
        return;
      }

      // Validar tamaño (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('El archivo es muy grande. Máximo 2MB');
        return;
      }

      setLogoFile(file);

      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setFormData({ ...formData, logo_url: '' });
    setShowDeleteConfirm(false);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return formData.logo_url || null;

    try {
      setUploading(true);

      // Generar nombre único para el archivo
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `tickets/${fileName}`;

      // Subir archivo a Supabase Storage
      const { data, error } = await supabase.storage
        .from('ticket-assets')
        .upload(filePath, logoFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('ticket-assets')
        .getPublicUrl(filePath);

      toast.success('Logo subido correctamente');
      return publicUrl;
    } catch (error: any) {
      console.error('Error al subir logo:', error);
      toast.error('Error al subir el logo');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    // Validación
    if (!formData.nombre_empresa.trim()) {
      toast.error('El nombre de la empresa es requerido');
      return;
    }

    try {
      setSaving(true);

      // Subir logo si hay uno nuevo
      let logoUrl = formData.logo_url;
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      const configData = {
        nombre_empresa: formData.nombre_empresa.trim(),
        encabezado: formData.encabezado.trim() || null,
        pie_pagina: formData.pie_pagina.trim() || null,
        logo_url: logoUrl || null,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      if (config) {
        // Actualizar configuración existente
        const { error } = await supabase
          .from('ticket_config')
          .update(configData)
          .eq('id', config.id);

        if (error) throw error;
        toast.success('Configuración actualizada correctamente');
      } else {
        // Crear nueva configuración
        const { error } = await supabase
          .from('ticket_config')
          .insert({
            ...configData,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        toast.success('Configuración guardada correctamente');
      }

      // Recargar configuración
      await loadConfig();
      setLogoFile(null);
    } catch (error: any) {
      console.error('Error al guardar configuración:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 md:gap-3">
          <FileText className="h-6 w-6 md:h-8 md:w-8 text-indigo-600" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Configuración de Tickets</h1>
            <p className="text-xs md:text-sm text-gray-600">Personaliza los tickets PDF de ventas</p>
          </div>
        </div>
        <button
          onClick={() => setShowPreview(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Eye className="h-4 w-4 md:h-5 md:w-5" />
          <span className="text-sm md:text-base">Vista Previa</span>
        </button>
      </div>

      {/* Configuración de Generación Automática */}
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2 mb-4">
          <FileText className="h-5 w-5 text-indigo-600" />
          <span>Opciones de Generación</span>
        </h2>

        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="autoGenerarTickets"
            checked={autoGenerarTickets}
            onChange={(e) => setAutoGenerarTickets(e.target.checked)}
            className="mt-1 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
          />
          <div className="flex-1">
            <label htmlFor="autoGenerarTickets" className="font-medium text-gray-900 cursor-pointer">
              Generar tickets automáticamente al vender
            </label>
            <p className="text-sm text-gray-600 mt-1">
              Cuando está habilitado, se generará un ticket PDF automáticamente después de procesar cada venta.
              Si lo deshabilitas, las ventas se procesarán sin generar tickets.
            </p>
          </div>
        </div>
      </div>

      {/* Formulario de Configuración */}
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6 space-y-4 md:space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <span>Información del Ticket</span>
        </h2>

        {/* Nombre de Empresa */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre de la Empresa <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.nombre_empresa}
            onChange={(e) => setFormData({ ...formData, nombre_empresa: e.target.value })}
            placeholder="Mi Empresa S.A."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Logo de la Empresa
          </label>
          
          {/* Preview del Logo */}
          {logoPreview && (
            <div className="mb-4 relative inline-block">
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-24 w-auto object-contain border border-gray-300 rounded-lg p-2 bg-white"
              />
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                title="Eliminar logo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Input de archivo */}
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors">
              <Upload className="h-5 w-5" />
              <span>{logoPreview ? 'Cambiar Logo' : 'Subir Logo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="hidden"
              />
            </label>
            <span className="text-sm text-gray-500">PNG, JPG o GIF (máx. 2MB)</span>
          </div>
        </div>

        {/* Encabezado */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Encabezado del Ticket
          </label>
          <textarea
            value={formData.encabezado}
            onChange={(e) => setFormData({ ...formData, encabezado: e.target.value })}
            placeholder="Dirección, teléfono, RUC, etc."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
          <p className="mt-1 text-xs text-gray-500">Información adicional que aparecerá en la parte superior del ticket</p>
        </div>

        {/* Pie de Página */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pie de Página del Ticket
          </label>
          <textarea
            value={formData.pie_pagina}
            onChange={(e) => setFormData({ ...formData, pie_pagina: e.target.value })}
            placeholder="Gracias por su compra, términos y condiciones, etc."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
          <p className="mt-1 text-xs text-gray-500">Mensaje que aparecerá al final del ticket</p>
        </div>

        {/* Botones de Acción */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {(saving || uploading) ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                <span className="text-sm">{uploading ? 'Subiendo...' : 'Guardando...'}</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm">Guardar Configuración</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Vista Previa del Ticket */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Vista Previa del Ticket</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              {/* Preview del Ticket */}
              <div className="border border-gray-300 rounded-lg p-6 bg-white space-y-4" style={{ fontFamily: 'monospace' }}>
                {/* Logo */}
                {logoPreview && (
                  <div className="flex justify-center mb-4">
                    <img src={logoPreview} alt="Logo" className="h-16 w-auto object-contain" />
                  </div>
                )}
                
                {/* Nombre Empresa */}
                <div className="text-center">
                  <h4 className="font-bold text-lg">{formData.nombre_empresa || 'NOMBRE EMPRESA'}</h4>
                </div>
                
                {/* Encabezado */}
                {formData.encabezado && (
                  <div className="text-center text-sm whitespace-pre-line border-b border-dashed border-gray-300 pb-3">
                    {formData.encabezado}
                  </div>
                )}
                
                {/* Datos de la Venta (Ejemplo) */}
                <div className="text-sm space-y-1 border-b border-dashed border-gray-300 pb-3">
                  <p><strong>Ticket:</strong> #00001</p>
                  <p><strong>Fecha:</strong> {new Date().toLocaleDateString('es-PY')}</p>
                  <p><strong>Hora:</strong> {new Date().toLocaleTimeString('es-PY')}</p>
                </div>
                
                {/* Items (Ejemplo) */}
                <div className="text-sm space-y-2 border-b border-dashed border-gray-300 pb-3">
                  <div className="font-semibold">PRODUCTOS:</div>
                  <div className="flex justify-between">
                    <span>Producto Ejemplo x2</span>
                    <span>₲10.000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Producto 2 x1</span>
                    <span>₲5.000</span>
                  </div>
                </div>
                
                {/* Total */}
                <div className="text-lg font-bold flex justify-between border-b border-dashed border-gray-300 pb-3">
                  <span>TOTAL:</span>
                  <span>₲15.000</span>
                </div>
                
                {/* Pie de Página */}
                {formData.pie_pagina && (
                  <div className="text-center text-sm whitespace-pre-line pt-2">
                    {formData.pie_pagina}
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Logo Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onConfirm={handleDeleteLogo}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Eliminar Logo"
        message="¿Estás seguro de que deseas eliminar el logo? Esta acción no se puede deshacer."
      />
    </div>
  );
};
