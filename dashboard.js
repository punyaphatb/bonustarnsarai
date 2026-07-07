export async function initDashboard(supabase, uid) {
    const listContainer = document.getElementById('dashboard-list');
    const emptyMsg = document.getElementById('dashboard-empty-msg');

    async function fetchDashboard() {
        const { data, error } = await supabase
            .from('cpr_sessions')
            .select('*')
            .eq('userId', uid)
            .order('createdAt', { ascending: false });

        if (error) return;
        
        listContainer.innerHTML = '';
        document.getElementById('session-count').innerText = `${data.length} รายการ`;
        if (data.length === 0) { listContainer.appendChild(emptyMsg); return; }

        data.forEach(item => {
            const div = document.createElement('div');
            div.className = "bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center gap-3";
            div.innerHTML = `
                <div class="flex-1">
                    <div class="text-[10px] text-slate-400">${new Date(item.createdAt).toLocaleDateString('th-TH')}</div>
                    <div class="grid grid-cols-3 gap-2 text-center bg-slate-900/50 p-1.5 rounded-lg text-xs">
                        <div><span class="block text-[9px]">จำนวน</span><span class="font-bold text-amber-500">${item.totalCompressions} ครั้ง</span></div>
                        <div><span class="block text-[9px]">เวลา</span><span class="font-bold text-slate-300">${item.durationSeconds} วิ</span></div>
                        <div><span class="block text-[9px]">Max BPM</span><span class="font-bold text-emerald-400">${item.maxBPM}</span></div>
                    </div>
                </div>
                <button onclick="deleteSession('${item.id}')" class="bg-rose-950/40 p-2 rounded-xl text-rose-400"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>`;
            listContainer.appendChild(div);
        });
        lucide.createIcons();
    }

    fetchDashboard();
    return supabase.channel('cpr_sessions').on('postgres_changes', { event: '*', schema: 'public', table: 'cpr_sessions' }, fetchDashboard).subscribe();
}