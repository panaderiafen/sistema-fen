// ═══════════════════════════════════════════════
//  Sistema Fën — configuración  v0.2.0
//  (i) La configuración web de Firebase no es secreta: es la misma que usa
//  la caja y solo identifica el proyecto. Lo que protege los datos son las
//  reglas de Firestore y la cuenta de administración.
// ═══════════════════════════════════════════════
window.FEN_SIS = {
  VERSION: '0.23.0',
  firebase: {
    apiKey: 'AIzaSyDrG2mij1h5wZ2lIyAYMTfgG9avaVnjcaU',
    authDomain: 'fen-ventas.firebaseapp.com',
    projectId: 'fen-ventas',
    storageBucket: 'fen-ventas.firebasestorage.app',
    messagingSenderId: '265179393436',
    appId: '1:265179393436:web:75f74773c0cb992ca3ac59'
  },
  // Apps actuales: el menú las abre en otra pestaña. Cada etapa saca una de aquí.
  APPS: [
    { id: 'b2b',        nombre: 'Ventas B2B', url: 'https://panaderiafen.github.io/Admin-Ventas-B2B-fen/', icono: 'camion' },
    { id: 'gastos',     nombre: 'Gastos',     url: 'https://panaderiafen.github.io/registro-gasto/',      icono: 'boleta' },
    { id: 'produccion', nombre: 'Producción', url: 'https://panaderiafen.github.io/fen-produccion/',      icono: 'libro' },
    { id: 'caja',       nombre: 'Caja',       url: 'https://panaderiafen.github.io/fen-ventas/',          icono: 'pantalla' },
    { id: 'asistencia', nombre: 'Asistencia', url: 'https://panaderiafen.github.io/fen-asistencia/admin.html', icono: 'personas' }
  ],
  // Cuánto se recuerda un equipo. "sesion" = hasta cerrar el navegador (y como máximo 12 horas).
  DURACIONES: [
    { id: 'sesion', nombre: 'Solo esta vez' },
    { id: '30d',    nombre: '30 días' },
    { id: '4m',     nombre: '4 meses' },
    { id: '1a',     nombre: '1 año' },
    { id: 'fecha',  nombre: 'Personalizado' }
  ],
  DURACION_SUGERIDA: '4m',
  // Script de caja/merma (el mismo que usa la caja para pasar los cierres a la planilla).
  // Sistema Fën lo llama con su propia sesión de administración.
  CAJA_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx7eYgaVGK5NBFcmX5rVr2H_QiLIuRKS7oBwiVfy5_74icgNnKvD_WEkYD92dU-fddv1A/exec',
  // Script de Ventas mensuales (el mismo que usa la caja): solo para el correo de descuadre.
  VENTAS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxeA_xhOm83PlYgLzv7wP5N6AM-ogfrfTClrs91JzFWgi5HCSgIRwgzAuGIbd6WsukrNQ/exec',
  // Apps Script de cada app, para que Hoy lea sus pendientes (se pueden cambiar en Configuración → Conexiones).
  // La de Ventas B2B se guarda en cada equipo de la app B2B (⚙️ Config): pégala en Conexiones.
  SCRIPTS: {
    gastos: 'https://script.google.com/macros/s/AKfycbxQXOCvWM9YYY-mKLBImD4jp5XTCpBLqBO1pzCFFfllMaDBmFZAzdT8dswjyifcqzex/exec',
    b2b: '',
    produccion: 'https://script.google.com/macros/s/AKfycbw-D1gOezUuFEhhqXQ69zYR0Sp4Bekg3CHhy3lEMzB8CV9kp6ty0iXTreyq5aULmz5L8g/exec'
  },
  // Lista de recetas que publica Producción (la misma que lee la caja, pestaña Lista_publica_productos)
  RECETAS_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRKvAbWUlwxbcCx54T3lfdMa8XxPD-F2lSE05-vMfdv_UpFVpDi6pbAJOpM7O6LBLmdfkz5804lzMYn/pub?gid=1370945279&single=true&output=csv',
  DIAS_HISTORIAL: 60,
  // Base nueva de Ventas B2B (proyecto Firebase fen-b2b). Se pega en Sistema Fën → Ventas B2B y queda
  // guardada en Firestore (config/sistemaFen). Si se pone aquí, se usa cuando no hay una guardada.
  firebaseB2B: null,
  // Datos que salen en el PDF de la orden de venta B2B
  DATOS_EMPRESA: { direccion: 'Ainavillo 764, Concepción', telefono: '+56 9 4147 3683', correo: 'panaderiafen@gmail.com', web: 'WWW.PANADERIAFEN.CL · @PANADERIAFEN' }
};
