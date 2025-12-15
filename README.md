# 🏪 Sistema de Inventario

**Un sistema completo de gestión de inventario responsive con punto de venta integrado**

![Preview](https://img.shields.io/badge/React-18-blue?style=flat-square)
![Preview](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square)
![Preview](https://img.shields.io/badge/Vite-6-purple?style=flat-square)
![Preview](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square)
![Preview](https://img.shields.io/badge/Responsive-100%25-orange?style=flat-square)

## 📋 Descripción del Software

**Sistema de Inventario** es una aplicación web completa diseñada para gestionar productos, ventas, compras y proveedores de manera eficiente. El sistema está desarrollado con tecnologías modernas y ofrece una interfaz intuitiva que se adapta perfectamente a cualquier dispositivo, desde móviles hasta escritorio.

## 🎯 Características Principales

### **📦 Gestión Avanzada de Productos**
- Control completo de inventario con múltiples tipos de productos
- Soporte para **unidades**, **paquetes** y **productos por peso (kg/gramos)**
- **Calculadora de porcentajes integrada** para calcular precios de venta basados en ganancia
- Gestión de **tallas** para ropa y calzado
- **Sistema de activación/desactivación** de productos (soft delete)
- **Indicadores visuales** para productos inactivos en inventario y reportes
- Categorización de productos con filtros avanzados
- Control de stock mínimo con alertas automáticas
- **Precios diferenciados**: Normal y Mayorista para cada tipo de producto
- **Apertura de paquetes** para convertir paquetes en unidades individuales
- Información detallada de proveedores por producto
- Escaneo de códigos de barras con cámara (móviles)

### **💰 Punto de Venta (POS) Avanzado**
- Sistema de ventas rápido e intuitivo
- Búsqueda de productos con navegación por teclado (Enter, ESC, flechas)
- **Modo Mayorista**: Precios especiales para ventas al por mayor
- **Ventas Fiadas**: Sistema completo de crédito con gestión de clientes
  - Registro de clientes con historial de fiados
  - Abonos parciales con seguimiento
  - Control de deudas pendientes
  - Conversión de fiados a ventas normales
- **Control de descuento de stock**: Opción para no descontar inventario en ventas especiales
- Generación automática de **tickets PDF** personalizados
- Cálculo automático de vuelto y totales
- Soporte para diferentes tipos de productos y medidas
- **Anulación de ventas** completas o parciales con restauración de stock
- Validación de productos con precio cero

### **🔄 Gestión de Anulaciones**
- **Anulación completa**: Cancela toda la venta y restaura el stock completo
- **Anulación parcial**: Cancela solo items específicos de una venta
- **Registro de motivos**: Documentación del por qué de cada anulación
- **Trazabilidad completa**: Historial de todas las anulaciones realizadas
- **Restauración automática de inventario**: El stock se devuelve automáticamente
- **Control de permisos**: Solo usuarios autorizados pueden anular ventas
- **Reportes de anulaciones**: Vista agrupada y detallada con filtros

### **🛒 Gestión de Compras**
- Reposición automática de inventario
- Historial de compras por proveedor
- Control de precios de compra y venta
- Actualización automática de stock al recibir productos
- Opción para actualizar precios de productos existentes

### **👥 Gestión de Clientes**
- Registro completo de clientes para ventas fiadas
- Historial de fiados por cliente
- Estado de cuenta con deudas pendientes
- Activación/desactivación de clientes
- Notas y observaciones personalizadas

### **👤 Gestión de Usuarios y Proveedores**
- **Sistema de roles y permisos granulares** por módulo
- Perfiles de usuario con diferentes niveles de acceso
- Control de acceso a funcionalidades específicas
- Gestión completa de proveedores
- Historial de compras y productos por proveedor

### **📊 Reportes y Análisis Avanzados**
- **Reportes de ventas**:
  - Vista detallada y agrupada
  - Filtro por ventas fiadas, normales o todas
  - Filtro por estado (completadas, con saldo pendiente)
- **Reportes de compras**: Con historial detallado por proveedor
- **Reportes de inventario**:
  - Estado actual de stock y valorización
  - Filtro por estado (activos, inactivos, todos)
  - Filtro por categorías
  - Indicadores visuales para productos de bajo stock e inactivos
- **Reportes de anulaciones**:
  - Vista agrupada: Resumen por venta anulada
  - Vista detallada: Desglose item por item
- **Análisis de productos más vendidos**
- **Proveedores principales** con estadísticas
- **Exportación** a PDF y Excel con formato profesional
  - PDFs con filas resaltadas para productos inactivos
  - Indicadores [INACTIVO] en exportaciones
- Filtros por fecha, categoría, proveedor y estado
- Paginación para grandes volúmenes de datos

### **📱 Diseño Responsive Optimizado**
- **Mobile-First**: Optimizado para móviles con anchos ajustados
- **Touch-Friendly**: Botones y controles adaptados para pantallas táctiles
- **Vistas adaptativas**: Tarjetas en móvil, tablas en escritorio
- **Modales responsivos**: Anchos diferentes para móvil y escritorio
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)

## 🛠️ Tecnologías Utilizadas

### **Frontend**
- **React 18** - Framework principal con hooks modernos
- **TypeScript** - Tipado fuerte y desarrollo seguro
- **Vite 6** - Build tool rápido y moderno
- **Tailwind CSS** - Framework CSS para diseño responsive
- **Radix UI** - Componentes de UI accesibles
- **Lucide React** - Biblioteca de iconos moderna
- **React Hook Form + Zod** - Formularios con validación
- **Sonner** - Sistema de notificaciones toast

### **Backend**
- **Supabase** - Plataforma Backend-as-a-Service
- **PostgreSQL** - Base de datos relacional robusta
- **Authentication** - Sistema de autenticación seguro
- **Row Level Security (RLS)** - Seguridad a nivel de base de datos
- **Real-time Subscriptions** - Actualizaciones en tiempo real

### **Exportación y Documentos**
- **jsPDF + jsPDF-AutoTable** - Generación de PDF en cliente
- **XLSX** - Exportación a hojas de cálculo
- **html2canvas** - Captura de elementos para documentos

## 🏗️ Arquitectura del Sistema

### **Estructura de Datos**
- **Productos**: Control de stock por tipo (unidades/paquetes/kg) con precios diferenciados
- **Categorías**: Organización jerárquica de productos con estado activo/inactivo
- **Proveedores**: Gestión de proveedores y productos asociados
- **Clientes**: Registro para ventas fiadas con historial de crédito
- **Ventas**: Registro detallado con items, modo mayorista y control de fiados
- **Compras**: Control de reposición de inventario
- **Anulaciones**: Registro de ventas anuladas (completas o parciales) con motivos
- **Ajustes de Inventario**: Historial de entradas, salidas y aperturas de paquetes
- **Usuarios**: Sistema multi-usuario con roles y permisos granulares
- **Operaciones**: Registro de abonos, conversiones y cancelaciones de fiados

### **Flujo de Trabajo**
1. **Gestión de Inventario**: Carga y actualiza productos con calculadora de precios
2. **Ventas**: Realiza ventas normales o mayoristas, con opción de fiado
3. **Gestión de Fiados**: Control de abonos y seguimiento de deudas
4. **Anulaciones**: Cancela ventas completas o parciales restaurando el inventario
5. **Compras**: Reposiciona productos cuando el stock es bajo
6. **Análisis**: Genera reportes filtrados para tomar decisiones informadas

### **Características Técnicas**
- **Cálculo automático** de precios, ganancia y totales
- **Validaciones** en tiempo real con feedback inmediato
- **Mensajes toast** para feedback al usuario (Sonner)
- **Navegación** por teclado para productividad (Enter, ESC, flechas)
- **Cierre con ESC** para ventanas emergentes
- **Confirmación** para acciones destructivas
- **Filtros en tiempo real** con actualización automática
- **Paginación** eficiente para grandes conjuntos de datos
- **Formato de moneda** guaraní con separadores de miles

## 📈 Casos de Uso

### **Para PyMEs y Empresas**
- Control completo de inventario con productos activos/inactivos
- Gestión de puntos de venta con precios mayoristas
- Sistema de crédito (fiados) para clientes frecuentes
- Análisis de ventas y productos más vendidos
- Optimización de stock y compras

### **Para Comercios Minoristas**
- Venta rápida con cálculo automático de precios
- Gestión de categorías y tallas (ropa/calzado)
- Tickets PDF profesionales personalizables
- Control de proveedores y reposición
- Apertura de paquetes para venta por unidad

### **Para Gestores**
- Reportes detallados con múltiples filtros
- Análisis de tendencias de ventas y anulaciones
- Control de márgenes de ganancia con calculadora integrada
- Historial completo de transacciones y operaciones
- Exportación a Excel y PDF para análisis externo

## 🚀 Instalación y Configuración

### **Requisitos Previos**
- Node.js 18 o superior
- pnpm (recomendado), npm o yarn
- Cuenta de Supabase (se puede crear gratis en [supabase.com](https://supabase.com))

### **Pasos de Instalación**

1. **Clonar el repositorio**
   ```bash
   git clone [tu-repositorio]
   cd sistema-inventario
   ```

2. **Instalar dependencias**
   ```bash
   pnpm install
   ```

   O si usas npm:
   ```bash
   npm install
   ```

3. **Configurar Supabase**

   Crea un archivo `.env` en la raíz del proyecto:
   ```bash
   cp .env.example .env
   ```

   Edita `.env` con tus credenciales de Supabase:
   ```env
   VITE_SUPABASE_URL=tu_supabase_url
   VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
   ```

4. **Configurar la Base de Datos**

   Ejecuta el script SQL incluido en tu proyecto Supabase para crear:
   - Tablas necesarias (productos, categorias, ventas, etc.)
   - Políticas RLS (Row Level Security)
   - Funciones y triggers

   > **Nota**: El archivo SQL no está incluido en este repositorio por seguridad.
   > Debes crear tu propia estructura de base de datos según tus necesidades.

5. **Ejecutar en desarrollo**
   ```bash
   pnpm dev
   ```

   La aplicación estará disponible en `http://localhost:5173`

6. **Construir para producción**
   ```bash
   pnpm build
   ```

   Los archivos de producción estarán en la carpeta `dist/`

## 📱 Interfaces Disponibles

### **Pantallas Principales**
- **Dashboard**: Vista general con estadísticas y métricas clave
- **Productos/Inventario**: Gestión completa con filtros de estado y categoría
- **Ventas**: Punto de venta con modo mayorista y fiado
- **Compras**: Gestión de reposiciones con historial
- **Proveedores**: Control de proveedores y productos asociados
- **Categorías**: Organización de productos por categorías
- **Tickets**: Historial de ventas con opción de anular
- **Reportes**: Análisis detallado con exportación
  - Ventas (detalladas/agrupadas)
  - Compras
  - Inventario
  - Productos más vendidos
  - Proveedores principales
  - Anulaciones (agrupadas/detalladas)
- **Usuarios**: Gestión de usuarios y permisos (solo administradores)

### **Características Responsive**
- **Móvil (< 768px)**: Tarjetas verticales optimizadas, modales compactos
- **Tablet (768px - 1024px)**: Layout adaptativo intermedio
- **Escritorio (> 1024px)**: Tablas completas, modales anchos
- **Touch**: Botones grandes y espaciados para facilitar la interacción

## 🔐 Seguridad y Privacidad

- **Autenticación segura** con Supabase Auth
- **Roles y permisos** granulares por módulo
- **Políticas RLS** (Row Level Security) en base de datos
- **Validación de datos** en cliente y servidor
- **Credenciales** protegidas con variables de entorno
- **No tracking**: Sin analytics de terceros
- **Datos locales**: Toda la información permanece en tu instancia de Supabase

## 📝 Variables de Entorno

Crea un archivo `.env` en la raíz con:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_publica

# Optional: Build Mode
BUILD_MODE=dev
```

> **⚠️ Importante**: Nunca compartas tus credenciales de Supabase públicamente.

## 🗃️ Estructura del Proyecto

```
sistema-inventario/
├── src/
│   ├── components/        # Componentes React
│   │   ├── auth/         # Autenticación
│   │   ├── common/       # Componentes reutilizables
│   │   ├── dashboard/    # Dashboard principal
│   │   ├── productos/    # Gestión de inventario
│   │   ├── ventas/       # Punto de venta
│   │   ├── compras/      # Gestión de compras
│   │   ├── reportes/     # Reportes y análisis
│   │   └── ...
│   ├── contexts/         # React Context (Auth, etc.)
│   ├── lib/             # Configuración (Supabase)
│   ├── types/           # Tipos TypeScript
│   ├── utils/           # Utilidades y helpers
│   ├── App.tsx          # Componente principal
│   └── main.tsx         # Punto de entrada
├── public/              # Archivos estáticos
├── .env                 # Variables de entorno (no incluido)
├── package.json         # Dependencias
├── tsconfig.json        # Configuración TypeScript
├── vite.config.ts       # Configuración Vite
└── README.md           # Este archivo
```

## 🎨 Personalización

### **Tema y Estilos**
- Colores principales definidos en Tailwind CSS
- Personaliza `tailwind.config.js` para cambiar la paleta
- Componentes de Radix UI para consistencia

### **Tickets PDF**
- Configura el encabezado y pie de página en la configuración de tickets
- Personaliza el logo de tu negocio
- Ajusta el formato según tus necesidades

### **Permisos**
- Define roles personalizados en la tabla `roles`
- Configura permisos granulares por módulo
- Controla acceso a funcionalidades específicas

## 📄 Licencia

Este proyecto está bajo la **MIT License**.

**Derechos de Uso:**

✅ **PERMITIDO:**
- Uso personal y comercial
- Modificación del código fuente
- Distribución en proyectos propios
- Contribuciones al proyecto

❌ **RESTRICCIONES:**
- No revender como producto comercial standalone
- No eliminar avisos de copyright
- No reclamar autoría del código original

Ver el archivo `LICENSE` para más detalles.

## 🤝 Contribuir

¡Las contribuciones son bienvenidas!

**Cómo contribuir:**

1. Fork del proyecto
2. Crea una rama para tu característica (`git checkout -b feature/NuevaCaracteristica`)
3. Commit tus cambios (`git commit -m 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/NuevaCaracteristica`)
5. Abre un Pull Request con descripción detallada

**Guías:**
- Mantén el código limpio y comentado
- Sigue las convenciones de TypeScript
- Prueba tus cambios antes de hacer PR
- Actualiza la documentación si es necesario

**Sistema de Inventario** - La solución completa para la gestión de tu negocio 🚀

*Desarrollado con ❤️ usando React, TypeScript y Supabase*
