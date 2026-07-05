import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { 
    getFirestore, collection, addDoc, serverTimestamp, 
    query, where, orderBy, onSnapshot, doc, deleteDoc 
} from "firebase/firestore";

// 🛠️ ตังค่า Firebase Config เดิมของคุณที่นี่
const firebaseConfig = {
    apiKey: "AIzaSyB-FxoUZm3pMptXF6kJIvJJkzNZ63ZjYPA",
  authDomain: "cpr-assistant-f0833.firebaseapp.com",
  projectId: "cpr-assistant-f0833",
  storageBucket: "cpr-assistant-f0833.firebasestorage.app",
  messagingSenderId: "1062430162073",
  appId: "1:1062430162073:web:95124e341f4b38fc020c08",
  measurementId: "G-2YR19NHPBQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ตัวแปร Screens และระบบสมาชิก
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
let currentUser = null;
let unsubscribeDashboard = null; // เก็บฟังก์ชันสำหรับคืนค่าหยุดฟังฐานข้อมูลเมื่อล็อกเอาต์

// ส่วนควบคุมแท็บเมนูสลับหน้าจอ (Tab UI Navigation)
const tabTest = document.getElementById('tab-test');
const tabDashboard = document.getElementById('tab-dashboard');
const pageTest = document.getElementById('page-test');
const pageDashboard = document.getElementById('page-dashboard');

tabTest.addEventListener('click', () => switchTab('test'));
tabDashboard.addEventListener('click', () => switchTab('dashboard'));

function switchTab(target) {
    if (target === 'test') {
        tabTest.className = "py-2 text-center rounded-lg bg-slate-800 text-amber-500 transition-all flex items-center justify-center gap-1";
        tabDashboard.className = "py-2 text-center rounded-lg text-slate-400 transition-all flex items-center justify-center gap-1";
        pageTest.classList.remove('hidden');
        pageDashboard.classList.add('hidden');
    } else {
        tabTest.className = "py-2 text-center rounded-lg text-slate-400 transition-all flex items-center justify-center gap-1";
        tabDashboard.className = "py-2 text-center rounded-lg bg-slate-800 text-amber-500 transition-all flex items-center justify-center gap-1";
        pageTest.classList.add('hidden');
        pageDashboard.classList.remove('hidden');
    }
}

// ==========================================
// 🔐 สมาชิกและล็อกอิน (แยกเก็บและฟังข้อมูล Dashboard รายบุคคล)
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('user-name').innerText = user.displayName;
        document.getElementById('user-avatar').src = user.photoURL;
        
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        switchTab('test'); // ล็อกอินเสร็จให้เด้งเข้าหน้าเทสก่อน
        lucide.createIcons();

        // 🟢 เรียกฟังข้อมูลจากคลาวด์แบบเจาะจงเฉพาะเจ้าของ UID สมาชิกคนนี้เท่านั้น
        listenToUserDashboard(user.uid);
    } else {
        currentUser = null;
        appScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        if (isRunning) stopTracking();
        if (unsubscribeDashboard) unsubscribeDashboard(); // หยุดดึงข้อมูลคลาวด์เมื่อออกระบบ
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } catch (e) { alert("ล็อกอินไม่สำเร็จ: " + e.message); }
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));


// ==========================================
// 📊 ฟังก์ชันระบบ REAL-TIME DASHBOARD & ระบบลบข้อมูล
// ==========================================
function listenToUserDashboard(uid) {
    // กรองหาข้อมูลในคอลเลกชัน "cpr_sessions" โดยเอาเฉพาะข้อมูลที่มี userId ตรงกับสมาชิกคนปัจจุบัน
    const q = query(
        collection(db, "cpr_sessions"),
        where("userId", "==", uid),
        orderBy("createdAt", "desc")
    );

    // ดึงและอัปเดต UI แบบ Real-time ทันทีที่มีการเพิ่มหรือลบ
    unsubscribeDashboard = onSnapshot(q, (snapshot) => {
        const listContainer = document.getElementById('dashboard-list');
        const emptyMsg = document.getElementById('dashboard-empty-msg');
        document.getElementById('session-count').innerText = `${snapshot.size} รายการ`;

        listContainer.innerHTML = ''; // ล้างลิสต์เก่าบนหน้าจอออกก่อนเพื่อวาดใหม่

        if (snapshot.empty) {
            emptyMsg.classList.remove('hidden');
            listContainer.appendChild(emptyMsg);
            return;
        }

        emptyMsg.classList.add('hidden');

        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const docId = docSnapshot.id;

            // แปลงรูปแบบวันที่ปั๊มให้สั้นและเข้าใจง่าย
            let dateText = "กำลังบันทึก...";
            if (data.createdAt) {
                dateText = data.createdAt.toDate().toLocaleDateString('th-TH', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }) + " น.";
            }

            // สร้างการ์ดแสดงผลสถิติแต่ละรอบขึ้นมา
            const itemCard = document.createElement('div');
            itemCard.className = "bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center gap-3 relative overflow-hidden group shadow-md";
            itemCard.innerHTML = `
                <div class="flex-1">
                    <div class="text-[10px] text-slate-400 mb-1 font-medium">${dateText}</div>
                    <div class="grid grid-cols-3 gap-2 text-center bg-slate-900/50 p-2 rounded-lg">
                        <div>
                            <span class="block text-[10px] text-slate-400">จำนวน</span>
                            <span class="text-sm font-bold text-amber-500">${data.totalCompressions || 0} ครั้ง</span>
                        </div>
                        <div>
                            <span class="block text-[10px] text-slate-400">เวลา</span>
                            <span class="text-sm font-bold text-slate-300">${data.durationSeconds || 0} วิ</span>
                        </div>
                        <div>
                            <span class="block text-[10px] text-slate-400">Max BPM</span>
                            <span class="text-sm font-bold text-emerald-400">${data.maxBPM || 0}</span>
                        </div>
                    </div>
                </div>
                <button class="btn-delete bg-rose-950/40 hover:bg-rose-600/90 text-rose-400 hover:text-white p-2 rounded-xl transition-all border border-rose-900/50" data-id="${docId}">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;

            listContainer.appendChild(itemCard);
        });

        // เปิดสิทธิ์ให้ปุ่มไอคอนลบแต่ละแถวทำงาน
        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                const idToDelete = button.getAttribute('data-id');
                deleteSessionLog(idToDelete);
            });
        });

        lucide.createIcons(); // โหลดไอคอนถังขยะขึ้นแสดงผล
    }, (error) => {
        console.error("Dashboard error:", error);
    });
}

// ❌ ฟังก์ชันสั่งลบข้อมูลเดี่ยวออกจาก Firestore
async function deleteSessionLog(id) {
    if (confirm("คุณแน่ใจใช่ไหมที่จะลบประวัติการทดสอบรอบนี้อย่างถาวร?")) {
        try {
            await deleteDoc(doc(db, "cpr_sessions", id));
            console.log("ลบประวัติออกจากคลาวด์แล้ว ID:", id);
        } catch (error) {
            alert("ไม่สามารถลบข้อมูลได้: " + error.message);
        }
    }
}


// ==========================================
// 🏎️ ระบบเซนเซอร์และการทำงานตรวจจับของคุณเดิม (เสถียรแล้ว)
// ==========================================
let isRunning = false;
let totalCount = 0;
let lastTapTime = 0;
let seconds = 0;
let timerInterval;
let maxBPMRecorded = 0;

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
        } catch (error) { return false; }
    }
    return true; 
}

async function startTracking() {
    const hasPermission = await requestSensorPermission();
    if (!hasPermission) { alert("จำเป็นต้องใช้สิทธิ์เข้าถึงเซนเซอร์"); return; }

    isRunning = true;
    isCalibrated = false; 
    btnAction.innerHTML = `<i data-lucide="square" fill="currentColor"></i> หยุดการทดสอบ`;
    btnAction.classList.replace('bg-amber-600', 'bg-red-600');
    lucide.createIcons();

    totalCount = 0; seconds = 0; lastTapTime = 0; lastTotalForce = 0; maxBPMRecorded = 0; isPeak = false;
    totalCompressions.innerText = "0"; timerText.innerText = "00:00"; bpmValue.innerText = "0"; bpmBar.style.width = "0%";
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

    saveDataToFirestore();
}

function handleOrientation(event) {
    if (!isRunning) return;
    let currentBeta = event.beta || 0; 
    if (!isCalibrated) { initialBeta = currentBeta; isCalibrated = true; }
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
    let x = acc.x; let y = acc.y; let z = acc.z;

    if (x === null || y === null || z === null) {
        let accG = event.accelerationIncludingGravity || {};
        x = accG.x || 0; y = accG.y || 0; z = (accG.z || 9.8) - 9.8; 
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
                        if (calculatedBPM > maxBPMRecorded) maxBPMRecorded = calculatedBPM;
                    }
                }
            } else { lastTapTime = now; }
        }
    } else if (deltaForce < (ACCEL_DELTA_THRESHOLD * 0.5)) { isPeak = false; }
    lastTotalForce = currentTotalForce;
}

function updateBPMUI(bpm) {
    bpmValue.innerText = bpm;
    if (bpm >= 100 && bpm <= 120) {
        bpmValue.className = "text-6xl font-black text-green-400";
        bpmBar.className = "bg-green-400 h-full transition-all duration-300"; bpmBar.style.width = "100%";
        bpmStatus.innerText = "จังหวะตรงตามเกณฑ์ CPR (100-120)"; bpmStatus.className = "text-sm font-medium text-green-400 mt-2";
    } else if (bpm < 100) {
        bpmValue.className = "text-6xl font-black text-sky-400";
        bpmBar.className = "bg-sky-400 h-full transition-all duration-300"; bpmBar.style.width = "50%";
        bpmStatus.innerText = "ความเร็วช้าไปนิด"; bpmStatus.className = "text-sm font-medium text-sky-400 mt-2";
    } else {
        bpmValue.className = "text-6xl font-black text-rose-500";
        bpmBar.className = "bg-rose-500 h-full transition-all duration-300"; bpmBar.style.width = "100%";
        bpmStatus.innerText = "ความเร็วเร็วเกินไป"; bpmStatus.className = "text-sm font-medium text-rose-500 mt-2";
    }
}

async function saveDataToFirestore() {
    if (!currentUser || totalCount === 0) return;
    try {
        await addDoc(collection(db, "cpr_sessions"), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: currentUser.displayName,
            totalCompressions: totalCount,
            durationSeconds: seconds,
            maxBPM: maxBPMRecorded,
            createdAt: serverTimestamp()
        });
        console.log("บันทึกประวัติสำเร็จ");
    } catch (e) { console.error("บันทึกผิดพลาด:", e); }
}

btnAction.addEventListener('click', () => {
    if (!isRunning) startTracking(); else stopTracking();
});
