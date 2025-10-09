import { describe, test, expect } from 'vitest';

/*
  Objetivo de esta batería:
  Seguir de forma granular el ciclo de vida del botón "Parámetro IA" dentro de StudyForm:
    1. Estado inicial (texto, atributos, habilitado)
    2. Transición al estado de carga (cambia texto a "Generando...", aria-busy, disabled)
    3. Abertura del diálogo avanzado (título presente)
    4. Restablecimiento automático del botón tras timeout de 1200 ms (regresa a texto original y se habilita)
    5. Evitar clicks duplicados mientras está en modo loading
    6. Escenario de error: si onAIAddParameter lanza excepción, el estado se restablece.

  NOTA: El flujo de generación del parámetro IA (sugerir nombre, aceptar y sincronizar) ya se valida en
  AIAssistParameterDialog.integration.test.jsx. Aquí nos enfocamos en la UX del botón y su máquina de estados.
*/

// Wrapper reutilizando StudiesModalsHost (integra StudyForm y los diálogos)

// El flujo de botón "Parámetro IA" fue eliminado/oculto en la UI actual (StudiesModalsHost marca
// "// Eliminado flujo de parámetro IA"). Este archivo se mantiene como placeholder documentando
// la antigua máquina de estados. Los tests se desactivan para evitar falsos rojos.
describe('Botón "Parámetro IA" - comportamiento detallado (desactivado)', () => {
  test('placeholder', () => {
    expect(true).toBe(true);
  });
});
