# Manual de Usuario: Módulo de Pacientes

## 1. Introducción

El módulo de Pacientes es una herramienta integral para la gestión de la información de los pacientes del laboratorio. Permite al personal autorizado registrar, consultar, actualizar y eliminar los datos de los pacientes de manera eficiente y segura.

## 2. Vista Principal de Pacientes

Al acceder al módulo de Pacientes, se presenta una lista completa de todos los pacientes registrados en el sistema.


### Funcionalidades Clave:

- **Barra de Búsqueda:** Ubicada en la parte superior, permite buscar pacientes por `nombre completo`, `email` o `número de teléfono`. La búsqueda se realiza automáticamente a medida que escribe.
- **Botón "Nuevo Paciente":** Inicia el proceso para registrar un nuevo paciente en el sistema.
- **Botón de Ayuda (icono de interrogación):** Muestra una ventana con información útil y consejos sobre cómo utilizar el módulo.
- **Paginación:** En la parte inferior de la lista, puede navegar a través de las diferentes páginas de pacientes si el número total excede el límite por página.

### Vista de Tabla (Escritorio)

En dispositivos de escritorio, los pacientes se muestran en una tabla con las siguientes columnas:
- **Nombre Completo**
- **Email**
- **Teléfono**
- **Edad**
- **Sexo**
- **Acciones:** Botones para `Editar`, `Eliminar` y `Ver Historial`.

### Vista de Tarjetas (Móvil)

En dispositivos móviles, la vista se adapta para mostrar cada paciente en una "tarjeta" individual, optimizando el espacio y la legibilidad. Cada tarjeta contiene la misma información y acciones que la fila de la tabla.

## 3. Registrar un Nuevo Paciente

1.  Haga clic en el botón **"Nuevo Paciente"**.
2.  Se abrirá un formulario emergente con los siguientes campos para completar:
    -   `Nombre(s)`
    -   `Apellido Paterno`
    -   `Apellido Materno`
    -   `Fecha de Nacimiento`
    -   `Sexo` (Masculino, Femenino, Otro)
    -   `Email`
    -   `Teléfono`
    -   `Dirección` (Opcional)
    -   `Nombre del Contacto de Emergencia` (Opcional)
    -   `Teléfono del Contacto de Emergencia` (Opcional)

    **Importancia del Contacto de Emergencia:**
    > Registrar un contacto de emergencia es crucial para garantizar la seguridad del paciente. En caso de que se presente una situación inesperada o se obtenga un resultado crítico en sus análisis, el laboratorio podrá comunicarse de manera inmediata con una persona de confianza. Esto es especialmente importante si el paciente es menor de edad, ya que el contacto registrado suele ser el padre, madre o tutor legal.

3.  Una vez completados los datos, tiene dos opciones para guardar:
    -   **Guardar:** Guarda la información del paciente y cierra el formulario.
    -   **Guardar y Crear Orden:** Guarda al paciente y redirige automáticamente al módulo de Órdenes para crear una nueva orden asociada a este paciente.
4.  Si el registro es exitoso, se mostrará una notificación de confirmación.

## 4. Editar un Paciente Existente

1.  Localice al paciente que desea editar en la lista.
2.  En la columna de "Acciones" (o en la tarjeta del paciente en la vista móvil), haga clic en el icono de **Editar** (lápiz).
3.  Se abrirá el mismo formulario que para un nuevo paciente, pero pre-cargado con la información existente.
4.  Modifique los campos necesarios.
5.  Haga clic en **"Guardar"** o **"Guardar y Crear Orden"** para aplicar los cambios.

## 5. Eliminar un Paciente

**¡Atención!** Esta acción es permanente y no se puede deshacer.

1.  Localice al paciente que desea eliminar.
2.  Haga clic en el icono de **Eliminar** (bote de basura) en la fila o tarjeta del paciente.
3.  Aparecerá un cuadro de diálogo de confirmación para prevenir eliminaciones accidentales.
4.  Haga clic en **"Confirmar"** para eliminar permanentemente al paciente del sistema.

## 6. Ver Historial del Paciente

Esta función permite consultar el historial de estudios y visitas del paciente.

1.  Localice al paciente en la lista.
2.  Haga clic en el icono de **Ver Historial** (reloj).
3.  Será redirigido a una página dedicada que muestra el historial completo de órdenes y resultados del paciente.
