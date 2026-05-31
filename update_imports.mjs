import fs from 'fs';
import path from 'path';

const files = [
  'C:\\Users\\davis\\Documents\\Agromercantil\\components\\reports\\StayFinancialReport.tsx',
  'C:\\Users\\davis\\Documents\\Agromercantil\\components\\ShipmentDetailsModal.tsx',
  'C:\\Users\\davis\\Documents\\Agromercantil\\components\\ShipmentTable.tsx',
  'C:\\Users\\davis\\Documents\\Agromercantil\\hooks\\useDatabase.ts',
  'C:\\Users\\davis\\Documents\\Agromercantil\\pages\\FreightQuotePage.tsx',
  'C:\\Users\\davis\\Documents\\Agromercantil\\pages\\LayoverCalculatorPage.tsx',
  'C:\\Users\\davis\\Documents\\Agromercantil\\pages\\OperationalMapPage.tsx',
  'C:\\Users\\davis\\Documents\\Agromercantil\\pages\\ReportsPage.tsx',
  'C:\\Users\\davis\\Documents\\Agromercantil\\pages\\ShipmentsPage.tsx',
  'C:\\Users\\davis\\Documents\\Agromercantil\\pages\\ToolsHistoryPage.tsx',
  'C:\\Users\\davis\\Documents\\Agromercantil\\App.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/['"]\.\.\/lib\/db['"]/g, "'../services/api/db'");
  content = content.replace(/['"]\.\.\/\.\.\/lib\/db['"]/g, "'../../services/api/db'");
  content = content.replace(/['"]\.\/lib\/db['"]/g, "'./services/api/db'");
  
  content = content.replace(/['"]\.\.\/utils\/toolStorage['"]/g, "'../services/api/toolsApi'");
  content = content.replace(/['"]\.\.\/\.\.\/utils\/toolStorage['"]/g, "'../../services/api/toolsApi'");
  content = content.replace(/['"]\.\/utils\/toolStorage['"]/g, "'./services/api/toolsApi'");
  
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
}
