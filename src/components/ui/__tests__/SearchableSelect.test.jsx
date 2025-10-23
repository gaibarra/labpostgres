import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import SearchableSelect from '../SearchableSelect';

describe('SearchableSelect', () => {
  afterEach(() => cleanup());
  const options = [
    { value: 1, label: 'Uno' },
    { value: 2, label: 'Dos' },
  ];

  it('muestra el label del valor seleccionado aunque value sea string y option sea number', () => {
    render(<SearchableSelect options={options} value={"1"} onValueChange={() => {}} />);
    // El botón de trigger debe mostrar "Uno"
    expect(screen.getByRole('combobox')).toHaveTextContent('Uno');
  });

  it('permite seleccionar una opción por etiqueta', () => {
    const onValueChange = vi.fn();
    render(<SearchableSelect options={options} value={null} onValueChange={onValueChange} />);
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Dos'));
    expect(onValueChange).toHaveBeenCalledWith(2);
  });
});
