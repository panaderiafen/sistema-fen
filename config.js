// ═══════════════════════════════════════════════
//  Sistema Fën — configuración  v0.1.1
//  (i) La configuración web de Firebase no es secreta: es la misma que usa
//  la caja y solo identifica el proyecto. Lo que protege los datos son las
//  reglas de Firestore y la cuenta de administración.
// ═══════════════════════════════════════════════
window.FEN_SIS = {
  VERSION: '0.1.1',
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
  DURACION_SUGERIDA: '4m'
};
