/**
 * OrçaObras - Export Module
 * ==========================
 * Handles budget export to PDF, Excel, and CSV
 */

class ExportManager {
    constructor() {
        this.currentFormat = 'pdf';
    }

    // ============ SETUP ============

    init() {
        // Setup export format buttons
        const exportBtns = document.querySelectorAll('.export-btn');
        exportBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFormat(e.target.closest('.export-btn').dataset.format);
            });
        });
    }

    setFormat(format) {
        this.currentFormat = format;
        document.querySelectorAll('.export-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.format === format);
        });
    }

    // ============ EXPORT PDF ============

    exportPDF(previewData) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let yPos = 15;

        // Header background
        doc.setFillColor(196, 90, 59);
        doc.rect(0, 0, pageWidth, 40, 'F');

        // Header content
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(previewData.title || 'ORÇAMENTO DE OBRA', pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 30, { align: 'center' });

        yPos = 50;

        // Company Logo (if exists)
        if (previewData.logos?.empresa) {
            try {
                doc.addImage(previewData.logos.empresa, 'PNG', margin, yPos, 30, 20);
            } catch (e) {
                console.log('Could not add company logo');
            }
        }

        // Client Logo (if exists)
        if (previewData.logos?.cliente) {
            try {
                doc.addImage(previewData.logos.cliente, 'PNG', pageWidth - margin - 30, yPos, 30, 20);
            } catch (e) {
                console.log('Could not add client logo');
            }
        }

        yPos += 25;

        // Info section
        doc.setTextColor(44, 24, 16);
        doc.setFontSize(11);

        const infoY = yPos;
        doc.setFont('helvetica', 'bold');
        doc.text('Cliente:', margin, infoY);
        doc.setFont('helvetica', 'normal');
        doc.text(previewData.cliente || '', margin + 25, infoY);

        doc.setFont('helvetica', 'bold');
        doc.text('Obra:', pageWidth / 2, infoY);
        doc.setFont('helvetica', 'normal');
        doc.text(previewData.obra || '', pageWidth / 2 + 20, infoY);

        yPos += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('Data:', margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(previewData.data || '', margin + 25, yPos);

        doc.setFont('helvetica', 'bold');
        doc.text('Validade:', pageWidth / 2, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(previewData.validade || '', pageWidth / 2 + 25, yPos);

        yPos += 15;

        // Items table
        const tableData = previewData.items.map((item, index) => [
            (index + 1).toString(),
            item.codigo || '-',
            item.descricao || '-',
            item.tipo || '-',
            item.unidade || '-',
            item.quantidade?.toString() || '0',
            this.formatBRL(item.valorUnit || 0),
            this.formatBRL(item.total || 0)
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['#', 'Código', 'Descrição', 'Tipo', 'Und', 'Qtd', 'Valor Unit.', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: [196, 90, 59],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9
            },
            bodyStyles: {
                fontSize: 8
            },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 20 },
                2: { cellWidth: 60 },
                3: { cellWidth: 25 },
                4: { cellWidth: 15 },
                5: { cellWidth: 15, halign: 'right' },
                6: { cellWidth: 25, halign: 'right' },
                7: { cellWidth: 25, halign: 'right' }
            },
            margin: { left: margin, right: margin }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Check if we need a new page for totals
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        // Totals section
        doc.setFillColor(237, 230, 223);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 35, 'F');

        doc.setTextColor(44, 24, 16);
        const totalsX = pageWidth - margin - 60;

        doc.setFont('helvetica', 'normal');
        doc.text('Subtotal:', totalsX, yPos + 10);
        doc.text(this.formatBRL(previewData.subtotal), totalsX + 35, yPos + 10);

        if (previewData.taxRate > 0) {
            doc.text(`Impostos (${previewData.taxRate}%):`, totalsX, yPos + 18);
            doc.text(this.formatBRL(previewData.taxValue), totalsX + 35, yPos + 18);
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('TOTAL:', totalsX, yPos + 28);
        doc.setTextColor(196, 90, 59);
        doc.text(this.formatBRL(previewData.total), totalsX + 35, yPos + 28);

        yPos += 45;

        // Footer
        if (previewData.observacoes) {
            doc.setTextColor(44, 24, 16);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Observações:', margin, yPos);
            doc.setFont('helvetica', 'normal');
            const splitObs = doc.splitTextToSize(previewData.observacoes, pageWidth - 2 * margin);
            doc.text(splitObs, margin, yPos + 6);
            yPos += 10 + (splitObs.length * 5);
        }

        // Signature boxes
        yPos = Math.max(yPos + 20, 240);
        if (yPos > 270) {
            doc.addPage();
            yPos = 30;
        }

        const sigWidth = (pageWidth - 2 * margin - 40) / 2;

        doc.setDrawColor(44, 24, 16);
        doc.line(margin, yPos, margin + sigWidth, yPos);
        doc.line(pageWidth - margin - sigWidth, yPos, pageWidth - margin, yPos);

        doc.setFontSize(9);
        doc.setTextColor(90, 74, 64);
        doc.text('Responsável Técnico', margin + sigWidth / 2, yPos + 5, { align: 'center' });
        doc.text('Cliente', pageWidth - margin - sigWidth / 2, yPos + 5, { align: 'center' });

        // Footer text
        doc.setFontSize(8);
        doc.setTextColor(138, 122, 112);
        doc.text(
            'OrçaObras - Sistema de Orçamentos de Obras',
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );

        // Save
        const filename = `Orcamento_${previewData.cliente || 'cliente'}_${this.getDateString()}.pdf`;
        doc.save(filename);
    }

    // ============ EXPORT EXCEL ============

    exportExcel(previewData) {
        const wb = XLSX.utils.book_new();

        // Budget data sheet
        const itemsData = previewData.items.map((item, index) => ({
            'Item': index + 1,
            'Código': item.codigo || '',
            'Descrição': item.descricao || '',
            'Tipo': item.tipo || '',
            'Unidade': item.unidade || '',
            'Quantidade': item.quantidade || 0,
            'Valor Unitário': item.valorUnit || 0,
            'Total': item.total || 0
        }));

        const wsItems = XLSX.utils.json_to_sheet(itemsData);

        // Set column widths
        wsItems['!cols'] = [
            { wch: 6 },
            { wch: 15 },
            { wch: 50 },
            { wch: 15 },
            { wch: 8 },
            { wch: 10 },
            { wch: 15 },
            { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(wb, wsItems, 'Itens');

        // Summary sheet
        const summaryData = [
            { 'Informação': 'Cliente', 'Valor': previewData.cliente || '' },
            { 'Informação': 'Obra', 'Valor': previewData.obra || '' },
            { 'Informação': 'Data', 'Valor': previewData.data || '' },
            { 'Informação': 'Validade', 'Valor': previewData.validade || '' },
            { 'Informação': '', 'Valor': '' },
            { 'Informação': 'Subtotal', 'Valor': previewData.subtotal || 0 },
            { 'Informação': `Impostos (${previewData.taxRate}%)`, 'Valor': previewData.taxValue || 0 },
            { 'Informação': 'TOTAL', 'Valor': previewData.total || 0 }
        ];

        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 20 }, { wch: 50 }];

        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

        // Generate and download
        const filename = `Orcamento_${previewData.cliente || 'cliente'}_${this.getDateString()}.xlsx`;
        XLSX.writeFile(wb, filename);
    }

    // ============ EXPORT CSV ============

    exportCSV(previewData) {
        // Prepare items data
        const headers = ['Item', 'Código', 'Descrição', 'Tipo', 'Unidade', 'Quantidade', 'Valor Unitário', 'Total'];
        const rows = previewData.items.map((item, index) => [
            index + 1,
            item.codigo || '',
            item.descricao || '',
            item.tipo || '',
            item.unidade || '',
            item.quantidade || 0,
            item.valorUnit || 0,
            item.total || 0
        ]);

        // Add summary at the end
        rows.push([]);
        rows.push(['Subtotal', '', '', '', '', '', '', previewData.subtotal || 0]);
        if (previewData.taxRate > 0) {
            rows.push([`Impostos (${previewData.taxRate}%)`, '', '', '', '', '', '', previewData.taxValue || 0]);
        }
        rows.push(['TOTAL', '', '', '', '', '', '', previewData.total || 0]);

        // Convert to CSV
        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.join(';'))
        ].join('\n');

        // Add BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        const filename = `Orcamento_${previewData.cliente || 'cliente'}_${this.getDateString()}.csv`;
        this.downloadBlob(blob, filename);
    }

    // ============ HELPERS ============

    formatBRL(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    }

    getDateString() {
        const now = new Date();
        return `${now.getDate().toString().padStart(2, '0')}${ (now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear()}`;
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============ MAIN EXPORT FUNCTION ============

    export(format, previewData) {
        switch (format) {
            case 'pdf':
                this.exportPDF(previewData);
                break;
            case 'xlsx':
                this.exportExcel(previewData);
                break;
            case 'csv':
                this.exportCSV(previewData);
                break;
            default:
                console.error('Unknown export format:', format);
        }
    }
}

// Create global instance
const exportManager = new ExportManager();