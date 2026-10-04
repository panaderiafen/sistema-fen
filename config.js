// ═══════════════════════════════════════════════
//  Sistema Fën — configuración  v0.2.0
//  (i) La configuración web de Firebase no es secreta: es la misma que usa
//  la caja y solo identifica el proyecto. Lo que protege los datos son las
//  reglas de Firestore y la cuenta de administración.
// ═══════════════════════════════════════════════
window.FEN_SIS = {
  VERSION: '0.4.0',
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
  DIAS_HISTORIAL: 60
};
