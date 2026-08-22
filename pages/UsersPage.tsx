
import React, { useState } from 'react';
import Header from '../components/Header';
import UserTable from '../components/UserTable';
import UserFormModal from '../components/UserFormModal';
import PermissionsModal from '../components/PermissionsModal';
import type { User, ProfilePermissions, Client, Branch } from '../types';
import { UserProfile } from '../types';
import { can } from '../auth';

interface UsersPageProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onSaveUser: (userData: User | Omit<User, 'id'>) => void;
  currentUser: User;
  profilePermissions: ProfilePermissions;
  onSavePermissions: (permissions: ProfilePermissions) => void;
  clients: Client[];
  onDeleteUser: (userId: string) => void;
  branches: Branch[];
}

const UsersPage: React.FC<UsersPageProps> = ({ users, setUsers, onSaveUser, currentUser, profilePermissions, onSavePermissions, clients, onDeleteUser, branches }) => {
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  const canCreateUser = can('create', currentUser, 'users-register', profilePermissions);
  const canUpdateUser = can('update', currentUser, 'users-register', profilePermissions);
  const canDeleteUser = can('delete', currentUser, 'users-register', profilePermissions);

  const handleOpenUserModal = () => {
    setUserToEdit(null);
    setIsUserModalOpen(true);
  };
  const handleCloseUserModal = () => setIsUserModalOpen(false);
  const handleEditUser = (user: User) => {
    setUserToEdit(user);
    setIsUserModalOpen(true);
  };
  const handleDeleteUser = (userId: string) => {
    onDeleteUser(userId);
  };
  const handleSaveUser = (user: User | Omit<User, 'id'>) => {
    onSaveUser(user);
    handleCloseUserModal();
  };

  return (
    <>
      <Header title="Gestão de Acessos & Usuários">
          {canUpdateUser && (
              <button
                  onClick={() => setIsPermissionsModalOpen(true)}
                  className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 font-medium"
              >
                  Matriz de Permissões
              </button>
          )}
          {canCreateUser && (
              <button
                  onClick={handleOpenUserModal}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary font-medium"
              >
                  Cadastrar Usuário
              </button>
          )}
      </Header>

      <UserTable 
        users={users} 
        onEdit={canUpdateUser ? handleEditUser : undefined} 
        onDelete={canDeleteUser ? handleDeleteUser : undefined} 
      />

      <UserFormModal
        isOpen={isUserModalOpen}
        onClose={handleCloseUserModal}
        onSave={handleSaveUser}
        userToEdit={userToEdit}
        clients={clients}
        branches={branches}
      />
      
      <PermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        onSave={onSavePermissions}
        permissions={profilePermissions}
      />
    </>
  );
};

export default UsersPage;