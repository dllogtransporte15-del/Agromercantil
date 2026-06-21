import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ekwirxblsnmflsamkgnx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrd2lyeGJsc25tZmxzYW1rZ254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MDY4MjgsImV4cCI6MjA5NTA4MjgyOH0.Q97uNFSpThMcVpUMp9T_jTSWu4UGX_0OEoB4LaC4AfM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const formatCPF = (value) => {
  if (!value) return value;
  const cleaned = String(value).replace(/\D/g, '').slice(0, 11);
  if (cleaned.length !== 11) return value; // only format if complete
  return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4');
};

const formatCNPJ = (value) => {
  if (!value) return value;
  const cleaned = String(value).replace(/\D/g, '').slice(0, 14);
  if (cleaned.length !== 14) return value;
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
};

const formatCpfCnpj = (value) => {
  if (!value) return value;
  const cleaned = String(value).replace(/\D/g, '');
  if (cleaned.length <= 11) {
    if (cleaned.length === 11) return formatCPF(cleaned);
  } else {
    if (cleaned.length === 14) return formatCNPJ(cleaned);
  }
  return value;
};

const formatPhone = (value) => {
  if (!value) return value;
  let cleaned = String(value).replace(/\D/g, '').slice(0, 11);
  if (cleaned.length === 11) {
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
  }
  return value; // if not 10 or 11 digits, we might not want to guess the format, or maybe we do?
};

const forceFormatPhone = (value) => {
  if (!value) return value;
  let cleaned = String(value).replace(/\D/g, '');
  if (cleaned.length > 11) cleaned = cleaned.slice(0, 11);
  
  if (cleaned.length === 11) {
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
  } else if (cleaned.length > 0) {
    return formatPhoneLogic(cleaned);
  }
  return value;
};

const formatPhoneLogic = (cleaned) => {
  if (cleaned.length > 10) {
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  } else if (cleaned.length > 6) {
    return cleaned.replace(/^(\d{2})(\d{4})(\d{1,4}).*/, '($1) $2-$3');
  } else if (cleaned.length > 2) {
    return cleaned.replace(/^(\d{2})(\d{1,5}).*/, '($1) $2');
  } else if (cleaned.length > 0) {
    return cleaned.replace(/^(\d{1,2})/, '($1');
  }
  return cleaned;
}

const formatDocsPhoneFallback = (value) => {
    if (!value) return value;
    const str = String(value);
    if(str.replace(/\D/g, '').length >= 10 && str.replace(/\D/g, '').length <= 11) return forceFormatPhone(str);
    return str;
}

async function run() {
  console.log('Starting DB Formatting...');

  // 1. Clients
  const { data: clients } = await supabase.from('clients').select('*');
  if (clients) {
    let count = 0;
    for (const c of clients) {
      const newCnpj = formatCpfCnpj(c.cnpj);
      const newPhone = formatDocsPhoneFallback(c.phone);
      if (newCnpj !== c.cnpj || newPhone !== c.phone) {
        await supabase.from('clients').update({ cnpj: newCnpj, phone: newPhone }).eq('id', c.id);
        count++;
      }
    }
    console.log(`Clients updated: ${count}`);
  }

  // 2. Owners
  const { data: owners } = await supabase.from('owners').select('*');
  if (owners) {
    let count = 0;
    for (const o of owners) {
      const newDoc = formatCpfCnpj(o.cpf_cnpj);
      const newPhone = formatDocsPhoneFallback(o.phone);
      if (newDoc !== o.cpf_cnpj || newPhone !== o.phone) {
        await supabase.from('owners').update({ cpf_cnpj: newDoc, phone: newPhone }).eq('id', o.id);
        count++;
      }
    }
    console.log(`Owners updated: ${count}`);
  }

  // 3. Drivers
  const { data: drivers } = await supabase.from('drivers').select('*');
  if (drivers) {
    let count = 0;
    for (const d of drivers) {
      const newCpf = formatCpfCnpj(d.cpf);
      const newPhone = formatDocsPhoneFallback(d.phone);
      if (newCpf !== d.cpf || newPhone !== d.phone) {
        await supabase.from('drivers').update({ cpf: newCpf, phone: newPhone }).eq('id', d.id);
        count++;
      }
    }
    console.log(`Drivers updated: ${count}`);
  }

  // 4. Shipments
  const { data: shipments } = await supabase.from('shipments').select('*');
  if (shipments) {
    let count = 0;
    for (const s of shipments) {
      const newCpf = formatCpfCnpj(s.driver_cpf);
      const newPhone = formatDocsPhoneFallback(s.driver_contact);
      if (newCpf !== s.driver_cpf || newPhone !== s.driver_contact) {
        await supabase.from('shipments').update({ driver_cpf: newCpf, driver_contact: newPhone }).eq('id', s.id);
        count++;
      }
    }
    console.log(`Shipments updated: ${count}`);
  }

  console.log('Finished DB Formatting.');
}

run();
