import React from 'react';

/**
 * ErrorBoundary genérico para capturar errores de renderizado/desmontaje.
 * Añade metadata de diálogos abiertos si se provee via props.
 */
export class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error){
    return { hasError: true, error };
  }
  componentDidCatch(error, info){
    // Log extendido en consola para correlacionar con NotFoundError
    if (typeof window !== 'undefined') {
      console.groupCollapsed('[ErrorBoundary] UI crash capturado');
      console.error(error);
      console.log('ComponentStack:', info?.componentStack);
      if (this.props.dialogStates) {
        console.log('DialogStates snapshot:', this.props.dialogStates);
      }
      console.groupEnd();
    }
    this.setState({ info });
  }
  render(){
    if (this.state.hasError){
      const Fallback = this.props.fallback;
      if (Fallback) return <Fallback error={this.state.error} info={this.state.info} />;
      return (
        <div className="p-4 border border-red-500 bg-red-50 text-red-800 rounded-md text-sm space-y-2">
          <p className="font-semibold">Ha ocurrido un error inesperado en la interfaz.</p>
          <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-40">{String(this.state.error)}</pre>
          <button
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={() => this.setState({ hasError: false, error: null, info: null })}
          >Reintentar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;