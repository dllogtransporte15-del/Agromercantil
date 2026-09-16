
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Shipment, Cargo, Client, Product, Vehicle } from "../types";

export const getStoredCompanyLogo = (): string | null => {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('agromercantil_companyLogo') ||
    localStorage.getItem('transcunha_companyLogo') ||
    localStorage.getItem('trancunha_companyLogo') ||
    null
  );
};

export const addPdfLogo = (
  doc: jsPDF,
  logo?: string | null,
  options?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    align?: 'left' | 'right' | 'center';
  }
): boolean => {
  const effectiveLogo = logo || getStoredCompanyLogo();
  if (!effectiveLogo) return false;

  const w = options?.width ?? 35;
  const h = options?.height ?? 15;
  const y = options?.y ?? 5;
  const pageWidth = doc.internal.pageSize.getWidth();

  let x = options?.x;
  if (x === undefined) {
    if (options?.align === 'left') {
      x = 14;
    } else if (options?.align === 'center') {
      x = (pageWidth - w) / 2;
    } else {
      // Default: Top right
      x = pageWidth - 14 - w;
    }
  }

  try {
    doc.addImage(effectiveLogo, 'PNG', x, y, w, h);
    return true;
  } catch (e) {
    console.warn("Could not add company logo to PDF", e);
    return false;
  }
};

export const generateLoadingOrderPDF = (
  shipment: Shipment,
  cargo: Cargo,
  clients: Client[],
  products: Product[],
  vehicles: Vehicle[],
  companyLogo?: string | null
) => {
  const doc = new jsPDF();
  const client = clients.find((c) => c.id === cargo.clientId);
  const product = products.find((p) => p.id === cargo.productId);
  const normalizePlate = (p: string | undefined | null) => p ? p.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
  const mainVehicle = vehicles.find((v) => normalizePlate(v.plate) === normalizePlate(shipment.horsePlate));

  // Brand Colors
  const primaryBlue: [number, number, number] = [11, 102, 228]; // #0B66E4 Agromercantil Vivid Electric Blue
  const accentBlue: [number, number, number] = [2, 132, 199];  // #0284C7 Agromercantil Sky Accent
  const secondaryGray: [number, number, number] = [100, 116, 139]; // #64748B

  // Constants
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Draw Header background for branding
  doc.setFillColor(248, 250, 252); // light slate
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Logo
  const effectiveLogo = companyLogo || getStoredCompanyLogo();
  if (effectiveLogo) {
      try {
          doc.addImage(effectiveLogo, 'PNG', margin, 5, 35, 20); 
      } catch (e) {
          console.warn("Could not add company logo to PDF", e);
      }
  }

  // Company Info Header (Under the logo)
  doc.setFontSize(8);
  doc.setTextColor(secondaryGray[0], secondaryGray[1], secondaryGray[2]);
  doc.setFont("helvetica", "normal");
  doc.text("CNPJ: 57.359.600/0001-68", margin, 28);
  doc.text("Rua Monteiro Lobato, 325 - Vila Nova - Poços de Caldas/MG - 37701-110", margin, 32);
  doc.text("Autorização de Carregamento de Transportes", margin, 36);

  // Document ID & Date (Top Right)
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(`OC Nº: ${shipment.id}`, pageWidth - margin, 18, { align: 'right' });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - margin, 24, { align: 'right' });

  // Divider
  doc.setDrawColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.setLineWidth(1.5);
  doc.line(margin, 40, pageWidth - margin, 40);

  // Title Section
  doc.setFontSize(16);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setFont("helvetica", "bold");
  doc.text("ORDEM DE CARREGAMENTO", pageWidth / 2, 53, { align: 'center' });

  // --- Carga Info ---
  doc.setFontSize(11);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text("1. INFORMAÇÕES DA CARGA", margin, 68);

  autoTable(doc, {
    startY: 71,
    head: [["Descrição do Requisito", "Informações Detalhadas"]],
    body: [
      ["CLIENTE / EMBARCADOR", (client?.nomeFantasia || client?.razaoSocial || cargo.clientId || '').toUpperCase()],
      ["PRODUTO / MERCADORIA", (product?.name || cargo.productId || '').toUpperCase()],
      ["PESO / TONELAGEM", `${(Number(shipment.shipmentTonnage) || 0).toLocaleString("pt-BR")} TON`],
      ["ORIGEM DO CARREGAMENTO", cargo.originLocation ? `${cargo.origin || ''} - ${cargo.originLocation}`.toUpperCase() : (cargo.origin || '').toUpperCase()],
      ["DESTINO DA CARGA", cargo.destinationLocation ? `${cargo.destination || ''} - ${cargo.destinationLocation}`.toUpperCase() : (cargo.destination || '').toUpperCase()],
      ["DATA PROGRAMADA", shipment.scheduledDate ? new Date(`${shipment.scheduledDate}T00:00:00`).toLocaleDateString('pt-BR') : 'N/A'],
    ],
    theme: "striped",
    headStyles: { fillColor: primaryBlue, fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: primaryBlue } }
  });

  const driverY = (doc as any).lastAutoTable.finalY + 12;

  // --- Motorista & Veiculo Info ---
  doc.setFontSize(11);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text("2. INFORMAÇÕES DO TRANSPORTADOR", margin, driverY);

  autoTable(doc, {
    startY: driverY + 3,
    head: [["Descrição", "Dados do Condutor e Veículo"]],
    body: [
      ["MOTORISTA", shipment.driverName.toUpperCase()],
      ["CPF DO CONDUTOR", shipment.driverCpf || "N/A"],
      ["TELEFONE CONTATO", shipment.driverContact || "N/A"],
      ["PLACA (CAVALO)", shipment.horsePlate.toUpperCase()],
      ["TIPO DE VEÍCULO", (mainVehicle?.setType || shipment.vehicleSetType || "N/A").toUpperCase()],
      ["CARROCERIA", (mainVehicle?.bodyType || shipment.vehicleBodyType || "N/A").toUpperCase()],
      ["PLACA(S) CARRETA(S)", [shipment.trailer1Plate, shipment.trailer2Plate, shipment.trailer3Plate].filter(Boolean).join(" / ").toUpperCase() || "N/A"],
      ["PROPRIETÁRIO / TITULAR", (shipment.anttOwnerIdentifier || shipment.ownerContact || "N/A").toUpperCase()],
    ],
    theme: "striped",
    headStyles: { fillColor: primaryBlue, fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: primaryBlue } }
  });

  const paymentY = (doc as any).lastAutoTable.finalY + 8;

  // --- Pagamento & Adiantamento ---
  doc.setFontSize(11);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text("3. CONDIÇÕES DE PAGAMENTO E ADIANTAMENTO", margin, paymentY);

  autoTable(doc, {
    startY: paymentY + 3,
    head: [["Item de Pagamento", "Detalhamento"]],
    body: [
      ["FORMA DE PAGAMENTO", (shipment.paymentMethod || "PIX - E-FRETE").toUpperCase()],
      ["ADIANTAMENTO (%)", `${shipment.advancePercentage !== undefined ? shipment.advancePercentage : 70}%`],
      ["CHAVE PIX / DADOS BANCÁRIOS", (shipment.paymentMethod === 'PIX - E-FRETE' ? (shipment.pixKey || shipment.bankDetails || "N/A") : (shipment.bankDetails || shipment.pixKey || "N/A")).toUpperCase()],
    ],
    theme: "striped",
    headStyles: { fillColor: primaryBlue, fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: primaryBlue } }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 8;

  // Espaço antes do rodapé
  currentY += 5;


  // --- Footer / Signatures ---
  const footerY = Math.max(currentY + 25, pageHeight - 55);

  // Signature lines
  doc.setLineWidth(0.5);
  doc.setDrawColor(secondaryGray[0], secondaryGray[1], secondaryGray[2]);
  
  // Driver signature
  doc.line(margin, footerY, margin + 80, footerY);
  doc.setFontSize(8);
  doc.setTextColor(secondaryGray[0], secondaryGray[1], secondaryGray[2]);
  doc.text("ASSINATURA DO MOTORISTA", margin + 40, footerY + 5, { align: 'center' });
  doc.setFontSize(7);
  doc.text(shipment.driverName.toUpperCase(), margin + 40, footerY + 9, { align: 'center' });

  // Authority signature
  doc.line(pageWidth - margin - 80, footerY, pageWidth - margin, footerY);
  doc.setFontSize(8);
  doc.text("AGROMERCANTIL LOGÍSTICA", pageWidth - margin - 40, footerY + 5, { align: 'center' });
  doc.setFontSize(7);
  doc.text("AUTORIZAÇÃO DE CARREGAMENTO", pageWidth - margin - 40, footerY + 9, { align: 'center' });

  // Final Footer Note
  doc.setFontSize(7);
  doc.setTextColor(150);
  const footerText = "Este documento é exclusivo para controle interno de carregamento da AGROMERCANTIL LOGÍSTICA. As informações aqui contidas são confidenciais.";
  doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Save PDF
  doc.save(`OC_${shipment.id}_${shipment.horsePlate.toUpperCase()}.pdf`);
};

