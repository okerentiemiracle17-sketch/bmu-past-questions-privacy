const AUTH_REDIRECT_URL='https://nexusbmupastquestion.mnexus.com.ng/';
const SUPABASE_URL="https://lobmgxewcmavijzylpil.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_5LRTqMP3oReP-UyFzLcwog_8pEbAHpx";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const s=(v,f="")=>v===null||v===undefined?f:String(v);
const esc=v=>s(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const row=v=>Array.isArray(v)?(v[0]||{}):(v||{});
const msg=(el,t,type="info")=>{if(!el)return;el.textContent=t||"";el.style.color={info:"#59c3ff",success:"#4ade80",error:"#ff6b7a"}[type]||"#59c3ff"};
let user=null,profile=null,courses=[],materials=[],uploads=[],videos=[],questions=[],answers={},reviews={},aiReviews={},qIndex=0,premium=false,seconds=0,timer=null,submitted=false,reviewMode=false;
let theoryQuestions=[],theoryAnswers={},theoryGrades={},theoryIndex=0,theoryReviewMode=false,theoryCourseCode="",theoryCourseTitle="";
let roomData=null,isHost=false,roomPoll=null,roomClock=null,groupNo=0,groupTotal=0,groupFormat="mcq",groupEndsAt=null,currentGroupQuestion=null,videoUrl="",paymentRef="";
let pendingGeneratedPractice=null,spectateTargetId=null,spectatePoll=null,roomAutoSubmitting=false;

let groupSelectedAnswers=new Map(),spectateRefreshTimer=null,spectateRequestBusy=false;
function roomFinishLabel(value){if(!value)return 'Finished';const d=new Date(value);return Number.isNaN(d.getTime())?'Finished':'Finished at '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function markGroupChoice(letter){document.querySelectorAll('#groupMcqOptions .option-button').forEach(b=>{const selected=b.dataset.answerLetter===letter;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))})}
async function restoreGroupChoice(questionNo){
 if(!roomData)return;const roomId=roomData.id;
 try{const {data,error}=await supabaseClient.rpc('get_my_study_room_selection',{p_room_id:roomId,p_question_no:questionNo});
 if(error)throw error;if(roomData?.id!==roomId||groupNo!==questionNo)return;
 const choice=Array.isArray(data)?data[0]?.selected_option:null;
 if(choice)groupSelectedAnswers.set(questionNo,choice);else groupSelectedAnswers.delete(questionNo);
 markGroupChoice(choice||'');
 }catch(e){console.warn('Answer restoration unavailable',e)}
}

const pageMap={home:$('dashboardHome'),'solo-learning':$('soloLearningPage'),'past-questions':$('pastQuestionsPage'),'nexus-ai':$('nexusAiPage'),materials:$('materialsPage'),videos:$('videosPage'),'study-groups':$('studyGroupsPage'),results:$('resultsPage'),cgpa:$('cgpaPage'),subscription:$('subscriptionPage'),profile:$('profilePage')};
function stopTimer(){if(timer){clearInterval(timer);timer=null}}
function stopRoom(){if(roomPoll){clearInterval(roomPoll);roomPoll=null}if(roomClock){clearInterval(roomClock);roomClock=null}}
function fmt(sec){sec=Math.max(0,Number(sec)||0);return`${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`}
function displayName(){return profile?.full_name||user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split("@")[0]||"Student"}
function isPremium(p){if(!p)return false;const st=s(p.subscription_status).toLowerCase();if(["owner","admin"].includes(st))return true;if(!["paid","premium","active"].includes(st)||!p.subscription_expires_at)return false;return new Date(p.subscription_expires_at).getTime()>Date.now()}
function expiry(v){if(!v)return"";const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}
function codeOf(c){return s(c?.code||c?.course_code).trim()}function titleOf(c){return s(c?.title||c?.course_title).trim()}function opt(q,l){return s(q?.[`option_${l.toLowerCase()}`])}
function cleanName(n){return s(n,"material").replace(/[^a-zA-Z0-9._-]+/g,"_").replace(/_+/g,"_").slice(0,140)}
function ext(n){const i=s(n).lastIndexOf(".");return i<0?"":s(n).slice(i+1).toLowerCase()}
function openModal(id){$(id)?.classList.remove("hidden");document.body.style.overflow="hidden"}function closeModal(id){$(id)?.classList.add("hidden");document.body.style.overflow=""}
function closeMobile(){$('desktopNav')?.classList.remove('mobile-open');$('mobileNavToggle')?.setAttribute('aria-expanded','false')}
$('mobileNavToggle')?.addEventListener('click',()=>{const o=$('desktopNav')?.classList.toggle('mobile-open');$('mobileNavToggle')?.setAttribute('aria-expanded',o?'true':'false')});document.querySelectorAll('.desktop-nav a').forEach(a=>a.addEventListener('click',closeMobile));
function publicView(){stopTimer();stopRoom();$('dashboard')?.classList.add('hidden');$('publicWebsite')?.classList.remove('hidden');document.querySelector('.topbar')?.classList.remove('hidden');document.querySelector('footer')?.classList.remove('hidden')}
async function dashboardView(u){user=u;document.querySelector('.topbar')?.classList.add('hidden');$('publicWebsite')?.classList.add('hidden');document.querySelector('footer')?.classList.add('hidden');$('dashboard')?.classList.remove('hidden');await loadProfile();updateUser();updateAccess();await loadCourses();await dashboardStats();loadNotices();go('home');animateDash()}
function go(page){Object.entries(pageMap).forEach(([k,el])=>el?.classList.toggle('hidden',k!==page));document.querySelectorAll('.sidebar-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const dashboardContent=$('dashboard')?.querySelector('.dashboard-content');if(dashboardContent&&getComputedStyle(dashboardContent).overflowY==='auto'){dashboardContent.scrollTo({top:0,behavior:'instant'})}else{window.scrollTo({top:0,behavior:'smooth'})}const active=pageMap[page];if(active){active.classList.remove('page-enter');void active.offsetWidth;active.classList.add('page-enter')}if(page==='solo-learning')loadSoloLearning();if(page==='materials')loadMaterials();if(page==='videos')loadVideos();if(page==='results')loadResults();if(page==='profile'){renderProfile();setProfileEditMode(false)}}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
$('startBtn')?.addEventListener('click',()=>$('login')?.scrollIntoView({behavior:'smooth'}));['signupBtn','heroCreateBtn','nexusSignupBtn','createAccountBtn'].forEach(id=>$(id)?.addEventListener('click',()=>openModal('signupModal')));$('closeSignup')?.addEventListener('click',()=>closeModal('signupModal'));$('forgotPasswordBtn')?.addEventListener('click',()=>{if($('forgotEmail'))$('forgotEmail').value=$('email')?.value||user?.email||'';openModal('forgotPasswordModal')});$('closeForgotPassword')?.addEventListener('click',()=>closeModal('forgotPasswordModal'));
function showVerifyEmail(email=''){const field=$('verifyEmailAddress');if(field)field.value=email||$('signupEmail')?.value.trim()||$('email')?.value.trim()||'';msg($('verifyEmailMessage'),'Please check your inbox. You can also resend the confirmation email.');closeModal('signupModal');openModal('verifyEmailModal')}
$('closeVerifyEmail')?.addEventListener('click',()=>closeModal('verifyEmailModal'));
$('verifyEmailForm')?.addEventListener('submit',async e=>{e.preventDefault();const email=$('verifyEmailAddress').value.trim(),token=$('verifyEmailCode').value.trim(),btn=$('verifyEmailSubmit');if(!/^[0-9]{6,8}$/.test(token)){msg($('verifyEmailMessage'),'Enter the 6- or 8-digit code from your email.','error');return}btn.disabled=true;try{const {data,error}=await supabaseClient.auth.verifyOtp({email,token,type:'email'});if(error)throw error;msg($('verifyEmailMessage'),'Email verified successfully!','success');closeModal('verifyEmailModal');if(data?.user&&data?.session){await dashboardView(data.user)}else{$('email').value=email;$('login')?.scrollIntoView({behavior:'smooth'});msg($('loginMessage'),'Email confirmed. Sign in to continue.','success')}}catch(e2){msg($('verifyEmailMessage'),e2.message||'Unable to verify this code. Check the latest email or request a new confirmation.','error')}finally{btn.disabled=false}});
$('resendSignupConfirmation')?.addEventListener('click',async()=>{const email=$('verifyEmailAddress')?.value.trim(),btn=$('resendSignupConfirmation');if(!email){msg($('verifyEmailMessage'),'Enter your email address first.','error');return}btn.disabled=true;try{const {error}=await supabaseClient.auth.resend({type:'signup',email,options:{emailRedirectTo:AUTH_REDIRECT_URL}});if(error)throw error;msg($('verifyEmailMessage'),'Confirmation email requested. Check your inbox and Spam folder.','success')}catch(e2){msg($('verifyEmailMessage'),e2.message||'Could not resend confirmation email.','error')}finally{btn.disabled=false}});
$('signupForm')?.addEventListener('submit',async e=>{e.preventDefault();const full_name=$('signupName').value.trim(),email=$('signupEmail').value.trim(),password=$('signupPassword').value,programme=$('signupProgramme').value.trim(),level=$('signupLevel').value,confirmPassword=$('signupConfirmPassword').value;if(!full_name||!email||!programme||!level||password.length<6){msg($('signupMessage'),'Complete your name, email, department, level and a password of at least 6 characters.','error');return}if(password!==confirmPassword){msg($('signupMessage'),'Passwords do not match.','error');return}$('signupSubmitBtn').disabled=true;try{const {data,error}=await supabaseClient.auth.signUp({email,password,options:{emailRedirectTo:AUTH_REDIRECT_URL,data:{full_name,programme,level}}});if(error)throw error;if(data.session&&data.user){const {error:profileError}=await supabaseClient.from('profiles').update({full_name,programme,level}).eq('id',data.user.id);if(profileError)console.warn('Profile update pending:',profileError.message);closeModal('signupModal');await dashboardView(data.user)}else {msg($('signupMessage'),'Account created. Please verify your email.','success');showVerifyEmail(email)}}catch(e2){msg($('signupMessage'),e2.message||'Unable to create account.','error')}finally{$('signupSubmitBtn').disabled=false}});
$('loginForm')?.addEventListener('submit',async e=>{e.preventDefault();$('loginSubmitBtn').disabled=true;msg($('loginMessage'),'Signing in...');try{const {data,error}=await supabaseClient.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;await dashboardView(data.user)}catch(e2){msg($('loginMessage'),e2.message||'Unable to sign in.','error');if(/email not confirmed/i.test(e2.message||''))showVerifyEmail($('email')?.value.trim()||'')}finally{$('loginSubmitBtn').disabled=false}});
let resetStage='email',resetTimer=null,resetSeconds=0;
function resetPasswordUi(stage='email'){resetStage=stage;$('resetEmailStep')?.classList.toggle('hidden',stage!=='email');$('resetOtpStep')?.classList.toggle('hidden',stage!=='otp');$('resetPasswordStep')?.classList.toggle('hidden',stage!=='password');if($('forgotEmail'))$('forgotEmail').disabled=stage!=='email';if($('forgotSubmitBtn'))$('forgotSubmitBtn').textContent=stage==='email'?'Send OTP':stage==='otp'?'Verify OTP':'Change Password';if($('resetStepText'))$('resetStepText').textContent=stage==='email'?'Enter your registered email and we’ll send a 6-digit reset code.':stage==='otp'?'Enter the 6-digit OTP sent to your email.':'OTP verified. Create your new password.';msg($('forgotPasswordMessage'),'')}
function startResetCountdown(seconds=60){resetSeconds=seconds;clearInterval(resetTimer);const b=$('resendResetOtpBtn');const paint=()=>{if(!b)return;b.disabled=resetSeconds>0;b.textContent=resetSeconds>0?`Resend OTP in ${resetSeconds}s`:'Resend OTP'};paint();resetTimer=setInterval(()=>{resetSeconds--;paint();if(resetSeconds<=0)clearInterval(resetTimer)},1000)}
async function sendResetOtp(){const email=$('forgotEmail').value.trim().toLowerCase();if(!email||!email.includes('@'))throw new Error('Enter a valid email address.');const {error}=await supabaseClient.auth.signInWithOtp({email,options:{shouldCreateUser:false}});if(error)throw error;resetPasswordUi('otp');startResetCountdown(60);msg($('forgotPasswordMessage'),'OTP sent. Check your email for the 6-digit code.','success')}
$('forgotPasswordForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=$('forgotSubmitBtn');btn.disabled=true;try{if(resetStage==='email'){await sendResetOtp()}else if(resetStage==='otp'){const email=$('forgotEmail').value.trim().toLowerCase(),token=$('forgotOtp').value.trim();if(!/^\d{6}$/.test(token))throw new Error('Enter the 6-digit OTP sent to your email.');const {error}=await supabaseClient.auth.verifyOtp({email,token,type:'email'});if(error)throw error;resetPasswordUi('password');msg($('forgotPasswordMessage'),'OTP verified. Enter your new password.','success')}else{const p=$('resetNewPassword').value,c=$('resetConfirmPassword').value;if(p.length<8)throw new Error('Password must be at least 8 characters.');if(p!==c)throw new Error('Passwords do not match.');const {error}=await supabaseClient.auth.updateUser({password:p});if(error)throw error;msg($('forgotPasswordMessage'),'Password changed successfully. You can now sign in with your new password.','success');setTimeout(async()=>{await supabaseClient.auth.signOut();closeModal('forgotPasswordModal');resetPasswordUi('email');if($('forgotOtp'))$('forgotOtp').value='';if($('resetNewPassword'))$('resetNewPassword').value='';if($('resetConfirmPassword'))$('resetConfirmPassword').value='';publicView()},1000)}}catch(e2){msg($('forgotPasswordMessage'),e2.message||'Unable to reset password.','error')}finally{btn.disabled=false}});
$('resendResetOtpBtn')?.addEventListener('click',async()=>{const b=$('resendResetOtpBtn');b.disabled=true;try{await sendResetOtp()}catch(e){msg($('forgotPasswordMessage'),e.message||'Unable to resend OTP.','error');if(resetSeconds<=0)b.disabled=false}});
async function loadProfile(){profile=null;if(!user?.id)return;const {data,error}=await supabaseClient.from('profiles').select('id,full_name,email,programme,level,subscription_status,subscription_started_at,subscription_expires_at').eq('id',user.id).maybeSingle();if(!error)profile=data||{}}
function updateUser(){const n=displayName(),first=n.trim().split(/\s+/)[0]||'Student';$('welcomeUser').textContent=`Good to see you, ${first}.`;$('headerUserName').textContent=first;$('profileInitial').textContent=first[0]?.toUpperCase()||'S'}
function updateAccess(){premium=isPremium(profile);const ex=expiry(profile?.subscription_expires_at);$('subscriptionBadge').textContent=premium?'Premium Active':'Free Access';$('subscriptionMeta').textContent=premium?(ex?`Until ${ex}`:'Full Access'):'5 MCQs per course';$('pqAccessLabel').textContent=premium?'Premium Active':'Free Access';$('pqAccessDetail').textContent=premium?'Up to 70 questions':'5 demo questions per course';$('accessCardTitle').textContent=premium?'Premium Access':'Free Access';$('accessCardText').textContent=premium?'Stored questions first, then approved-material Nexus AI, then validated general AI fallback.':'Free users can practise up to 5 stored demo questions per course.';$('questionCount').disabled=!premium;$('materialsAccessLabel').textContent=premium?'Premium Library':'Library Preview';$('materialsAccessDetail').textContent=premium?'Books, notes and slides are unlocked':'Browse all resources • Premium opens locked items';renderProfile()}
const CORE_100_LEVEL_CODES=['BIO101','BIO107','CHM101','CHM107','COS101','COS107','GST111','MTH101','MTH111','PHY101','PHY107','STA111','BIO102','BIO108','CHM102','CHM108','COS102','COS108','GST112','GST114','MTH102','PHY102','PHY108'];
function normalCourseCode(v){return s(v).toUpperCase().replace(/\s+/g,'')}
let departmentCurriculum=[];
let verifiedProgrammeCourses=[];
async function loadCourses(){const [{data,error},curriculumResult,mappingResult]=await Promise.all([supabaseClient.from('courses').select('id,code,title,course_code,course_title,level,department').eq('active',true).order('code').range(0,4999),supabaseClient.from('department_curriculum_courses').select('department,level,course_code,course_title,status').eq('status','active').range(0,4999),supabaseClient.from('programme_courses').select('level,semester,programmes(name),courses(id,code,title,course_code,course_title)').eq('verified',true).range(0,4999)]);if(error){console.error(error);return}if(curriculumResult.error){console.warn('Department curriculum unavailable:',curriculumResult.error.message);departmentCurriculum=[];}else{departmentCurriculum=(curriculumResult.data||[]).filter(c=>c.department&&c.course_code).map(c=>({department:c.department,level:c.level,code:c.course_code,course_code:c.course_code,title:c.course_title,course_title:c.course_title}));}if(mappingResult.error){console.warn('Programme course assignments unavailable',mappingResult.error);verifiedProgrammeCourses=[]}else{verifiedProgrammeCourses=(mappingResult.data||[]).filter(m=>m.programmes?.name&&m.courses&&(m.courses.code||m.courses.course_code)).map(m=>({...m.courses,department:m.programmes.name,level:m.level,semester:m.semester,verifiedAssignment:true}));}const map=new Map();(data||[]).forEach(c=>{const code=codeOf(c);if(code&&!map.has(normalCourseCode(code)))map.set(normalCourseCode(code),c)});departmentCurriculum.forEach(c=>{const code=codeOf(c),key=normalCourseCode(code);if(key&&!map.has(key))map.set(key,c)});CORE_100_LEVEL_CODES.forEach(code=>{if(!map.has(code))map.set(code,{code,course_code:code,title:'',course_title:'',level:'100',department:'All Programmes'})});courses=[...map.values()].sort((a,b)=>{const la=Number(s(a.level).replace(/\D/g,''))||999,lb=Number(s(b.level).replace(/\D/g,''))||999;return la-lb||codeOf(a).localeCompare(codeOf(b))});const levelFilter=$('courseLevelFilter');if(levelFilter){const current=levelFilter.value;const levels=[...new Set(courses.map(c=>s(c.level).replace(/\D/g,'')).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));levelFilter.innerHTML='<option value="">All Levels</option>'+levels.map(level=>`<option value="${esc(level)}">${esc(level)} Level</option>`).join('');if(levels.includes(current))levelFilter.value=current;}renderCourseSelect(courses);renderCourseBrowser();fillPastPaperCourses();renderRecent(courses);renderMaterialCourses(courses);renderGroupCourses(courses);renderSoloFilters();renderSoloCourses()}
function filteredPracticeCourses(){const q=s($('courseSearch')?.value).toLowerCase().trim(),lv=$('courseLevelFilter')?.value||'';return courses.filter(c=>(!lv||s(c.level).replace(/\D/g,'')===lv)&&(!q||(codeOf(c)+' '+titleOf(c)+' '+s(c.department)).toLowerCase().includes(q)))}
let pastPaperMode=false,pastPaperIdentity=null,pastPaperList=[],pastPaperLoadingSeq=0;
// Past Questions archive follows the app's ordered Department → Level → Semester → Course flow.
// Course/department membership comes from the website's loaded course catalogue; shared
// university courses are also available under each department.
function pastPaperDept(c){return s(c.department).trim()||'All Programmes'}
function pastPaperLevel(c){const match=s(c.level).match(/\d{3}|JUPEB/i);return match?match[0].toUpperCase():s(c.level).trim()}
function canonicalPastPaperDept(value){const name=s(value).trim();return name.toLowerCase()==='medicine and surgery'?'Medicine & Surgery':name}
function pastPaperScopedCourses(){
 const dept=canonicalPastPaperDept($('pastPaperDepartment')?.value||'');
 const lv=$('pastPaperLevel')?.value||'',sem=$('pastPaperSemester')?.value||'';
 const assignments=verifiedProgrammeCourses.filter(c=>!dept||canonicalPastPaperDept(pastPaperDept(c))===dept);
 const mappedFirstYear=assignments.some(c=>pastPaperLevel(c)==='100');
 const unique=new Map();
 for(const c of [...assignments,...departmentCurriculum,...courses]){
  const level=pastPaperLevel(c),cDept=canonicalPastPaperDept(pastPaperDept(c));
  if(lv&&level!==lv)continue;
  if(dept&&level!=='100'&&cDept!==dept&&cDept.toLowerCase()!=='all programmes')continue;
  // First-year assignments are shared, but their confirmed semester matters.
  if(level==='100'&&mappedFirstYear&&!c.verifiedAssignment)continue;
  if(sem&&c.verifiedAssignment&&String(c.semester)!==sem)continue;
  const key=normalCourseCode(codeOf(c));if(!key)continue;
  const prev=unique.get(key);
  if(!prev||(!prev.verifiedAssignment&&c.verifiedAssignment)||
   (!prev.verifiedAssignment&&cDept===dept&&canonicalPastPaperDept(pastPaperDept(prev))!==dept))unique.set(key,c);
 }
 return [...unique.values()].sort((a,b)=>codeOf(a).localeCompare(codeOf(b)));
}
function resetPastPaperYears(){
 pastPaperLoadingSeq++;pastPaperList=[];
 const el=$('pastPaperYear');if(el){el.innerHTML='<option value="">Choose course first</option>';el.disabled=true}
 if($('startPastPaperBtn'))$('startPastPaperBtn').disabled=true;
 if($('pastPaperCount'))$('pastPaperCount').textContent='Select an examination year to see available questions.';
 msg($('pastPaperMessage'),'');
}
function fillPastPaperCourses(){
 const dept=$('pastPaperDepartment'),lv=$('pastPaperLevel'),sem=$('pastPaperSemester'),course=$('pastPaperCourse');
 if(!dept||!lv||!sem||!course)return;
 const prev=dept.value;
 const signupDepartments=[...document.querySelectorAll('#signupProgramme option')].map(option=>option.value.trim()).filter(Boolean);
 const depts=[...new Set([...signupDepartments,...departmentCurriculum.map(pastPaperDept),...verifiedProgrammeCourses.map(pastPaperDept),...courses.map(pastPaperDept)].map(canonicalPastPaperDept))].filter(x=>x.toLowerCase()!=='all programmes').sort((a,b)=>a.localeCompare(b));
 dept.innerHTML='<option value="">Choose department</option>'+depts.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');
 if(depts.includes(prev))dept.value=prev;
 refreshPastPaperLevels();
}
function refreshPastPaperLevels(){
 const dept=$('pastPaperDepartment')?.value||'',lv=$('pastPaperLevel'),sem=$('pastPaperSemester'),course=$('pastPaperCourse');
 if(!lv||!sem||!course)return;
 const prior=lv.value;
 lv.innerHTML='<option value="">Choose level</option>';
 if(dept){
  const levels=[...new Set(pastPaperScopedCourses().map(pastPaperLevel))].filter(Boolean).sort((a,b)=>(parseInt(a)||999)-(parseInt(b)||999));
  levels.forEach(value=>lv.add(new Option(/^\d+$/.test(value)?`${value} Level`:value,value)));
  if(levels.includes(prior))lv.value=prior;
 }
 lv.disabled=!dept;
 if(!lv.value){sem.value='';sem.disabled=true}
 else sem.disabled=false;
 refreshPastPaperCourseOptions();
 if(dept&&!departmentCurriculum.some(c=>pastPaperDept(c)===dept))msg($('pastPaperMessage'),`Showing shared first-year courses. Department-specific courses will appear after they are catalogued.`, 'info');
}
function refreshPastPaperCourseOptions(){
 const dept=$('pastPaperDepartment')?.value||'',lv=$('pastPaperLevel')?.value||'',sem=$('pastPaperSemester')?.value||'',el=$('pastPaperCourse');
 if(!el)return;
 const prior=el.value;el.innerHTML='<option value="">Choose course</option>';
 el.disabled=!(dept&&lv&&sem);resetPastPaperYears();
 if(el.disabled)return;
 // The academic-session lookup is semester-aware; we do not guess semester
 // membership from course-code parity, because schools can vary.
 const available=pastPaperScopedCourses();
 available.forEach(c=>{const option=new Option(`${codeOf(c)} — ${titleOf(c)||'Course'}`,codeOf(c));el.add(option)});
 if(available.some(c=>codeOf(c)===prior))el.value=prior;
 if(el.value)refreshPastPaperYears();
}
$('pastPaperDepartment')?.addEventListener('change',()=>{if($('pastPaperLevel'))$('pastPaperLevel').value='';refreshPastPaperLevels()});
$('pastPaperLevel')?.addEventListener('change',()=>{if($('pastPaperSemester'))$('pastPaperSemester').value='';$('pastPaperSemester').disabled=!$('pastPaperLevel').value;refreshPastPaperCourseOptions()});
$('pastPaperSemester')?.addEventListener('change',refreshPastPaperCourseOptions);
async function refreshPastPaperYears(){
  const course=$('pastPaperCourse')?.value||'',semester=Number($('pastPaperSemester')?.value||0),year=$('pastPaperYear');
  if(!year)return;
  const seq=++pastPaperLoadingSeq;pastPaperList=[];year.disabled=true;year.innerHTML='<option value="">Select a course first</option>';$('startPastPaperBtn').disabled=true;
  $('pastPaperCount').textContent='';msg($('pastPaperMessage'),'');
  if(!course||!semester)return;
  year.innerHTML='<option value="">Loading available years...</option>';
  try{
    const {data,error}=await supabaseClient.rpc('list_available_year_question_sets',{p_course_code:course,p_semester:semester});
    if(error)throw error;if(seq!==pastPaperLoadingSeq)return;
    pastPaperList=(Array.isArray(data)?data:[]).filter(x=>s(x.academic_session).trim());
    year.innerHTML='<option value="">Select examination year</option>';
    pastPaperList.forEach(item=>{const option=document.createElement('option');option.value=item.academic_session;option.textContent=`${item.academic_session} (${Number(item.question_count)||0} questions)`;year.appendChild(option)});
    year.disabled=!pastPaperList.length;
    if(!pastPaperList.length)msg($('pastPaperMessage'),'No published year-based papers are available for this course and semester. Try Random Practice instead.','info');
  }catch(err){if(seq!==pastPaperLoadingSeq)return;year.innerHTML='<option value="">Unable to load years</option>';msg($('pastPaperMessage'),err.message||'Unable to load examination years.','error')}
}
$('pastPaperCourse')?.addEventListener('change',refreshPastPaperYears);

$('pastPaperYear')?.addEventListener('change',()=>{
 const choice=$('pastPaperYear').value,item=pastPaperList.find(x=>x.academic_session===choice);
 $('startPastPaperBtn').disabled=!item;
 $('pastPaperCount').textContent=item?`${Number(item.question_count)||0} source questions in this examination year. Only supported MCQs will be scored.`:'Select an examination year to see available questions.';
});
async function startYearPastPaper(){
 const btn=$('startPastPaperBtn'),course=$('pastPaperCourse').value,semester=Number($('pastPaperSemester').value),year=$('pastPaperYear').value;
 if(!course||!year)return;
 if(!isPremium(profile)){msg($('pastPaperMessage'),'Premium is required to practise complete year-based past papers. You can still use your free random practice questions.','error');return}
 btn.disabled=true;msg($('pastPaperMessage'),'Loading examination questions securely...');
 try{
   const {data,error}=await supabaseClient.rpc('get_available_year_questions',{p_course_code:course,p_semester:semester,p_academic_session:year});
   if(error)throw error;
   const seen=new Set();const eligible=(Array.isArray(data)?data:[]).filter(q=>{
     if(s(q.question_type).toLowerCase()!=='mcq'||!s(q.question_text).trim()||!['A','B','C','D','E'].some(l=>s(q['option_'+l.toLowerCase()]).trim())||seen.has(String(q.id)))return false;
     seen.add(String(q.id));return true;
   });
   if(!eligible.length)throw new Error('No scored multiple-choice questions were found for this examination year.');
   questions=eligible.slice(0,70);answers={};reviews={};aiReviews={};qIndex=0;submitted=false;reviewMode=false;
   pastPaperMode=true;pastPaperIdentity={course,semester,year};
   seconds=Number($('pastPaperMinutes').value||30)*60;
   $('quizCourseCode').textContent=course;
   $('quizCourseTitle').textContent=`${year} • ${semester===1?'First':'Second'} semester • Past-paper CBT`;
   $('practiceSetup').classList.add('hidden');$('yearPastPapers').classList.add('hidden');
   $('resultCard').classList.add('hidden');$('theoryResultCard').classList.add('hidden');$('theoryShell').classList.add('hidden');
   $('quizShell').classList.remove('hidden');$('submitQuizBtn').classList.remove('hidden');
   renderQ();startClock();
 }catch(err){pastPaperMode=false;pastPaperIdentity=null;msg($('pastPaperMessage'),err.message||'Unable to start this year-based past paper.','error')}
 finally{btn.disabled=false}
}
$('startPastPaperBtn')?.addEventListener('click',startYearPastPaper);
function resetYearPastPaperUi(){pastPaperMode=false;pastPaperIdentity=null;$('yearPastPapers')?.classList.remove('hidden')}
async function scoreYearPastPaper(){
  reviews={};const selected={};questions.forEach(q=>{selected[String(q.id)]=answers[q.id]||''});
  // Both RPCs require authentication + Premium and never disclose an answer before submission.
  const scored=await supabaseClient.rpc('score_secure_quiz',{p_answers:selected});if(scored.error)throw scored.error;
  const reviewed=await supabaseClient.rpc('review_secure_quiz',{p_answers:selected});if(reviewed.error)throw reviewed.error;
  (Array.isArray(reviewed.data)?reviewed.data:[]).forEach(r=>{const id=r.id??r.question_id;reviews[id]={...r,selected_option:answers[id]||'',is_correct:!!r.is_correct&&!!answers[id]}});
  // Use the better, answer-snapshot-checked explanation cache when available.
  try{
    const ids=questions.map(q=>Number(q.id)).filter(Number.isSafeInteger);
    const detail=await supabaseClient.rpc('get_study_question_answers',{p_question_ids:ids});
    if(!detail.error&&Array.isArray(detail.data))detail.data.forEach(x=>{
      if(!reviews[x.question_id])return;
      reviews[x.question_id].explanation=x.explanation||reviews[x.question_id].explanation;
      reviews[x.question_id].answer_text=x.answer_text||reviews[x.question_id].answer_text;
      reviews[x.question_id].answer_status=x.answer_status;
    });
  }catch(e){console.warn('Explanation upgrade unavailable; using source review.',e)}
  const correct=Number(row(scored.data).correct||0);
  await finishSolo(correct,false);
  const total=questions.length,pct=total?Math.round(correct/total*100):0;
  $('resultSummary').textContent=`${pastPaperIdentity.year} • ${pastPaperIdentity.course}. You scored ${correct} of ${total} (${pct}%). Review the correct choices and worked explanations underneath each question.`;
}
function renderCourseSelect(rows=filteredPracticeCourses()){const el=$('courseSelect');if(!el)return;const old=el.value;el.innerHTML='<option value="">Select a course</option>';rows.forEach(c=>{const o=document.createElement('option');o.value=codeOf(c);o.dataset.title=titleOf(c);o.textContent=titleOf(c)?`${codeOf(c)} — ${titleOf(c)}`:`${codeOf(c)} — 100 Level`;el.appendChild(o)});if(old&&[...el.options].some(o=>o.value===old))el.value=old}
function renderCourseBrowser(){const grid=$('courseBrowseGrid');if(!grid)return;const rows=filteredPracticeCourses();grid.innerHTML=rows.length?'':'<div class="material-empty">No matching courses.</div>';rows.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='course-browser-card';b.innerHTML=`<strong>${esc(codeOf(c))}</strong><span>${esc(titleOf(c)||s(c.level)+' Level')}</span><small>${esc(s(c.level))} Level</small>`;b.addEventListener('click',()=>{$('courseSelect').value=codeOf(c);document.querySelectorAll('.course-browser-card').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');msg($('practiceSetupMessage'),`${codeOf(c)} selected.`,'success')});grid.appendChild(b)})}
function refreshPracticeCourses(){const rows=filteredPracticeCourses();renderCourseSelect(rows);renderCourseBrowser();fillPastPaperCourses()}
$('courseSearch')?.addEventListener('input',refreshPracticeCourses);$('courseLevelFilter')?.addEventListener('change',refreshPracticeCourses);

function renderRecent(rows){const el=$('recentCoursesList');el.innerHTML='';rows.slice(0,4).forEach(c=>{const b=document.createElement('button');b.className='recent-course';b.innerHTML=`<strong>${esc(codeOf(c))}</strong><span>${esc(titleOf(c))}</span>`;b.addEventListener('click',()=>{go('past-questions');$('courseSelect').value=codeOf(c)});el.appendChild(b)})}
function renderMaterialCourses(rows){['materialsCourseFilter','materialCourseCode'].forEach(id=>{const el=$(id);if(!el)return;el.innerHTML=id==='materialsCourseFilter'?'<option value="">All Courses</option>':'<option value="">Select Course</option>';rows.forEach(c=>{const o=document.createElement('option');o.value=id==='materialsCourseFilter'?codeOf(c).toUpperCase():codeOf(c);o.textContent=titleOf(c)?`${codeOf(c)} — ${titleOf(c)}`:codeOf(c);el.appendChild(o)})})}
function renderGroupCourses(rows){const el=$('groupCourse');if(!el)return;el.innerHTML='<option value="">Select Course</option>';rows.forEach(c=>{const o=document.createElement('option');o.value=codeOf(c);o.textContent=titleOf(c)?`${codeOf(c)} — ${titleOf(c)}`:codeOf(c);el.appendChild(o)})}
async function dashboardStats(){const {data}=await supabaseClient.from('quiz_session_results').select('total,percentage').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);const r=data||[],avg=r.length?Math.round(r.reduce((a,x)=>a+Number(x.percentage||0),0)/r.length):0,qs=r.reduce((a,x)=>a+Number(x.total||0),0);$('performanceRing').style.setProperty('--score',avg);$('performancePercent').textContent=`${avg}%`;$('performanceQuestions').textContent=qs;$('performanceSessions').textContent=r.length}
async function loadNotices(){const el=$('notificationsList');const {data,error}=await supabaseClient.from('app_notifications').select('title,message,created_at').eq('published',true).order('created_at',{ascending:false}).limit(5);if(error||!data?.length){el.innerHTML='<div class="material-empty">No notices right now.</div>';return}el.innerHTML='';data.forEach(n=>{const d=document.createElement('div');d.className='notice-item';d.innerHTML=`<strong>${esc(n.title)}</strong><p>${esc(n.message)}</p>`;el.appendChild(d)})}

/* SOLO QUIZ */
$('loadQuestionsBtn')?.addEventListener('click',startQuiz);
async function startQuiz(){
  resetYearPastPaperUi();
  const selectedCode=$('courseSelect').value.trim(),manualCode=$('manualCourseCode')?.value.trim().toUpperCase()||'',manualName=$('manualCourseName')?.value.trim()||'';
  const courseCode=selectedCode||manualCode;
  const selected=$('courseSelect').options[$('courseSelect').selectedIndex];
  const courseTitle=selectedCode?(selected?.dataset?.title||''):manualName;
  if(!courseCode){msg($('practiceSetupMessage'),'Select a listed course or enter a course code.','error');return}
  const format=$('questionType')?.value||'mcq';
  premium=isPremium(profile);const wanted=premium?Math.min(70,Math.max(1,Number($('questionCount').value)||30)):5;
  if(format==='theory'){await startTheoryPractice(courseCode,courseTitle,wanted);return}
  questions=[];answers={};reviews={};aiReviews={};qIndex=0;submitted=false;reviewMode=false;
  $('loadQuestionsBtn').disabled=true;msg($('practiceSetupMessage'),'Checking stored questions...');
  try{
    if(pendingGeneratedPractice&&pendingGeneratedPractice.format==='mcq'){questions=convertGenerated(pendingGeneratedPractice.rows,'upload_ai').slice(0,wanted);pendingGeneratedPractice=null;if(!questions.length)throw new Error('The uploaded material did not produce usable MCQs.');seconds=(Number($('sessionMinutes').value)||30)*60;$('practiceSetup').classList.add('hidden');$('resultCard').classList.add('hidden');$('quizShell').classList.remove('hidden');$('quizCourseCode').textContent=courseCode;$('quizCourseTitle').textContent=courseTitle||'Uploaded Material';renderQ();startClock();return}
    let st=premium?await supabaseClient.rpc('get_secure_quiz_questions_v3',{p_course_code:courseCode,p_limit:wanted}):await supabaseClient.rpc('get_demo_questions',{p_course_code:courseCode});
    if(!st.error&&Array.isArray(st.data))questions.push(...st.data.slice(0,wanted));
    let missing=wanted-questions.length;
    if(premium&&missing>0){msg($('practiceSetupMessage'),'Checking approved course materials...');try{const r=await supabaseClient.functions.invoke('material-practice-generator',{body:{course_code:courseCode,format:'mcq',count:Math.min(30,missing)}});if(!r.error&&r.data?.material_found&&Array.isArray(r.data.validated_questions)){questions.push(...convertGenerated(r.data.validated_questions,'material_ai'));missing=wanted-questions.length}}catch(e2){console.warn('material fallback skipped',e2)}}
    if(missing>0&&(premium||questions.length===0)){msg($('practiceSetupMessage'),'Nexus AI is preparing remaining questions...');questions.push(...await generalAi(courseCode,courseTitle,missing))}
    const seen=new Set();questions=questions.filter(q=>{const k=s(q.question_text).trim().toLowerCase();if(!k||seen.has(k))return false;seen.add(k);return true}).slice(0,wanted);
    if(!questions.length)throw new Error('No questions could be prepared for this course.');
    seconds=(Number($('sessionMinutes').value)||30)*60;$('practiceSetup').classList.add('hidden');$('resultCard').classList.add('hidden');$('theoryResultCard')?.classList.add('hidden');$('theoryShell')?.classList.add('hidden');$('quizShell').classList.remove('hidden');$('submitQuizBtn').classList.remove('hidden');$('quizCourseCode').textContent=courseCode;$('quizCourseTitle').textContent=courseTitle||'Practice Session';renderQ();startClock()
  }catch(e2){msg($('practiceSetupMessage'),e2.message||'Unable to prepare questions.','error')}finally{$('loadQuestionsBtn').disabled=false}
}
function convertGenerated(rows,source){const letters=['A','B','C','D'];return rows.map((x,i)=>{if(!x?.question||!Array.isArray(x.options)||x.options.length<4)return null;const ci=Number(x.correct_index);if(!Number.isInteger(ci)||ci<0||ci>3)return null;const id=`${source}_${Date.now()}_${i}_${Math.random().toString(36).slice(2,7)}`;aiReviews[id]={correct_option:letters[ci],answer_text:x.answer||x.options[ci],explanation:x.explanation||'Validated by Nexus AI.',is_ai:true};return{id,question_text:x.question,option_a:x.options[0],option_b:x.options[1],option_c:x.options[2],option_d:x.options[3],nexus_ai:true,source_mode:source}}).filter(Boolean)}
async function generalAi(courseCode,courseTitle,count){const all=[];while(all.length<count){const n=Math.min(10,count-all.length);const g=await supabaseClient.functions.invoke('ai-question-generator',{body:{action:'web_generate',format:'mcq',count:n,topic:studyAiTopic('mcq',courseCode,courseTitle)}});if(g.error||g.data?.error)throw new Error(g.data?.message||'Nexus AI could not prepare this practice set. Please try again.');const qs=g.data?.result?.questions;if(!Array.isArray(qs)||!qs.length)break;let pass=qs;try{const v=await supabaseClient.functions.invoke('ai-question-generator',{body:{action:'web_validate',format:'mcq',topic:courseCode,questions:qs}});const checked=v.data?.result?.validated_questions;if(!v.error&&Array.isArray(checked)&&checked.length)pass=checked}catch(e){console.warn('MCQ validation fallback: using normalized generated set',e)}all.push(...convertGenerated(pass,'general_ai'));if(pass.length<n)break}return all.slice(0,count)}
function startClock(){stopTimer();$('quizTimer').textContent=fmt(seconds);timer=setInterval(async()=>{seconds--;$('quizTimer').textContent=fmt(seconds);if(seconds<=0){stopTimer();await submitQuiz(true)}},1000)}
function renderQ(){const q=questions[qIndex];if(!q)return;$('questionNumber').textContent=`Question ${qIndex+1}`;$('questionText').textContent=q.question_text;$('quizProgress').textContent=`${qIndex+1} / ${questions.length}`;$('progressBar').style.width=`${((qIndex+1)/questions.length)*100}%`;$('previousQuestionBtn').disabled=qIndex===0;$('nextQuestionBtn').disabled=qIndex===questions.length-1;$('mcqOptions').innerHTML='';['A','B','C','D','E'].forEach(l=>{const t=opt(q,l);if(!t)return;const b=document.createElement('button');b.className='option-button'+(answers[q.id]===l?' selected':'');b.disabled=submitted;b.innerHTML=`<span class="option-key">${l}</span><span>${esc(t)}</span>`;b.addEventListener('click',()=>{if(submitted)return;answers[q.id]=l;renderQ()});$('mcqOptions').appendChild(b)});renderNav();if(submitted&&reviewMode)renderReview(q);else $('reviewBox').classList.add('hidden')}
function renderNav(){$('questionNavigator').innerHTML='';questions.forEach((q,i)=>{const b=document.createElement('button');b.className='question-chip'+(i===qIndex?' active':'')+(answers[q.id]?' answered':'');b.textContent=i+1;b.addEventListener('click',()=>{qIndex=i;renderQ()});$('questionNavigator').appendChild(b)})}
$('previousQuestionBtn')?.addEventListener('click',()=>{if(qIndex>0){qIndex--;renderQ()}});$('nextQuestionBtn')?.addEventListener('click',()=>{if(qIndex<questions.length-1){qIndex++;renderQ()}});$('submitQuizBtn')?.addEventListener('click',()=>submitQuiz(false));
$('quitQuizBtn')?.addEventListener('click',()=>{if(!confirm('Quit this Past Questions session?\nYour current answers in this session will be lost.'))return;stopTimer();questions=[];answers={};reviews={};aiReviews={};qIndex=0;submitted=false;reviewMode=false;$('quizShell').classList.add('hidden');$('resultCard').classList.add('hidden');resetYearPastPaperUi();$('practiceSetup').classList.remove('hidden');$('submitQuizBtn').classList.remove('hidden');msg($('practiceSetupMessage'),'Session closed. Choose a course when you are ready.','info')});
async function submitQuiz(timed=false){if(submitted)return;if(!timed&&!confirm(`Submit now?\nAnswered ${Object.keys(answers).length} of ${questions.length}.`))return;stopTimer();$('submitQuizBtn').disabled=true;try{if(pastPaperMode)await scoreYearPastPaper();else if(premium)await scorePremium();else await scoreFree();submitted=true;$('quizShell').classList.add('hidden');$('resultCard').classList.remove('hidden')}catch(e2){alert(e2.message||'Unable to submit.')}finally{$('submitQuizBtn').disabled=false}}
async function scorePremium(){reviews={};let correct=0,verifiedSaved=false;const stored=questions.filter(q=>!q.nexus_ai),ai=questions.filter(q=>q.nexus_ai);if(stored.length){const a={};stored.forEach(q=>a[String(q.id)]=answers[q.id]||'');if(ai.length===0){const sc=await supabaseClient.rpc('submit_secure_solo_quiz',{p_course_code:$('quizCourseCode').textContent,p_course_title:$('quizCourseTitle').textContent,p_answers:a});if(sc.error)throw sc.error;const sr=row(sc.data);correct=Number(sr.correct??0)||0;verifiedSaved=true}else{const sc=await supabaseClient.rpc('score_secure_quiz',{p_answers:a});if(sc.error)throw sc.error;const sr=row(sc.data);correct+=Number(sr.correct??sr.correct_count??0)||0}const rv=await supabaseClient.rpc('review_secure_quiz',{p_answers:a});if(rv.error)throw rv.error;(Array.isArray(rv.data)?rv.data:[]).forEach(r=>reviews[r.id??r.question_id]=r)}ai.forEach(q=>{const r=aiReviews[q.id];if(!r)return;const selected=s(answers[q.id]).toUpperCase(),ok=!!selected&&selected===s(r.correct_option).toUpperCase();if(ok)correct++;reviews[q.id]={...r,selected_option:selected,is_correct:ok}});await finishSolo(correct,verifiedSaved)}
async function scoreFree(){reviews={};let correct=0;const a={};for(const q of questions){const selected=s(answers[q.id]).toUpperCase();a[String(q.id)]=selected;if(!selected){reviews[q.id]={selected_option:'',correct_option:'',explanation:'You did not answer this question.',is_correct:false};continue}const {data,error}=await supabaseClient.rpc('answer_demo_question',{p_question_id:q.id,p_selected_option:selected});if(error)throw error;const r=row(data);reviews[q.id]={...r,selected_option:selected};if(r.is_correct)correct++}let verifiedSaved=false;try{const save=await supabaseClient.rpc('submit_demo_solo_quiz',{p_course_code:$('quizCourseCode').textContent,p_course_title:$('quizCourseTitle').textContent,p_answers:a});if(!save.error)verifiedSaved=true}catch(_){}await finishSolo(correct,verifiedSaved)}
async function finishSolo(correct,verifiedSaved=false){const total=questions.length,pct=total?Math.round(correct/total*100):0;$('resultTitle').textContent=pct>=70?'Strong Performance':pct>=50?'Good Attempt':'Keep Practising';$('resultSummary').textContent=`You scored ${correct} out of ${total}. ${verifiedSaved?'This verified session counts toward Solo Learning rank.':'AI-assisted sessions are saved to your history but do not change the secure leaderboard.'}`;$('resultStats').innerHTML=`<div><strong>${correct}/${total}</strong><span>SCORE</span></div><div><strong>${pct}%</strong><span>PERCENTAGE</span></div><div><strong>${Object.keys(answers).length}</strong><span>ANSWERED</span></div>`;if(!verifiedSaved){try{await supabaseClient.from('quiz_session_results').insert({user_id:user.id,course_code:$('quizCourseCode').textContent,course_title:$('quizCourseTitle').textContent,session_type:questions.some(q=>q.nexus_ai)?'nexus_ai':'solo',question_format:'mcq',score:correct,total,percentage:pct,source_breakdown:{stored:questions.filter(q=>!q.nexus_ai).length,ai:questions.filter(q=>q.nexus_ai).length},verified_for_leaderboard:false})}catch(e2){console.warn(e2)}}dashboardStats();if(!pageMap['solo-learning']?.classList.contains('hidden'))loadSoloLeaderboard()}
$('reviewAnswersBtn')?.addEventListener('click',()=>{reviewMode=true;submitted=true;qIndex=0;$('resultCard').classList.add('hidden');$('quizShell').classList.remove('hidden');$('submitQuizBtn').classList.add('hidden');renderQ()});const quizExplanationCache=new Map(),quizExplanationPending=new Set();
function weakQuizExplanation(value){
 const t=s(value).trim();
 return t.length<160||/from .*lecturer note|directly matches the definition|distractors do not match|this follows from the definition, formula, identity, or calculation required|this is the standard mathematical\/statistical definition|because it is correct/i.test(t);
}
async function enrichQuizExplanation(questionId){
 if(!Number.isSafeInteger(Number(questionId))||quizExplanationPending.has(questionId)||quizExplanationCache.has(questionId))return;
 quizExplanationPending.add(questionId);
 try{
  const {data,error}=await supabaseClient.functions.invoke('cached-quiz-explanation',{body:{question_id:Number(questionId)}});
  if(error||!data?.explanation||!['draft','approved','original'].includes(data.status))return;
  const explanation=s(data.explanation).trim();
  if(explanation.length<100)return;
  quizExplanationCache.set(questionId,{explanation,status:data.status});
  if(reviewMode&&submitted&&questions[qIndex]?.id===questionId)renderReview(questions[qIndex]);
 }catch(error){console.warn('Review explanation currently unavailable',error)}
 finally{quizExplanationPending.delete(questionId)}
}
function renderReview(q){
 const r=reviews[q.id],box=$('reviewBox');
 box.classList.remove('hidden');
 const original=s(r?.explanation||r?.answer_explanation);
 const cached=quizExplanationCache.get(q.id);
 const explanation=cached?.explanation||original||'Explanation is pending review.';
 const aiLabel=cached?.status==='draft'?'<p><small>AI-generated explanation — not yet academically verified.</small></p>':'';
 box.innerHTML=r?`<h4>${r.is_correct?'Correct':'Review this question'}</h4><p class="review-original-question">${esc(q.question_text||'Question unavailable.')}</p><p><strong>Your Answer:</strong> ${esc(r.selected_option||'No answer')}</p><p><strong>Correct Answer:</strong> ${esc(r.correct_option??r.correct_answer??'Unavailable')}${r.answer_text?' — '+esc(r.answer_text):''}</p><p><strong>Explanation:</strong> ${esc(explanation)}</p>${aiLabel}`:'Review unavailable.';
 // Only request a more specific explanation after the student has submitted.
 // The server rechecks authorization, caches drafts and never edits answer keys.
 if(r&&submitted&&reviewMode&&!cached&&weakQuizExplanation(original))void enrichQuizExplanation(q.id);
}
$('newSessionBtn')?.addEventListener('click',()=>{stopTimer();questions=[];answers={};reviews={};aiReviews={};submitted=false;reviewMode=false;qIndex=0;resetYearPastPaperUi();$('practiceSetup').classList.remove('hidden');$('quizShell').classList.add('hidden');$('theoryShell')?.classList.add('hidden');$('resultCard').classList.add('hidden');$('theoryResultCard')?.classList.add('hidden');$('submitQuizBtn').classList.remove('hidden');msg($('practiceSetupMessage'),'')});



function quitPracticeSession(kind='quiz'){if(!confirm('Quit this session? Your unfinished answers will not be submitted.'))return;stopTimer();questions=[];answers={};reviews={};theoryQuestions=[];theoryAnswers={};theoryGrades={};submitted=false;reviewMode=false;qIndex=0;$('quizShell')?.classList.add('hidden');$('theoryShell')?.classList.add('hidden');$('resultCard')?.classList.add('hidden');$('theoryResultCard')?.classList.add('hidden');resetYearPastPaperUi();$('practiceSetup')?.classList.remove('hidden');msg($('practiceSetupMessage'),'Session closed. Choose another course or start again.','info')}
$('quitPracticeBtn')?.addEventListener('click',()=>quitPracticeSession('mcq'));

/* SOLO LEARNING */
function renderSoloFilters(){
 const level=$('soloLevelFilter'),dept=$('soloDepartmentFilter');if(!level||!dept)return;
 const oldLevel=level.value,oldDept=dept.value;
 const all=[...verifiedProgrammeCourses,...departmentCurriculum,...courses];
 const levels=[...new Set(all.map(c=>pastPaperLevel(c)).filter(Boolean))].sort((a,b)=>(parseInt(a)||999)-(parseInt(b)||999));
 const registered=[...document.querySelectorAll('#signupProgramme option')].map(x=>s(x.value).trim()).filter(Boolean);
 const depts=[...new Set([...registered,...verifiedProgrammeCourses.map(x=>x.department),...departmentCurriculum.map(x=>x.department)].map(canonicalPastPaperDept).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 level.innerHTML='<option value="">All Levels</option>'+levels.map(v=>`<option value="${esc(v)}">${esc(v)} Level</option>`).join('');
 dept.innerHTML='<option value="">All Departments</option>'+depts.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
 if(levels.includes(oldLevel))level.value=oldLevel;if(depts.includes(oldDept))dept.value=oldDept;
}
function renderSoloCourses(){const grid=$('soloCoursesGrid');if(!grid)return;const q=s($('soloCourseSearch')?.value).trim().toLowerCase(),lv=$('soloLevelFilter')?.value||'',dp=$('soloDepartmentFilter')?.value||'';const src=dp?[...verifiedProgrammeCourses,...departmentCurriculum,...courses]:courses;
 const match=src.filter(c=>(!q||(codeOf(c)+' '+titleOf(c)+' '+s(c.department)).toLowerCase().includes(q))&&(!lv||pastPaperLevel(c)===lv)&&(!dp||(canonicalPastPaperDept(s(c.department))===dp||pastPaperLevel(c)==='100'&&s(c.department)==='All Programmes')));
 const unique=new Map();for(const c of match){const key=normalCourseCode(codeOf(c));if(!key)continue;if(!unique.has(key))unique.set(key,c)}
 const rows=[...unique.values()].sort((a,b)=>codeOf(a).localeCompare(codeOf(b)));grid.innerHTML=rows.length?'':'<div class="material-empty">No matching courses.</div>';rows.forEach(c=>{const d=document.createElement('article');d.className='solo-course-card';d.innerHTML=`<span class="course-code">${esc(codeOf(c))}</span><h3>${esc(titleOf(c)||'Course')}</h3><p>${esc([c.level,c.department].filter(Boolean).join(' • '))}</p><div class="solo-course-actions"><button class="secondary-btn solo-mcq" type="button">MCQ</button><button class="primary-btn solo-theory" type="button">Theory</button></div>`;d.querySelector('.solo-mcq').addEventListener('click',()=>openSoloCourse(c,'mcq'));d.querySelector('.solo-theory').addEventListener('click',()=>openSoloCourse(c,'theory'));grid.appendChild(d)})}
function openSoloCourse(c,format){
 go('past-questions');
 const choice=$('courseSelect'),matched=choice&&[...choice.options].find(o=>normalCourseCode(o.value)===normalCourseCode(codeOf(c)));
 if(choice)choice.value=matched?.value||'';
 $('manualCourseCode').value=matched?'':codeOf(c);
 $('manualCourseName').value=matched?'':titleOf(c);
 $('questionType').value=format;
 msg($('practiceSetupMessage'),`${codeOf(c)} selected for ${format==='theory'?'Theory':'MCQ'} practice.`,'success');
}
async function loadSoloLearning(){renderSoloFilters();renderSoloCourses();await loadSoloLeaderboard()}
async function loadSoloLeaderboard(){const box=$('soloLeaderboard');if(!box)return;box.innerHTML='<div class="material-empty">Loading leaderboard...</div>';const {data,error}=await supabaseClient.rpc('get_solo_learning_leaderboard',{p_limit:10});if(error){box.innerHTML=`<div class="material-empty">${esc(error.message)}</div>`;return}const rows=Array.isArray(data)?data:[];box.innerHTML=rows.length?'':'<div class="material-empty">No ranked Solo Learning sessions yet.</div>';let myRank=null;rows.forEach((r,i)=>{const d=document.createElement('div');const mine=r.user_id===user?.id;if(mine)myRank=i+1;d.className='solo-leader-row'+(mine?' me':'');d.innerHTML=`<div class="solo-rank">#${i+1}</div><div><strong>${esc(r.display_name||'Student')}</strong><span>${esc(r.sessions??0)} sessions • ${esc(r.total_questions??0)} questions</span></div><div class="solo-score">${Number(r.average_percentage||0).toFixed(1)}%</div>`;box.appendChild(d)});$('soloRankDetail').textContent=myRank?`#${myRank} in Top 10`:'Complete a verified MCQ session to rank.'}
$('soloCourseSearch')?.addEventListener('input',renderSoloCourses);$('soloLevelFilter')?.addEventListener('change',renderSoloCourses);$('soloDepartmentFilter')?.addEventListener('change',renderSoloCourses);
$('soloManualMcqBtn')?.addEventListener('click',()=>openManualSolo('mcq'));$('soloManualTheoryBtn')?.addEventListener('click',()=>openManualSolo('theory'));
function openManualSolo(format){const code=$('soloManualCode').value.trim().toUpperCase(),name=$('soloManualName').value.trim();if(!code){msg($('soloManualMessage'),'Enter the course code first.','error');return}go('past-questions');$('courseSelect').value='';$('manualCourseCode').value=code;$('manualCourseName').value=name;$('questionType').value=format;msg($('practiceSetupMessage'),`${code}${name?' — '+name:''} will use Nexus AI Practice if stored content is unavailable.`,'success')}

/* INDIVIDUAL THEORY PRACTICE */
async function startTheoryPractice(courseCode,courseTitle,wanted){theoryQuestions=[];theoryAnswers={};theoryGrades={};theoryIndex=0;theoryReviewMode=false;theoryCourseCode=courseCode;theoryCourseTitle=courseTitle||'Theory Practice';$('loadQuestionsBtn').disabled=true;msg($('practiceSetupMessage'),'Preparing Theory practice...');try{if(pendingGeneratedPractice&&pendingGeneratedPractice.format==='theory'){theoryQuestions=convertTheory(pendingGeneratedPractice.rows,'upload_ai').slice(0,wanted);pendingGeneratedPractice=null;if(!theoryQuestions.length)throw new Error('The uploaded material did not produce usable Theory questions.');seconds=(Number($('sessionMinutes').value)||30)*60;$('practiceSetup').classList.add('hidden');$('theoryResultCard').classList.add('hidden');$('theoryShell').classList.remove('hidden');$('theoryCourseCode').textContent=courseCode;$('theoryCourseTitle').textContent=courseTitle||'Uploaded Material';renderTheoryQ();startTheoryClock();return}let missing=wanted;if(premium){try{const r=await supabaseClient.functions.invoke('material-practice-generator',{body:{course_code:courseCode,format:'theory',count:Math.min(30,missing)}});if(!r.error&&r.data?.material_found&&Array.isArray(r.data.validated_questions)){theoryQuestions.push(...convertTheory(r.data.validated_questions,'material_ai'));missing=wanted-theoryQuestions.length}}catch(e){console.warn('theory material fallback skipped',e)}}if(missing>0){theoryQuestions.push(...await generalTheoryAi(courseCode,courseTitle,missing))}const seen=new Set();theoryQuestions=theoryQuestions.filter(q=>{const k=s(q.question_text).trim().toLowerCase();if(!k||seen.has(k))return false;seen.add(k);return true}).slice(0,wanted);if(!theoryQuestions.length)throw new Error('No Theory questions could be prepared for this course.');seconds=(Number($('sessionMinutes').value)||30)*60;$('practiceSetup').classList.add('hidden');$('quizShell').classList.add('hidden');$('resultCard').classList.add('hidden');$('theoryResultCard').classList.add('hidden');$('theoryShell').classList.remove('hidden');$('theoryCourseCode').textContent=courseCode;$('theoryCourseTitle').textContent=courseTitle||'Theory Practice';renderTheoryQ();startTheoryClock()}catch(e){msg($('practiceSetupMessage'),e.message||'Unable to prepare Theory practice.','error')}finally{$('loadQuestionsBtn').disabled=false}}
function convertTheory(rows,source){return rows.map((x,i)=>{const text=s(x?.question||x?.question_text).trim();if(!text)return null;return{id:`th_${source}_${Date.now()}_${i}_${Math.random().toString(36).slice(2,6)}`,question_text:text,marks:Math.min(20,Math.max(1,Number(x.marks)||10)),explanation:s(x.explanation),model_answer:s(x.model_answer||x.answer),marking_guide:s(x.marking_guide),source_mode:source}}).filter(Boolean)}
async function generalTheoryAi(courseCode,courseTitle,count){const all=[];while(all.length<count){const n=Math.min(10,count-all.length);const g=await supabaseClient.functions.invoke('ai-question-generator',{body:{action:'web_generate',format:'theory',count:n,topic:studyAiTopic('theory',courseCode,courseTitle)}});if(g.error||g.data?.error)throw new Error(g.data?.message||'Nexus AI could not prepare Theory questions right now. Please try again.');const qs=g.data?.result?.questions;if(!Array.isArray(qs)||!qs.length)break;let pass=qs;try{const v=await supabaseClient.functions.invoke('ai-question-generator',{body:{action:'web_validate',format:'theory',topic:courseCode,questions:qs}});const checked=v.data?.result?.validated_questions;if(!v.error&&Array.isArray(checked)&&checked.length)pass=checked}catch(e){console.warn('Theory validation fallback: using normalized generated set',e)}const converted=convertTheory(pass,'general_ai');all.push(...converted);if(converted.length===0||pass.length<n)break}return all.slice(0,count)}
function startTheoryClock(){stopTimer();$('theoryTimer').textContent=fmt(seconds);timer=setInterval(async()=>{seconds--;$('theoryTimer').textContent=fmt(seconds);if(seconds<=0){stopTimer();await submitTheory(true)}},1000)}
function saveTheoryAnswer(){const q=theoryQuestions[theoryIndex];if(q)theoryAnswers[q.id]=$('theoryAnswer').value}
function renderTheoryQ(){const q=theoryQuestions[theoryIndex];if(!q)return;$('theoryQuestionNumber').textContent=`Question ${theoryIndex+1}`;$('theoryQuestionText').textContent=q.question_text;$('theoryProgress').textContent=`${theoryIndex+1} / ${theoryQuestions.length}`;$('theoryProgressBar').style.width=`${((theoryIndex+1)/theoryQuestions.length)*100}%`;$('theoryPreviousBtn').disabled=theoryIndex===0;$('theoryNextBtn').disabled=theoryIndex===theoryQuestions.length-1;$('theoryAnswer').value=theoryAnswers[q.id]||'';$('theoryAnswer').disabled=theoryReviewMode;$('theoryReviewBox').classList.toggle('hidden',!theoryReviewMode);if(theoryReviewMode){const g=theoryGrades[q.id]||{};$('theoryReviewBox').innerHTML=`<h4>Score: ${esc(g.score??0)}/${esc(g.max_score??q.marks)}</h4><p class="review-original-question">${esc(q.question_text||'Question unavailable.')}</p><p><strong>Your answer:</strong> ${esc(theoryAnswers[q.id]||'No answer')}</p><p><strong>Feedback:</strong> ${esc(g.feedback||'No feedback available.')}</p><div class="theory-review-list">${(g.strengths||[]).map(x=>`<div><strong>Strength:</strong> ${esc(x)}</div>`).join('')}${(g.missing_points||[]).map(x=>`<div><strong>Missing:</strong> ${esc(x)}</div>`).join('')}</div><p><strong>Suggested Answer:</strong> ${esc(g.suggested_answer||q.model_answer||'')}</p>`}renderTheoryNav()}
function renderTheoryNav(){$('theoryNavigator').innerHTML='';theoryQuestions.forEach((q,i)=>{const b=document.createElement('button');b.className='question-chip'+(i===theoryIndex?' active':'')+(s(theoryAnswers[q.id]).trim()?' answered':'');b.textContent=String(i+1);b.addEventListener('click',()=>{saveTheoryAnswer();theoryIndex=i;renderTheoryQ()});$('theoryNavigator').appendChild(b)})}
$('theoryPreviousBtn')?.addEventListener('click',()=>{saveTheoryAnswer();if(theoryIndex>0){theoryIndex--;renderTheoryQ()}});$('theoryNextBtn')?.addEventListener('click',()=>{saveTheoryAnswer();if(theoryIndex<theoryQuestions.length-1){theoryIndex++;renderTheoryQ()}});$('theoryAnswer')?.addEventListener('input',()=>{const q=theoryQuestions[theoryIndex];if(q)theoryAnswers[q.id]=$('theoryAnswer').value;renderTheoryNav()});$('submitTheoryBtn')?.addEventListener('click',()=>submitTheory(false));
$('quitTheoryBtn')?.addEventListener('click',()=>{saveTheoryAnswer();if(!confirm('Quit this Theory session?\nYour current answers in this session will be lost.'))return;stopTimer();theoryQuestions=[];theoryAnswers={};theoryGrades={};theoryIndex=0;theoryReviewMode=false;$('theoryShell').classList.add('hidden');$('theoryResultCard').classList.add('hidden');$('practiceSetup').classList.remove('hidden');$('submitTheoryBtn').classList.remove('hidden');msg($('practiceSetupMessage'),'Theory session closed. Choose a course when you are ready.','info')});
async function submitTheory(timedOut=false){saveTheoryAnswer();if(!timedOut&&!confirm(`Submit Theory session?\nAnswered ${Object.values(theoryAnswers).filter(v=>s(v).trim()).length} of ${theoryQuestions.length}.`))return;stopTimer();$('submitTheoryBtn').disabled=true;try{theoryGrades={};let totalScore=0,totalMarks=0;for(let i=0;i<theoryQuestions.length;i+=30){const batch=theoryQuestions.slice(i,i+30),items=batch.map(q=>({question:q.question_text,answer:s(theoryAnswers[q.id]).trim()||'No answer provided.',marks:q.marks,model_answer:q.model_answer||'',marking_guide:q.marking_guide||'',explanation:q.explanation||'',ai_generated:true}));const r=await supabaseClient.functions.invoke('solo-theory-grade',{body:{course_code:theoryCourseCode,items}});if(r.error||r.data?.error)throw new Error(r.data?.error||r.error?.message||'Theory grading failed');(r.data?.grades||[]).forEach((g,k)=>{const q=batch[k];if(!q)return;theoryGrades[q.id]=g;totalScore+=Number(g.score)||0;totalMarks+=Number(g.max_score)||q.marks})}const pct=totalMarks?Math.round(totalScore/totalMarks*100):0;$('theoryResultTitle').textContent=pct>=70?'Strong Theory Performance':pct>=50?'Good Theory Attempt':'Keep Improving';$('theoryResultSummary').textContent=`Nexus AI graded your Theory practice at ${pct}%. Theory sessions are saved to history but do not affect the secure Solo leaderboard.`;$('theoryResultStats').innerHTML=`<div><strong>${totalScore.toFixed(1)}/${totalMarks}</strong><span>SCORE</span></div><div><strong>${pct}%</strong><span>PERCENTAGE</span></div><div><strong>${Object.values(theoryAnswers).filter(v=>s(v).trim()).length}</strong><span>ANSWERED</span></div>`;try{await supabaseClient.from('quiz_session_results').insert({user_id:user.id,course_code:theoryCourseCode,course_title:theoryCourseTitle,session_type:'nexus_ai',question_format:'theory',score:totalScore,total:totalMarks,percentage:pct,source_breakdown:{theory:true,ai:theoryQuestions.length},verified_for_leaderboard:false})}catch(e){console.warn(e)}$('theoryShell').classList.add('hidden');$('theoryResultCard').classList.remove('hidden');dashboardStats()}catch(e){console.error('Theory grading failed',e);alert('Nexus AI could not grade this Theory session right now. Please check your connection and try Submit again.')}finally{$('submitTheoryBtn').disabled=false}}
$('reviewTheoryBtn')?.addEventListener('click',()=>{theoryReviewMode=true;theoryIndex=0;$('theoryResultCard').classList.add('hidden');$('theoryShell').classList.remove('hidden');$('submitTheoryBtn').classList.add('hidden');renderTheoryQ()});$('newTheorySessionBtn')?.addEventListener('click',()=>{stopTimer();theoryQuestions=[];theoryAnswers={};theoryGrades={};theoryReviewMode=false;$('theoryShell').classList.add('hidden');$('theoryResultCard').classList.add('hidden');$('practiceSetup').classList.remove('hidden');$('submitTheoryBtn').classList.remove('hidden');msg($('practiceSetupMessage'),'')});

/* NEXUS AI */
const NEXUS_HISTORY_KEY='nexus_ai_history_v1';
let nexusThread=[];
function loadNexusHistory(){try{return JSON.parse(localStorage.getItem(NEXUS_HISTORY_KEY)||'[]')}catch{return[]}}
function saveNexusHistory(rows){localStorage.setItem(NEXUS_HISTORY_KEY,JSON.stringify(rows.slice(0,40)))}
function renderNexusHistory(){const el=$('nexusHistoryList');if(!el)return;const rows=loadNexusHistory();el.innerHTML=rows.length?'':'<div class="history-empty">Your previous Nexus AI questions will appear here.</div>';rows.forEach((x,i)=>{const b=document.createElement('button');b.type='button';b.className='nexus-history-item';b.innerHTML=`<strong>${esc((x.question||'Conversation').slice(0,55))}</strong><small>${esc(x.when||'Previous')}</small>`;b.onclick=()=>{const c=$('nexusConversation');c.innerHTML='';addChat('You',x.question,'user-message');addChat('Nexus AI',x.answer,'ai-message')};el.appendChild(b)})}
function rememberNexus(q,a){const rows=loadNexusHistory();rows.unshift({question:q,answer:a,when:new Date().toLocaleString()});saveNexusHistory(rows);renderNexusHistory()}
function setNexusMode(mode){document.querySelectorAll('.nexus-mode').forEach(b=>b.classList.toggle('active',b.dataset.nexusMode===mode));$('nexusChatMode')?.classList.toggle('hidden',mode!=='chat');$('nexusGenerateMode')?.classList.toggle('hidden',mode!=='generate');$('nexusUploadMode')?.classList.toggle('hidden',mode!=='upload')}
document.querySelectorAll('.nexus-mode').forEach(b=>b.addEventListener('click',()=>setNexusMode(b.dataset.nexusMode)));
$('newNexusChatBtn')?.addEventListener('click',()=>{$('nexusConversation').innerHTML='<div class="ai-message"><strong>Nexus AI</strong><p>New conversation. What would you like to study?</p></div>';setNexusMode('chat')});
$('openPastQuestionsFromAi')?.addEventListener('click',()=>go('past-questions'));
$('openMaterialUploadBtn')?.addEventListener('click',async()=>{const f=$('nexusUploadFile')?.files?.[0];if(!f){alert('Choose a PDF, TXT or image first.');return}const format=$('nexusUploadType')?.value||'mcq',count=Math.min(30,Number($('nexusUploadCount')?.value)||10),topic=$('nexusUploadTopic')?.value.trim()||f.name;try{$('openMaterialUploadBtn').disabled=true;$('openMaterialUploadBtn').textContent='Nexus AI is reading your material…';let body={action:'generate',format,count,topic};if(f.type==='text/plain'||f.name.toLowerCase().endsWith('.txt'))body.source_text=await f.text();else{const buf=await f.arrayBuffer();let bin='';const bytes=new Uint8Array(buf);for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));body.file_base64=btoa(bin);body.mime_type=f.type||'application/pdf'}const r=await supabaseClient.functions.invoke('ai-question-generator',{body});if(r.error||r.data?.error)throw new Error(r.data?.message||r.data?.error||r.error?.message);const generated=r.data?.result?.questions||[];if(!generated.length)throw new Error('No usable questions were generated from this material.');pendingGeneratedPractice={format,topic,rows:generated,count};go('past-questions');$('courseSelect').value='';$('manualCourseCode').value='UPLOAD';$('manualCourseName').value=topic;$('questionType').value=format;$('questionCount').value=String(count);msg($('practiceSetupMessage'),`${generated.length} ${format.toUpperCase()} questions were generated from your upload. Choose a timer and press Start Practice.`,'success')}catch(e){alert(e.message||'Nexus AI could not generate questions from this upload.')}finally{$('openMaterialUploadBtn').disabled=false;$('openMaterialUploadBtn').textContent='Generate from Upload'}});
$('nexusGenerateBtn')?.addEventListener('click',async()=>{const prompt=$('nexusGeneratePrompt')?.value.trim();if(!prompt){msg($('nexusGenerateMessage'),'Describe the course or topic first.','error');return}const format=$('nexusGenerateType').value,count=Math.min(30,Number($('nexusGenerateCount').value)||10);$('nexusGenerateBtn').disabled=true;msg($('nexusGenerateMessage'),`Nexus AI is generating ${count} ${format.toUpperCase()} questions…`);try{const r=await supabaseClient.functions.invoke('ai-question-generator',{body:{action:'web_generate',format,count,topic:prompt}});if(r.error||r.data?.error)throw new Error(r.data?.message||r.data?.error||r.error?.message);const rows=r.data?.result?.questions||[];if(!rows.length)throw new Error('Nexus AI did not return usable questions.');pendingGeneratedPractice={format,topic:prompt,rows,count};const m=prompt.toUpperCase().match(/\b[A-Z]{2,4}\s*-?\s*\d{3}\b/);go('past-questions');$('courseSelect').value='';$('manualCourseCode').value=m?m[0].replace(/\s*-\s*/,' ').trim():'AI';$('manualCourseName').value=prompt;$('questionType').value=format;$('questionCount').value=String(count);msg($('practiceSetupMessage'),`${rows.length} ${format.toUpperCase()} questions were generated by Nexus AI. Choose a timer and press Start Practice.`,'success')}catch(e){msg($('nexusGenerateMessage'),e.message||'Nexus AI could not generate the questions.','error')}finally{$('nexusGenerateBtn').disabled=false}});
$('nexusAskForm')?.addEventListener('submit',async e=>{e.preventDefault();const q=$('nexusQuestion').value.trim();if(!q)return;addChat('You',q,'user-message');$('nexusQuestion').value='';$('nexusAskBtn').disabled=true;msg($('nexusStatus'),'Nexus AI is thinking...');try{const r=await supabaseClient.functions.invoke('ai-tutor',{body:{action:'explain',question:q,programme:profile?.programme||'',style:$('nexusStyle').value,format_instruction:'Give a moderate, clear student-friendly answer with short headings, short paragraphs and lists when useful.'}});if(r.error)throw r.error;const a=s(r.data?.answer).trim();if(!a)throw new Error(r.data?.error||'Nexus AI returned an empty response.');addChat('Nexus AI',a,'ai-message');rememberNexus(q,a);const u=r.data?.ai_usage;const sourceNote=r.data?.source_mode==='general_ai_unverified'?' • General academic explanation (not verified against BMU materials)':r.data?.source_mode==='approved_bmu_resources'?' • Based on matched BMU study resources':r.data?.source_mode==='web_verified'?' • Web-grounded explanation':'';msg($('nexusStatus'),(u?`Today: ${u.used??0}/${u.daily_limit??'?'} requests used • ${u.remaining??'?'} remaining`:'')+sourceNote,'success')}catch(e2){addChat('Nexus AI',e2.message||'Unable to connect right now.','ai-message');msg($('nexusStatus'),e2.message||'Unable to connect.','error')}finally{$('nexusAskBtn').disabled=false}});
function nexusRichText(text){
  let raw=s(text).replace(/<br\s*\/?>/gi,"\n").replace(/\\n/g,"\n").trim();
  // Escape provider output first so AI-generated HTML can never execute.
  raw=esc(raw);
  const lines=raw.split(/\r?\n/),out=[];
  let list=null,items=[];
  const inline=v=>v
    .replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g,"<strong>$1</strong>")
    .replace(/`([^`\n]+)`/g,"<code>$1</code>");
  const flush=()=>{if(!list)return;out.push(`<${list}>${items.map(x=>`<li>${inline(x)}</li>`).join("")}</${list}>`);list=null;items=[]};
  for(let i=0;i<lines.length;i++){
    const t=lines[i].trim();
    if(!t){flush();continue}
    // Convert simple Markdown tables into a clean responsive HTML table.
    if(t.startsWith('|')&&t.endsWith('|')&&i+1<lines.length&&/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[i+1])){
      flush();const heads=t.slice(1,-1).split('|').map(x=>inline(x.trim()));i+=2;const rows=[];
      while(i<lines.length){const r=lines[i].trim();if(!(r.startsWith('|')&&r.endsWith('|'))){i--;break}rows.push(r.slice(1,-1).split('|').map(x=>inline(x.trim())));i++}
      out.push(`<div class="nexus-table-wrap"><table class="nexus-table"><thead><tr>${heads.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue
    }
    let m=t.match(/^#{1,3}\s+(.+)$/);if(m){flush();out.push(`<h4>${inline(m[1])}</h4>`);continue}
    m=t.match(/^[-*•]\s+(.+)$/);if(m){if(list&&list!=="ul")flush();list="ul";items.push(m[1]);continue}
    m=t.match(/^\d+[.)]\s+(.+)$/);if(m){if(list&&list!=="ol")flush();list="ol";items.push(m[1]);continue}
    flush();out.push(`<p>${inline(t)}</p>`);
  }
  flush();return out.join("");
}
function addChat(who,text,cl){const d=document.createElement('div');d.className=cl;d.innerHTML=`<strong>${esc(who)}</strong><div class="nexus-message-content">${cl==='ai-message'?nexusRichText(text):`<p>${esc(text)}</p>`}</div>`;$('nexusConversation').appendChild(d);$('nexusConversation').scrollTop=$('nexusConversation').scrollHeight;if(cl==='ai-message'&&window.MathJax?.typesetPromise){window.MathJax.typesetPromise([d]).catch(()=>{})}}

/* MATERIALS */
async function loadMaterials(){if(!user)return;msg($('materialsLibraryMessage'),'Loading the study library...');msg($('myUploadsMessage'),'Loading your submissions...');let approved=[];const {data:libraryData,error:libraryError}=await supabaseClient.rpc('get_website_library',{p_query:'',p_limit:100});if(libraryError)msg($('materialsLibraryMessage'),libraryError.message,'error');else{approved=(libraryData||[]).map(r=>({...r,course:{code:r.course_code,course_code:r.course_code}}));const books=approved.filter(r=>['textbook','study_note','lecture_slide'].includes(s(r.material_type).toLowerCase())).length;msg($('materialsLibraryMessage'),approved.length?`${approved.length} resources available • ${books} books, notes or slides${isPremium(profile)?' • Premium access active':' • Browse everything; Premium opens locked resources'}`:'No approved materials are available yet.')}materials=approved;const {data,error}=await supabaseClient.from('student_material_uploads').select('id,uploader_id,title,course_code,level,material_type,file_name,file_extension,storage_path,description,status,created_at,updated_at,approved_at').eq('uploader_id',user.id).order('created_at',{ascending:false});uploads=error?[]:(data||[]);msg($('myUploadsMessage'),error?error.message:(uploads.length?'':'You have not submitted any materials yet.'),error?'error':'info');renderMaterials();renderUploads()}
function materialCode(r){return s(r?.course?.code||r?.course?.course_code||r?.course_code).trim()}function materialLabel(type){const t=s(type,'material').replaceAll('_',' ');return t.charAt(0).toUpperCase()+t.slice(1)}function renderMaterials(){const q=s($('materialsSearch').value).toLowerCase(),c=s($('materialsCourseFilter').value).toUpperCase();const rows=materials.filter(r=>{const rc=materialCode(r).toUpperCase(),hay=[r.title,r.file_name,r.material_type,r.description,rc,r?.course?.title,r?.course?.course_title].map(x=>s(x).toLowerCase()).join(' ');return(!q||hay.includes(q))&&(!c||rc===c)});$('materialsCountBadge').textContent=rows.length;$('materialsList').innerHTML=rows.length?'':'<div class="material-empty"><strong>No matching resources</strong><span>Try another course or search term.</span></div>';rows.forEach(r=>{const locked=!isPremium(profile);const d=document.createElement('article');d.className=`material-card human-resource-card${locked?' is-locked':''}`;d.innerHTML=`<div class="resource-cover"><span>${esc(materialLabel(r.material_type).slice(0,2).toUpperCase())}</span></div><div class="material-card-title"><div class="resource-kicker">${esc(materialCode(r)||'Study resource')}</div><h4>${esc(r.title||r.file_name||'Course Material')}</h4><p>${esc(r.description||r.file_name||'Approved learning resource')}</p><div class="material-meta">${materialCode(r)?`<span class="material-tag course-tag">${esc(materialCode(r))}</span>`:''}<span class="material-tag">${esc(materialLabel(r.material_type))}</span>${locked?'<span class="material-tag premium-lock">Premium</span>':'<span class="material-tag available-tag">Available</span>'}</div></div><button class="material-open-btn" type="button">${locked?'View access':'Open resource'}</button>`;d.querySelector('button').addEventListener('click',()=>openMaterial(r));$('materialsList').appendChild(d)})}async function openMaterial(r){if(!isPremium(profile)){go('subscription');msg($('subscriptionMessage'),`Upgrade to Premium to open ${r.title||'this library resource'}.`,'info');return}try{if(r.source_url){window.open(r.source_url,'_blank','noopener,noreferrer');return}if(!r.storage_path)throw new Error('No file link available.');const {data,error}=await supabaseClient.storage.from('course-materials').createSignedUrl(r.storage_path,600);if(error)throw error;window.open(data.signedUrl,'_blank','noopener,noreferrer')}catch(e2){alert(e2.message)}}
function renderUploads(){$('myUploadsList').innerHTML=uploads.length?'':'<div class="material-empty">No submissions yet.</div>';uploads.forEach(r=>{const d=document.createElement('article'),st=s(r.status,'pending').toLowerCase();d.className='my-upload-card';d.innerHTML=`<div><h4>${esc(r.title||r.file_name)}</h4><p>${r.course_code?esc(r.course_code)+' • ':''}${esc(r.file_name)}</p></div><span class="upload-status ${esc(st)}">${esc(st.toUpperCase())}</span><button class="material-open-btn" type="button">Open</button>`;d.querySelector('button').addEventListener('click',async()=>{try{const {data,error}=await supabaseClient.storage.from('course-materials').createSignedUrl(r.storage_path,600);if(error)throw error;window.open(data.signedUrl,'_blank','noopener,noreferrer')}catch(e2){alert(e2.message)}});$('myUploadsList').appendChild(d)})}
$('materialsSearch')?.addEventListener('input',renderMaterials);$('materialsCourseFilter')?.addEventListener('change',renderMaterials);$('refreshMaterialsBtn')?.addEventListener('click',loadMaterials);
$('materialUploadForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=$('materialFile').files?.[0],title=$('materialTitle').value.trim();if(!f||!title){msg($('materialUploadMessage'),'Add a title and choose a file.','error');return}if(f.size>15*1024*1024){msg($('materialUploadMessage'),'File is larger than 15 MB.','error');return}const ex=ext(f.name),allowed=new Set(['pdf','doc','docx','ppt','pptx','txt','jpg','jpeg','png']);if(!allowed.has(ex)){msg($('materialUploadMessage'),'Unsupported file type.','error');return}$('materialUploadBtn').disabled=true;const path=`${user.id}/${Date.now()}_${cleanName(f.name)}`;try{const {error:up}=await supabaseClient.storage.from('course-materials').upload(path,f,{cacheControl:'3600',upsert:false,contentType:f.type||undefined});if(up)throw up;const {error:ins}=await supabaseClient.from('student_material_uploads').insert({uploader_id:user.id,title,course_code:$('materialCourseCode').value||null,level:$('materialLevel').value||null,material_type:$('materialType').value||'lecture_note',file_name:f.name,file_extension:ex,storage_path:path,description:$('materialDescription').value.trim()||null,status:'pending'});if(ins)throw ins;$('materialUploadForm').reset();msg($('materialUploadMessage'),'Material submitted successfully. It is pending approval.','success');await loadMaterials()}catch(e2){msg($('materialUploadMessage'),e2.message||'Unable to submit material.','error')}finally{$('materialUploadBtn').disabled=false}});

/* VIDEOS */
async function loadVideos(){
  msg($('videoMessage'),'Loading tutorial catalogue...');
  const {data,error}=await supabaseClient.rpc('get_website_video_tutorials');
  if(error){
    videos=[];
    msg($('videoMessage'),'Tutorials could not be loaded. Please refresh and try again.','error');
    renderVideos();
    return;
  }
  videos=data||[];
  const accessible=videos.filter(v=>v.can_access===true||v.is_premium===false).length;
  const premiumCount=videos.filter(v=>v.is_premium!==false).length;
  msg($('videoMessage'),videos.length?`${videos.length} course tutorials available • ${accessible} ready to watch${premiumCount?` • ${premiumCount} Premium lessons`:''}`:'No tutorials are available yet.');
  populateVideoFilters();
  renderVideoOverview();
  renderVideos();
}
function uniq(k){return[...new Set(videos.map(r=>s(r[k]).trim()).filter(Boolean))].sort()}
function fill(id,vals,label){const el=$(id),old=el.value;el.innerHTML=`<option value="">${label}</option>`;vals.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o)});if(old&&vals.includes(old))el.value=old}
function populateVideoFilters(){fill('videoProgramme',uniq('programme'),'All Programmes');fill('videoLevel',uniq('level'),'All Levels');fill('videoSemester',uniq('semester'),'All Semesters');fill('videoCourse',uniq('course_code'),'All Courses')}
['videoProgramme','videoLevel','videoSemester','videoCourse'].forEach(id=>$(id)?.addEventListener('change',renderVideos));
$('videoSearch')?.addEventListener('input',renderVideos);
function renderVideoOverview(){
  if(!$('videoOverview'))return;
  const courses=new Set(videos.map(v=>s(v.course_code)).filter(Boolean)).size;
  const programmes=new Set(videos.map(v=>s(v.programme)).filter(Boolean)).size;
  $('videoOverview').innerHTML=`<div><strong>${videos.length}</strong><span>Tutorials</span></div><div><strong>${courses}</strong><span>Courses</span></div><div><strong>${programmes}</strong><span>Programmes</span></div>`;
}
function renderVideos(){
  const q=s($('videoSearch').value).toLowerCase(),p=$('videoProgramme').value,l=$('videoLevel').value,se=$('videoSemester').value,c=$('videoCourse').value;
  const rows=videos.filter(r=>(!p||r.programme===p)&&(!l||r.level===l)&&(!se||r.semester===se)&&(!c||r.course_code===c)&&(!q||[r.title,r.creator,r.course_code,r.course_name,r.topic].map(s).join(' ').toLowerCase().includes(q)));
  const grid=$('videoGrid');
  grid.innerHTML=rows.length?'':'<div class="material-empty video-empty"><div class="empty-icon">▶</div><strong>No matching tutorials</strong><span>Try another course, level, programme or topic.</span></div>';
  rows.forEach(r=>{
    const locked=!(r.can_access===true||r.is_premium===false);
    const d=document.createElement('article');
    d.className=`video-card human-video-card${locked?' is-locked':''}`;
    d.innerHTML=`<div class="video-thumb">${r.thumbnail_url?`<img src="${esc(r.thumbnail_url)}" alt="${esc(r.title||'Course tutorial')}">`:'<div class="video-placeholder"><span>▶</span><small>Course tutorial</small></div>'}<div class="video-play-badge">▶</div>${locked?'<span class="video-lock-badge">Premium</span>':'<span class="video-free-badge">Ready to watch</span>'}${r.duration?`<span class="video-duration">${esc(r.duration)}</span>`:''}</div><div class="video-body"><div class="video-card-topline"><span class="resource-kicker">${esc(r.course_code||r.level||'Tutorial')}</span>${r.level?`<span class="video-level">${esc(r.level)}</span>`:''}</div><h3>${esc(r.title)}</h3><p>${esc([r.course_name,r.topic].filter(Boolean).join(' • '))}</p>${r.creator?`<small class="video-creator">${esc(r.creator)}</small>`:''}<div class="video-card-footer"><span>${esc(r.semester||'Course tutorial')}</span><button class="video-watch-btn" type="button">${locked?'Unlock tutorial':'Watch tutorial'}</button></div></div>`;
    d.querySelector('button').addEventListener('click',()=>openVideo(r));
    grid.appendChild(d);
  });
}
function yt(url){const m=s(url).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);return m?.[1]||''}
function openVideo(r){
  const locked=!(r.can_access===true||r.is_premium===false);
  if(locked){go('subscription');msg($('subscriptionMessage'),`Upgrade to Premium to watch ${r.title||'this tutorial'}.`,'info');return}
  videoUrl=r.video_url||'';
  if(!videoUrl){msg($('videoMessage'),'This tutorial link is temporarily unavailable.','error');return}
  $('videoModalTitle').textContent=r.title||'Video Tutorial';
  const id=yt(videoUrl);
  $('videoPlayerWrap').innerHTML=id?`<iframe src="https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`:'<div class="material-empty" style="margin:20px"><strong>External learning resource</strong><span>Use “Open tutorial” to continue on the original learning website.</span></div>';
  openModal('videoModal');
}
$('closeVideoModal')?.addEventListener('click',()=>{closeModal('videoModal');$('videoPlayerWrap').innerHTML=''});$('openVideoExternalBtn')?.addEventListener('click',()=>{if(videoUrl)window.open(videoUrl,'_blank','noopener,noreferrer')});

/* STUDY GROUPS */
$('createStudyRoomBtn')?.addEventListener('click',createRoom);$('joinStudyRoomBtn')?.addEventListener('click',joinRoom);$('copyRoomCodeBtn')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(roomData?.room_code||'');msg($('studyRoomLobbyMessage'),'Room code copied.','success')}catch{}});
async function createRoom(){msg($('studyRoomEntryMessage'),'Creating room...');try{let room=null;for(let i=0;i<5;i++){const code=`BMU${Math.floor(Math.random()*90000)+10000}`;const {data,error}=await supabaseClient.from('study_rooms').insert({room_code:code,host_id:user.id,activity:'study',question_source:'app',status:'waiting'}).select().single();if(!error){room=data;break}}if(!room)throw new Error('Could not create room.');const {error}=await supabaseClient.from('study_room_members').upsert({room_id:room.id,user_id:user.id,display_name:displayName(),score:0,is_host:true},{onConflict:'room_id,user_id'});if(error)throw error;enterRoom(room,true)}catch(e2){msg($('studyRoomEntryMessage'),e2.message||'Could not create room.','error')}}
async function joinRoom(){const code=$('joinRoomCode')?.value?.trim().toUpperCase();if(!code){msg($('studyRoomEntryMessage'),'Enter a room code first.','error');return}msg($('studyRoomEntryMessage'),'Joining room...');try{if(!user?.id)throw new Error('Your session has expired. Please sign in again.');const joined=await supabaseClient.rpc('join_website_study_room',{p_room_code:code});if(joined.error)throw joined.error;const {data,error}=await supabaseClient.from('study_rooms').select('*').eq('room_code',code).in('status',['waiting','playing']).order('created_at',{ascending:false}).limit(1);if(error)throw error;const room=data?.[0]||null;if(!room?.id)throw new Error('Study room could not be loaded. Refresh and enter the room code again.');msg($('studyRoomEntryMessage'),'','info');enterRoom(room,room.host_id===user.id)}catch(e2){console.error('joinRoom',e2);msg($('studyRoomEntryMessage'),e2?.message||'Could not join room. Please try again.','error')}}
function enterRoom(r,host){groupSelectedAnswers.clear();roomData=r;isHost=host;$('studyRoomEntry').classList.add('hidden');$('studyRoomLobby').classList.remove('hidden');$('groupQuizShell').classList.add('hidden');$('groupResults').classList.add('hidden');$('groupFinishWaiting')?.classList.add('hidden');$('activeRoomCode').textContent=r.room_code;$('hostRoomControls').classList.toggle('hidden',!host);$('participantWaitingMessage').classList.toggle('hidden',host);if(host){$('groupCourse').value=r.selected_course||'';$('groupQuestionFormat').value=r.question_format||'mcq';$('groupQuestionCount').value=String(r.total_questions||10);$('groupTimeLimit').value=String(r.time_limit_minutes||30)}updateRoomSetupSummary();loadParticipants();stopRoom();roomPoll=setInterval(syncRoom,2500)}
function updateRoomSetupSummary(){if(!roomData)return;const summary=`${roomData.selected_course||'Course not selected'} • ${(roomData.question_format||'mcq').toUpperCase()} • ${roomData.total_questions||10} questions • ${roomData.time_limit_minutes||30} min`;if($('participantSetupSummary'))$('participantSetupSummary').textContent=summary;if($('roomSelectionPreview'))$('roomSelectionPreview').querySelector('span').textContent=summary}
let lastParticipantIds=[];
async function loadParticipants(){if(!roomData)return;try{let rows=[];const direct=await supabaseClient.from('study_room_members').select('user_id,display_name,is_host,ready,finished,finished_at,answered_count,left_at').eq('room_id',roomData.id).is('left_at',null).order('joined_at');if(!direct.error)rows=direct.data||[];else{const r=await supabaseClient.rpc('get_study_room_participants',{p_room_id:roomData.id});if(r.error)throw r.error;rows=(r.data||[]).filter(x=>!x.left_at)}const ids=rows.map(x=>x.user_id);if(lastParticipantIds.length&&ids.length<lastParticipantIds.length)msg($('studyRoomLobbyMessage'),'A participant has left the study group.','info');lastParticipantIds=ids;$('participantCount').textContent=`${rows.length} online`;$('participantList').innerHTML='';const me=rows.find(x=>x.user_id===user.id);rows.forEach(r=>{const d=document.createElement('div');d.className='participant-item';const state=r.finished?roomFinishLabel(r.finished_at):(r.ready?'Ready':'Not ready');d.innerHTML=`<strong>${esc(r.display_name||'Student')}${r.is_host?' • Host':''}</strong><span class="${r.ready?'participant-ready':'participant-not-ready'}">${esc(state)}${r.finished?'':` • ${r.answered_count||0} answered`}</span>`;if(me?.finished&&!r.finished&&r.user_id!==user.id){const b=document.createElement('button');b.type='button';b.className='secondary-btn';b.textContent='Request Live Watch';b.onclick=()=>requestSpectate(r.user_id,r.display_name);d.appendChild(b)}$('participantList').appendChild(d)});if($('participantReadyBtn')){$('participantReadyBtn').textContent=me?.ready?'Ready ✓':'I’m Ready';$('participantReadyBtn').disabled=!!me?.ready}if(isHost&&$('startStudyRoomBtn')){const unready=rows.filter(x=>!x.is_host&&!x.ready);$('startStudyRoomBtn').disabled=unready.length>0;$('startStudyRoomBtn').textContent=unready.length?`Waiting for ${unready.length} participant${unready.length===1?'':'s'}`:'Start Session'}return rows}catch(e2){console.warn(e2);return[]}}
async function syncSpectateRequests(){
 if(!roomData||spectateRequestBusy)return;
 const roomId=roomData.id;
 try{
  const {data,error}=await supabaseClient.rpc('get_my_pending_spectate_requests',{p_room_id:roomId});
  if(error)throw error;
  if(roomData?.id!==roomId)return;
  const requests=Array.isArray(data)?data:[];
  const holder=document.getElementById('spectatePermissionPrompt')||document.createElement('section');
  holder.id='spectatePermissionPrompt';
  holder.className='spectate-permission-prompt';
  holder.setAttribute('role','region');holder.setAttribute('aria-label','Live Watch requests');
  if(!holder.isConnected)document.body.appendChild(holder);
  const ids=requests.map(req=>req.id).join(',');
  if(!requests.length){holder.classList.add('hidden');holder.innerHTML='';holder.dataset.requestIds='';return}
  holder.classList.remove('hidden');
  if(holder.dataset.requestIds===ids)return;
  holder.dataset.requestIds=ids;
  holder.innerHTML='<strong>Live Watch requests</strong><p class="spectate-intro">Choose who can watch your quiz. You can keep answering.</p>'+requests.map(req=>
   '<div class="spectate-request-item" data-request-id="'+esc(req.id)+'"><p><strong>'+esc(req.requester_name||'A participant')+'</strong> wants to spectate your progress.</p><div class="spectate-actions"><button type="button" data-accept="true">Allow</button><button type="button" data-accept="false">Decline</button></div></div>'
  ).join('');
  holder.querySelectorAll('.spectate-request-item').forEach(item=>{
   const requestId=item.dataset.requestId;
   item.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',async()=>{
    if(item.dataset.busy)return;item.dataset.busy='true';
    item.querySelectorAll('button').forEach(x=>x.disabled=true);
    try{
     const result=await supabaseClient.rpc('respond_study_room_spectate',{p_request_id:requestId,p_accept:btn.dataset.accept==='true'});
     if(result.error)throw result.error;
     holder.dataset.requestIds='';item.remove();
     if(!holder.querySelector('.spectate-request-item'))holder.classList.add('hidden');
    }catch(err){alert(err.message||'Could not respond to spectator');item.dataset.busy='';item.querySelectorAll('button').forEach(x=>x.disabled=false)}
   }));
  });
 }catch(err){console.warn('spectate check',err)}
}
async function requestSpectate(targetId,name){try{const r=await supabaseClient.rpc('request_study_room_spectate',{p_room_id:roomData.id,p_target_id:targetId});if(r.error)throw r.error;spectateTargetId=targetId;alert(`Live Watch request sent to ${name||'participant'}. You can watch only if they allow it.`);startSpectateStatusPoll()}catch(e){alert(e.message||'Unable to request spectating.')}}
function startSpectateStatusPoll(){
 if(spectatePoll)clearInterval(spectatePoll);
 const tick=async()=>{
  if(!roomData||!spectateTargetId)return;
  try{
   const r=await supabaseClient.rpc('get_my_spectate_request_status',{p_room_id:roomData.id,p_target_id:spectateTargetId});
   if(r.error)throw r.error;
   const status=Array.isArray(r.data)?r.data[0]:null;if(!status)return;
   if(status.status==='accepted'){
    clearInterval(spectatePoll);spectatePoll=null;
    await showSpectatorProgress();
    if(spectateRefreshTimer)clearInterval(spectateRefreshTimer);
    spectateRefreshTimer=setInterval(()=>{void showSpectatorProgress()},2500);
   }else if(status.status==='declined'){
    clearInterval(spectatePoll);spectatePoll=null;
    alert((status.target_name||'Participant')+' declined the spectating request.');
   }
  }catch(e){console.warn('Spectating status check',e)}
 };
 void tick();spectatePoll=setInterval(tick,2500);
}
let spectatorReactionLastSent=0;
async function sendSpectatorEmoji(emoji){
 if(!roomData||!spectateTargetId||Date.now()-spectatorReactionLastSent<3000)return;
 spectatorReactionLastSent=Date.now();
 const {error}=await supabaseClient.rpc('send_consented_spectator_reaction',{p_room_id:roomData.id,p_target_id:spectateTargetId,p_emoji:emoji});
 const status=document.getElementById('spectatorReactionStatus');if(status)status.textContent=error?'Unable to send reaction':'Sent '+emoji;
}
async function showSpectatorProgress(){
 if(!roomData||!spectateTargetId)return;
 const target=spectateTargetId,roomId=roomData.id;
 try{
  const {data,error}=await supabaseClient.rpc('get_consented_spectator_live_view',{p_room_id:roomId,p_target_id:target});
  if(error)throw error;
  if(roomData?.id!==roomId||spectateTargetId!==target)return;
  const panel=$('spectateLivePanel');if(!panel)return;
  const q=data||{},number=Number(q.question_no)||0,total=Number(q.total_questions)||0;
  const selected=s(q.selected_option).trim().toUpperCase();
  const optionRows=Object.entries(q.options||{}).filter(([key,value])=>value&&s(value).trim()).map(([key,value])=>
   '<div class="spectate-choice'+(selected===key?' chosen':'')+'"><span class="spectate-choice-key">'+esc(key)+'</span><span>'+esc(value)+'</span>'+(selected===key?'<span class="spectate-selected-label">Selected ✓</span>':'')+'</div>'
  ).join('');
  const signature=JSON.stringify([number,q.question_text,selected,q.answered_count,q.finished,q.target_name]);
  if(panel.dataset.renderSignature===signature)return;
  panel.dataset.renderSignature=signature;
  panel.classList.remove('hidden');
  panel.innerHTML='<div class="spectate-screen-header"><div><span class="spectate-live-dot"></span><strong>Live Watch Mode</strong><p>Watching '+esc(q.target_name||'Participant')+' • Read only</p></div><span class="spectate-counter">Question '+(number+1)+' / '+total+'</span></div>'+
  '<div class="spectate-question-card"><p class="spectate-eyebrow">LIVE QUESTION • READ ONLY</p><h3>'+esc(q.question_text||'Waiting for the question…')+'</h3>'+(optionRows||'<p class="spectate-unanswered">Theory question • the answer is private until submission.</p>')+'</div>'+
  '<div class="spectate-screen-footer"><span>'+Number(q.answered_count||0)+' of '+total+' answered</span><span>'+(q.finished?'Participant finished':selected?'Answer selected':'Not yet answered')+'</span></div>'+
  '<div class="spectate-screen-tip">You are watching in real time. Only the student can answer or change choices.</div>'+
  '<div class="spectate-emoji-bar"><span>Send encouragement</span>'+['👏','🔥','😂','❤️','👍'].map(emoji=>'<button type="button" class="spectate-emoji" data-emoji="'+emoji+'" aria-label="Send '+emoji+' reaction">'+emoji+'</button>').join('')+'<small id="spectatorReactionStatus" aria-live="polite"></small></div>';
  panel.querySelectorAll('.spectate-emoji').forEach(btn=>btn.addEventListener('click',()=>{void sendSpectatorEmoji(btn.dataset.emoji)}));
 }catch(error){console.warn('Live spectating view unavailable',error)}
}
async function showMySpectatorReactions(){
 if(!roomData||$('groupQuizShell')?.classList.contains('hidden'))return;
 const {data,error}=await supabaseClient.rpc('get_my_study_room_spectator_reactions',{p_room_id:roomData.id});
 if(error)return;
 let panel=document.getElementById('quizSpectatorReactions');
 if(!panel){panel=document.createElement('div');panel.id='quizSpectatorReactions';panel.className='quiz-spectator-reactions';$('groupQuizShell')?.prepend(panel)}
 const rows=Array.isArray(data)?data:[];
 panel.innerHTML=rows.slice(0,5).map(r=>'<span class="quiz-spectator-reaction">'+esc(r.reaction)+' <small>'+esc(r.display_name||'Spectator')+'</small></span>').join('');
 panel.classList.toggle('hidden',!rows.length);
}
async function syncRoom(){if(!roomData)return;const rows=await loadParticipants();await syncSpectateRequests();try{await supabaseClient.rpc('expire_study_room_if_needed',{p_room_id:roomData.id})}catch{}const {data}=await supabaseClient.from('study_rooms').select('*').eq('id',roomData.id).limit(1);if(!data?.length)return;roomData=data[0];updateRoomSetupSummary();if(roomData.status==='playing'&&$('groupQuizShell').classList.contains('hidden')&&$('groupFinishWaiting')?.classList.contains('hidden'))startGroupQuiz();const active=rows.filter(x=>!x.left_at);if(active.length&&active.every(x=>x.finished))groupResults();if(roomData.status==='finished')groupResults();else if(roomData.status==='playing'&&!$('groupQuizShell')?.classList.contains('hidden'))void showMySpectatorReactions()}
async function saveRoomConfiguration(){if(!isHost||!roomData||roomData.status!=='waiting')return;const course=$('groupCourse').value;if(!course)return;const r=await supabaseClient.rpc('configure_study_room_secure',{p_room_id:roomData.id,p_course:course,p_format:$('groupQuestionFormat').value,p_count:Number($('groupQuestionCount').value),p_minutes:Number($('groupTimeLimit').value)});if(r.error){msg($('studyRoomLobbyMessage'),r.error.message,'error');return}roomData.selected_course=course;roomData.question_format=$('groupQuestionFormat').value;roomData.total_questions=Number($('groupQuestionCount').value);roomData.time_limit_minutes=Number($('groupTimeLimit').value);updateRoomSetupSummary();loadParticipants()}
['groupCourse','groupQuestionFormat','groupQuestionCount','groupTimeLimit'].forEach(id=>$(id)?.addEventListener('change',saveRoomConfiguration));
$('participantReadyBtn')?.addEventListener('click',async()=>{if(!roomData)return;const r=await supabaseClient.rpc('set_study_room_ready',{p_room_id:roomData.id,p_ready:true});if(r.error){msg($('studyRoomLobbyMessage'),r.error.message,'error');return}loadParticipants()});
$('startStudyRoomBtn')?.addEventListener('click',async()=>{if(!isHost||!roomData)return;const course=$('groupCourse').value;if(!course){msg($('studyRoomLobbyMessage'),'Choose a course first.','error');return}$('startStudyRoomBtn').disabled=true;try{if(!roomData.selected_course)await saveRoomConfiguration();const r=await supabaseClient.rpc('start_study_room_secure',{p_room_id:roomData.id});if(r.error)throw r.error;await syncRoom()}catch(e2){msg($('studyRoomLobbyMessage'),e2.message||'Could not start room.','error')}finally{loadParticipants()}});
$('leaveStudyRoomBtn')?.addEventListener('click',leaveRoom);async function leaveRoom(){if(roomData&&!confirm('Quit this study group? Other participants will see that you left.'))return;const rid=roomData?.id;if(rid){try{await supabaseClient.rpc('leave_study_room_secure',{p_room_id:rid})}catch{}}stopRoom();groupSelectedAnswers.clear();if(spectatePoll)clearInterval(spectatePoll);spectatePoll=null;if(spectateRefreshTimer)clearInterval(spectateRefreshTimer);spectateRefreshTimer=null;document.getElementById('spectatePermissionPrompt')?.remove();roomData=null;isHost=false;$('studyRoomLobby').classList.add('hidden');$('groupQuizShell').classList.add('hidden');$('groupFinishWaiting')?.classList.add('hidden');$('groupResults').classList.add('hidden');$('studyRoomEntry').classList.remove('hidden');msg($('studyRoomEntryMessage'),'You left the study group.','info')}
async function startGroupQuiz(){stopRoom();groupTotal=Number(roomData.total_questions)||10;groupFormat=roomData.question_format||'mcq';groupEndsAt=roomData.ends_at?new Date(roomData.ends_at):null;const {data}=await supabaseClient.from('study_room_members').select('score,answered_count').eq('room_id',roomData.id).eq('user_id',user.id).limit(1);const m=data?.[0]||{};groupNo=Math.min(Number(m.answered_count)||0,Math.max(0,groupTotal-1));$('studyRoomLobby').classList.add('hidden');$('groupResults').classList.add('hidden');$('groupQuizShell').classList.remove('hidden');$('groupQuizRoomCode').textContent=roomData.room_code;$('groupQuizTitle').textContent=roomData.selected_course||'Study Group';startGroupClock();try{await loadGroupQ(groupNo)}finally{if(roomData&&!roomPoll)roomPoll=setInterval(()=>{void syncRoom()},2500)}}
function startGroupClock(){if(roomClock)clearInterval(roomClock);const tick=async()=>{if(!groupEndsAt){$('groupQuizTimer').textContent='--:--';return}const left=Math.max(0,Math.floor((groupEndsAt.getTime()-Date.now())/1000));$('groupQuizTimer').textContent=fmt(left);if(left<=0&&!roomAutoSubmitting){clearInterval(roomClock);roomAutoSubmitting=true;await autoExpireGroupRoom();roomAutoSubmitting=false}};tick();roomClock=setInterval(tick,1000)}
async function autoExpireGroupRoom(){if(!roomData)return;try{if(groupFormat==='theory'&&$('groupTheoryAnswer')&&!$('groupTheoryAnswer').classList.contains('hidden')){const a=$('groupTheoryAnswer').value.trim();if(a.length>=5){try{await supabaseClient.functions.invoke('study-theory-grade',{body:{room_id:roomData.id,question_no:groupNo,answer_text:a}})}catch{}}}const r=await supabaseClient.rpc('expire_study_room_if_needed',{p_room_id:roomData.id});if(r.error)throw r.error;$('groupQuizShell').classList.add('hidden');$('groupFinishWaiting')?.classList.add('hidden');await groupResults();alert('Time is up. The room was submitted automatically and the answers are now available for review.')}catch(e){alert(e.message||'Time expired. Refreshing room results…');await syncRoom()}}
async function loadGroupQ(no){groupNo=Math.max(0,Math.min(no,groupTotal-1));if(roomData?.status==='playing')void supabaseClient.rpc('set_my_study_room_live_position',{p_room_id:roomData.id,p_question_no:groupNo}).then(({error})=>{if(error)console.warn('Live question tracking',error.message)});$('groupReviewBox').classList.add('hidden');$('groupQuizProgress').textContent=`${groupNo+1} / ${groupTotal}`;$('groupProgressBar').style.width=`${((groupNo+1)/groupTotal)*100}%`;$('groupPreviousBtn').disabled=groupNo===0;$('groupNextBtn').disabled=groupNo===groupTotal-1;try{if(groupFormat==='theory'){const q=await supabaseClient.rpc('get_study_room_theory_question',{p_room_id:roomData.id,p_question_no:groupNo});if(q.error)throw q.error;currentGroupQuestion=row(q.data);$('groupQuestionNumber').textContent=`Question ${groupNo+1}`;$('groupQuestionText').textContent=currentGroupQuestion.question_text||'';$('groupMcqOptions').classList.add('hidden');$('groupTheoryAnswer').classList.remove('hidden');$('groupSubmitTheoryBtn').classList.remove('hidden');$('groupTheoryAnswer').value='';const rev=await supabaseClient.rpc('get_my_study_room_theory_review',{p_room_id:roomData.id,p_question_no:groupNo});if(Array.isArray(rev.data)&&rev.data.length){$('groupTheoryAnswer').value=rev.data[0].answer_text||'';if(roomData?.status==='finished'){$('groupReviewBox').classList.remove('hidden');$('groupReviewBox').innerHTML=`<p><strong>Score:</strong> ${esc(rev.data[0].ai_score??0)}/${esc(rev.data[0].max_score??10)}</p><p><strong>Feedback:</strong> ${esc(rev.data[0].feedback||'')}</p>`}}}else{const q=await supabaseClient.rpc('get_study_room_question',{p_room_id:roomData.id,p_question_no:groupNo});if(q.error)throw q.error;currentGroupQuestion=row(q.data);$('groupQuestionNumber').textContent=`Question ${groupNo+1}`;$('groupQuestionText').textContent=currentGroupQuestion.question_text||'';$('groupMcqOptions').classList.remove('hidden');$('groupTheoryAnswer').classList.add('hidden');$('groupSubmitTheoryBtn').classList.add('hidden');renderGroupOptions();await restoreGroupChoice(groupNo);if(roomData?.status==='finished'){const rev=await supabaseClient.rpc('get_my_study_room_answer_review',{p_room_id:roomData.id,p_question_no:groupNo});if(Array.isArray(rev.data)&&rev.data.length)showGroupReview(rev.data[0])}}}catch(e2){alert(e2.message||'Could not load group question.')}}
function renderGroupOptions(){$('groupMcqOptions').innerHTML='';['A','B','C','D','E'].forEach(l=>{const t=s(currentGroupQuestion?.[`option_${l.toLowerCase()}`]);if(!t)return;const b=document.createElement('button');b.className='option-button';b.dataset.answerLetter=l;b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="option-key">${l}</span><span>${esc(t)}</span>`;b.addEventListener('click',()=>submitGroupMcq(l,b));$('groupMcqOptions').appendChild(b)});markGroupChoice(groupSelectedAnswers.get(groupNo)||'')}
async function submitGroupMcq(letter,button){
 const number=groupNo;document.querySelectorAll('#groupMcqOptions .option-button').forEach(b=>b.disabled=true);
 markGroupChoice(letter);
 try{
  const response=await supabaseClient.rpc('submit_study_room_answer',{p_room_id:roomData.id,p_question_no:number,p_selected_option:letter});
  if(response.error)throw response.error;
  groupSelectedAnswers.set(number,letter);
  if(roomData?.status==='finished'){
   const review=await supabaseClient.rpc('get_my_study_room_answer_review',{p_room_id:roomData.id,p_question_no:number});
   if(groupNo===number&&Array.isArray(review.data)&&review.data.length)showGroupReview(review.data[0]);
  }else if(groupNo===number)msg($('groupReviewBox'),'Answer saved. You can change your choice before submitting the session.','success');
 }catch(error){alert(error.message||'Unable to save answer.');if(groupNo===number)await restoreGroupChoice(number)}
 finally{if(groupNo===number)document.querySelectorAll('#groupMcqOptions .option-button').forEach(b=>b.disabled=false)}
}
function showGroupReview(r){$('groupReviewBox').classList.remove('hidden');$('groupReviewBox').innerHTML=`<p><strong>${r.is_correct?'Correct':'Review'}</strong></p><p><strong>Your answer:</strong> ${esc(r.selected_option||'')}</p><p><strong>Correct:</strong> ${esc(r.correct_option||'')}</p><p><strong>Explanation:</strong> ${esc(r.explanation||'')}</p>`}
$('groupSubmitTheoryBtn')?.addEventListener('click',async()=>{const a=$('groupTheoryAnswer').value.trim();if(a.length<5){alert('Type your answer first.');return}$('groupSubmitTheoryBtn').disabled=true;try{const r=await supabaseClient.functions.invoke('study-theory-grade',{body:{room_id:roomData.id,question_no:groupNo,answer_text:a}});if(r.error||r.data?.error)throw new Error(r.data?.error||r.error?.message);await loadGroupQ(groupNo);alert('Answer submitted and graded by Nexus AI.')}catch(e2){alert(e2.message||'Unable to grade answer.')}finally{$('groupSubmitTheoryBtn').disabled=false}});
$('quitGroupQuizBtn')?.addEventListener('click',leaveRoom);$('groupPreviousBtn')?.addEventListener('click',()=>loadGroupQ(groupNo-1));$('groupNextBtn')?.addEventListener('click',()=>loadGroupQ(groupNo+1));$('finishGroupBtn')?.addEventListener('click',finishGroup);async function finishGroup(){if(!roomData)return;if(!confirm('Finish your quiz? You will wait for the other participants before final results.'))return;try{const fn=roomData?.question_source==='ai'?'finish_ai_study_room_participant':'finish_study_room_participant';const r=await supabaseClient.rpc(fn,{p_room_id:roomData.id});if(r.error)throw r.error;$('groupQuizShell').classList.add('hidden');$('groupFinishWaiting')?.classList.remove('hidden');const rows=await loadParticipants();renderSpectateWaiting(rows);if(rows.length&&rows.every(x=>x.finished))groupResults()}catch(e2){alert(e2.message||'Could not finish room.')}}
function renderSpectateWaiting(rows=[]){const el=$('spectateParticipants');if(!el)return;const active=rows.filter(x=>!x.finished&&x.user_id!==user.id);el.innerHTML=active.length?'':'<div class="material-empty">Everyone has finished. Preparing results…</div>';active.forEach(r=>{const d=document.createElement('div');d.className='participant-item';d.innerHTML=`<strong>${esc(r.display_name||'Student')}</strong><span>${r.answered_count||0} answered</span>`;const b=document.createElement('button');b.type='button';b.className='secondary-btn';b.textContent='Request to spectate';b.onclick=()=>requestSpectate(r.user_id,r.display_name);d.appendChild(b);el.appendChild(d)})}
async function groupResults(){
 stopRoom();$('studyRoomLobby').classList.add('hidden');$('groupQuizShell').classList.add('hidden');$('groupFinishWaiting')?.classList.add('hidden');$('groupResults').classList.remove('hidden');
 if(spectateRefreshTimer)clearInterval(spectateRefreshTimer);spectateRefreshTimer=null;
 try{
  let rows=[];
  if(groupFormat==='theory'){
   const r=await supabaseClient.rpc('get_study_room_theory_leaderboard',{p_room_id:roomData.id});
   if(r.error)throw r.error;rows=Array.isArray(r.data)?r.data:[];
  }else{
   const r=await supabaseClient.rpc('get_study_room_participants',{p_room_id:roomData.id});
   if(r.error)throw r.error;rows=Array.isArray(r.data)?r.data:[];
   rows.sort((a,b)=>Number(b.score||0)-Number(a.score||0));
  }
  // The secure participant table records finished_at; don't invent completion times.
  const {data:times,error:timesError}=await supabaseClient.from('study_room_members')
   .select('user_id,display_name,finished,finished_at').eq('room_id',roomData.id).is('left_at',null);
  if(timesError)console.warn('Finish timestamps unavailable',timesError.message);
  const byId=new Map((times||[]).map(x=>[x.user_id,x]));
  const byName=new Map((times||[]).map(x=>[x.display_name,x]));
  $('groupLeaderboard').innerHTML='';
  rows.forEach((r,i)=>{
   const participant=byId.get(r.user_id)||byName.get(r.display_name);
   const time=participant?.finished_at?roomFinishLabel(participant.finished_at):(r.finished?'Finished':'Not finished');
   const d=document.createElement('div');d.className='leaderboard-row';
   d.innerHTML='<strong>#'+(i+1)+'</strong><div><strong>'+esc(r.display_name||'Student')+'</strong><small>'+esc(time)+'</small></div><strong>'+
    (groupFormat==='theory'?esc(r.total_score??0)+' • '+esc(r.percentage??0)+'%':esc(r.score??0))+'</strong>';
   $('groupLeaderboard').appendChild(d);
  });
  await renderGroupAnswerReview();
 }catch(err){console.warn('Study leaderboard failed',err);$('groupLeaderboard').innerHTML='<div class="material-empty">Unable to load leaderboard.</div>'}
}
async function renderGroupAnswerReview(){
 const el=$('groupAnswerReview');if(!el||!roomData)return;
 el.innerHTML='<div class="material-empty">Loading your questions, answers and explanations…</div>';
 const roomId=roomData.id,source=roomData.question_source,format=groupFormat,count=Number(roomData.total_questions||groupTotal||0);
 const out=await Promise.all(Array.from({length:count},async(_,i)=>{
  try{
   const qFn=source==='ai'?'get_ai_study_room_question':format==='theory'?'get_study_room_theory_question':'get_study_room_question';
   const reviewFn=format==='theory'?(source==='ai'?'get_my_ai_study_room_theory_review':'get_my_study_room_theory_review'):(source==='ai'?'get_my_ai_study_room_review':'get_my_study_room_answer_review');
   // Fetch the original question via the room-scoped, member-authorized RPC. Never invent questions from explanations.
   const [questionResult,reviewResult]=await Promise.all([
    supabaseClient.rpc(qFn,{p_room_id:roomId,p_question_no:i}),
    supabaseClient.rpc(reviewFn,{p_room_id:roomId,p_question_no:i})
   ]);
   const question=Array.isArray(questionResult.data)?questionResult.data[0]:questionResult.data;
   const answer=Array.isArray(reviewResult.data)?reviewResult.data[0]:reviewResult.data;
   const prompt=s(question?.question_text).trim();
   const questionHtml='<p class="group-review-question">'+esc(prompt||'Question text unavailable.')+'</p>';
   if(format==='theory'){
    return '<article class="group-answer-review"><strong>Question '+(i+1)+'</strong>'+questionHtml+
     '<p><b>Your answer:</b> '+esc(answer?.answer_text||'No answer')+'</p>'+
     '<p><b>Score:</b> '+esc(answer?.ai_score??0)+'/'+esc(answer?.max_score??10)+'</p>'+
     '<p><b>Feedback:</b> '+esc(answer?.feedback||'No graded answer was submitted before time expired.')+'</p>'+
     '<p><b>Model answer:</b> '+esc(answer?.improved_answer||answer?.model_answer||'Review unavailable.')+'</p></article>';
   }
   return '<article class="group-answer-review"><strong>Question '+(i+1)+'</strong>'+questionHtml+
    '<p><b>Your answer:</b> '+esc(answer?.selected_option?(answer.selected_option+(question?.['option_'+String(answer.selected_option).toLowerCase()]?' — '+question['option_'+String(answer.selected_option).toLowerCase()] : '')):'No answer')+'</p>'+
    '<p><b>Correct answer:</b> '+esc(answer?.correct_option?(answer.correct_option+(question?.['option_'+String(answer.correct_option).toLowerCase()]?' — '+question['option_'+String(answer.correct_option).toLowerCase()] : '')):'Unavailable')+'</p>'+
    '<p><b>Explanation:</b> '+esc(answer?.explanation||'No explanation available.')+'</p></article>';
  }catch(err){console.warn('Question review',i,err);return '<article class="group-answer-review"><strong>Question '+(i+1)+'</strong><p>Unable to load this question review.</p></article>'}
 }));
 if(roomData?.id===roomId)el.innerHTML=out.join('')||'<div class="material-empty">No answer review is available for this session.</div>';
}
$('backToStudyRoomsBtn')?.addEventListener('click',leaveRoom);

/* RESULTS */
async function loadResults(){msg($('resultsMessage'),'Loading results...');const {data,error}=await supabaseClient.from('quiz_session_results').select('id,course_code,course_title,session_type,question_format,score,total,percentage,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);if(error){msg($('resultsMessage'),error.message,'error');return}const r=data||[],avg=r.length?Math.round(r.reduce((a,x)=>a+Number(x.percentage||0),0)/r.length):0,best=r.length?Math.max(...r.map(x=>Number(x.percentage||0))):0;$('resultsSessions').textContent=r.length;$('resultsAverage').textContent=`${avg}%`;$('resultsBest').textContent=`${best}%`;msg($('resultsMessage'),r.length?'':'No saved practice results yet.');$('resultsList').innerHTML='';r.forEach(x=>{const d=document.createElement('div');d.className='result-history-row';d.innerHTML=`<div><strong>${esc(x.course_code)}${x.course_title?` — ${esc(x.course_title)}`:''}</strong><p>${esc(s(x.session_type).replaceAll('_',' '))} • ${new Date(x.created_at).toLocaleString()}</p></div><strong class="score">${Math.round(Number(x.percentage||0))}%</strong>`;$('resultsList').appendChild(d)})}

/* CGPA */
const gp={A:5,B:4,C:3,D:2,E:1,F:0};function addCgpa(course='',units=3,grade='A'){const d=document.createElement('div');d.className='cgpa-row';d.innerHTML=`<div><label>Course</label><input class="cgpa-course" value="${esc(course)}"></div><div><label>Units</label><input class="cgpa-unit" type="number" min="1" max="12" value="${units}"></div><div><label>Grade</label><select class="cgpa-grade">${Object.keys(gp).map(g=>`<option value="${g}"${g===grade?' selected':''}>${g}</option>`).join('')}</select></div><button class="remove-cgpa-row" type="button">×</button>`;d.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',calcCgpa));d.querySelector('button').addEventListener('click',()=>{d.remove();calcCgpa()});$('cgpaRows').appendChild(d);calcCgpa()}function calcCgpa(){let u=0,p=0;document.querySelectorAll('.cgpa-row').forEach(r=>{const units=Number(r.querySelector('.cgpa-unit').value)||0,g=r.querySelector('.cgpa-grade').value;u+=units;p+=units*(gp[g]??0)});$('cgpaValue').textContent=u?(p/u).toFixed(2):'0.00';$('cgpaUnits').textContent=`${u} total units`}$('addCgpaRowBtn')?.addEventListener('click',()=>addCgpa());addCgpa('Course 1',3,'A');addCgpa('Course 2',3,'B');

/* PAYMENT - CURRENT LIVE WEB GATEWAY */
$('payPremiumBtn')?.addEventListener('click',async()=>{$('payPremiumBtn').disabled=true;msg($('paymentMessage'),'Preparing secure payment...');try{const r=await supabaseClient.functions.invoke('paystack-initialize',{body:{}});if(r.error)throw r.error;if(!r.data?.authorization_url)throw new Error(r.data?.error||'Payment could not be initialized.');paymentRef=r.data.reference||'';localStorage.setItem('bmu_payment_reference',paymentRef);$('verifyPaymentBtn').classList.remove('hidden');window.open(r.data.authorization_url,'_blank','noopener,noreferrer');msg($('paymentMessage'),'Complete payment in the opened page, return here, then click Verify Payment.','success')}catch(e2){msg($('paymentMessage'),e2.message||'Unable to initialize payment.','error')}finally{$('payPremiumBtn').disabled=false}});
$('verifyPaymentBtn')?.addEventListener('click',async()=>{const ref=paymentRef||localStorage.getItem('bmu_payment_reference')||'';if(!ref){msg($('paymentMessage'),'No payment reference found.','error');return}$('verifyPaymentBtn').disabled=true;msg($('paymentMessage'),'Verifying payment...');try{const r=await supabaseClient.functions.invoke('paystack-verify',{body:{reference:ref}});if(r.error||r.data?.verified!==true)throw new Error(r.data?.error||r.error?.message||'Payment not confirmed.');await loadProfile();updateAccess();msg($('paymentMessage'),`Payment verified. Premium active until ${expiry(r.data.expires_at)}.`,'success');localStorage.removeItem('bmu_payment_reference')}catch(e2){msg($('paymentMessage'),e2.message||'Payment has not been confirmed.','error')}finally{$('verifyPaymentBtn').disabled=false}});

/* PROFILE */
function renderProfile(){if(!user)return;const n=displayName(),pr=isPremium(profile);$('settingsProfileInitial').textContent=n[0]?.toUpperCase()||'S';$('settingsUserName').textContent=n;$('settingsUserEmail').textContent=user.email||'';$('settingsAccountType').textContent=pr?'Premium':'Free';$('settingsPremiumExpiry').textContent=pr?(expiry(profile?.subscription_expires_at)||'Active'):'Not Active';$('profileFullName').value=profile?.full_name||n;$('profileProgramme').value=profile?.programme||'';$('profileLevel').value=profile?.level||''}function setProfileEditMode(on){['profileFullName','profileProgramme','profileLevel'].forEach(id=>{const el=$(id);if(el)el.readOnly=!on});$('profileForm')?.classList.toggle('profile-readonly',!on);$('profileEditActions')?.classList.toggle('hidden',!on);$('editProfileBtn')?.classList.toggle('hidden',on)}$('editProfileBtn')?.addEventListener('click',()=>setProfileEditMode(true));$('cancelProfileEditBtn')?.addEventListener('click',()=>{renderProfile();setProfileEditMode(false)});
$('profileForm')?.addEventListener('submit',async e=>{e.preventDefault();$('saveProfileBtn').disabled=true;try{const full_name=$('profileFullName').value.trim(),programme=$('profileProgramme').value.trim()||null,level=$('profileLevel').value.trim()||null;const {error}=await supabaseClient.from('profiles').update({full_name,programme,level,updated_at:new Date().toISOString()}).eq('id',user.id);if(error)throw error;await supabaseClient.auth.updateUser({data:{full_name}});await loadProfile();updateUser();renderProfile();msg($('profileSaveMessage'),'Profile updated.','success');setProfileEditMode(false)}catch(e2){msg($('profileSaveMessage'),e2.message||'Unable to save profile.','error')}finally{$('saveProfileBtn').disabled=false}});
$('profileResetPasswordBtn')?.addEventListener('click',()=>{if(!user?.email)return;if($('forgotEmail'))$('forgotEmail').value=user.email;resetPasswordUi('email');openModal('forgotPasswordModal')});
$('deleteAccountBtn')?.addEventListener('click',()=>{$('deleteConfirmText').value='';$('confirmDeleteAccountBtn').disabled=true;openModal('deleteAccountModal')});$('closeDeleteAccountModal')?.addEventListener('click',()=>closeModal('deleteAccountModal'));$('cancelDeleteAccountBtn')?.addEventListener('click',()=>closeModal('deleteAccountModal'));$('deleteConfirmText')?.addEventListener('input',function(){$('confirmDeleteAccountBtn').disabled=this.value.trim().toUpperCase()!=='DELETE'});$('confirmDeleteAccountBtn')?.addEventListener('click',async()=>{if($('deleteConfirmText').value.trim().toUpperCase()!=='DELETE')return;$('confirmDeleteAccountBtn').disabled=true;msg($('deleteModalMessage'),'Deleting your account...');try{const {data,error}=await supabaseClient.functions.invoke('delete-account',{body:{}});if(error)throw error;if(data?.deleted!==true)throw new Error(data?.error||'Deletion was not completed.');try{await supabaseClient.auth.signOut()}catch{}user=null;profile=null;closeModal('deleteAccountModal');publicView();alert('Your account has been permanently deleted.')}catch(e2){msg($('deleteModalMessage'),e2.message||'Unable to delete account.','error');$('confirmDeleteAccountBtn').disabled=false}});
$('logoutBtn')?.addEventListener('click',async()=>{stopTimer();stopRoom();const {error}=await supabaseClient.auth.signOut();if(error){alert(error.message);return}user=null;profile=null;publicView()});
$('dashboardSearch')?.addEventListener('input',function(){const q=this.value.trim().toLowerCase();document.querySelectorAll('.quick-tool,.recent-course').forEach(el=>el.style.display=!q||el.textContent.toLowerCase().includes(q)?'':'none')});
function animatePublic(){const els=document.querySelectorAll('.reveal-up,.reveal-left,.reveal-right'),ob=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('motion-active',e.isIntersecting)),{threshold:.1});els.forEach(e=>ob.observe(e))}function animateDash(){document.querySelectorAll('.dashboard-reveal').forEach((e,i)=>setTimeout(()=>e.classList.add('dashboard-visible'),80+i*70))}
supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){user=null;profile=null}});
async function restore(){try{const {data,error}=await supabaseClient.auth.getSession();if(error)throw error;if(data.session?.user)await dashboardView(data.session.user);else publicView()}catch(e2){console.error(e2);publicView()}}
$('dashboardDate').textContent=new Intl.DateTimeFormat('en',{weekday:'short',day:'numeric',month:'short'}).format(new Date());animatePublic();restore();

/* GLOBAL THEME */
function applyTheme(theme){
  const dark=theme==='dark';
  document.body.classList.toggle('dark',dark);
  localStorage.setItem('bmu_theme',dark?'dark':'light');
  const btn=document.getElementById('themeToggle');
  if(btn){btn.textContent=dark?'☀':'☾';btn.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');btn.title=dark?'Light mode':'Dark mode'}
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',dark?'#111112':'#a41624');
}
function initTheme(){
  const saved=localStorage.getItem('bmu_theme');
  const preferred=saved||((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');
  applyTheme(preferred);
}
initTheme();
document.getElementById('themeToggle')?.addEventListener('click',()=>applyTheme(document.body.classList.contains('dark')?'light':'dark'));

/* =========================================================
   V3 — NEXUS AI COURSE FALLBACK + AI STUDY ROOMS
   ========================================================= */
/* The retired Nexus AI course shortcut was removed; Generate Questions and
   manual course entry in Past Questions are the supported paths. */

$('groupUseAi')?.addEventListener('change',function(){
  $('groupAiFields')?.classList.toggle('hidden',!this.checked);
  if(this.checked && $('groupCourse')) $('groupCourse').value='';
});
$('groupCourse')?.addEventListener('change',function(){
  if(this.value && $('groupUseAi')?.checked){$('groupUseAi').checked=false;$('groupAiFields')?.classList.add('hidden')}
});

function studyAiTopic(format,code,title){
  const style=$('groupAiDifficulty')?.value==='test'?'test':'exam';
  const base=title?`${code} — ${title}`:code;
  if(format!=='theory')return `${base}. Generate challenging ${style}-style multiple choice questions with a correct answer and a clear explanation for every question.`;
  return `${base}. Generate rigorous university-level THEORY ${style} questions (not MCQs). ${style==='exam'?'Use difficult exam-standard, multi-part questions requiring analysis, application, comparisons and worked calculations where relevant.':'Use challenging class-test questions requiring understanding, explanation and problem solving.'} Each question must have a comprehensive accurate model answer, marking guidance and step-by-step explanation. Stay within the specified course and uploaded source if supplied. Do not claim questions are actual past exam questions.`;
}
// Keep generation bounded, deduplicated and source-grounded. Partial batches are normal.
function validStudyAiQuestion(q,format){
 if(!q||typeof q.question!=='string'||q.question.trim().length<12)return false;
 if(format==='theory')return typeof q.model_answer==='string'&&q.model_answer.trim().length>=20&&
  typeof q.marking_guide==='string'&&q.marking_guide.trim().length>=12&&
  typeof q.explanation==='string'&&q.explanation.trim().length>=15;
 return Array.isArray(q.options)&&q.options.length===4&&q.options.every(x=>typeof x==='string'&&x.trim())&&
  new Set(q.options.map(x=>x.trim().toLowerCase())).size===4&&
  Number.isInteger(q.correct_index)&&q.correct_index>=0&&q.correct_index<4&&
  typeof q.explanation==='string'&&q.explanation.trim().length>=15;
}
function studyAiQuestionKey(q){return s(q.question).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
async function studyAiFilePart(file){
 if(file.size>10*1024*1024)throw new Error('Each uploaded file must be 10 MB or smaller.');
 const name=file.name.toLowerCase();
 if(name.endsWith('.txt')||file.type==='text/plain')return{source_text:await file.text()};
 if(!/[.](pdf|png|jpe?g)$/.test(name))throw new Error('Only PDF, TXT, PNG and JPG files are supported.');
 const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return{file_base64:btoa(binary),mime_type:name.endsWith('.pdf')?'application/pdf':name.endsWith('.png')?'image/png':'image/jpeg'};
}
async function generateValidatedStudyRoomQuestions(format,courseCode,courseTitle,count,files=[]){
 const all=[],seen=new Set(),parts=[];
 for(const file of files)parts.push(await studyAiFilePart(file));
 const base=studyAiTopic(format,courseCode,courseTitle);
 // Run at most two independent requests concurrently. Parallel small batches
 // finish faster than waiting for each batch, without unbounded provider calls.
 const maxBatch=format==='theory'?3:5,attemptCap=Math.min(24,Math.max(8,Math.ceil(count/maxBatch)*4));
 let round=0,attempts=0,emptyRounds=0,lastError='';
 while(all.length<count&&attempts<attemptCap&&emptyRounds<5){
  const remaining=count-all.length;
  const jobs=Math.min(2,Math.ceil(remaining/maxBatch),attemptCap-attempts);
  const recent=all.slice(-16).map(q=>s(q.question).slice(0,120));
  let assigned=0;
  const requests=Array.from({length:jobs},(_,index)=>{
   const n=Math.min(maxBatch,remaining-assigned);assigned+=n;
   const source=parts.length?parts[(round*2+index)%parts.length]:null;
   const topic=base+(recent.length?' Do not repeat these questions: '+JSON.stringify(recent).slice(0,2000):'')+
    (jobs>1?' Produce a distinct question set for batch '+(index+1)+'; avoid common repeated examples.':'');
   return {n,source,topic};
  });
  attempts+=jobs;round++;
  msg($('studyRoomLobbyMessage'),`Preparing ${all.length} of ${count} valid ${format.toUpperCase()} questions…`,'info');
  const results=await Promise.allSettled(requests.map(async job=>{
   const body={action:job.source?'generate':'web_generate',format,count:job.n,topic:job.topic,...(job.source||{})};
   const response=await supabaseClient.functions.invoke('ai-question-generator',{body});
   if(response.error||response.data?.error)throw new Error(response.data?.message||response.error?.message||'AI generator temporarily unavailable');
   if(!Array.isArray(response.data?.result?.questions))throw new Error('AI did not return a question list');
   return response.data.result.questions;
  }));
  let added=0;
  for(const result of results){
   if(result.status==='rejected'){lastError=result.reason?.message||'AI request failed';continue}
   for(const q of result.value){
    if(!validStudyAiQuestion(q,format))continue;
    const key=studyAiQuestionKey(q);
    if(!key||seen.has(key))continue;
    seen.add(key);all.push(q);added++;
    if(all.length>=count)break;
   }
   if(all.length>=count)break;
  }
  emptyRounds=added?0:emptyRounds+1;
 }
 if(all.length<count)throw new Error(`Nexus AI prepared ${all.length} of ${count} unique, valid questions. The room has not started. ${lastError?'Last provider issue: '+lastError+'. ':''}Please try a smaller set or provide clearer material.`);
 return all.slice(0,count);
}

/* Override the earlier click path by capturing AI-room starts before the normal handler. */
$('startStudyRoomBtn')?.addEventListener('click',async e=>{
  if(!$('groupUseAi')?.checked)return;
  e.stopImmediatePropagation();
  if(!isHost||!roomData)return;
  const code=s($('groupManualCode')?.value).trim().toUpperCase();
  const name=s($('groupManualName')?.value).trim();
  const format=$('groupQuestionFormat')?.value||'mcq';
  const count=Number($('groupQuestionCount')?.value)||10;
  const minutes=Number($('groupTimeLimit')?.value)||30;
  if(!code){msg($('studyRoomLobbyMessage'),'Enter the course code for the Nexus AI room.','error');return}
  const btn=$('startStudyRoomBtn');btn.disabled=true;
  try{
    msg($('studyRoomLobbyMessage'),`Nexus AI is preparing ${count} validated ${format.toUpperCase()} questions for ${code}…`);
    const files=Array.from($('groupAiFile')?.files||[]);
    if(files.length>5)throw new Error('Select at most 5 files per room.');
    if(files.reduce((sum,file)=>sum+file.size,0)>30*1024*1024)throw new Error('Combined upload size must be 30 MB or less.');
    const prepared=await generateValidatedStudyRoomQuestions(format,code,name,count,files);
    if(prepared.length!==count)throw new Error(`Nexus AI prepared only ${prepared.length} of ${count} valid questions. The session was not started; please retry or select fewer questions.`);
    const up=await supabaseClient.from('study_rooms').update({activity:'study',question_source:'ai',question_format:format,selected_course:code,total_questions:prepared.length,time_limit_minutes:minutes}).eq('id',roomData.id);
    if(up.error)throw up.error;
    const save=await supabaseClient.rpc('save_ai_generated_study_room_questions',{p_room_id:roomData.id,p_format:format,p_questions:prepared,p_time_limit_minutes:minutes});
    if(save.error)throw save.error;
    const start=await supabaseClient.rpc('start_ai_study_room',{p_room_id:roomData.id});
    if(start.error)throw start.error;
    msg($('studyRoomLobbyMessage'),`${prepared.length} validated questions prepared. Starting room…`,'success');
    await syncRoom();
  }catch(err){msg($('studyRoomLobbyMessage'),err.message||'Could not start the Nexus AI study room.','error')}
  finally{btn.disabled=false}
},true);

/* AI study rooms use their dedicated secure RPCs. */
const _loadGroupQ=loadGroupQ;
loadGroupQ=async function(no){
  if(roomData?.question_source!=='ai')return _loadGroupQ(no);
  groupNo=Math.max(0,Math.min(no,groupTotal-1));if(roomData?.status==='playing')void supabaseClient.rpc('set_my_study_room_live_position',{p_room_id:roomData.id,p_question_no:groupNo}).then(({error})=>{if(error)console.warn('Live question tracking',error.message)});
  $('groupReviewBox').classList.add('hidden');$('groupQuizProgress').textContent=`${groupNo+1} / ${groupTotal}`;$('groupProgressBar').style.width=`${((groupNo+1)/groupTotal)*100}%`;$('groupPreviousBtn').disabled=groupNo===0;$('groupNextBtn').disabled=groupNo===groupTotal-1;
  try{
    const q=await supabaseClient.rpc('get_ai_study_room_question',{p_room_id:roomData.id,p_question_no:groupNo});
    if(q.error)throw q.error;currentGroupQuestion=row(q.data);$('groupQuestionNumber').textContent=`Question ${groupNo+1}`;$('groupQuestionText').textContent=currentGroupQuestion.question_text||'';
    if(groupFormat==='theory'){$('groupMcqOptions').classList.add('hidden');$('groupTheoryAnswer').classList.remove('hidden');$('groupSubmitTheoryBtn').classList.remove('hidden');$('groupTheoryAnswer').value=''}
    else{$('groupMcqOptions').classList.remove('hidden');$('groupTheoryAnswer').classList.add('hidden');$('groupSubmitTheoryBtn').classList.add('hidden');renderGroupOptions();await restoreGroupChoice(groupNo);if(roomData?.status==='finished'){const rev=await supabaseClient.rpc('get_my_ai_study_room_review',{p_room_id:roomData.id,p_question_no:groupNo});if(Array.isArray(rev.data)&&rev.data.length)showGroupReview(rev.data[0])}}
  }catch(err){alert(err.message||'Could not load Nexus AI group question.')}
};

const _submitGroupMcq=submitGroupMcq;
submitGroupMcq=async function(letter,button){
 if(roomData?.question_source!=='ai')return _submitGroupMcq(letter,button);
 const number=groupNo;
 document.querySelectorAll('#groupMcqOptions .option-button').forEach(b=>b.disabled=true);
 markGroupChoice(letter);
 try{
  const response=await supabaseClient.rpc('submit_ai_study_room_mcq',{p_room_id:roomData.id,p_question_no:number,p_selected_option:letter});
  if(response.error)throw response.error;
  groupSelectedAnswers.set(number,letter);
  if(roomData?.status==='finished'){
   const rev=await supabaseClient.rpc('get_my_ai_study_room_review',{p_room_id:roomData.id,p_question_no:number});
   if(groupNo===number&&Array.isArray(rev.data)&&rev.data.length)showGroupReview(rev.data[0]);
  }else if(groupNo===number)msg($('groupReviewBox'),'Answer saved. You can change your choice before submitting the session.','success');
 }catch(error){alert(error.message||'Unable to save answer.');if(groupNo===number)await restoreGroupChoice(number)}
 finally{if(groupNo===number)document.querySelectorAll('#groupMcqOptions .option-button').forEach(b=>b.disabled=false)}
};



/* V7 public landing interactions */
$('premiumCreateBtn')?.addEventListener('click',()=>openModal('signupModal'));
(function initPublicMotion(){
  const hero=document.querySelector('.hero');
  const card=document.querySelector('.phone-card');
  if(hero&&card&&window.matchMedia('(pointer:fine)').matches){
    hero.addEventListener('mousemove',e=>{const r=hero.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`perspective(1000px) rotateY(${x*7}deg) rotateX(${-y*5}deg) translateY(-2px)`});
    hero.addEventListener('mouseleave',()=>{card.style.transform='perspective(1000px) rotateY(-5deg) rotateX(2deg)'});
  }
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('motion-active');observer.unobserve(entry.target)}}),{threshold:.12});
  document.querySelectorAll('.reveal-up,.reveal-left,.reveal-right').forEach(el=>observer.observe(el));
})();

/* ===== V8 PUBLIC EXPERIENCE ===== */
(function(){
  const opening=document.getElementById('openingScene');
  if(opening){
    const seen=sessionStorage.getItem('bmuOpeningSeen');
    if(seen) opening.classList.add('finished');
    else { sessionStorage.setItem('bmuOpeningSeen','1'); setTimeout(()=>opening.classList.add('finished'),2200); }
  }
  const syncThemeButtons=()=>{
    const dark=document.body.classList.contains('dark');
    const p=document.getElementById('publicThemeToggle');
    if(p){p.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');p.title=dark?'Light mode':'Dark mode';}
  };
  document.getElementById('publicThemeToggle')?.addEventListener('click',()=>{
    applyTheme(document.body.classList.contains('dark')?'light':'dark');syncThemeButtons();
  });
  document.getElementById('themeToggle')?.addEventListener('click',syncThemeButtons);
  syncThemeButtons();
  document.getElementById('premiumCreateBtn')?.addEventListener('click',()=>openModal('signupModal'));

  const screen=document.getElementById('marketingAppScreen');
  const screens={
    questions:['PHS 201','Introductory Physiology','Start a focused MCQ session.','Past Questions','30 questions ready'],
    ai:['Nexus AI','Study Assistant','Ask a course question and understand why.','Ask Nexus','Explain this topic'],
    library:['Study Library','Course Resources','Browse approved notes, slides and resources.','Materials','52+ resources'],
    group:['Study Groups','Learn Together','Create a room and practise with friends.','Create Room','Live group practice']
  };
  document.querySelectorAll('.app-feature').forEach(el=>el.addEventListener('click',()=>{
    document.querySelectorAll('.app-feature').forEach(x=>x.classList.remove('active'));el.classList.add('active');
    if(!screen)return; const d=screens[el.dataset.appScreen]||screens.questions;
    const course=screen.querySelector('.device-course'); const greeting=screen.querySelector('.device-greeting');
    if(course){course.querySelector('b').textContent=d[0];course.querySelector('small').textContent=d[1];}
    if(greeting){greeting.querySelector('strong').textContent=d[3];greeting.querySelector('span').textContent=d[2];}
  }));

  if(matchMedia('(pointer:fine)').matches){
    const art=document.querySelector('.hero-art');
    art?.addEventListener('mousemove',e=>{const r=art.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;art.style.setProperty('--mx',`${x*10}px`);art.style.setProperty('--my',`${y*10}px`);const card=art.querySelector('.phone-card');if(card)card.style.transform=`perspective(1000px) rotateY(${x*7}deg) rotateX(${-y*5}deg) translate(${x*5}px,${y*5}px)`;});
    art?.addEventListener('mouseleave',()=>{const card=art.querySelector('.phone-card');if(card)card.style.transform='';});
  }
})();

try{renderNexusHistory();setProfileEditMode(false)}catch(e){console.warn(e)}

/* Keep the host setup preview in sync for AI rooms (DB updates on Start). */
['groupQuestionFormat','groupQuestionCount','groupTimeLimit','groupManualCode','groupManualName','groupUseAi','groupAiDifficulty'].forEach(id=>$(id)?.addEventListener('change',()=>{
 if(!$('groupUseAi')?.checked)return;
 const code=($('groupManualCode')?.value||'').trim().toUpperCase()||'Course not selected';
 const title=($('groupManualName')?.value||'').trim();
 const format=($('groupQuestionFormat')?.value||'mcq').toUpperCase();
 const count=$('groupQuestionCount')?.value||10;
 const minutes=$('groupTimeLimit')?.value||30;
 const label=`${code}${title?' — '+title:''} • ${format} • ${count} questions • ${minutes} min • Nexus AI`;
 const preview=$('roomSelectionPreview')?.querySelector('span');if(preview)preview.textContent=label;
}));
