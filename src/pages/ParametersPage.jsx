import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';

const ParametersPage = () => {
  const [parameters, setParameters] = useState([]);

  const fetchParameters = async () => {
    try {
      const data = await apiClient.get('/parameters');
      setParameters(data || []);
    } catch (err) {
      console.error('Error al cargar parámetros:', err);
    }
  };

  const handleAddParameter = async (newParameter) => {
    try {
      const created = await apiClient.post('/parameters', newParameter);
      setParameters([...parameters, created]);
    } catch (err) {
      console.error('Error al agregar parámetro:', err);
    }
  };

  const handleUpdateParameter = async (index, updatedParameter) => {
    const parameterId = parameters[index].id;
    try {
      const updated = await apiClient.put(`/parameters/${parameterId}`, updatedParameter);
      const updatedParameters = [...parameters];
      updatedParameters[index] = updated;
      setParameters(updatedParameters);
    } catch (err) {
      console.error('Error al actualizar parámetro:', err);
    }
  };

  const handleDeleteParameter = async (index) => {
    const parameterId = parameters[index].id;
    try {
      await apiClient.delete(`/parameters/${parameterId}`);
      setParameters(parameters.filter((_, i) => i !== index));
    } catch (err) {
      console.error('Error al eliminar parámetro:', err);
    }
  };

  useEffect(() => {
    fetchParameters();
  }, []);

  const [isEditing, setIsEditing] = useState(null);
  const [currentParameter, setCurrentParameter] = useState({ name: '', value: '' });

  const handleEdit = (parameter) => {
    setIsEditing(parameter.id);
    setCurrentParameter({ name: parameter.name, value: parameter.value });
  };

  const handleSave = (index) => {
    handleUpdateParameter(index, currentParameter);
    setIsEditing(null);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Parámetros</h1>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Nombre del parámetro"
          value={currentParameter.name}
          onChange={(e) => setCurrentParameter({ ...currentParameter, name: e.target.value })}
          className="border p-2 mr-2"
        />
        <input
          type="text"
          placeholder="Valor del parámetro"
          value={currentParameter.value}
          onChange={(e) => setCurrentParameter({ ...currentParameter, value: e.target.value })}
          className="border p-2 mr-2"
        />
        <button onClick={() => handleAddParameter(currentParameter)} className="bg-blue-500 text-white p-2">
          Agregar Parámetro
        </button>
      </div>
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="py-2">Nombre</th>
            <th className="py-2">Valor</th>
            <th className="py-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((parameter, index) => (
            <tr key={parameter.id}>
              <td className="border px-4 py-2">
                {isEditing === parameter.id ? (
                  <input
                    type="text"
                    value={currentParameter.name}
                    onChange={(e) => setCurrentParameter({ ...currentParameter, name: e.target.value })}
                    className="border p-1"
                  />
                ) : (
                  parameter.name
                )}
              </td>
              <td className="border px-4 py-2">
                {isEditing === parameter.id ? (
                  <input
                    type="text"
                    value={currentParameter.value}
                    onChange={(e) => setCurrentParameter({ ...currentParameter, value: e.target.value })}
                    className="border p-1"
                  />
                ) : (
                  parameter.value
                )}
              </td>
              <td className="border px-4 py-2">
                {isEditing === parameter.id ? (
                  <button onClick={() => handleSave(index)} className="bg-green-500 text-white p-1">
                    Guardar
                  </button>
                ) : (
                  <button onClick={() => handleEdit(parameter)} className="bg-yellow-500 text-white p-1 mr-2">
                    Editar
                  </button>
                )}
                <button onClick={() => handleDeleteParameter(index)} className="bg-red-500 text-white p-1">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ParametersPage;
