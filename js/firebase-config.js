// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDqsITvjqxe1Dp9ukpOxXQPQqg71U3LeXI",
  authDomain: "project-96f29ce1-531d-4284-b9d.firebaseapp.com",
  projectId: "project-96f29ce1-531d-4284-b9d",
  storageBucket: "project-96f29ce1-531d-4284-b9d.firebasestorage.app",
  messagingSenderId: "976361235859",
  appId: "1:976361235859:web:8ccad72c92586b796c3466",
  measurementId: "G-H4ZYT6WGF7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);