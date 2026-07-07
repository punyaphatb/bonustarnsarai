// ประกาศตัวแปรเหล่านี้ไว้ด้านบนสุดของไฟล์ (นอกฟังก์ชัน handleMotion)
let lastTotalForce = 0;
let isPeak = false;
let lastTapTime = 0;
let totalCount = 0;
let maxBPMRecorded = 0;

// ตัวแปรที่เพิ่มเข้ามาใหม่เพื่อกรองสัญญาณ (Filter)
let forceHistory = []; 
const FILTER_WINDOW = 5; // เก็บค่า 5 รอบล่าสุดมาเฉลี่ยเพื่อลด Noise
import { initializeApp } from "firebase/app";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    updateProfile, signOut, onAuthStateChanged 
} from "firebase/auth";
import { 
    getFirestore, collection, addDoc, serverTimestamp, 
    query, where, orderBy, onSnapshot, doc, deleteDoc 
} from "firebase/firestore";

// 🛠️ วาง Firebase Config ของคุณตามปกติที่นี่
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

const loginScreen = document.getElementById('login-screen');
const registerScreen = document.getElementById('register-screen');
const appScreen = document.getElementById('app-screen');
const btnSaveManual = document.getElementById('btn-save-manual');

let currentUser = null;
let unsubscribeDashboard = null;

// ==========================================
// 🔐 AUTHENTICATION SYSTEM
// ==========================================
document.getElementById('go-to-register').addEventListener('click', () => {
    loginScreen.classList.add('hidden');
    registerScreen.classList.remove('hidden');
});
document.getElementById('go-to-login').addEventListener('click', () => {
    registerScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
});

document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        alert("สมัครสมาชิกสำเร็จระบบจะนำคุณเข้าใช้งานอัตโนมัติ");
        document.getElementById('form-register').reset();
    } catch (error) { alert("สมัครสมาชิกไม่สำเร็จ: " + error.message); }
});

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        document.getElementById('form-login').reset();
    } catch (error) { alert("อีเมลหรือรหัสผ่านไม่ถูกต้อง: " + error.message); }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('user-name').innerText = user.displayName || 'User';
        document.getElementById('user-avatar-fallback').innerText = (user.displayName || 'U').charAt(0);
        loginScreen.classList.add('hidden');
        registerScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        switchTab('test');
        lucide.createIcons();
        listenToUserDashboard(user.uid);
    } else {
        currentUser = null;
        appScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        if (isRunning) stopTracking();
        if (unsubscribeDashboard) unsubscribeDashboard();
    }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// ==========================================
// 🗺️ 4-TABS NAVIGATION CONTROLLER 
// ==========================================
const tabs = {
    test: { btn: document.getElementById('tab-test'), page: document.getElementById('page-test') },
    dashboard: { btn: document.getElementById('tab-dashboard'), page: document.getElementById('page-dashboard') },
    guide: { btn: document.getElementById('tab-guide'), page: document.getElementById('page-guide') },
    criteria: { btn: document.getElementById('tab-criteria'), page: document.getElementById('page-criteria') }
};

Object.keys(tabs).forEach(key => {
    tabs[key].btn.addEventListener('click', () => switchTab(key));
});

// ค้นหาฟังก์ชัน switchTab เดิมใน app.js แล้วแทนที่ด้วยตัวนี้ (เพื่อสลับแท็บให้สีเปลี่ยนสวยงาม)
function switchTab(targetKey) {
    Object.keys(tabs).forEach(key => {
        if (key === targetKey) {
            tabs[key].btn.className = "py-2.5 rounded-xl bg-slate-800 text-amber-400 shadow-md transition-all flex flex-col items-center gap-1";
            tabs[key].page.classList.remove('hidden');
        } else {
            tabs[key].btn.className = "py-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-all flex flex-col items-center gap-1";
            tabs[key].page.classList.add('hidden');
        }
    });
}

// ==========================================
// 📊 REAL-TIME DASHBOARD (FETCH & DELETE)
// ==========================================
function listenToUserDashboard(uid) {
    const q = query(collection(db, "cpr_sessions"), where("userId", "==", uid), orderBy("createdAt", "desc"));
    unsubscribeDashboard = onSnapshot(q, (snapshot) => {
        const listContainer = document.getElementById('dashboard-list');
        const emptyMsg = document.getElementById('dashboard-empty-msg');
        document.getElementById('session-count').innerText = `${snapshot.size} รายการ`;
        listContainer.innerHTML = '';

        if (snapshot.empty) { emptyMsg.classList.remove('hidden'); listContainer.appendChild(emptyMsg); return; }
        emptyMsg.classList.add('hidden');

        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const docId = docSnapshot.id;
            let dateText = "กำลังบันทึก...";
            if (data.createdAt) {
                dateText = data.createdAt.toDate().toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + " น.";
            }

            const itemCard = document.createElement('div');
            itemCard.className = "bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center gap-3 shadow-sm";
            itemCard.innerHTML = `
                <div class="flex-1">
                    <div class="text-[10px] text-slate-400 mb-1">${dateText}</div>
                    <div class="grid grid-cols-3 gap-2 text-center bg-slate-900/50 p-1.5 rounded-lg text-xs">
                        <div><span class="block text-[9px] text-slate-400">จำนวน</span><span class="font-bold text-amber-500">${data.totalCompressions || 0} ครั้ง</span></div>
                        <div><span class="block text-[9px] text-slate-400">เวลา</span><span class="font-bold text-slate-300">${data.durationSeconds || 0} วิ</span></div>
                        <div><span class="block text-[9px] text-slate-400">Max BPM</span><span class="font-bold text-emerald-400">${data.maxBPM || 0}</span></div>
                    </div>
                </div>
                <button class="btn-delete bg-rose-950/40 hover:bg-rose-600 text-rose-400 hover:text-white p-2 rounded-xl transition-all border border-rose-900/50" data-id="${docId}">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            `;
            listContainer.appendChild(itemCard);
        });

        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', () => deleteSessionLog(button.getAttribute('data-id')));
        });
        lucide.createIcons();
    });
}

async function deleteSessionLog(id) {
    if (confirm("คุณแน่ใจใช่ไหมที่จะลบประวัติการทดสอบรอบนี้?")) {
        try { await deleteDoc(doc(db, "cpr_sessions", id)); } catch (e) { alert("ลบไม่ได้: " + e.message); }
    }
}

// ==========================================
// 🏎️ SENSOR TRACKING CORE (WITH MANUAL SAVE)
// ==========================================
let isRunning = false;
let totalCount = 0;
let lastTapTime = 0;
let seconds = 0;
let timerInterval;
let maxBPMRecorded = 0;

let initialGamma = 0;
let initialBeta = 0;
let isCalibrated = false;
let lastTotalForce = 0;
let isPeak = false;

const ACCEL_DELTA_THRESHOLD = 0.7; 
const DEBOUNCE_TIME = 1000;         

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
        try { const permissionState = await DeviceOrientationEvent.requestPermission(); return permissionState === 'granted'; } catch (e) { return false; }
    }
    return true; 
}

async function startTracking() {
    const hasPermission = await requestSensorPermission();
    if (!hasPermission) { alert("จำเป็นต้องใช้สิทธิ์เข้าถึงเซนเซอร์"); return; }

    isRunning = true; isCalibrated = false; 
    btnAction.innerHTML = `<i data-lucide="square" fill="currentColor" class="w-5 h-5"></i> หยุดการทดสอบ`;
    btnAction.classList.replace('bg-amber-600', 'bg-red-600');
    btnSaveManual.classList.add('hidden'); // ซ่อนปุ่มเซฟไว้ตอนกำลังวิ่งเทสอยู่
    lucide.createIcons();

    totalCount = 0; seconds = 0; lastTapTime = 0; lastTotalForce = 0; maxBPMRecorded = 0; isPeak = false;
    totalCompressions.innerText = "0"; timerText.innerText = "00:00"; bpmValue.innerText = "0"; bpmBar.style.width = "0%";
    bpmStatus.innerText = "กำลังทดสอบ...";

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
    btnAction.innerHTML = `<i data-lucide="play" fill="currentColor" class="w-5 h-5"></i> เริ่มการทดสอบความไวสูง`;
    btnAction.classList.replace('bg-red-600', 'bg-amber-600');
    lucide.createIcons();

    clearInterval(timerInterval);
    window.removeEventListener('deviceorientation', handleOrientation);
    window.removeEventListener('devicemotion', handleMotion);

    // 🟢 แสดงปุ่มเซฟแบบเลือกเองแทนการอัปโหลดอัตโนมัติ (Manual Save Trigger)
    if (totalCount > 0) {
        btnSaveManual.classList.remove('hidden');
        bpmStatus.innerText = `การทดสอบหยุดแล้ว สรุปผลปั๊มได้ ${totalCount} ครั้ง (Max BPM: ${maxBPMRecorded})`;
    } else {
        bpmStatus.innerText = "การทดสอบสิ้นสุด (ไม่มีข้อมูลการปั๊มจับค่าได้)";
    }
}

// 💾 ฟังปุ่มกดบันทึกแบบเลือกเอง (Manual Save)
btnSaveManual.addEventListener('click', async () => {
    if (!currentUser || totalCount === 0) return;
    btnSaveManual.disabled = true;
    btnSaveManual.innerText = "กำลังอัปโหลดส่งคลาวด์...";
    try {
        await addDoc(collection(db, "cpr_sessions"), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: currentUser.displayName || 'User',
            totalCompressions: totalCount,
            durationSeconds: seconds,
            maxBPM: maxBPMRecorded,
            createdAt: serverTimestamp()
        });
        alert("บันทึกสถิติลงแดชบอร์ดสำเร็จเรียบร้อยแล้ว!");
        btnSaveManual.classList.add('hidden'); // ซ่อนปุ่มไปหลังจากเซฟเสร็จแล้ว
    } catch (e) { 
        alert("บันทึกผิดพลาด: " + e.message); 
    } finally {
        btnSaveManual.disabled = false;
        btnSaveManual.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> บันทึกผลการทดสอบรอบนี้ลงคลาวด์`;
        lucide.createIcons();
    }
});

// ฟังก์ชันประมวลผลเซนเซอร์คงเดิม (เสถียรแล้ว)
function handleOrientation(event) {
    if (!isRunning) return;

    // เปลี่ยนจาก beta ตัวเดียว เป็นการวัดความเอียงจากแนวระนาบ (0,0)
    let currentBeta = event.beta || 0; // เอียงหน้า-หลัง
    let currentGamma = event.gamma || 0; // เอียงซ้าย-ขวา

    if (!isCalibrated) { 
        initialBeta = currentBeta; 
        initialGamma = currentGamma; // สมมติว่ามีตัวแปรนี้เพิ่มขึ้นมา
        isCalibrated = true; 
    }

    // คำนวณความเบี่ยงเบนจากจุดเริ่มต้น (ใช้ทฤษฎีบทพีทาโกรัสเพื่อให้ได้มุมเอียงรวม)
    let diffBeta = currentBeta - initialBeta;
    let diffGamma = currentGamma - initialGamma;
    let relativeAngle = Math.round(Math.sqrt(diffBeta * diffBeta + diffGamma * diffGamma));

    angleValue.innerText = relativeAngle + "°";
    // ปรับการหมุน indicator ให้ตอบสนองทั้งสองแกน (หรือจะเลือกหมุนตามแกนหลักก็ได้)
    angleIndicator.style.transform = `rotate(${Math.atan2(diffGamma, diffBeta) * 180 / Math.PI}deg)`;

    // ปรับเกณฑ์เป็น 3 องศา ตามที่ต้องการ
    if (Math.abs(relativeAngle) <= 3) {
        angleValue.className = "text-5xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]";
        angleIndicator.className = "w-1 h-6 bg-emerald-400 absolute rounded-full origin-center transition-transform duration-200 shadow-[0_0_8px_#34d399]";
        angleStatus.innerText = "ระนาบสมดุลดีเยี่ยม (Safe Zone)";
        angleStatus.className = "text-xs font-semibold text-emerald-400 mt-2";
    } else {
        angleValue.className = "text-5xl font-black text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]";
        angleIndicator.className = "w-1 h-6 bg-orange-500 absolute rounded-full origin-center transition-transform duration-200 shadow-[0_0_8px_#f97316]";
        angleStatus.innerText = "เครื่องเอียงเกิน 3 องศา! กรุณาวางให้ราบ";
        angleStatus.className = "text-xs font-semibold text-orange-400 mt-2";
    }
}
//ความลึก 
function handleMotion(event) {
    if (!isRunning) return;

    let acc = event.acceleration || {};
    let x = acc.x; let y = acc.y; let z = acc.z;

    // แก้ไขจุดที่ 2: ปรับปรุงการคำนวณกรณีต้องใช้ accelerationIncludingGravity
    if (x === null || y === null || z === null) {
        let accG = event.accelerationIncludingGravity || {};
        // แทนที่จะลบ 9.8 แค่แกน Z ตรงๆ (ซึ่งจะเพี้ยนเวลาเอียงเครื่อง) 
        // เราจะเอาค่าดิบมาคำนวณ แล้วค่อยไปหักลบเวกเตอร์รวมของแรงโน้มถ่วงในภายหลังแทน
        x = accG.x || 0; 
        y = accG.y || 0; 
        z = accG.z || 9.8; 
    }

    // คำนวณหาแรงรวมดิบ (Raw Total Force)
    let rawTotalForce = Math.sqrt(x*x + y*y + z*z);

    // แก้ไขจุดที่ 3: ใช้ Moving Average Filter เพื่อลดสัญญาณรบกวน (Noise)
    forceHistory.push(rawTotalForce);
    if (forceHistory.length > FILTER_WINDOW) {
        forceHistory.shift(); // เอาค่าเก่าสุดออกเพื่อรักษาขนาดตารางกรองสัญญาณ
    }
    
    // หาค่าเฉลี่ยของแรงเพื่อความนิ่ง
    let currentTotalForce = forceHistory.reduce((sum, val) => sum + val, 0) / forceHistory.length;

    // หักลบค่าแรงโน้มถ่วงมาตรฐาน (ประมาณ 9.8) หากใช้เซนเซอร์ที่รวมแรงโน้มถ่วงมา
    if (acc.x === null) {
        currentTotalForce = Math.abs(currentTotalForce - 9.8);
    }

    // คำนวณความต่างของแรงเมื่อเทียบกับรอบก่อนหน้า
    let deltaForce = Math.abs(currentTotalForce - lastTotalForce);

    // ตรวจสอบเงื่อนไขการเกิด Peak (การกดลงไปหนักๆ)
    if (deltaForce > ACCEL_DELTA_THRESHOLD) {
        if (!isPeak) {
            isPeak = true; // ล็อกไว้ไม่ให้นับซ้ำในสัญญาณระลอกเดียวกัน
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
                        if (calculatedBPM > maxBPMRecorded) {
                            maxBPMRecorded = calculatedBPM;
                        }
                    }
                }
            } else {
                // สำหรับการกดครั้งแรกสุดของระบบ
                lastTapTime = now;
            }
        }
    } else {
        // แก้ไขจุดที่ 1: เมื่อแรงลดลงต่ำกว่า ACCEL_DELTA_THRESHOLD (ผ่านจุดสูงสุดไปแล้ว)
        // จะรีเซ็ตค่ากลับมาเป็น false เพื่อเตรียมพร้อมรับแรงกระแทกในครั้งถัดไป
        isPeak = false;
    }

    // บันทึกค่าแรงรวมรอบนี้ ไว้เปรียบเทียบในรอบถัดไป
    lastTotalForce = currentTotalForce;
}
            } else { lastTapTime = now; }
        }
    } else if (deltaForce < (ACCEL_DELTA_THRESHOLD * 0.5)) { isPeak = false; }
    lastTotalForce = currentTotalForce;
}

function updateBPMUI(bpm) {
    const bpmTopBar = document.getElementById('bpm-top-bar');
    bpmValue.innerText = bpm;
    
    if (bpm >= 100 && bpm <= 120) {
        bpmValue.className = "text-6xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)] animate-pulse";
        bpmBar.className = "bg-emerald-400 h-full rounded-full transition-all duration-300"; bpmBar.style.width = "100%";
        bpmTopBar.className = "absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_2px_10px_rgba(52,211,153,0.5)]";
        bpmStatus.innerText = "ความเร็วเยี่ยม! อยู่ในเกณฑ์มาตรฐานสากล 100-120"; bpmStatus.className = "text-xs font-semibold text-emerald-400 mt-2";
    } else if (bpm < 100) {
        bpmValue.className = "text-6xl font-black text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.3)]";
        bpmBar.className = "bg-sky-400 h-full rounded-full transition-all duration-300"; bpmBar.style.width = "55%";
        bpmTopBar.className = "absolute top-0 left-0 w-full h-1 bg-sky-500 shadow-[0_2px_10px_rgba(56,189,248,0.5)]";
        bpmStatus.innerText = "ความเร็วช้าเกินไปเล็กน้อย เพิ่มจังหวะอีกนิด"; bpmStatus.className = "text-xs font-semibold text-sky-400 mt-2";
    } else {
        bpmValue.className = "text-6xl font-black text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]";
        bpmBar.className = "bg-rose-500 h-full rounded-full transition-all duration-300"; bpmBar.style.width = "100%";
        bpmTopBar.className = "absolute top-0 left-0 w-full h-1 bg-rose-500 shadow-[0_2px_10px_rgba(244,63,94,0.5)]";
        bpmStatus.innerText = "ความเร็วรัวเกินไปแล้ว! ผ่อนจังหวะลงมาหน่อย"; bpmStatus.className = "text-xs font-semibold text-rose-400 mt-2";
    }
}
btnAction.addEventListener('click', () => { if (!isRunning) startTracking(); else stopTracking(); });
