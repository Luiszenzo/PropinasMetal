// Función para inicializar la aplicación
async function initApp() {
    try {
        // Verifica conexión con Firestore
        const propinasRef = db.collection('propinas');
        const snapshot = await propinasRef.limit(1).get();
        
        console.log('Conexión a Firestore establecida correctamente');
        
        // Aquí puedes continuar con el resto de tu aplicación
        // Por ahora solo mostramos un mensaje en la consola
        
    } catch (error) {
        console.error('Error al conectar con Firestore:', error);
    }
}

// Función para mostrar tickets
async function displayTickets() {
    try {
        const ticketsList = document.querySelector('.tickets-list');
        ticketsList.innerHTML = '';
        
        const snapshot = await db.collection('tickets').orderBy('fecha', 'desc').get();
        
        if (snapshot.empty) {
            ticketsList.innerHTML = '<p>No hay tickets registrados</p>';
            return;
        }

        const resumenPropinas = {};
        let currentDate = null;
        
        snapshot.forEach(doc => {
            const ticket = doc.data();
            const ticketDate = ticket.fecha;
            
            // Add date header if it's a new day
            if (ticketDate !== currentDate) {
                currentDate = ticketDate;
                const dateHeader = document.createElement('div');
                dateHeader.className = 'date-header';
                dateHeader.innerHTML = `<h3>${formatDate(ticketDate)}</h3>`;
                ticketsList.appendChild(dateHeader);
            }

            const ticketElement = document.createElement('div');
            ticketElement.className = 'ticket-item';
            
            // Calculate amount per employee
            const numEmpleados = ticket.empleados ? ticket.empleados.length : 0;
            const montoPorEmpleado = numEmpleados > 0 ? (ticket.monto / numEmpleados).toFixed(2) : 0;
            
            ticketElement.innerHTML = `
                <div class="ticket-info">
                    <span>Monto total: $${ticket.monto || '0'}</span>
                    <span>Empleados: ${numEmpleados}</span>
                    <span>Monto por empleado: $${montoPorEmpleado}</span>
                    <span>Creado por: ${ticket.creadoPor || 'Sistema'}</span>
                </div>
                <div class="ticket-empleados">
                    ${ticket.empleados ? ticket.empleados.join(', ') : 'No especificados'}
                </div>
                <div class="ticket-actions">
                    <button class="btn-delete" data-id="${doc.id}">Eliminar</button>
                </div>
            `;
            ticketsList.appendChild(ticketElement);

            // Add event listener for the delete button
            const deleteBtn = ticketElement.querySelector('.btn-delete');
            deleteBtn.addEventListener('click', deleteTicket);

            // Calcular propinas por empleado
            if (ticket.empleados && ticket.empleados.length > 0 && ticket.monto) {
                const propinaPorEmpleado = ticket.monto / ticket.empleados.length;
                ticket.empleados.forEach(empleado => {
                    resumenPropinas[empleado] = (resumenPropinas[empleado] || 0) + propinaPorEmpleado;
                });
            }
        });

        // Mostrar resumen de propinas
        mostrarResumenPropinas(resumenPropinas);
        
    } catch (error) {
        console.error('Error al obtener tickets:', error);
        const ticketsList = document.querySelector('.tickets-list');
        ticketsList.innerHTML = '<p class="error">Error al cargar tickets</p>';
    }
}

// Add this helper function
function formatDate(dateString) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', options);
}

// Función para mostrar el resumen de propinas
function mostrarResumenPropinas(resumen) {
    const appElement = document.getElementById('app');
    
    // Verificar si ya existe el contenedor de resumen
    let resumenContainer = document.querySelector('.resumen-container');
    if (!resumenContainer) {
        resumenContainer = document.createElement('div');
        resumenContainer.className = 'resumen-container';
        appElement.appendChild(resumenContainer);
    }

    resumenContainer.innerHTML = `
        <h3 class="resumen-title">Resumen de Propinas</h3>
        <table class="resumen-table">
            <thead>
                <tr>
                    <th>Empleado</th>
                    <th>Propina Acumulada</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(resumen).map(([empleado, monto]) => `
                    <tr>
                        <td>${empleado}</td>
                        <td>$${monto.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Función para crear un nuevo ticket
async function createTicket() {
    try {
        const fecha = new Date().toISOString().split('T')[0];
        const monto = parseFloat(prompt('Ingrese el monto del ticket:'));
        const empleados = prompt('Ingrese los empleados que participaron (separados por comas):');
        
        if (isNaN(monto) || monto <= 0) {
            alert('Por favor ingrese un monto válido');
            return;
        }

        await db.collection('tickets').add({
            fecha: fecha,
            monto: monto,
            empleados: empleados.split(',').map(e => e.trim()),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('Ticket creado exitosamente!');
        await displayTickets(); // Refrescar la lista
        
    } catch (error) {
        console.error('Error al crear ticket:', error);
        alert('Error al crear el ticket: ' + error.message);
    }
}

// Modifica initApp para agregar el botón
// Lista de empleados disponibles (puedes obtenerla de Firestore si prefieres)
const empleados = ['Juan', 'Kike', 'Sofi', 'Toño', 'Pedro', "Cami", "Rodrigo", "Martha", "Ivet", "Lulu"];

// Referencias a elementos del DOM
let modal;
let empleadosList;
let selectedEmpleados = [];

// Modificar initApp para inicializar el modal
async function initApp() {
    // Always show login first
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('app').style.display = 'none';
    setupLogin();
    
    if (!currentUser) return;
    
    try {
        console.log('Conexión a Firestore establecida correctamente');
        
        // Initialize main app structure
        const appElement = document.getElementById('app');
        appElement.innerHTML = `
            <div class="tickets-header">
                <h2>Tickets Registrados</h2>
                <button id="addTicket" class="btn-add">+ Nuevo Ticket</button>
            </div>
            <div class="date-filter">
                <label for="filterDate">Filtrar por fecha:</label>
                <input type="date" id="filterDate">
                <button id="applyFilter">Aplicar</button>
                <button id="clearFilter">Mostrar todos</button>
            </div>
            <div class="tickets-list"></div>
            <div class="resumen-container"></div>
            <div class="report-buttons">
                <button id="dailyReport" class="report-btn">Reporte Diario</button>
                <button id="weeklyReport" class="report-btn">Reporte Semanal</button>
                <button id="monthlyReport" class="report-btn">Reporte Mensual</button>
            </div>
        `;

        // Show user info
        const userInfo = document.createElement('div');
        userInfo.id = 'user-info';
        userInfo.textContent = `Usuario: ${currentUser}`;
        appElement.insertBefore(userInfo, appElement.firstChild);

        // Configurar eventos del filtro
        document.getElementById('applyFilter').addEventListener('click', applyDateFilter);
        document.getElementById('clearFilter').addEventListener('click', clearDateFilter);

        // Inicializar elementos del modal
        modal = document.getElementById('ticketModal');
        empleadosList = document.getElementById('empleadosList');
        
        // Crear botones de empleados
        empleados.forEach(empleado => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'empleado-btn';
            btn.textContent = empleado;
            btn.addEventListener('click', () => toggleEmpleado(empleado, btn));
            empleadosList.appendChild(btn);
        });

        // Configurar eventos del modal
        document.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('addTicket').addEventListener('click', () => {
            selectedEmpleados = [];
            resetEmpleadosButtons();
            document.getElementById('ticketForm').reset();
            modal.style.display = 'block';
        });

        document.getElementById('ticketForm').addEventListener('submit', handleSubmit);

        // Configurar eventos para los reportes
        document.getElementById('dailyReport').addEventListener('click', () => generateReport('daily'));
        document.getElementById('weeklyReport').addEventListener('click', () => generateReport('weekly'));
        document.getElementById('monthlyReport').addEventListener('click', () => generateReport('monthly'));

        await displayTickets();
        
    } catch (error) {
        console.error('Error al conectar con Firestore:', error);
    }
}

// Función para alternar selección de empleados
function toggleEmpleado(empleado, btn) {
    const index = selectedEmpleados.indexOf(empleado);
    if (index === -1) {
        selectedEmpleados.push(empleado);
        btn.classList.add('selected');
    } else {
        selectedEmpleados.splice(index, 1);
        btn.classList.remove('selected');
    }
}

// Función para resetear botones de empleados
function resetEmpleadosButtons() {
    const buttons = empleadosList.querySelectorAll('.empleado-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
}

// Función para manejar el envío del formulario
// Add at the beginning of the file
const HARDCODED_USERS = {
    'cami': '8989',
    'sofi': 'Juanito123',
    'toño': '12345'
};

let currentUser = null;

// Add login function
// Remove the localStorage check from setupLogin
function setupLogin() {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (HARDCODED_USERS[username] && HARDCODED_USERS[username] === password) {
            currentUser = username;
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            document.getElementById('user-info').textContent = `Usuario: ${username}`;
            initApp();
        } else {
            alert('Usuario o contraseña incorrectos');
        }
    });
}

// Modify ticket creation to include user
async function handleSubmit(e) {
    e.preventDefault();
    try {
        const fecha = document.getElementById('fecha').value;
        const monto = parseFloat(document.getElementById('monto').value);

        if (!fecha || isNaN(monto) || monto <= 0 || selectedEmpleados.length === 0) {
            alert('Por favor complete todos los campos correctamente');
            return;
        }

        await db.collection('tickets').add({
            fecha: fecha,
            monto: monto,
            empleados: selectedEmpleados,
            creadoPor: currentUser,  // Add creator username
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        modal.style.display = 'none';
        alert('Ticket creado exitosamente!');
        await displayTickets();
        
    } catch (error) {
        console.error('Error al crear ticket:', error);
        alert('Error al crear el ticket: ' + error.message);
    }
}

// Update initApp to check login
async function initApp() {
    if (!currentUser) {
        document.getElementById('login-container').style.display = 'block';
        document.getElementById('app').style.display = 'none';
        setupLogin();
        return;
    }
    try {
        console.log('Conexión a Firestore establecida correctamente');
        
        // Initialize main app structure
        const appElement = document.getElementById('app');
        appElement.innerHTML = `
            <div class="tickets-header">
                <h2>Tickets Registrados</h2>
                <button id="addTicket" class="btn-add">+ Nuevo Ticket</button>
            </div>
            <div class="date-filter">
                <label for="filterDate">Filtrar por fecha:</label>
                <input type="date" id="filterDate">
                <button id="applyFilter">Aplicar</button>
                <button id="clearFilter">Mostrar todos</button>
            </div>
            <div class="tickets-list"></div>
            <div class="resumen-container"></div>
            <div class="report-buttons">
                <button id="dailyReport" class="report-btn">Reporte Diario</button>
                <button id="weeklyReport" class="report-btn">Reporte Semanal</button>
                <button id="monthlyReport" class="report-btn">Reporte Mensual</button>
            </div>
        `;

        // Show user info
        const userInfo = document.createElement('div');
        userInfo.id = 'user-info';
        userInfo.textContent = `Usuario: ${currentUser}`;
        appElement.insertBefore(userInfo, appElement.firstChild);

        // Configurar eventos del filtro
        document.getElementById('applyFilter').addEventListener('click', applyDateFilter);
        document.getElementById('clearFilter').addEventListener('click', clearDateFilter);

        // Inicializar elementos del modal
        modal = document.getElementById('ticketModal');
        empleadosList = document.getElementById('empleadosList');
        
        // Crear botones de empleados
        empleados.forEach(empleado => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'empleado-btn';
            btn.textContent = empleado;
            btn.addEventListener('click', () => toggleEmpleado(empleado, btn));
            empleadosList.appendChild(btn);
        });

        // Configurar eventos del modal
        document.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('addTicket').addEventListener('click', () => {
            selectedEmpleados = [];
            resetEmpleadosButtons();
            document.getElementById('ticketForm').reset();
            modal.style.display = 'block';
        });

        document.getElementById('ticketForm').addEventListener('submit', handleSubmit);

        // Configurar eventos para los reportes
        document.getElementById('dailyReport').addEventListener('click', () => generateReport('daily'));
        document.getElementById('weeklyReport').addEventListener('click', () => generateReport('weekly'));
        document.getElementById('monthlyReport').addEventListener('click', () => generateReport('monthly'));

        await displayTickets();
        
    } catch (error) {
        console.error('Error al conectar con Firestore:', error);
    }
}

// Call setupLogin when DOM is ready
document.addEventListener('DOMContentLoaded', setupLogin);


// Función para aplicar filtro por fecha
async function applyDateFilter() {
    const selectedDate = document.getElementById('filterDate').value;
    if (!selectedDate) {
        alert('Por favor seleccione una fecha');
        return;
    }

    try {
        const ticketsRef = db.collection('tickets');
        const snapshot = await ticketsRef.where('fecha', '==', selectedDate).get();
        
        const ticketsList = document.querySelector('.tickets-list');
        ticketsList.innerHTML = '';
        
        if (snapshot.empty) {
            ticketsList.innerHTML = '<p>No hay tickets para esta fecha</p>';
            mostrarResumenPropinas({}); // Limpiar resumen
            return;
        }

        const resumenPropinas = {};
        
        snapshot.forEach(doc => {
            const ticket = doc.data();
            const ticketElement = document.createElement('div');
            ticketElement.className = 'ticket-item';
            ticketElement.innerHTML = `
                <div class="ticket-info">
                    <span>Fecha: ${ticket.fecha || 'Sin fecha'}</span>
                    <span>Monto: $${ticket.monto || '0'}</span>
                </div>
                <div class="ticket-empleados">
                    Empleados: ${ticket.empleados ? ticket.empleados.join(', ') : 'No especificados'}
                </div>
            `;
            ticketsList.appendChild(ticketElement);

            // Calcular propinas por empleado
            if (ticket.empleados && ticket.empleados.length > 0 && ticket.monto) {
                const propinaPorEmpleado = ticket.monto / ticket.empleados.length;
                ticket.empleados.forEach(empleado => {
                    resumenPropinas[empleado] = (resumenPropinas[empleado] || 0) + propinaPorEmpleado;
                });
            }
        });

        mostrarResumenPropinas(resumenPropinas);
        
    } catch (error) {
        console.error('Error al filtrar tickets:', error);
        document.querySelector('.tickets-list').innerHTML = '<p class="error">Error al filtrar tickets</p>';
    }
}

// Función para limpiar el filtro
async function clearDateFilter() {
    document.getElementById('filterDate').value = '';
    await displayTickets(); // Mostrar todos los tickets nuevamente
}


// Función para generar reportes
async function generateReport(type) {
    try {
        // Crear modal para selección de fechas
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.zIndex = '1000';
        modal.style.left = '0';
        modal.style.top = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.4)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';

        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = '#fefefe';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '8px';
        modalContent.style.width = '80%';
        modalContent.style.maxWidth = '500px';

        let dateInputs = '';
        
        if (type === 'daily') {
            dateInputs = `
                <div class="report-date-selector">
                    <label>Seleccione el día:</label>
                    <input type="date" id="reportDate">
                </div>
            `;
        } else if (type === 'weekly') {
            dateInputs = `
                <div class="report-date-selector">
                    <label>Seleccione la semana:</label>
                    <input type="week" id="reportWeek">
                </div>
            `;
        } else if (type === 'monthly') {
            dateInputs = `
                <div class="report-date-selector">
                    <label>Seleccione el mes:</label>
                    <input type="month" id="reportMonth">
                </div>
            `;
        }

        modalContent.innerHTML = `
            <h2>Generar Reporte ${type === 'daily' ? 'Diario' : type === 'weekly' ? 'Semanal' : 'Mensual'}</h2>
            ${dateInputs}
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="generateReportBtn" style="padding: 8px 15px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Generar</button>
                <button id="cancelReportBtn" style="padding: 8px 15px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Esperar a que el usuario seleccione las fechas
        return new Promise((resolve) => {
            document.getElementById('generateReportBtn').addEventListener('click', async () => {
                let startDate, endDate, title;

                if (type === 'daily') {
                    const dateValue = document.getElementById('reportDate').value;
                    if (!dateValue) {
                        alert('Por favor seleccione una fecha');
                        return;
                    }
                    startDate = dateValue;
                    endDate = dateValue;
                    title = `Reporte Diario - ${startDate}`;
                    
                    // Obtener tickets del día
                    const ticketsRef = db.collection('tickets');
                    const snapshot = await ticketsRef
                        .where('fecha', '==', startDate)
                        .get();

                    if (snapshot.empty) {
                        alert(`No hay tickets para la fecha seleccionada (${startDate})`);
                        return;
                    }

                    // Inicializar jsPDF
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF();
                    
                    // Configurar título
                    doc.setFontSize(18);
                    doc.text(title, 14, 20);
                    
                    // Preparar datos para la tabla
                    const ticketsData = [];
                    const resumenPropinas = {};
                    
                    snapshot.forEach(doc => {
                        const ticket = doc.data();
                        ticketsData.push([
                            ticket.fecha || 'Sin fecha',
                            `$${ticket.monto?.toFixed(2) || '0.00'}`,
                            ticket.empleados?.join(', ') || 'No especificados'
                        ]);

                        // Calcular propinas
                        if (ticket.empleados && ticket.empleados.length > 0 && ticket.monto) {
                            const propinaPorEmpleado = ticket.monto / ticket.empleados.length;
                            ticket.empleados.forEach(empleado => {
                                resumenPropinas[empleado] = (resumenPropinas[empleado] || 0) + propinaPorEmpleado;
                            });
                        }
                    });

                    // Tabla de tickets
                    doc.setFontSize(12);
                    doc.text('Detalle de Tickets', 14, 40);
                    
                    doc.autoTable({
                        startY: 45,
                        head: [['Fecha', 'Monto', 'Empleados']],
                        body: ticketsData,
                        theme: 'grid'
                    });

                    // Resumen de propinas
                    const summaryY = doc.lastAutoTable.finalY + 20;
                    doc.setFontSize(14);
                    doc.text('Resumen de Propinas', 14, summaryY);
                    
                    const summaryTableData = Object.entries(resumenPropinas).map(([empleado, monto]) => [
                        empleado,
                        `$${monto.toFixed(2)}`
                    ]);
                    
                    doc.autoTable({
                        startY: summaryY + 5,
                        head: [['Empleado', 'Propina']],
                        body: summaryTableData,
                        theme: 'grid'
                    });

                    // Guardar PDF
                    doc.save(`Reporte_Propinas_Diario_${startDate}.pdf`);
                    
                    return;
                }
                else if (type === 'weekly') {
                    const weekValue = document.getElementById('reportWeek').value;
                    if (!weekValue) {
                        alert('Por favor seleccione una semana');
                        return;
                    }
                    const [year, week] = weekValue.split('-W');
                    const date = new Date(year, 0, 1);
                    const dayMs = 24 * 60 * 60 * 1000;
                    const weekMs = 7 * dayMs;
                    
                    // Ajustar al primer día de la semana (lunes)
                    while (date.getDay() !== 1) {
                        date.setTime(date.getTime() + dayMs);
                    }
                    
                    // Avanzar a la semana seleccionada
                    date.setTime(date.getTime() + (week - 1) * weekMs);
                    startDate = new Date(date).toISOString().split('T')[0];
                    
                    date.setTime(date.getTime() + 6 * dayMs);
                    endDate = new Date(date).toISOString().split('T')[0];
                    title = `Reporte Semanal ${startDate} al ${endDate}`;
                } 
                else if (type === 'monthly') {
                    const monthValue = document.getElementById('reportMonth').value;
                    if (!monthValue) {
                        alert('Por favor seleccione un mes');
                        return;
                    }
                    const [year, month] = monthValue.split('-');
                    startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
                    endDate = new Date(year, month, 0).toISOString().split('T')[0];
                    title = `Reporte Mensual ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`;
                }

                modal.remove();

                // Obtener tickets del período
                const ticketsRef = db.collection('tickets');
                const snapshot = await ticketsRef
                    .where('fecha', '>=', startDate)
                    .where('fecha', '<=', endDate)
                    .get();

                if (snapshot.empty) {
                    alert(`No hay tickets para el período seleccionado (${startDate} - ${endDate})`);
                    return;
                }

                // Usar la versión UMD de jsPDF
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                // Agrupar tickets por día o semana según el tipo de reporte
                // Cambiar de const a let para groupedData
                let groupedData = {};
                const resumenPropinas = {};
                const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                
                snapshot.forEach(doc => {
                    const ticket = doc.data();
                    let groupKey;
                    
                    if (type === 'weekly') {
                        // Agrupar por día para reporte semanal
                        const fecha = new Date(ticket.fecha);
                        const diaSemana = fecha.getDay(); // 0=Domingo, 1=Lunes, etc.
                        groupKey = diasSemana[diaSemana];
                    } else if (type === 'monthly') {
                        // Agrupar por semana para reporte mensual
                        const date = new Date(ticket.fecha);
                        const firstDay = new Date(date.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1)));
                        groupKey = firstDay.toISOString().split('T')[0];
                    }
                    
                    if (!groupedData[groupKey]) {
                        groupedData[groupKey] = [];
                    }
                    groupedData[groupKey].push(ticket);

                    // Calcular propinas
                    if (ticket.empleados && ticket.empleados.length > 0 && ticket.monto) {
                        const propinaPorEmpleado = ticket.monto / ticket.empleados.length;
                        ticket.empleados.forEach(empleado => {
                            resumenPropinas[empleado] = (resumenPropinas[empleado] || 0) + propinaPorEmpleado;
                        });
                    }
                });

                // Modificar la parte de ordenamiento para reporte semanal
                if (type === 'weekly') {
                    const orderedData = {};
                    diasSemana.forEach(dia => {
                        if (groupedData[dia]) {
                            orderedData[dia] = groupedData[dia];
                        }
                    });
                    groupedData = orderedData; // Esto ahora funciona porque groupedData es let
                }

                // Generar tablas por grupo
                let currentY = 40;
                
                for (const [groupKey, tickets] of Object.entries(groupedData)) {
                    // Título del grupo
                    let groupTitle;
                    if (type === 'weekly') {
                        groupTitle = `Día: ${groupKey}`;
                    } else if (type === 'monthly') {
                        const date = new Date(groupKey);
                        const endOfWeek = new Date(date);
                        endOfWeek.setDate(date.getDate() + 6);
                        groupTitle = `Semana del ${groupKey} al ${endOfWeek.toISOString().split('T')[0]}`;
                    }
                    
                    doc.setFontSize(12);
                    doc.text(groupTitle, 14, currentY);
                    currentY += 10;
                    
                    // Tabla de tickets del grupo
                    const ticketsTableData = tickets.map(ticket => [
                        ticket.fecha || 'Sin fecha',
                        `$${ticket.monto?.toFixed(2) || '0.00'}`,
                        ticket.empleados?.join(', ') || 'No especificados'
                    ]);
                    
                    doc.autoTable({
                        startY: currentY,
                        head: [['Fecha', 'Monto', 'Empleados']],
                        body: ticketsTableData,
                        theme: 'grid'
                    });
                    
                    currentY = doc.lastAutoTable.finalY + 15;
                }

                // Resumen general de propinas
                doc.setFontSize(14);
                doc.text('Resumen General de Propinas', 14, currentY);
                currentY += 10;
                
                const summaryTableData = Object.entries(resumenPropinas).map(([empleado, monto]) => [
                    empleado,
                    `$${monto.toFixed(2)}`
                ]);
                
                doc.autoTable({
                    startY: currentY,
                    head: [['Empleado', 'Propina']],
                    body: summaryTableData,
                    theme: 'grid'
                });
                
                // Guardar PDF
                doc.save(`Reporte_Propinas_${type}_${new Date().toISOString().split('T')[0]}.pdf`);
                
                resolve();
            });

            document.getElementById('cancelReportBtn').addEventListener('click', () => {
                modal.remove();
                resolve();
            });
        });
        
    } catch (error) {
        console.error('Error al generar reporte:', error);
        alert('Error al generar el reporte: ' + error.message);
    }
}

// Make sure the delete function is properly defined
async function deleteTicket(e) {
    const ticketId = e.target.getAttribute('data-id');
    const ticketElement = e.target.closest('.ticket-item');
    
    // Create a custom confirmation dialog
    const confirmDelete = await Swal.fire({
        title: '¿Eliminar ticket?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        backdrop: `
            rgba(0,0,123,0.4)
            url("/images/nyan-cat.gif")
            left top
            no-repeat
        `
    });
    
    if (confirmDelete.isConfirmed) {
        try {
            // Add loading state
            e.target.disabled = true;
            e.target.textContent = 'Eliminando...';
            
            await db.collection('tickets').doc(ticketId).delete();
            
            // Animate removal
            ticketElement.style.transform = 'translateX(100%)';
            ticketElement.style.opacity = '0';
            setTimeout(() => {
                ticketElement.remove();
            }, 300);
            
            // Show success notification
            Swal.fire({
                position: 'top-end',
                icon: 'success',
                title: 'Ticket eliminado',
                showConfirmButton: false,
                timer: 1500,
                toast: true
            });
            
            // Refresh summary
            await displayTickets();
            
        } catch (error) {
            console.error('Error al eliminar ticket:', error);
            // Show error notification
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo eliminar el ticket: ' + error.message,
                confirmButtonColor: '#3085d6',
            });
            // Reset button state
            e.target.disabled = false;
            e.target.textContent = 'Eliminar';
        }
    }
}

// Add this with your other functions
function logout() {
    currentUser = null;
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('app').style.display = 'none';
    document.getElementById('loginForm').reset();
    // No need to remove from localStorage since we're not using it anymore
}

// Add logout button listener
document.getElementById('logoutBtn').addEventListener('click', logout);