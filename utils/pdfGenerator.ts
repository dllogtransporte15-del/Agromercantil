
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Shipment, Cargo, Client, Product, Vehicle } from "../types";

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
  const mainVehicle = vehicles.find((v) => v.plate.trim().toLowerCase() === shipment.horsePlate.trim().toLowerCase());

  // Brand Colors
  const primaryBlue: [number, number, number] = [29, 59, 141]; // #1D3B8D
  const accentOrange: [number, number, number] = [241, 100, 33]; // #F16421
  const secondaryGray: [number, number, number] = [107, 114, 128]; // #6B7280

  // Constants
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Draw Header background for branding
  doc.setFillColor(248, 250, 252); // light slate
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Logo
  if (companyLogo) {
      try {
          // Adjust logo width/height if needed to prevent squash, but keeping original dimension settings
          doc.addImage(companyLogo, 'PNG', margin, 5, 35, 20); 
      } catch (e) {
          console.warn("Could not add company logo to PDF", e);
      }
  }

  // Company Info Header (Under the logo)
  doc.setFontSize(8);
  doc.setTextColor(secondaryGray[0], secondaryGray[1], secondaryGray[2]);
  doc.setFont("helvetica", "normal");
  doc.text("CNPJ: 20.439.095/0001-51", margin, 28);
  doc.text("Logradouro: Rua Beijos Brancos, 374 - Bairro: Cidade Jardim - CEP: 38412-204", margin, 32);
  doc.text("Município: Uberlândia - Estado: Minas Gerais", margin, 36);
  doc.text("Autorização de Carregamento", margin, 40);

  // Document ID & Date (Top Right)
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(`OC Nº: ${shipment.id}`, pageWidth - margin, 18, { align: 'right' });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - margin, 24, { align: 'right' });

  // Divider
  doc.setDrawColor(accentOrange[0], accentOrange[1], accentOrange[2]);
  doc.setLineWidth(1.5);
  doc.line(margin, 45, pageWidth - margin, 45);

  // Title Section
  doc.setFontSize(16);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setFont("helvetica", "bold");
  doc.text("ORDEM DE CARREGAMENTO", pageWidth / 2, 58, { align: 'center' });

  // --- Carga Info ---
  doc.setFontSize(11);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text("1. INFORMAÇÕES DA CARGA", margin, 68);

  autoTable(doc, {
    startY: 71,
    head: [["Descrição do Requisito", "Informações Detalhadas"]],
    body: [
      ["CLIENTE / EMBARCADOR", (client?.nomeFantasia || client?.razaoSocial || cargo.clientId).toUpperCase()],
      ["PRODUTO / MERCADORIA", (product?.name || cargo.productId).toUpperCase()],
      ["PESO / TONELAGEM", `${shipment.shipmentTonnage.toLocaleString("pt-BR")} TON`],
      ["ORIGEM DO CARREGAMENTO", cargo.origin.toUpperCase()],
      ["DESTINO DA CARGA", cargo.destination.toUpperCase()],
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
      ["TIPO DE VEÍCULO", mainVehicle?.setType?.toUpperCase() || "N/A"],
      ["CARROCERIA", mainVehicle?.bodyType?.toUpperCase() || "N/A"],
      ["PLACA(S) CARRETA(S)", [shipment.trailer1Plate, shipment.trailer2Plate, shipment.trailer3Plate].filter(Boolean).join(" / ").toUpperCase() || "N/A"],
      ["PROPRIETÁRIO / TITULAR", (shipment.anttOwnerIdentifier || shipment.ownerContact || "N/A").toUpperCase()],
    ],
    theme: "striped",
    headStyles: { fillColor: primaryBlue, fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: primaryBlue } }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 12;

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
  doc.text("AGROMERCANTIL - TRANSPORTES", pageWidth - margin - 40, footerY + 5, { align: 'center' });
  doc.setFontSize(7);
  doc.text("AUTORIZAÇÃO DE CARREGAMENTO", pageWidth - margin - 40, footerY + 9, { align: 'center' });

  // Final Footer Note
  doc.setFontSize(7);
  doc.setTextColor(150);
  const footerText = "Este documento é exclusivo para controle interno de carregamento da AGROMERCANTIL - TRANSPORTES. As informações aqui contidas são confidenciais.";
  doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Save PDF
  doc.save(`OC_${shipment.id}_${shipment.horsePlate.toUpperCase()}.pdf`);
};

