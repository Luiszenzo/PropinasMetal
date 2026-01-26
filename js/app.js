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

// Helper to get ISO week string (YYYY-Www) with week starting on Monday
function getWeekString(dateStr) {
    const date = new Date(dateStr);
    // Copy date so don't modify original
    const target = new Date(date.valueOf());
    // Set to nearest Thursday: current date + 4 - current day number (Monday=1, Sunday=7)
    const dayNr = (date.getDay() + 6) % 7; // Monday=0,...Sunday=6
    target.setDate(target.getDate() - dayNr + 3);
    // January 4th is always in week 1
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const firstDayNr = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
    // Calculate full weeks to target date
    const weekNo = 1 + Math.round(((target - firstThursday) / 86400000 - 3) / 7);
    const year = target.getFullYear();
    return `${year}-W${weekNo.toString().padStart(2, '0')}`;
}

// Helper to get week range (start and end date) from ISO week string (Monday to Sunday)
function getWeekRange(isoWeekStr) {
    const [yearStr, weekStr] = isoWeekStr.split('-W');
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);

    // Find Monday of the week
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const day = simple.getDay();
    const ISOweekStart = new Date(simple);
    // Adjust to Monday (day 1)
    const diff = (day <= 0 ? 7 : day) - 1; // Sunday=0 -> 7
    ISOweekStart.setDate(simple.getDate() - diff);

    const ISOweekEnd = new Date(ISOweekStart);
    ISOweekEnd.setDate(ISOweekStart.getDate() + 6);

    const format = d => d.toLocaleDateString('es-MX');
    return `${format(ISOweekStart)} - ${format(ISOweekEnd)}`;
}

// Helper to get ISO week string (YYYY-Www) with week starting on Sunday
function getWeekString(dateStr) {
    const date = new Date(dateStr);
    // Get the day of week (Sunday = 0)
    const day = date.getDay();
    // Set date to Sunday of the current week
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - day);

    // Determine the year for the week based on the Sunday date
    let year = sunday.getFullYear();

    // Calculate the first Sunday of the year
    const yearStart = new Date(year, 0, 1);
    const firstSunday = new Date(yearStart);
    firstSunday.setDate(yearStart.getDate() - yearStart.getDay());

    // Calculate week number
    const diff = sunday - firstSunday;
    const weekNo = Math.floor(diff / (7 * 86400000)) + 1;

    // Handle edge case: if weekNo is 0, it belongs to the last week of previous year
    if (weekNo === 0) {
        year -= 1;
        const prevYearStart = new Date(year, 0, 1);
        const prevFirstSunday = new Date(prevYearStart);
        prevFirstSunday.setDate(prevYearStart.getDate() - prevYearStart.getDay());
        const diffPrev = sunday - prevFirstSunday;
        const prevWeekNo = Math.floor(diffPrev / (7 * 86400000)) + 1;
        return `${year}-W${prevWeekNo.toString().padStart(2, '0')}`;
    }

    return `${year}-W${weekNo.toString().padStart(2, '0')}`;
}

// Helper to get week range (start and end date) from ISO week string
function getWeekRange(isoWeekStr) {
    const [year, week] = isoWeekStr.split('-W');
    const weekNum = parseInt(week, 10);

    // Find the first Sunday of the year
    const firstDayOfYear = new Date(year, 0, 1);
    const firstSunday = new Date(firstDayOfYear);
    firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfYear.getDay()) % 7);

    // Calculate the Sunday of the requested week
    const sunday = new Date(firstSunday);
    sunday.setDate(firstSunday.getDate() + (weekNum - 1) * 7);

    // Saturday is 6 days after Sunday
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    // Format as DD/MM/YYYY
    const format = d => d.toLocaleDateString('es-MX');
    return `${format(sunday)} - ${format(saturday)}`;
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

        // Change resumenPropinas to be grouped by week and employee
        const resumenPropinas = {}; // { week: { empleado: monto } }
        let currentDate = null;
        let dateGroupElement = null;
        
        snapshot.forEach(doc => {
            const ticket = doc.data();
            const ticketDate = ticket.fecha.split('T')[0];
            
            if (ticketDate !== currentDate) {
                currentDate = ticketDate;
                
                // Create date group container
                dateGroupElement = document.createElement('div');
                dateGroupElement.className = 'date-group';
                ticketsList.appendChild(dateGroupElement);
                
                // Create clickable date header
                const dateHeader = document.createElement('div');
                dateHeader.className = 'date-header collapsed';
                dateHeader.innerHTML = `<h3>${formatDate(ticketDate)}</h3>`;
                dateHeader.addEventListener('click', function() {
                    const ticketsGroup = this.nextElementSibling;
                    this.classList.toggle('collapsed');
                    ticketsGroup.classList.toggle('visible');
                });
                dateGroupElement.appendChild(dateHeader);
                
                // Create tickets container for this date
                const ticketsGroup = document.createElement('div');
                ticketsGroup.className = 'tickets-group';
                dateGroupElement.appendChild(ticketsGroup);
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
            
            // Add ticket to the current date's tickets group (CHANGED THIS LINE)
            dateGroupElement.querySelector('.tickets-group').appendChild(ticketElement);
            
            // Add event listener for the delete button
            const deleteBtn = ticketElement.querySelector('.btn-delete');
            deleteBtn.addEventListener('click', deleteTicket);
            
            // Calcular propinas por empleado agrupadas por semana
            if (ticket.empleados && ticket.empleados.length > 0 && ticket.monto) {
                const propinaPorEmpleado = ticket.monto / ticket.empleados.length;
                const weekStr = getWeekString(ticketDate);
                if (!resumenPropinas[weekStr]) resumenPropinas[weekStr] = {};
                ticket.empleados.forEach(empleado => {
                    resumenPropinas[weekStr][empleado] = (resumenPropinas[weekStr][empleado] || 0) + propinaPorEmpleado;
                });
            }
        });

        // Mostrar resumen de propinas por semana
        mostrarResumenPropinas(resumenPropinas);
        
    } catch (error) {
        console.error('Error al obtener tickets:', error);
        const ticketsList = document.querySelector('.tickets-list');
        ticketsList.innerHTML = '<p class="error">Error al cargar tickets</p>';
    }
}

// Add this helper function
// Update this helper function to handle timezone correctly
function formatDate(dateString) {
    // Parse the date string in local timezone
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    // Format to Spanish and capitalize first letter
    let formattedDate = date.toLocaleDateString('es-ES', options);
    return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
}

// Función para mostrar el resumen de propinas
function mostrarResumenPropinas(resumen) {
    const appElement = document.getElementById('app');
    let resumenContainer = document.querySelector('.resumen-container');
    if (!resumenContainer) {
        resumenContainer = document.createElement('div');
        resumenContainer.className = 'resumen-container';
        appElement.appendChild(resumenContainer);
    }

    // Get all unique employees and weeks
    const weeks = Object.keys(resumen).sort();
    const empleadosSet = new Set();
    weeks.forEach(week => {
        Object.keys(resumen[week]).forEach(emp => empleadosSet.add(emp));
    });
    const empleados = Array.from(empleadosSet).sort();

    // Build table header with week ranges
    let thead = `<tr><th>Empleado</th>`;
    weeks.forEach(week => {
        thead += `<th>${getWeekRange(week)}</th>`;
    });
    thead += `</tr>`;

    // Build table body
    let tbody = '';
    empleados.forEach(emp => {
        tbody += `<tr><td>${emp}</td>`;
        weeks.forEach(week => {
            const monto = resumen[week][emp] || 0;
            tbody += `<td>$${monto.toFixed(2)}</td>`;
        });
        tbody += `</tr>`;
    });

    resumenContainer.innerHTML = `
        <h3 class="resumen-title">Resumen de Propinas por Semana</h3>
        <table class="resumen-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
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
const empleados = ['Juan', 'Kike', 'Sofi', 'Toño', 'Miguel', "Cami", "Rodrigo", "Martha", "Ivet", "Lulu", "Carlo"];

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
    'toño': '12345',
    'Lily': 'Metal'
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
        const fechaInput = document.getElementById('fecha').value;
        // Ensure we store the date in YYYY-MM-DD format
        const fecha = new Date(fechaInput).toISOString().split('T')[0];
        
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


// Helper to format date as YYYY-MM-DD in local time
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper to group tickets by period
function groupTicketsByPeriod(tickets, period) {
    const groups = {};
    tickets.forEach(ticket => {
        let key;
        if (period === 'daily') {
            key = ticket.fecha;
        } else if (period === 'weekly') {
            key = getWeekString(ticket.fecha);
        } else if (period === 'monthly') {
            const [year, month] = ticket.fecha.split('-');
            key = `${year}-${month}`;
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(ticket);
    });
    return groups;
}

// Helper to filter tickets by selected period and value
function filterTicketsByPeriod(tickets, period, value) {
    if (period === 'daily') {
        return tickets.filter(ticket => ticket.fecha === value);
    } else if (period === 'weekly') {
        // Filter by exact week string
        filteredTickets = tickets.filter(ticket => getWeekString(ticket.fecha) === value);
    } else if (period === 'monthly') {
        return tickets.filter(ticket => {
            const [year, month] = ticket.fecha.split('-');
            return `${year}-${month}` === value;
        });
    }
    return tickets;
}

// Function to prompt for date and generate PDF report
async function generateReport(period) {
    let inputType, inputLabel, value;
    if (period === 'daily') {
        inputType = 'date';
        inputLabel = 'Selecciona el día para el reporte';
    } else if (period === 'weekly') {
        inputType = 'week';
        inputLabel = 'Selecciona la semana para el reporte';
    } else if (period === 'monthly') {
        inputType = 'month';
        inputLabel = 'Selecciona el mes para el reporte';
    }

    // Prompt user for date/week/month
    const { value: selected } = await Swal.fire({
        title: inputLabel,
        input: inputType,
        inputLabel: inputLabel,
        inputPlaceholder: 'Selecciona...',
        showCancelButton: true,
        confirmButtonText: 'Generar',
        cancelButtonText: 'Cancelar'
    });

    if (!selected) return; // Cancelled

    // Format selected value for filtering
    if (period === 'daily') {
        value = selected; // YYYY-MM-DD
    } else if (period === 'weekly') {
        // Use the selected week string directly (YYYY-Www)
        value = selected; // e.g., "2024-W21"
    } else if (period === 'monthly') {
        value = selected; // YYYY-MM
    }

    try {
        const ticketsRef = db.collection('tickets');
        const snapshot = await ticketsRef.orderBy('fecha', 'asc').get();
        if (snapshot.empty) {
            Swal.fire('No hay tickets para el reporte');
            return;
        }

        // Collect all tickets
        const tickets = [];
        snapshot.forEach(doc => {
            tickets.push(doc.data());
        });

        // Filter tickets by selected period
        let filteredTickets;
        if (period === 'monthly') {
            filteredTickets = tickets.filter(ticket => {
                const [year, month] = ticket.fecha.split('-');
                return `${year}-${month}` === value;
            });
        } else if (period === 'weekly') {
            // Filter by exact week string
            filteredTickets = tickets.filter(ticket => getWeekString(ticket.fecha) === value);
        } else {
            filteredTickets = filterTicketsByPeriod(tickets, period, value);
        }

        if (filteredTickets.length === 0) {
            Swal.fire('No hay tickets para el periodo seleccionado');
            return;
        }

        // Prepare PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header formatting
        let title = '';
        let subtitle = '';
        if (period === 'daily') {
            title = 'Reporte Diario de Propinas';
            subtitle = `Fecha: ${formatDate(value)}`;
        }
        if (period === 'weekly') {
            title = 'Reporte Semanal de Propinas';
            subtitle = `Semana: ${getWeekRange(value)}`; // Use the selected week string for range
        }
        if (period === 'monthly') {
            const [year, month] = value.split('-');
            title = 'Reporte Mensual de Propinas';
            subtitle = `Mes: ${month}/${year}`;
        }

        doc.setFontSize(20);
        doc.text(title, 105, 18, { align: 'center' });
        doc.setFontSize(13);
        doc.text(subtitle, 105, 28, { align: 'center' });

        let y = 38;

        // Calculate grand total for filtered tickets
        const grandTotal = filteredTickets.reduce((sum, t) => sum + (parseFloat(t.monto) || 0), 0);

        // Show grand total at the top for daily/weekly/monthly
        doc.setFontSize(14);
        doc.setTextColor(0, 128, 0);
        doc.text(`Total de propinas: $${grandTotal.toFixed(2)}`, 15, y);
        doc.setTextColor(0, 0, 0);
        y += 10;

        // Table header formatting
        function printTableHeader(doc, y) {
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Fecha', 15, y);
            doc.text('Monto', 45, y);
            doc.text('Empleados', 75, y);
            doc.text('Creado Por', 150, y);
            doc.setFont(undefined, 'normal');
            doc.line(15, y + 2, 195, y + 2); // underline
            return y + 6;
        }

        // Table row formatting
        function printTableRow(doc, ticket, y) {
            const empleadosStr = ticket.empleados ? ticket.empleados.join(', ') : '';
            doc.setFontSize(10);
            doc.text(ticket.fecha, 15, y);
            doc.text(`$${ticket.monto}`, 45, y);
            doc.text(empleadosStr, 75, y, { maxWidth: 70 });
            doc.text(ticket.creadoPor || '', 150, y);
            return y + 6;
        }

        if (period === 'monthly') {
            // Agrupar por semana dentro del mes seleccionado
            const weeksInMonth = {};
            filteredTickets.forEach(ticket => {
                const weekStr = getWeekString(ticket.fecha);
                if (!weeksInMonth[weekStr]) weeksInMonth[weekStr] = [];
                weeksInMonth[weekStr].push(ticket);
            });

            Object.keys(weeksInMonth).sort().forEach(weekKey => {
                // Calculate total for this week
                const weekTotal = weeksInMonth[weekKey].reduce((sum, t) => sum + (parseFloat(t.monto) || 0), 0);

                doc.setFontSize(13);
                doc.setTextColor(40, 70, 200);
                doc.text(getWeekRange(weekKey), 15, y);
                doc.setTextColor(0, 128, 0);
                doc.text(`Total semana: $${weekTotal.toFixed(2)}`, 120, y);
                doc.setTextColor(0, 0, 0);
                y += 7;

                y = printTableHeader(doc, y);

                weeksInMonth[weekKey].forEach(ticket => {
                    y = printTableRow(doc, ticket, y);
                    if (y > 270) {
                        doc.addPage();
                        y = 20;
                    }
                });

                doc.line(15, y, 195, y); // separator line
                y += 8;
            });

            // Show grand total at the end of the monthly report
            doc.setFontSize(15);
            doc.setTextColor(0, 128, 0);
            doc.text(`Total mensual: $${grandTotal.toFixed(2)}`, 15, y);
            doc.setTextColor(0, 0, 0);
            y += 10;
        } else {
            // Agrupar por periodo (día o semana)
            const grouped = groupTicketsByPeriod(filteredTickets, period);
            Object.keys(grouped).forEach((groupKey, idx) => {
                let groupTitle = '';
                if (period === 'daily') groupTitle = formatDate(groupKey);
                if (period === 'weekly') groupTitle = getWeekRange(groupKey);

                // Calculate total for this group (day/week)
                const groupTotal = grouped[groupKey].reduce((sum, t) => sum + (parseFloat(t.monto) || 0), 0);

                doc.setFontSize(13);
                doc.setTextColor(40, 70, 200);
                doc.text(groupTitle, 15, y);
                doc.setTextColor(0, 128, 0);
                doc.text(`Total: $${groupTotal.toFixed(2)}`, 120, y);
                doc.setTextColor(0, 0, 0);
                y += 7;

                y = printTableHeader(doc, y);

                grouped[groupKey].forEach(ticket => {
                    y = printTableRow(doc, ticket, y);
                    if (y > 270) {
                        doc.addPage();
                        y = 20;
                    }
                });

                doc.line(15, y, 195, y); // separator line
                y += 8;
            });
        }

        // === EMPLOYEE SUMMARY TABLE ===
        // Calculate total per employee for the filtered tickets
        const employeeTotals = {};
        filteredTickets.forEach(ticket => {
            if (ticket.empleados && ticket.empleados.length > 0 && ticket.monto) {
                const propinaPorEmpleado = ticket.monto / ticket.empleados.length;
                ticket.empleados.forEach(empleado => {
                    employeeTotals[empleado] = (employeeTotals[empleado] || 0) + propinaPorEmpleado;
                });
            }
        });

        // Move down before drawing the table
        if (y > 250) {
            doc.addPage();
            y = 20;
        } else {
            y += 15;
        }

        doc.setFontSize(14);
        doc.setTextColor(40, 70, 200);
        doc.text('Resumen de Propinas por Empleado', 15, y);
        doc.setTextColor(0, 0, 0);
        y += 8;

        // Table header
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('Empleado', 15, y);
        doc.text('Total', 70, y);
        doc.setFont(undefined, 'normal');
        doc.line(15, y + 2, 100, y + 2);
        y += 6;

        // Table rows
        Object.keys(employeeTotals).sort().forEach(empleado => {
            doc.setFontSize(10);
            doc.text(empleado, 15, y);
            doc.text(`$${employeeTotals[empleado].toFixed(2)}`, 70, y);
            y += 6;
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
        });

        doc.save(`${title.replace(/ /g, '_')}.pdf`);
    } catch (error) {
        console.error('Error al generar el reporte:', error);
        Swal.fire('Error al generar el reporte');
    }
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful:', registration);
            })
            .catch(function(error) {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}
