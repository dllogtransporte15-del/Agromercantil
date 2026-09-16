import React, { useState } from 'react';
import Header from '../components/Header';
import type { Product, User, ProfilePermissions } from '../types';
import { ProductUnit } from '../types';
import { can } from '../auth';

interface ProductsPageProps {
  products: Product[];
  onSaveProduct: (product: Product | Omit<Product, 'id'>) => void;
  onDeleteProduct: (productId: string) => void;
  currentUser: User;
  profilePermissions: ProfilePermissions;
}

const UNIT_LABELS: Record<ProductUnit, string> = {
  [ProductUnit.Tonelada]: 'Tonelada (ton)',
  [ProductUnit.MetroCubico]: 'Metro Cúbico (m³)',
  [ProductUnit.Sacas]: 'Sacas (sc)',
};

const ProductFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product | Omit<Product, 'id'>) => void;
  productToEdit: Product | null;
}> = ({ isOpen, onClose, onSave, productToEdit }) => {
  const [name, setName] = useState(productToEdit?.name || '');
  const [unit, setUnit] = useState<ProductUnit>(productToEdit?.unit || ProductUnit.Tonelada);
  const [requiresRiskManagement, setRequiresRiskManagement] = useState<boolean>(
    productToEdit?.requiresRiskManagement !== false
  );

  React.useEffect(() => {
    if (isOpen) {
      setName(productToEdit?.name || '');
      setUnit(productToEdit?.unit || ProductUnit.Tonelada);
      setRequiresRiskManagement(productToEdit?.requiresRiskManagement !== false);
    }
  }, [isOpen, productToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('O nome do produto é obrigatório.');
      return;
    }
    if (productToEdit) {
      onSave({ ...productToEdit, name: name.trim(), unit, requiresRiskManagement });
    } else {
      onSave({ name: name.trim(), unit, requiresRiskManagement });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            {productToEdit ? 'Editar Produto' : 'Novo Produto'}
            {productToEdit && (
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
                ID: {productToEdit.id}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome do Produto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Soja, Milho, Açúcar..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unidade de Medida <span className="text-red-500">*</span>
            </label>
            <select
              value={unit}
              onChange={e => setUnit(e.target.value as ProductUnit)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.values(ProductUnit).map(u => (
                <option key={u} value={u}>{UNIT_LABELS[u]}</option>
              ))}
            </select>
          </div>

          {/* Toggle: Necessita Gerenciamento de Risco */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Necessita de Gerenciamento de Risco?
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {requiresRiskManagement
                    ? 'Exige código de liberação e tipo de consulta (fluxo completo).'
                    : 'Liberação simplificada — apenas documento de liberação obrigatório.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequiresRiskManagement(prev => !prev)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  requiresRiskManagement ? 'bg-orange-500' : 'bg-emerald-500'
                }`}
                aria-pressed={requiresRiskManagement}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    requiresRiskManagement ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                requiresRiskManagement
                  ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700'
                  : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-600 dark:border-gray-700'
              }`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Exige GR (Sim)
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                !requiresRiskManagement
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700'
                  : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-600 dark:border-gray-700'
              }`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Simplificado (Não)
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {productToEdit ? 'Salvar Alterações' : 'Adicionar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProductsPage: React.FC<ProductsPageProps> = ({
  products,
  onSaveProduct,
  onDeleteProduct,
  currentUser,
  profilePermissions,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const canCreate = can('create', currentUser, 'products', profilePermissions);
  const canUpdate = can('update', currentUser, 'products', profilePermissions);
  const canDelete = can('delete', currentUser, 'products', profilePermissions);

  const handleOpenModal = () => {
    setProductToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setProductToEdit(product);
    setIsModalOpen(true);
  };

  const handleDelete = (productId: string, productName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o produto "${productName}"?`)) {
      onDeleteProduct(productId);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Header title="Cadastro de Produtos">
        {canCreate && (
          <button
            onClick={handleOpenModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-medium transition-colors"
          >
            + Novo Produto
          </button>
        )}
      </Header>

      {/* Search */}
      <div className="my-4">
        <input
          type="text"
          placeholder="Buscar produto por nome ou ID..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-lg font-medium">Nenhum produto encontrado</p>
            {canCreate && (
              <button
                onClick={handleOpenModal}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Cadastrar primeiro produto
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">ID</th>
                <th className="px-6 py-3 text-left">Nome do Produto</th>
                <th className="px-6 py-3 text-left">Unidade</th>
                <th className="px-6 py-3 text-left">Ger. de Risco</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {product.id}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {product.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                      {UNIT_LABELS[product.unit] || product.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {product.requiresRiskManagement !== false ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        Exige GR
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Simplificado
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canUpdate && (
                        <button
                          onClick={() => handleEdit(product)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        >
                          Editar
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onSaveProduct}
        productToEdit={productToEdit}
      />
    </>
  );
};

export default ProductsPage;
