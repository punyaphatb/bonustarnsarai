// ตั้งค่า Supabase (ใส่ URL และ Key ของคุณ)
const supabase = supabase.createClient('https://ezvckfrdvqwluplwbekv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dmNrZnJkdnF3bHVwbHdiZWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzY3MTEsImV4cCI6MjA5OTAxMjcxMX0.A0Kknw6bdNG6h3PP4BF7-zLag_0kK6-_0rIfNZwOgmA');

// --- ตัวแปรควบคุม ---
let currentUser = null;
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

// --- DOM Elements ---
const loginScreen = document.getElementById('login-screen');
const registerScreen = document.getElementById('register-screen');
const appScreen = document.getElementById('app-screen');
const btnSaveManual = document.getElementById('btn-save-manual');
const btnAction = document.getElementById('btn-action');
const bpmValue = document.getElementById('bpm-value');
const bpmBar = document.getElementById('bpm-bar');
const bpmStatus = document.getElementById('bpm-status');
const angleValue = document.getElementById('angle-value');
const angleIndicator = document.getElementById('angle-indicator');
const angleStatus = document.getElementById('angle-status');
const totalCompressions = document.getElementById('total-compressions');
const timerText = document.getElementById('timer');

// --- 1. AUTHENTICATION ---
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        document.getElementById('user-name').innerText = currentUser.user_metadata.display_name || 'User';
        loginScreen.classList.add('hidden');
        registerScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        listenToUserDashboard(currentUser.id);
    } else {
        appScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
    }
});

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ 
        email: document.getElementById('login-email').value, 
        password: document.getElementById('login-password').value 
    });
    if (error) alert(error.message);
});

document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ 
        email: document.getElementById('reg-email').value, 
        password: document.getElementById('reg-password').value,
        options: { data: { display_name: document.getElementById('reg-name').value } }
    });
    if (error) alert(error.message); else alert("สมัครสำเร็จ!");
});

document.getElementById('btn-logout').addEventListener('click', () => supabase.auth.signOut());

// --- 2. REAL-TIME DASHBOARD ---
function listenToUserDashboard(uid) {
    const fetchDashboard = async () => {
        const { data } = await supabase.from('cpr_sessions').select('*').eq('userId', uid).order('createdAt', { ascending: false });
        const listContainer = document.getElementById('dashboard-list');
        listContainer.innerHTML = '';
        data?.forEach(item => {
            const div = document.createElement('div');
            div.className = "bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center";
            div.innerHTML = `<div><div class="text-xs font-bold">${item.totalCompressions} ครั้ง / ${item.maxBPM} BPM</div></div>
                             <button onclick="deleteSession('${item.id}')" class="text-rose-400">ลบ</button>`;
            listContainer.appendChild(div);
        });
    };
    fetchDashboard();
    supabase.channel('public:cpr_sessions').on('postgres_changes', { event: '*', schema: 'public', table: 'cpr_sessions' }, fetchDashboard).subscribe();
}

window.deleteSession = async (id) => { await supabase.from('cpr_sessions').delete().eq('id', id); };

// --- 3. SENSOR TRACKING ---
async function startTracking() {
    isRunning = true; isCalibrated = false; totalCount = 0; seconds = 0; maxBPMRecorded = 0;
    btnAction.innerHTML = "หยุดการทดสอบ";
    btnAction.classList.replace('bg-amber-600', 'bg-red-600');
    
    timerInterval = setInterval(() => {
        seconds++;
        timerText.innerText = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
    }, 1000);

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);
}

function stopTracking() {
    isRunning = false; clearInterval(timerInterval);
    btnAction.innerHTML = "เริ่มการทดสอบ";
    btnAction.classList.replace('bg-red-600', 'bg-amber-600');
    window.removeEventListener('deviceorientation', handleOrientation);
    window.removeEventListener('devicemotion', handleMotion);
    if (totalCount > 0) btnSaveManual.classList.remove('hidden');
}

function handleOrientation(event) {
    if (!isRunning) return;
    let currentBeta = event.beta || 0;
    if (!isCalibrated) { initialBeta = currentBeta; isCalibrated = true; }
    let relativeAngle = Math.round(currentBeta - initialBeta);
    angleValue.innerText = Math.abs(relativeAngle) + "°";
    angleIndicator.style.transform = `rotate(${relativeAngle}deg)`;
}

function handleMotion(event) {
    if (!isRunning) return;
    let acc = event.acceleration || {x:0, y:0, z:0};
    let currentTotalForce = Math.sqrt((acc.x||0)**2 + (acc.y||0)**2 + (acc.z||0)**2);
    if (Math.abs(currentTotalForce - lastTotalForce) > 0.5) {
        if (!isPeak) {
            isPeak = true;
            let now = Date.now();
            if (lastTapTime > 0 && (now - lastTapTime) > 500) {
                let bpm = Math.round(60000 / (now - lastTapTime));
                if (bpm >= 30 && bpm <= 400) {
                    totalCount++;
                    totalCompressions.innerText = totalCount;
                    bpmValue.innerText = bpm;
                    maxBPMRecorded = Math.max(maxBPMRecorded, bpm);
                }
            }
            lastTapTime = now;
        }
    } else if (Math.abs(currentTotalForce - lastTotalForce) < 0.2) isPeak = false;
    lastTotalForce = currentTotalForce;
}

btnAction.addEventListener('click', () => isRunning ? stopTracking() : startTracking());

btnSaveManual.addEventListener('click', async () => {
    await supabase.from('cpr_sessions').insert([{ userId: currentUser.id, totalCompressions: totalCount, durationSeconds: seconds, maxBPM: maxBPMRecorded }]);
    alert("บันทึกสำเร็จ!");
    btnSaveManual.classList.add('hidden');
});
