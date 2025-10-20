// Configuración de Firebase (reemplaza con tus datos)
const firebaseConfig = {
    apiKey: "AIzaSyAuk63DsxoRDPautxAycxCC2kcmU_c1iwI",
    authDomain: "propinas-7579e.firebaseapp.com",
    projectId: "propinas-7579e",
    storageBucket: "propinas-7579e.firebasestorage.app",
    messagingSenderId: "1037386066713",
    appId: "1:1037386066713:web:fc40b878026b3ead7e3388",
    measurementId: "G-BT68EHFW3W"
  };
  

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);

// Obtiene referencia a Firestore
const db = firebase.firestore();