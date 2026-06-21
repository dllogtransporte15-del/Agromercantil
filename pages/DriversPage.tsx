
import React, { useState, useRef, useMemo } from 'react';
import Header from '../components/Header';
import DriverTable from '../components/DriverTable';
import DriverFormModal from '../components/DriverFormModal';
import DriverFilter, { DriverFilters } from '../components/DriverFilter';
import ShipmentHistoryModal from '../components/ShipmentHistoryModal';
import type { Driver, Owner, User, ProfilePermissions, Shipment, Cargo } from '../types';
import { DriverClassification } from '../types';
import { can } from '../auth';
import Pagination from '../components/Pagination';

// For reading XLS files
declare const XLSX: any;

interface DriversPageProps {
  drivers: Driver[];
  setDrivers: React.Dispatch<React.SetStateAction<Driver[]>>;
  onSaveDriver: (driverData: Driver | Omit<Driver, 'id'>) => void;
  owners: Owner[];
  currentUser: User;
  profilePermissions: ProfilePermissions;
  shipments: Shipment[];
  cargos: Cargo[];
}

const DriversPage: React.FC<DriversPageProps> = ({ 
  drivers, 
  setDrivers, 
  onSaveDriver, 
  owners, 
  currentUser, 
  profilePermissions,
  shipments,
  cargos
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [driverToEdit, setDriverToEdit] = useState<Driver | null>(null);
  const [selectedDriverForHistory, setSelectedDriverForHistory] = useState<Driver | null>(null);
  
  const [filters, setFilters] = useState<DriverFilters>({
    name: '',
    cpf: '',
    cnh: '',
    phone: '',
    classification: '',
    ownerId: '',
    status: 'all',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const canCreate = can('create', currentUser, 'drivers', profilePermissions);
  const canUpdate = can('update', currentUser, 'drivers', profilePermissions);
  const canDelete = can('delete', currentUser, 'drivers', profilePermissions);

  const filteredDrivers = useMemo(() => {
    return drivers.filter(driver => {
      const nameMatch = !filters.name || driver.name.toLowerCase().includes(filters.name.toLowerCase());
      const cpfMatch = !filters.cpf || driver.cpf.includes(filters.cpf);
      const cnhMatch = !filters.cnh || driver.cnh.includes(filters.cnh);
      const phoneMatch = !filters.phone || driver.phone.includes(filters.phone);
      const classificationMatch = !filters.classification || driver.classification === filters.classification;
      const ownerMatch = !filters.ownerId || driver.ownerId === filters.ownerId;
      
      let statusMatch = true;
      if (filters.status === 'active') statusMatch = driver.active;
      else if (filters.status === 'restricted') statusMatch = !driver.active;

      return nameMatch && cpfMatch && cnhMatch && phoneMatch && classificationMatch && ownerMatch && statusMatch;
    });
  }, [drivers, filters]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage);
  const paginatedDrivers = filteredDrivers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenModal = () => {
    setDriverToEdit(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleEditDriver = (driver: Driver) => {
    setDriverToEdit(driver);
    setIsModalOpen(true);
  };
  
  const handleShowHistory = (driver: Driver) => {
    setSelectedDriverForHistory(driver);
    setIsHistoryModalOpen(true);
  };

  const driverShipmentHistory = useMemo(() => {
    if (!selectedDriverForHistory) return [];
    return shipments.filter(s => 
      s.driverCpf === selectedDriverForHistory.cpf || 
      s.driverName === selectedDriverForHistory.name
    );
  }, [selectedDriverForHistory, shipments]);
  
  const handleDeleteDriver = (driverId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este motorista?')) {
        setDrivers(prev => prev.filter(d => d.id !== driverId));
    }
  };

  const handleSaveDriver = (driver: Driver | Omit<Driver, 'id'>) => {
    onSaveDriver(driver);
    handleCloseModal();
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleExport = () => {
    const headers = ['name', 'cpf', 'cnh', 'phone', 'classification', 'ownerId'];
    const csvRows = [
      headers.join(','),
      ...drivers.map(driver =>
        headers.map(header => `"${driver[header as keyof Driver] || ''}"`).join(',')
      )
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'motoristas.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const processData = (allRows: any[][]) => {
          if (allRows.length < 2) {
            throw new Error('A planilha deve conter um cabeçalho e pelo menos uma linha de dados.');
          }

          const header = allRows[0].map(h => String(h || '').trim().toLowerCase());
          const dataRows = allRows.slice(1).filter(row => Array.isArray(row) && row.some(cell => cell !== null && cell !== ''));

          const findHeaderIndex = (...possibleNames: string[]): number => {
              for (const name of possibleNames) {
                  const index = header.indexOf(name);
                  if (index !== -1) return index;
              }
              return -1;
          }

          const colMap = {
            name: findHeaderIndex('name', 'nome', 'motorista', 'nome completo', 'nome do motorista'),
            cpf: findHeaderIndex('cpf'),
            cnh: findHeaderIndex('cnh'),
            phone: findHeaderIndex('phone', 'telefone', 'celular', 'contato'),
            classification: findHeaderIndex('classification', 'classificação', 'classificacao'),
            ownerId: findHeaderIndex('ownerid', 'owner_id', 'proprietarioid', 'proprietario_id', 'id do proprietario'),
          };

          const validDrivers: Omit<Driver, 'id'>[] = [];
          const importErrors: { row: number, message: string }[] = [];

          const cleanNumeric = (val: string) => val.replace(/\D/g, '');
          const standardizeClassification = (val: string): DriverClassification | null => {
            if (!val) return null;
            const cleanVal = val.trim().toLowerCase();
            for (const enumValue of Object.values(DriverClassification)) {
              if (enumValue.toLowerCase() === cleanVal) {
                return enumValue;
              }
            }
            return null;
          };

          dataRows.forEach((row, index) => {
              const rowNum = index + 2; // Spreadsheet row number
              try {
                const getValue = (key: keyof typeof colMap) => {
                  const colIndex = colMap[key];
                  return colIndex !== -1 ? String(row[colIndex] || '').trim() : '';
                }

                const name = getValue('name');
                const cpf = cleanNumeric(getValue('cpf'));
                const cnh = cleanNumeric(getValue('cnh'));
                const classificationStr = getValue('classification');
                let classification = standardizeClassification(classificationStr);

                if (!name || !cpf || !cnh) {
                   const isRowBlank = row.every(cell => String(cell || '').trim() === '');
                  if (isRowBlank) {
                    return; // Silently skip blank lines
                  }
                  throw new Error(`Nome, CPF e CNH são obrigatórios.`);
                }

                if (!classification) {
                  classification = DriverClassification.Terceiro;
                }

                const ownerId = getValue('ownerId');
                if (classification !== DriverClassification.Terceiro && (!ownerId || !owners.some(o => o.id === ownerId))) {
                  throw new Error(`Para a classificação "${classification}", um ID de Proprietário válido é obrigatório. ID fornecido: "${ownerId}".`);
                }

                validDrivers.push({
                  name,
                  cpf,
                  cnh,
                  phone: cleanNumeric(getValue('phone')),
                  classification: classification,
                  ownerId: classification === DriverClassification.Terceiro ? undefined : ownerId,
                  active: true,
                });

              } catch (error: any) {
                  importErrors.push({ row: rowNum, message: error.message });
              }
          });
          
          let summaryMessage = '';
          if (validDrivers.length > 0) {
            validDrivers.forEach(onSaveDriver);
            summaryMessage += `${validDrivers.length} motorista(s) importado(s) com sucesso!`;
          }

          if (importErrors.length > 0) {
            summaryMessage += `\n\n${importErrors.length} linha(s) com erros não foram importadas:\n`;
            const maxErrorsToShow = 15;
            const errorsToShow = importErrors.slice(0, maxErrorsToShow);
            summaryMessage += errorsToShow.map(err => `- Linha ${err.row}: ${err.message}`).join('\n');
            if (importErrors.length > maxErrorsToShow) {
                summaryMessage += `\n... e mais ${importErrors.length - maxErrorsToShow} erro(s).`;
            }
          }
          
          if (!summaryMessage) {
            summaryMessage = 'Nenhum dado de motorista válido foi encontrado no arquivo para importar.';
          }

          alert(summaryMessage);
        };

        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.csv')) {
          const text = e.target?.result as string;
          // Handle potential BOM character
          const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
          const allRows = cleanText.split('\n').filter(line => line.trim() !== '').map(line => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)); // Improved CSV split
          processData(allRows);
        } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          processData(allRows);
        }
      } catch (error: any) {
        alert(`Erro ao processar o arquivo: ${error.message}`);
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    
    reader.onerror = () => {
        alert('Ocorreu um erro ao ler o arquivo.');
        if (event.target) event.target.value = '';
    };

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.csv')) {
        reader.readAsText(file);
    } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
        reader.readAsArrayBuffer(file);
    } else {
        alert('Formato de arquivo não suportado. Por favor, use um arquivo .csv, .xls ou .xlsx');
        if (event.target) event.target.value = '';
    }
  };

  return (
    <>
      <Header title="Cadastro de Motoristas">
        {canCreate && (
            <>
                <button onClick={handleImportClick} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Importar</button>
                <button onClick={handleExport} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Exportar</button>
                <button onClick={handleOpenModal} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">Adicionar Motorista</button>
            </>
        )}
      </Header>
      
      <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".csv,.xls,.xlsx"/>

      <div style={{ zoom: 0.8 }}>
        <DriverFilter 
          owners={owners} 
          filters={filters} 
          onFilterChange={setFilters} 
        />

        <DriverTable 
          drivers={paginatedDrivers} 
          owners={owners} 
          onEdit={canUpdate ? handleEditDriver : undefined} 
          onDelete={canDelete ? handleDeleteDriver : undefined} 
          onShowHistory={handleShowHistory}
        />

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredDrivers.length}
            itemsPerPage={itemsPerPage}
          />
        )}
      </div>

      <DriverFormModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSave={handleSaveDriver} 
        driverToEdit={driverToEdit} 
        owners={owners} 
        onShowHistory={handleShowHistory}
      />

      <ShipmentHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        shipments={driverShipmentHistory}
        cargos={cargos}
        title={`Histórico de Embarques - ${selectedDriverForHistory?.name}`}
      />
    </>
  );
};

export default DriversPage;
