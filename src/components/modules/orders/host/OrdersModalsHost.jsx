import React from 'react';
import PropTypes from 'prop-types';

/**
 * OrdersModalsHost
 * Contenedor único para alojar todos los modales relacionados con órdenes.
 * La idea es montar este host una sola vez (por ejemplo en App o en una sección
 * de Orders) y pasarle el hook `useOrderModals` ya inicializado.
 * Esto centraliza la jerarquía de portales de Radix y reduce el churn de nodos.
 */
export const OrdersModalsHost = ({ modalComponent }) => {
  return (
    <div data-orders-modals-host>
      {modalComponent}
    </div>
  );
};

OrdersModalsHost.propTypes = {
  modalComponent: PropTypes.node,
};

export default OrdersModalsHost;
