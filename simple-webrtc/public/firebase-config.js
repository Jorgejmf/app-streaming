// Configuración de Firebase (Realtime Database se usa como servidor de señalización WebRTC)
// Configuración de Firebase (Realtime Database se usa como servidor de señalización WebRTC)
const firebaseConfig = {
  apiKey: "AIzaSyAp4sKgihI9BTj7NoKEp-VDM4R3uibzlcU",
  authDomain: "clase-progra2.firebaseapp.com",
  databaseURL: "https://clase-progra2-default-rtdb.firebaseio.com",
  projectId: "clase-progra2",
  storageBucket: "clase-progra2.firebasestorage.app",
  messagingSenderId: "940345549806",
  appId: "1:940345549806:web:7d46424bc3f280abd824ff",
  measurementId: "G-1H9M7XCL04"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Ruta principal de señalización (soporta 1 emisor y múltiples espectadores)
const ROOM_PATH = 'rooms/main';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};
