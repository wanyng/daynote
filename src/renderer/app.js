const icons={logo:'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 1.5 1.5 M19 5l-1.5 1.5 M6.5 17.5 1.5 1.5',history:'M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2',chevronLeft:'m14 6-6 6 6 6',chevronRight:'m10 6 6 6-6 6',arrowRight:'M4 12h16 m-6-6 6 6-6 6',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',panel:'M3 4h18v16H3z M15 4v16 M6 8h5 M6 12h5',checkCircle:'M21 11a9 9 0 1 1-5-7 M8 11l4 4L21 5',trend:'m3 16 6-6 4 4 8-9 M15 5h6v6',grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',book:'M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1z M12 5v15',more:'M5 12h.1 M12 12h.1 M19 12h.1',chart:'M4 20V4 M4 20h17 M8 16v-4 M13 16V7 M18 16v-7',pen:'m15 4 5 5 M4 15 16 3a2 2 0 0 1 5 5L9 20l-6 1z',target:'M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5 M12 12l9-9 M17 3h4v4',plus:'M12 5v14 M5 12h14',close:'m6 6 12 12 M18 6 6 18',expand:'M14 3h7v7 M21 3l-9 9 M10 3H3v18h18v-7',flame:'M13 3c1 5-4 6-3 10-2-1-3-2-3-4-5 5-3 12 5 12 9 0 10-10 1-18z',leaf:'M20 3C6 2 1 8 5 16c8 8 17 1 15-13z M5 20 16 9',bolt:'m13 2-9 12h7l-1 8L21 9h-8z',coffee:'M4 7h13v9a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z M17 8h2a3 3 0 0 1 0 6h-2 M7 2v2 M12 2v2',briefcase:'M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3',home:'m3 11 9-8 9 8 M5 9v12h14V9 M9 21v-8h6v8',learn:'m2 8 10-5 10 5-10 5z M6 11v7q6 5 12 0v-7 M22 8v8',health:'m2 12 5 0 3-8 4 16 3-8h5'};
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
function icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]||icons.target}"/></svg>`}
function fillIcons(root=document){$$('[data-icon]',root).forEach(el=>el.innerHTML=icon(el.dataset.icon))}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function parseDate(s){return new Date(s+'T12:00:00')}
function plusDays(s,n){const d=parseDate(s);d.setDate(d.getDate()+n);return dateKey(d)}
let today=dateKey(new Date());
let monday=plusDays(today,-((parseDate(today).getDay()+6)%7));
let sunday=plusDays(monday,6);
let selectedDate=today,calendarMonth=parseDate(today),activeView='today';
const STORAGE_KEY='daynote-ui-v1';
function seed(){
 const tasks=[
  ['整理项目方案，确认最终版本',1,'work',false],['发送本周项目进度',1,'work',true],
  ['梳理下一阶段的学习计划',2,'work',false],['阅读《深度工作》30 分钟',2,'life',false],['晨间拉伸 15 分钟',2,'life',true],
  ['回复合作方的确认邮件',3,'work',false],['预约周末的牙齿检查',3,'life',true],['整理收藏夹里的文章',4,'life',false]
 ].map((t,i)=>({id:'t'+i,title:t[0],q:t[1],done:t[3],planned:today,due:today}));
 for(let i=0;i<8;i++)tasks.push({id:'h'+i,title:['整理项目需求','完成周报复盘','复习英语单词','阅读并整理笔记','运动 30 分钟','整理本月预算','规划下周工作','整理读书笔记'][i],q:i%4+1,done:i<6,planned:i<6?plusDays(today,-(i%2+1)):plusDays(today,1),due:i<6?monday:sunday});
 return {version:1,tasks,book:{title:'深度工作',author:'卡尔·纽波特',current:126,total:280},notes:{[monday]:'这周把注意力放回重要的事上。\n保持阅读，也给自己留一点余地。'},goals:[{id:'g1',name:'阅读',icon:'book',weekText:'读完 100 页，记录 2 条感想',week:60,totalText:'今年读完 12 本书',total:42},{id:'g2',name:'学习',icon:'learn',weekText:'完成 3 节课程，整理学习笔记',week:67,totalText:'完成专业课程的 6 个章节',total:35},{id:'g3',name:'运动',icon:'health',weekText:'运动 3 次，每次 30 分钟',week:33,totalText:'建立连续 12 周的运动习惯',total:25}],opacity:.77};
}
let state,revision=0,canPersist=true;
if(window.daynote){const snapshot=window.daynote.read();if(!snapshot.ok)throw Error(snapshot.error);state=snapshot.state;revision=snapshot.revision;}
else{try{const loaded=JSON.parse(localStorage.getItem(STORAGE_KEY));state=loaded?.version===1&&Array.isArray(loaded.tasks)&&loaded.book&&Array.isArray(loaded.goals)&&loaded.notes?loaded:seed()}catch{state=seed();canPersist=false}}
state.tasks.forEach(task=>delete task.category);
const copyFields=[
 ['title','今日页面标题','把今天，安排得刚刚好。'],
 ['subtitle','今日页面说明','专注重要的事，也照顾生活的小事。'],
 ['futureTitle','其他日期的页面标题','给这一天，留一点期待。'],
 ['historyTitle','历史记录页面标题','回看，也是一种前进。'],
 ['historySubtitle','历史记录页面说明','完成的事值得记录，未完成的事可以重新安排。'],
 ['sidebar','侧栏寄语','给重要的事，\n留一点时间。'],
 ['goalsHeading','目标区域标题','一点点，向前走'],
 ['q1','重要且紧急 · 说明','优先处理 · 给当下一个交代'],
 ['q2','重要不紧急 · 说明','从容推进 · 为长期留出时间'],
 ['q3','紧急不重要 · 说明','集中处理 · 减少注意力切换'],
 ['q4','不重要不紧急 · 说明','有空再做 · 不必急于完成'],
 ['empty','象限为空时的提示','留一点空白，给真正重要的事。'],
 ['reading','阅读寄语','慢慢读，有所获'],
 ['cover','书封小字','把时间留给思考'],
 ['footer','底部寄语','每一个小小的完成，都算数。'],
 ['signature','底部署名','DAYNOTE / 把日子过成喜欢的样子']
];
state.copy={...Object.fromEntries(copyFields.map(([key,,value])=>[key,value])),...state.copy};
function renderCopy(){
 $('#page-title').textContent=state.copy[activeView==='history'?'historyTitle':selectedDate===today?'title':'futureTitle'];
 $('#page-subtitle').textContent=state.copy[activeView==='history'?'historySubtitle':'subtitle'];
 $('.sidebar-note p').textContent=state.copy.sidebar;
 $('.goals-section .section-heading h2').innerHTML=icon('target')+escapeHtml(state.copy.goalsHeading);
 $('.book-badge').textContent=state.copy.reading;
 $('.book-cover small').textContent=state.copy.cover;
 $('.app-footer>span:first-child').innerHTML='<span class="small-dot"></span>'+escapeHtml(state.copy.footer);
 $('#footer-date').textContent=state.copy.signature;
}
function save(){
 if(window.daynote){const result=window.daynote.save(state,revision);if(!result.ok){$('#save-status').textContent='尚未保存';if(result.state){applySnapshot(result)}toast(result.error);return false}revision=result.revision;$('#save-status').textContent='已保存在本机';return true}
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$('#save-status').textContent='已保存在本机';return true}catch{canPersist=false;$('#save-status').textContent='当前仅保存在本次预览';return false}
}
function applySnapshot(snapshot){state=snapshot.state;revision=snapshot.revision;state.copy={...Object.fromEntries(copyFields.map(([key,,value])=>[key,value])),...state.copy};render();$('#weekly-note').value=state.notes[monday]||'';}
const quadrants=[{id:1,title:'重要且紧急',description:'优先处理 · 给当下一个交代',icon:'flame'},{id:2,title:'重要不紧急',description:'从容推进 · 为长期留出时间',icon:'leaf'},{id:3,title:'紧急不重要',description:'集中处理 · 减少注意力切换',icon:'bolt'},{id:4,title:'不重要不紧急',description:'有空再做 · 不必急于完成',icon:'coffee'}];
function tasksOn(date){return state.tasks.filter(t=>t.planned===date)}
function weeklyTasks(){return state.tasks.filter(t=>t.due>=monday&&t.due<=sunday)}
function rate(done,total){return total?Math.round(done/total*100):0}
function shortDate(s){const d=parseDate(s);return `${d.getMonth()+1}月${d.getDate()}日`}
function taskMarkup(t,widget=false){return `<li class="task-row ${t.done?'done':''}" data-task="${escapeHtml(t.id)}"><input type="checkbox" aria-label="${escapeHtml(t.title)}" ${t.done?'checked':''}><span class="task-content" data-edit-task="${escapeHtml(t.id)}" title="点击编辑任务及日期"><span class="task-title">${escapeHtml(t.title)}</span></span><button class="task-edit" data-edit-task="${escapeHtml(t.id)}" aria-label="编辑任务 ${escapeHtml(t.title)}">${icon('pen')}</button></li>`}
function renderCalendar(){const year=calendarMonth.getFullYear(),month=calendarMonth.getMonth();$('#month-label').textContent=`${year}年 ${month+1}月`;const start=(new Date(year,month,1).getDay()+6)%7;const total=new Date(year,month+1,0).getDate();$('#calendar-days').innerHTML='<span class="blank"></span>'.repeat(start)+Array.from({length:total},(_,i)=>{const key=dateKey(new Date(year,month,i+1));return `<button class="${key===today?'today ':''}${key===selectedDate?'selected':''}" data-date="${key}" aria-label="${key}" ${key===selectedDate?'aria-pressed="true"':''}>${i+1}</button>`}).join('')}
function renderStats(){const tt=tasksOn(today),done=tt.filter(t=>t.done).length,week=weeklyTasks(),wd=week.filter(t=>t.done).length;$('#today-done').textContent=done;$('#today-total').textContent=' / '+tt.length;$('#today-bar').style.width=rate(done,tt.length)+'%';$('#week-rate').innerHTML=week.length?`${rate(wd,week.length)}<span class="percent">%</span>`:'—';$('#week-rate').title=week.length?`${wd} 个已完成 / ${week.length} 个本周截止计划`:'本周暂无截止计划';$('#weekly-done').textContent=wd;$('#weekly-total').textContent=week.length;$('#widget-progress-text').textContent=`已完成 ${done} / ${tt.length}`;$('#widget-bar').style.width=rate(done,tt.length)+'%';$('#widget-remaining').textContent=tt.length-done?`还有 ${tt.length-done} 件小事`:'今天的计划都完成了'}
function renderQuadrants(){const tasks=tasksOn(selectedDate);$('#quadrants').innerHTML=quadrants.map(q=>{const qt=tasks.filter(t=>t.q===q.id);return `<article class="quadrant q${q.id}"><div class="q-heading"><span class="q-icon">${icon(q.icon)}</span><h3>${q.title}</h3><span class="q-count" title="未完成任务数">${qt.filter(t=>!t.done).length}</span></div><p class="q-description">${escapeHtml(state.copy['q'+q.id])}</p><ul class="task-list">${qt.length?qt.map(t=>taskMarkup(t)).join(''):'<li class="q-empty">'+escapeHtml(state.copy.empty)+'</li>'}</ul><form class="inline-add" data-quadrant="${q.id}"><i>${icon('plus')}</i><input name="title" placeholder="添加任务，按回车保存" aria-label="在${q.title}中添加任务" maxlength="120" required autocomplete="off"></form></article>`}).join('')}
function renderBook(){const b=state.book;$('#book-title').textContent=b.title||'添加当前阅读';$('#book-author').textContent=b.title?b.author:'记录你的下一本书';$('#book-pages').textContent=b.title?`已读 ${b.current} / ${b.total} 页`:'从第一页开始';$('#book-percent').textContent=rate(b.current,b.total)+'%';$('#book-bar').style.width=rate(b.current,b.total)+'%'}
function renderGoals(){if(!state.goals.length){$('#goals-grid').innerHTML='<div class="empty-goals">从一个小目标开始。点击「添加板块」，写下你的本周目标与总目标。</div>';return}$('#goals-grid').innerHTML=state.goals.map(g=>`<article class="goal-card"><div class="goal-heading"><h3>${icon(g.icon)}${escapeHtml(g.name)}</h3><button class="icon-button" data-edit-goal="${escapeHtml(g.id)}" aria-label="编辑${escapeHtml(g.name)}目标">${icon('more')}</button></div><div class="goal-entry"><div class="goal-entry-head"><span>本周目标</span><strong>${g.week}%</strong></div><div class="goal-copy" title="${escapeHtml(g.weekText)}">${escapeHtml(g.weekText)}</div><div class="progress-track"><span style="width:${g.week}%"></span></div></div><div class="goal-entry total"><div class="goal-entry-head"><span>总目标</span><strong>${g.total}%</strong></div><div class="goal-copy" title="${escapeHtml(g.totalText)}">${escapeHtml(g.totalText)}</div><div class="progress-track"><span style="width:${g.total}%"></span></div></div></article>`).join('')}
function renderWidget(){const ts=tasksOn(today).slice().sort((a,b)=>Number(a.done)-Number(b.done)||a.q-b.q);$('#widget-list').innerHTML='<ul class="task-list">'+(ts.length?ts.map(t=>taskMarkup(t,true)).join(''):'<li class="inline-empty">暂无待办，留一点时间给自己。</li>')+'</ul>'}
function renderHistory(){const dates=[...new Set(state.tasks.filter(t=>t.planned<today).map(t=>t.planned))].sort().reverse();$('#history-list').innerHTML=dates.length?dates.map(date=>{const ts=tasksOn(date);return `<article class="history-day"><h3>${shortDate(date)}<span>已完成 ${ts.filter(t=>t.done).length} / ${ts.length}</span></h3><ul class="task-list">${ts.map(t=>taskMarkup(t)).join('')}</ul></article>`}).join(''):'<div class="empty-state">还没有往日记录。<br>每天的计划会留在这里，方便回看。</div>'}
function render(){renderCalendar();renderStats();renderQuadrants();renderBook();renderGoals();renderWidget();renderHistory();document.documentElement.style.setProperty('--opacity',state.opacity);const d=parseDate(selectedDate);$('#header-date').textContent=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日  ·  ${['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getDay()]}`;$('#dashboard-view').hidden=activeView==='history';$('#history-view').hidden=activeView!=='history';$('#nav-today').classList.toggle('active',activeView==='today');$('#nav-history').classList.toggle('active',activeView==='history');$('#breadcrumb-current').textContent=activeView==='history'?'历史记录':selectedDate===today?'今日计划':shortDate(selectedDate)+'的计划';$('#page-title').innerHTML=activeView==='history'?'回看，也是一种前进<span class="title-dot">。</span>':selectedDate===today?'把今天，安排得刚刚好<span class="title-dot">。</span>':'给这一天，留一点期待<span class="title-dot">。</span>';$('#page-subtitle').textContent=activeView==='history'?'完成的事值得记录，未完成的事可以重新安排。':'专注重要的事，也照顾生活的小事。';$('#dashboard-view .section-heading h2').innerHTML=icon('grid')+(selectedDate===today?'今日四象限':shortDate(selectedDate)+'的四象限');renderCopy();}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2200)}
function addTask(title,q,planned){const previous=structuredClone(state),previousRevision=revision;state.tasks.push({id:'t'+Date.now()+Math.random().toString(36).slice(2,6),title,q,planned,due:planned,done:false});if(!save()){if(revision===previousRevision)state=previous;render();return false}render();toast('已添加到'+(planned===today?'今日计划':shortDate(planned)+'的计划'));return true}
document.addEventListener('submit',e=>{const f=e.target;if(f.matches('.inline-add')){e.preventDefault();const title=f.elements.title.value.trim();if(!title)return;const q=Number(f.dataset.quadrant);addTask(title,q,selectedDate);const next=$(`[data-quadrant="${q}"]`);next.elements.title.focus()}if(f.id==='widget-add'){e.preventDefault();const title=f.elements.title.value.trim();if(!title)return;if(!addTask(title,2,today))return;f.elements.title.value='';f.elements.title.focus()}});
document.addEventListener('change',e=>{if(e.target.matches('.task-row input[type=checkbox]')){const task=state.tasks.find(t=>t.id===e.target.closest('[data-task]').dataset.task);if(task){task.done=e.target.checked;save();render()}}});
document.addEventListener('click',e=>{const day=e.target.closest('[data-date]');if(day){selectedDate=day.dataset.date;activeView='today';render()}const edit=e.target.closest('[data-edit-task]');if(edit)editTask(edit.dataset.editTask);const goal=e.target.closest('[data-edit-goal]');if(goal)editGoal(goal.dataset.editGoal)});
$('#prev-month').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);renderCalendar()};
$('#next-month').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);renderCalendar()};
$('#nav-today').onclick=()=>{selectedDate=today;calendarMonth=parseDate(today);activeView='today';render()};
$('#nav-history').onclick=()=>{activeView='history';render()};
$('#minimize').onclick=()=>{if(window.daynote){window.daynote.window('widget');return}$('#app').hidden=true;$('#widget').hidden=false;$('#preview-hint').hidden=false;renderWidget();$('#restore').focus()};
$('#restore').onclick=()=>{if(window.daynote){window.daynote.window('main');return}$('#app').hidden=false;$('#widget').hidden=true;$('#preview-hint').hidden=true;render();$('#minimize').focus()};
$('#weekly-note').value=state.notes[monday]||'';
$('#weekly-note').addEventListener('input',()=>{state.notes[monday]=$('#weekly-note').value;save()});
$('#week-range').textContent=`${shortDate(monday)} — ${shortDate(sunday)}`;
$('#week-number').textContent=`${parseDate(monday).getMonth()+1}.${parseDate(monday).getDate()} – ${parseDate(sunday).getMonth()+1}.${parseDate(sunday).getDate()}`;
$('#widget-date').textContent=shortDate(today);
$('#footer-date').textContent='DAYNOTE / 把日子过成喜欢的样子';
let onEditorSave;
function field(label,name,value,type='text',attrs=''){return `<label class="field">${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${attrs}></label>`}
function openEditor(title,fields,saveCallback){$('#editor-title').textContent=title;$('#editor-fields').innerHTML=fields;onEditorSave=saveCallback;$('#editor').showModal()}
function closeEditor(){$('#editor').close()}
$('#close-editor').onclick=closeEditor;$('#cancel-editor').onclick=closeEditor;
$('#editor-form').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form));const previous=structuredClone(state),previousRevision=revision;if(onEditorSave(data)===false)return;if(!save()){if(revision===previousRevision)state=previous;render();return;}render();closeEditor();toast('修改已保存')};
function editTask(id){const t=state.tasks.find(t=>t.id===id);if(!t)return;openEditor('编辑任务',field('任务内容','title',t.title,'text','required maxlength="120"')+`<div class="field-row">`+field('计划日期','planned',t.planned,'date','required')+field('截止日期','due',t.due,'date','required')+`</div><label class="field">所在象限<select name="q">${quadrants.map(q=>`<option value="${q.id}" ${t.q===q.id?'selected':''}>${q.title}</option>`).join('')}</select></label><p class="dialog-note">计划日期决定显示在哪一天；截止日期用于计算本周执行率。</p><button type="button" class="danger-button" data-delete-task="${escapeHtml(id)}">删除这条任务</button>`,data=>{if(!data.title.trim())return false;const current=state.tasks.find(task=>task.id===id);if(!current){toast('这条任务已被删除');return false}Object.assign(current,{title:data.title.trim(),q:Number(data.q),planned:data.planned,due:data.due})})}
function editBook(){const b=state.book;openEditor('当前阅读',field('书名','title',b.title,'text','required maxlength="80"')+field('作者','author',b.author,'text','maxlength="60"')+'<div class="field-row">'+field('已读页数','current',b.current,'number','min="0" step="1" required')+field('总页数','total',b.total,'number','min="1" step="1" required')+'</div><p class="field-error" id="book-error" hidden>已读页数不能大于总页数。</p>',data=>{if(Number(data.current)>Number(data.total)){$('#book-error').hidden=false;return false}if(!data.title.trim())return false;state.book={title:data.title.trim(),author:data.author.trim(),current:Number(data.current),total:Number(data.total)}})}
$('#edit-book').onclick=editBook;$('#update-reading').onclick=editBook;
function editGoal(id){const g=state.goals.find(g=>g.id===id)||{id:'g'+Date.now(),name:'',icon:'target',weekText:'',week:0,totalText:'',total:0};openEditor(id?'编辑目标板块':'添加目标板块',field('板块名称','name',g.name,'text','required maxlength="20"')+field('本周目标','weekText',g.weekText,'text','required maxlength="80"')+field('本周进度（%）','week',g.week,'number','min="0" max="100" step="1" required')+field('总目标','totalText',g.totalText,'text','required maxlength="80"')+field('总目标进度（%）','total',g.total,'number','min="0" max="100" step="1" required')+'<p class="dialog-note">目标进度可以单独记录，暂不随任务勾选自动变化。</p>',data=>{if(!data.name.trim()||!data.weekText.trim()||!data.totalText.trim())return false;const current=id?state.goals.find(goal=>goal.id===id):g;if(!current){toast('这个板块已被删除');return false}Object.assign(current,{name:data.name.trim(),weekText:data.weekText.trim(),week:Number(data.week),totalText:data.totalText.trim(),total:Number(data.total)});if(!id)state.goals.push(current)})}
$('#add-goal').onclick=()=>editGoal(null);
$('#edit-copy').onclick=()=>openEditor('自定义文案','<p class="dialog-note">把这些文字换成你喜欢的表达。留空可隐藏相应寄语；修改会保存在本机。</p>'+copyFields.map(([key,label])=>key==='sidebar'?'<label class="field">'+label+'<textarea name="'+key+'" rows="2" maxlength="120">'+escapeHtml(state.copy[key])+'</textarea></label>':field(label,key,state.copy[key],'text','maxlength="120"')).join(''),data=>{for(const [key] of copyFields)state.copy[key]=data[key].trim()});
$('#settings-button').onclick=async()=>{
 const settings=window.daynote?await window.daynote.settings():null;
 openEditor('外观与数据',field('面板不透明度','opacity',Math.round(state.opacity*100),'range','min="40" max="95" step="1"')+'<p class="dialog-note">向左更通透，向右更清晰。</p>'+(settings?.ok?'<div class="storage-settings"><h3>本地数据</h3><p class="storage-path">'+escapeHtml(settings.dataRoot)+'</p><div class="settings-buttons"><button type="button" data-setting="open">打开目录</button><button type="button" data-setting="move">更换目录</button><button type="button" data-setting="export">导出备份</button><button type="button" data-setting="import">导入备份</button></div><p class="dialog-note">任务、设置、缓存和日志保存在所选目录。更换目录会复制数据并重启，原目录保留。</p><p class="dialog-note">序日 '+escapeHtml(settings.version)+' · MIT 开源 · 数据仅保存在本机</p></div>':''),data=>state.opacity=Number(data.opacity)/100);
};
document.addEventListener('click',async e=>{
 const del=e.target.closest('[data-delete-task]');if(del){const task=state.tasks.find(t=>t.id===del.dataset.deleteTask);if(!task)return;const answer=window.daynote?await window.daynote.confirmDelete(task.title):{confirmed:window.confirm('删除这条任务？')};if(answer.confirmed){state.tasks=state.tasks.filter(t=>t.id!==task.id);if(save()){closeEditor();render();toast('任务已删除')}}}
 const setting=e.target.closest('[data-setting]');if(setting&&window.daynote){const actions={open:'openStorage',move:'chooseStorage',export:'exportData',import:'importData'};setting.disabled=true;try{const result=await window.daynote[actions[setting.dataset.setting]]();if(!result.ok)toast(result.error);else if(!result.canceled&&setting.dataset.setting!=='open')toast('操作已完成')}catch(error){toast(error.message)}finally{setting.disabled=false}}
 const native=e.target.closest('[data-native]');if(native&&window.daynote)window.daynote.window(native.dataset.native);
});
const dragHandle=$('#widget-drag');let drag;
dragHandle.addEventListener('pointerdown',e=>{if(window.daynote)return;if(e.target.closest('button'))return;const r=$('#widget').getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};dragHandle.setPointerCapture(e.pointerId)});
dragHandle.addEventListener('pointermove',e=>{if(!drag)return;const w=$('#widget'),x=Math.max(0,Math.min(innerWidth-w.offsetWidth,e.clientX-drag.x)),y=Math.max(0,Math.min(innerHeight-w.offsetHeight,e.clientY-drag.y));w.style.left=x+'px';w.style.top=y+'px';w.style.right='auto'});
dragHandle.addEventListener('pointerup',()=>drag=null);dragHandle.addEventListener('pointercancel',()=>drag=null);
window.addEventListener('resize',()=>{const w=$('#widget');if(w.hidden||!w.style.left)return;w.style.left=Math.max(0,Math.min(parseFloat(w.style.left),innerWidth-w.offsetWidth))+'px';w.style.top=Math.max(0,Math.min(parseFloat(w.style.top),innerHeight-w.offsetHeight))+'px'});
fillIcons();render();save();

if(window.daynote){
 const mode=new URLSearchParams(location.search).get('mode')||'main';document.body.classList.add('native-app','native-'+mode);$('#app').hidden=mode==='widget';$('#widget').hidden=mode!=='widget';$('#preview-hint').hidden=true;
 window.daynote.onState(applySnapshot);
 const pinButton=$('#pin-widget');async function updatePin(){const settings=await window.daynote.settings();if(settings.ok){pinButton.setAttribute('aria-pressed',String(settings.pinned));pinButton.classList.toggle('pinned',settings.pinned);pinButton.title=settings.pinned?'取消置顶':'始终置顶'}}
 pinButton.onclick=async()=>{const settings=await window.daynote.settings();if(settings.ok){await window.daynote.setPin(!settings.pinned);updatePin()}};
 window.addEventListener('focus',updatePin);updatePin();
}
setInterval(()=>{const now=dateKey(new Date());if(now===today)return;const followToday=selectedDate===today;today=now;monday=plusDays(today,-((parseDate(today).getDay()+6)%7));sunday=plusDays(monday,6);if(followToday){selectedDate=today;calendarMonth=parseDate(today)}$('#widget-date').textContent=shortDate(today);$('#week-range').textContent=shortDate(monday)+' — '+shortDate(sunday);$('#week-number').textContent=shortDate(monday)+' – '+shortDate(sunday);$('#weekly-note').value=state.notes[monday]||'';render()},15000);
