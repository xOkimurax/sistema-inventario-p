import jsPDF from 'jspdf';
import { TicketConfig, Venta, VentaItem } from '../types';
import { formatGuaranies } from './currency';

interface TicketData {
  venta: Venta;
  items: VentaItem[];
  vendedor: string;
  config: TicketConfig;
}

/**
 * Genera un PDF de ticket de venta con formato estrecho (80mm)
 */
export const generateTicketPDF = async (data: TicketData): Promise<jsPDF> => {
  const { venta, items, vendedor, config } = data;
  const ticketWidth = 80; // mm

  // Función que renderiza el contenido del ticket y retorna la posición Y final
  const renderTicketContent = async (doc: jsPDF): Promise<number> => {
    let currentY = 10;
    const pageWidth = ticketWidth;
    const margin = 5;
    const contentWidth = pageWidth - (margin * 2);

    // Función helper para agregar texto centrado
    const addCenteredText = (text: string, y: number, fontSize: number = 10, bold: boolean = false) => {
      doc.setFontSize(fontSize);
      if (bold) {
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      const textWidth = doc.getTextWidth(text);
      const x = (pageWidth - textWidth) / 2;
      doc.text(text, x, y);
    };

    // Función helper para agregar texto con ajuste automático de líneas
    const addWrappedText = (text: string, y: number, fontSize: number = 9, align: 'left' | 'center' = 'center'): number => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'normal');

      const lines = doc.splitTextToSize(text, contentWidth);

      lines.forEach((line: string, index: number) => {
        if (align === 'center') {
          const textWidth = doc.getTextWidth(line);
          const x = (pageWidth - textWidth) / 2;
          doc.text(line, x, y + (index * 4));
        } else {
          doc.text(line, margin, y + (index * 4));
        }
      });

      return y + (lines.length * 4);
    };

    // Función helper para línea separadora
    const addDashedLine = (y: number) => {
      const dashLength = 2;
      const gapLength = 1;
      let currentX = margin;
      const endX = pageWidth - margin;

      while (currentX < endX) {
        const dashEnd = Math.min(currentX + dashLength, endX);
        doc.line(currentX, y, dashEnd, y);
        currentX = dashEnd + gapLength;
      }
    };

    try {
      // 1. LOGO (si existe)
      if (config.logo_url) {
        try {
          const response = await fetch(config.logo_url);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          const logoWidth = 30;
          const logoHeight = 20;
          const logoX = (pageWidth - logoWidth) / 2;
          doc.addImage(base64, 'PNG', logoX, currentY, logoWidth, logoHeight);
          currentY += logoHeight + 5;
        } catch (error) {
          console.error('Error al cargar logo:', error);
        }
      }

      // 2. NOMBRE DE LA EMPRESA
      addCenteredText(config.nombre_empresa.toUpperCase(), currentY, 12, true);
      currentY += 6;

      // 3. ENCABEZADO (si existe)
      if (config.encabezado) {
        currentY = addWrappedText(config.encabezado, currentY, 8, 'center');
        currentY += 2;
      }

      // Línea separadora
      addDashedLine(currentY);
      currentY += 5;

      // 4. INFORMACIÓN DEL TICKET
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ticket: ${venta.numero_venta}`, margin, currentY);
      currentY += 4;

      const fecha = new Date(venta.fecha);
      doc.text(`Fecha: ${fecha.toLocaleDateString('es-PY')}`, margin, currentY);
      currentY += 4;
      doc.text(`Hora: ${fecha.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}`, margin, currentY);
      currentY += 4;
      doc.text(`Vendedor: ${vendedor}`, margin, currentY);
      currentY += 5;

      // Línea separadora
      addDashedLine(currentY);
      currentY += 5;

      // 5. ENCABEZADO DE PRODUCTOS
      doc.setFont('helvetica', 'bold');
      doc.text('PRODUCTOS', margin, currentY);
      currentY += 5;

      // 6. ITEMS
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      items.forEach(item => {
        const producto = item.producto;

        // Nombre del producto
        const nombreLines = doc.splitTextToSize(producto?.nombre || 'Producto', contentWidth);
        nombreLines.forEach((line: string, index: number) => {
          doc.text(line, margin, currentY + (index * 3.5));
        });
        currentY += nombreLines.length * 3.5;

        // Cantidad y precio
        const cantidadText = `${item.cantidad} ${item.unidad_medida}`;
        const precioUnitario = Math.round(item.precio_unitario).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        const subtotalValor = Math.round(item.subtotal).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        const lineaProducto = `${cantidadText} x ${precioUnitario}`;
        doc.text(lineaProducto, margin, currentY);

        const subtotalText = subtotalValor;
        const subtotalWidth = doc.getTextWidth(subtotalText);
        doc.text(subtotalText, pageWidth - margin - subtotalWidth, currentY);
        currentY += 5;
      });

      // Línea separadora
      addDashedLine(currentY);
      currentY += 5;

      // 7. TOTAL
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const totalText = 'TOTAL:';
      const totalValue = Math.round(venta.total).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

      doc.text(totalText, margin, currentY);
      const totalValueWidth = doc.getTextWidth(totalValue);
      doc.text(totalValue, pageWidth - margin - totalValueWidth, currentY);
      currentY += 7;

      // Línea separadora antes del pie de página (2 líneas de espacio = ~8mm)
      addDashedLine(currentY);
      currentY += 8;

      // 8. PIE DE PÁGINA (si existe)
      if (config.pie_pagina) {
        currentY = addWrappedText(config.pie_pagina, currentY, 8, 'center');
        currentY += 3;
      }

      // 9. MENSAJE FINAL
      addCenteredText('¡Gracias por su compra!', currentY, 9, false);
      currentY += 5;

      return currentY;
    } catch (error) {
      console.error('Error al renderizar contenido:', error);
      throw error;
    }
  };

  try {
    // Primera pasada: calcular altura necesaria con documento temporal
    const tempDoc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [ticketWidth, 1000] // Altura temporal grande
    });

    const finalY = await renderTicketContent(tempDoc);

    // Calcular altura final con margen inferior
    const finalHeight = finalY + 5; // Margen inferior pequeño

    // Segunda pasada: crear documento con altura exacta y renderizar
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [ticketWidth, finalHeight]
    });

    await renderTicketContent(doc);

    return doc;
  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw new Error('No se pudo generar el PDF del ticket');
  }
};

/**
 * Descarga un ticket PDF
 */
export const downloadTicketPDF = async (data: TicketData) => {
  try {
    const pdf = await generateTicketPDF(data);
    const fileName = `ticket-${data.venta.numero_venta}.pdf`;
    pdf.save(fileName);
  } catch (error) {
    console.error('Error al descargar PDF:', error);
    throw error;
  }
};

/**
 * Abre el ticket PDF en una nueva ventana
 */
export const openTicketPDF = async (data: TicketData) => {
  try {
    const pdf = await generateTicketPDF(data);
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    
    // Limpiar el objeto URL después de un tiempo
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error('Error al abrir PDF:', error);
    throw error;
  }
};
