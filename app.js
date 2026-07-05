import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

// 🛠️ ตังค่า Firebase Config (ให้นำค่าที่คุณได้มาจาก Firebase Console มาวางทับตรงนี้)
const firebaseConfig = {
    apiKey: "AIzaSyB-FxoUZm3pMptXF6kJIvJJkzNZ63ZjYPA",
  authDomain: "cpr-assistant-f0833.firebaseapp.com",
  projectId: "cpr-assistant-f0833",
  storageBucket: "cpr-assistant-f0833.firebasestorage.app",
  messagingSenderId: "1062430162073",
  appId: "1:1062430162073:web:95124e341f4b38fc020c08",
  measurementId: "G-2YR19NHPBQ"
};

// เริ่มต้นเปิดระบบ Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// กำหนดตัวแปรควบคุม UI Screens
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');

// ตัวแปรเก็บข้อมูลผู้ใช้ที่ล็อกอินอยู่
let currentUser = null;

// ==========================================
// 🔐 ระบบ AUTHENTICATION (GOOGLE LOGIN)
// ==========================================

// ตัวตรวจจับสถานะล็อกอิน (ทำงานตลอดเวลา)
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('user-name').innerText = user.displayName;
        document.getElementById('user-avatar').src = user.photoURL;
        
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        lucide.createIcons();
    } else {
        currentUser = null;
        appScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        if (isRunning) stopTracking();
    }
});

// กดปุ่มล็อกอินด้วย Google
document.getElementById('btn-login').addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login Failed:", error);
        alert("เข้าสู่ระบบไม่สำเร็จ: " + error.message);
    }
});

// กดปุ่มล็อกเอาต์
document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth);
});


// ==========================================
// 🏎️ ระบบเซนเซอร์และการคำนวณ (โค้ดปัจจุบันที่เสถียรของคุณ)
// ==========================================
let isRunning = false;
let totalCount = 0;
let lastTapTime = 0;
let seconds = 0;
let timerInterval;
let maxBPMRecorded = 0; // เพิ่มเติมเพื่อเก็บสถิติไปลง DB

let initialBeta = 0;
let isCalibrated = false;
let lastTotalForce = 0;
let isPeak = false;

const ACCEL_DELTA_THRESHOLD = 0.5; 
const DEBOUNCE_TIME = 500;         

const btnAction = document.getElementById('btn-action');
const bpmValue = document.getElementById('bpm-value');
const bpmBar = document.getElementById('bpm-bar');
const bpmStatus = document.getElementById('bpm-status');
const angleValue = document.getElementById('angle-value');
const angleIndicator = document.getElementById('angle-indicator');
const angleStatus = document.getElementById('angle-status');
const totalCompressions = document.getElementById('total-compressions');
const timerText = document.getElementById('timer');

async function requestSensorPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permissionState = await DeviceOrientationEvent.requestPermission();
            return permissionState === 'granted';
        } catch (error) {
            console.error(error);
            return false;
        }
    }
    return true; 
}

async function startTracking() {
    const hasPermission = await requestSensorPermission();
    if (!hasPermission) {
        alert("จำเป็นต้องใช้สิทธิ์เข้าถึงเซนเซอร์");
        return;
    }

    isRunning = true;
    isCalibrated = false; 
    btnAction.innerHTML = `<i data-lucide="square" fill="currentColor"></i> หยุดการทดสอบ`;
    btnAction.classList.replace('bg-amber-600', 'bg-red-600');
    lucide.createIcons();

    totalCount = 0;
    seconds = 0;
    lastTapTime = 0;
    lastTotalForce = 0;
    maxBPMRecorded = 0;
    isPeak = false;
    totalCompressions.innerText = "0";
    timerText.innerText = "00:00";
    bpmValue.innerText = "0";
    bpmBar.style.width = "0%";
    bpmStatus.innerText = "โหมดเทสเปิดใช้งานแล้ว ลองขยับเครื่องเบาๆ...";

    timerInterval = setInterval(() => {
        seconds++;
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        timerText.innerText = `${mins}:${secs}`;
    }, 1000);

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);
}

function stopTracking() {
    isRunning = false;
    btnAction.innerHTML = `<i data-lucide="play" fill="currentColor"></i> เริ่มการทดสอบความไวสูง`;
    btnAction.classList.replace('bg-red-600', 'bg-amber-600');
    lucide.createIcons();

    clearInterval(timerInterval);
    window.removeEventListener('deviceorientation', handleOrientation);
    window.removeEventListener('devicemotion', handleMotion);

    // 💾 บันทึกสถิติลงฐานข้อมูลทันทีหลังจากปั๊มเสร็จเรียบร้อย
    saveDataToFirestore();
}

function handleOrientation(event) {
    if (!isRunning) return;
    let currentBeta = event.beta || 0; 

    if (!isCalibrated) {
        initialBeta = currentBeta;
        isCalibrated = true;
    }

    let relativeAngle = Math.round(currentBeta - initialBeta);
    angleValue.innerText = Math.abs(relativeAngle) + "°";
    angleIndicator.style.transform = `rotate(${relativeAngle}deg)`;

    if (Math.abs(relativeAngle) <= 8) {
        angleValue.className = "text-5xl font-black text-green-400";
        angleIndicator.className = "w-1 h-8 bg-green-400 absolute rounded origin-center transition-transform duration-200";
        angleStatus.innerText = "มุมตรงดี (โหมดเทส)";
        angleStatus.className = "text-sm font-medium text-green-400";
    } else {
        angleValue.className = "text-5xl font-black text-amber-500";
        angleIndicator.className = "w-1 h-8 bg-amber-500 absolute rounded origin-center transition-transform duration-200";
        angleStatus.innerText = "มุมเอียงออกไป (โหมดเทส)";
        angleStatus.className = "text-sm font-medium text-amber-500";
    }
}

function handleMotion(event) {
    if (!isRunning) return;

    let acc = event.acceleration || {};
    let x = acc.x;
    let y = acc.y;
    let z = acc.z;

    if (x === null || y === null || z === null) {
        let accG = event.accelerationIncludingGravity || {};
        x = accG.x || 0;
        y = accG.y || 0;
        z = (accG.z || 9.8) - 9.8; 
    }

    let currentTotalForce = Math.sqrt(x*x + y*y + z*z);
    let deltaForce = Math.abs(currentTotalForce - lastTotalForce);

    if (deltaForce > ACCEL_DELTA_THRESHOLD) {
        if (!isPeak) {
            isPeak = true;
            let now = Date.now();
            
            if (lastTapTime > 0) {
                let timeDiff = now - lastTapTime;

                if (timeDiff > DEBOUNCE_TIME) {
                    let calculatedBPM = Math.round(60000 / timeDiff);
                    
                    if (calculatedBPM >= 30 && calculatedBPM <= 400) {
                        updateBPMUI(calculatedBPM);
                        totalCount++;
                        totalCompressions.innerText = totalCount;
                        lastTapTime = now;

                        // ตรวจเช็คเพื่อเก็บสถิติความเร็วสูงสุดที่ทำได้ในเซสชันนี้
                        if (calculatedBPM > maxBPMRecorded) {
                            maxBPMRecorded = calculatedBPM;
                        }
                    }
                }
            } else {
                lastTapTime = now;
            }
        }
    } else if (deltaForce < (ACCEL_DELTA_THRESHOLD * 0.5)) { 
        isPeak = false;
    }

    lastTotalForce = currentTotalForce;
}

function updateBPMUI(bpm) {
    bpmValue.innerText = bpm;

    if (bpm >= 100 && bpm <= 120) {
        bpmValue.className = "text-6xl font-black text-green-400";
        bpmBar.className = "bg-green-400 h-full transition-all duration-300";
        bpmBar.style.width = "100%";
        bpmStatus.innerText = "จังหวะตรงตามเกณฑ์ CPR (100-120)";
        bpmStatus.className = "text-sm font-medium text-green-400 mt-2";
    } else if (bpm < 100) {
        bpmValue.className = "text-6xl font-black text-sky-400";
        bpmBar.className = "bg-sky-400 h-full transition-all duration-300";
        bpmBar.style.width = "50%";
        bpmStatus.innerText = "ความเร็วช้าไปนิด";
        bpmStatus.className = "text-sm font-medium text-sky-400 mt-2";
    } else {
        bpmValue.className = "text-6xl font-black text-rose-500";
        bpmBar.className = "bg-rose-500 h-full transition-all duration-300";
        bpmBar.style.width = "100%";
        bpmStatus.innerText = "ความเร็วเร็วเกินไป";
        bpmStatus.className = "text-sm font-medium text-rose-500 mt-2";
    }
}

// ==========================================
// 💾 ระบบบันทึกข้อมูลลงฐานข้อมูล FIRESTORE
// ==========================================
async function saveDataToFirestore() {
    // ถ้าไม่ได้ล็อกอิน หรือกดเล่นๆ โดยไม่มีการนับครั้ง จะไม่บันทึก
    if (!currentUser || totalCount === 0) return;

    try {
        // อ้างอิงโฟลเดอร์เก็บข้อมูลชื่อ "cpr_sessions" บนคลาวด์
        const docRef = await addDoc(collection(db, "cpr_sessions"), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: currentUser.displayName,
            totalCompressions: totalCount,
            durationSeconds: seconds,
            maxBPM: maxBPMRecorded,
            createdAt: serverTimestamp() // เวลาเซิร์ฟเวอร์ส่วนกลาง
        });
        console.log("บันทึกประวัติการทดสอบลงคลาวด์สำเร็จ ไอดี:", docRef.id);
    } catch (e) {
        console.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล:", e);
    }
}

btnAction.addEventListener('click', () => {
    if (!isRunning) {
        startTracking();
    } else {
        stopTracking();
    }
});