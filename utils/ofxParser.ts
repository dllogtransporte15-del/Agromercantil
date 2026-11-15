import type { OfxTransaction } from '../types';

/**
 * Utilitário para ler e converter extratos bancários .OFX (Open Financial Exchange 1.x e 2.x)
 * Compatível com formatos comuns emitidos por bancos brasileiros (Itaú, Bradesco, BB, Caixa, Santander, etc.)
 */

export interface ParsedOfxResult {
  bankId?: string;
  accountNumber?: string;
  startDate?: string;
  endDate?: string;
  currency?: string;
  transactions: OfxTransaction[];
}

/**
 * Converte data no formato OFX (YYYYMMDDHHMMSS ou YYYYMMDD) para formato ISO (YYYY-MM-DD)
 */
function parseOfxDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const clean = dateStr.trim().replace(/\[.*\]/, ''); // remove timezone se existir
  if (clean.length >= 8) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Extrai o valor de uma tag SGML/XML do conteúdo OFX
 */
function getTagValue(block: string, tag: string): string {
  // Tenta formato XML: <TAG>valor</TAG>
  const xmlRegex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const xmlMatch = block.match(xmlRegex);
  if (xmlMatch && xmlMatch[1] !== undefined) {
    return xmlMatch[1].trim();
  }

  // Tenta formato SGML (comum em bancos brasileiros): <TAG>valor\n (sem fechamento)
  const sgmlRegex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
  const sgmlMatch = block.match(sgmlRegex);
  if (sgmlMatch && sgmlMatch[1] !== undefined) {
    return sgmlMatch[1].trim();
  }

  return '';
}

/**
 * Parser principal de arquivo OFX
 */
export function parseOfxFileContent(content: string): ParsedOfxResult {
  const result: ParsedOfxResult = {
    transactions: [],
  };

  if (!content) return result;

  // Extrair metadados da conta se disponíveis
  result.bankId = getTagValue(content, 'BANKID') || undefined;
  result.accountNumber = getTagValue(content, 'ACCTID') || undefined;
  result.currency = getTagValue(content, 'CURDEF') || 'BRL';

  const dtStart = getTagValue(content, 'DTSTART');
  if (dtStart) result.startDate = parseOfxDate(dtStart);

  const dtEnd = getTagValue(content, 'DTEND');
  if (dtEnd) result.endDate = parseOfxDate(dtEnd);

  // Isolar todos os blocos de transação <STMTTRN>...</STMTTRN> ou <STMTTRN> até próximo <STMTTRN> ou </BANKTRANLIST>
  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|$))/gi;
  let match: RegExpExecArray | null;

  while ((match = trnRegex.exec(content)) !== null) {
    const trnBlock = match[1];
    if (!trnBlock.trim()) continue;

    const trnType = getTagValue(trnBlock, 'TRNTYPE').toUpperCase();
    const dtPosted = getTagValue(trnBlock, 'DTPOSTED');
    const trnAmtStr = getTagValue(trnBlock, 'TRNAMT').replace(',', '.');
    const fitId = getTagValue(trnBlock, 'FITID');
    const checkNum = getTagValue(trnBlock, 'CHECKNUM') || fitId || '';
    const memo = getTagValue(trnBlock, 'MEMO') || getTagValue(trnBlock, 'NAME');

    const amount = parseFloat(trnAmtStr) || 0;
    const date = parseOfxDate(dtPosted);

    const type: 'CREDIT' | 'DEBIT' | 'OTHER' = 
      amount > 0 ? 'CREDIT' : 
      amount < 0 ? 'DEBIT' : 
      (trnType === 'CREDIT' ? 'CREDIT' : 'DEBIT');

    result.transactions.push({
      id: fitId || `ofx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      checkNum,
      date,
      amount,
      description: memo || 'Lançamento bancário',
      type,
      memo,
      reconciled: false,
    });
  }

  // Ordenar transações pela data decrescente
  result.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return result;
}
