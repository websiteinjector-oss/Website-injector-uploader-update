// Firebase setup
const firebaseConfig = {
  apiKey: "AIzaSyBikwOco-WFuucTCKQR2a15V_wVXha5Y1Y",
  authDomain: "website-857ee.firebaseapp.com",
  databaseURL: "https://website-857ee-default-rtdb.firebaseio.com/",
  projectId: "website-857ee"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Globals
let user = "", data = {}, downloadsStatus = {}, downloadIntervals = {};
let currentCommentAPK = "";

// AUTO LOGIN
window.onload = function() {
  let saved = localStorage.getItem("apkUser");
  if(saved){
    user = saved;
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    document.getElementById("profileName").textContent = user;
    loadAPKs(); loadDownloadsStatus(); loadProfile();
    loadFriends();
  }
}

// CAPTCHA
let captchaValue = "";
function makeCaptcha(){
  let chars = "ABCDEFGHJKLMNP123456789";
  captchaValue = "";
  for(let i=0;i<5;i++){
    captchaValue += chars[Math.floor(Math.random()*chars.length)];
  }
  document.getElementById("captcha").innerHTML = captchaValue;
}
makeCaptcha();

// LOGIN
function login(){
  let u = document.getElementById("user").value;
  let p = document.getElementById("password").value;
  let c = document.getElementById("capInput").value;
  let email = document.getElementById("email").value;
  let telegram = document.getElementById("telegram").value;

  if(c !== captchaValue){ alert("Wrong captcha"); makeCaptcha(); return; }
  if(!u || !p){ alert("Username & Password required"); return; }

  user = u;
  localStorage.setItem("apkUser", u);

  db.ref("users/"+u).set({ password: p, email, telegram, lastLogin: Date.now() });

  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("profileName").textContent = user;

  loadAPKs(); loadDownloadsStatus(); loadProfile(); loadFriends();
}

// LOGOUT
function logout(){ if(confirm("Logout?")){ localStorage.removeItem("apkUser"); location.reload(); } }

// TABS
function showTab(t){
  document.querySelectorAll(".tab").forEach(e=>e.style.display="none");
  document.getElementById(t).style.display="block";
}
function switchHomeTab(tab){
  document.querySelectorAll(".home-tab").forEach(e=>e.style.display="none");
  document.getElementById(tab).style.display="block";
}

// ICON PREVIEW
function showPreview(event){
  let file = event.target.files[0];
  if(!file) return;
  let img = new Image();
  img.onload = function(){
    if(img.width<128 || img.height<128){ alert("Icon must be at least 128x128"); document.getElementById("iconFile").value=""; return; }
    let reader = new FileReader();
    reader.onload = e => document.getElementById("previewIcon").src = e.target.result;
    reader.readAsDataURL(file);
  }
  img.src = URL.createObjectURL(file);
}

// UPLOAD
function fileToBase64(file, callback){
  let reader = new FileReader();
  reader.onload = e => callback(e.target.result);
  reader.readAsDataURL(file);
}

function upload(){
  let name = document.getElementById("name").value;
  let desc = document.getElementById("desc").value;
  let apk = document.getElementById("apk").value;
  let telegramLink = document.getElementById("telegramUpload").value;
  let iconFile = document.getElementById("iconFile").files[0];
  if(!name || !apk || !iconFile){ alert("App Name, APK, and Icon required"); return; }

  fileToBase64(iconFile, iconData => {
    let node = db.ref("apks").push();
    node.set({
      appName: name,
      description: desc,
      apkURL: apk,
      icon: iconData,
      uploadedBy: user,
      telegramLink,
      downloads: 0,
      likesCount:0,
      comments:0,
      time: Date.now()
    });
    alert("Uploaded!");
  });
}

// LOAD APKs
function loadAPKs(){ db.ref("apks").on("value", snap => { data = snap.val() || {}; renderAPKs(); }); }
function loadDownloadsStatus(){ db.ref("downloadsStatus/"+user).on("value", snap => { downloadsStatus = snap.val()||{}; renderAPKs(); }); }

// RENDER APKs
function renderAPKs(){
  let latest=document.getElementById("latest");
  let top=document.getElementById("top");
  let my=document.getElementById("my");
  latest.innerHTML=""; top.innerHTML=""; my.innerHTML="";

  let arr=Object.keys(data).map(k=>({id:k,...data[k]}));
  let search=document.getElementById("search").value.toLowerCase();
  arr = arr.filter(a=>a.appName.toLowerCase().includes(search));

  arr.sort((a,b)=>b.time-a.time); arr.forEach(a=>latest.appendChild(makeCard(a)));
  arr.sort((a,b)=>b.downloads-a.downloads); arr.forEach(a=>top.appendChild(makeCard(a)));
  arr.filter(a=>a.uploadedBy==user).forEach(a=>my.appendChild(makeCard(a)));
}

// MAKE CARD
function makeCard(a){
  let d = document.createElement("div"); d.className="apk";
  let status = downloadsStatus[a.id] || "";
  let btnText = status=="done"?"Re-download":"Download";

  d.innerHTML = `
  <img src="${a.icon}">
  <div>
    <b>${a.appName}</b><br>
    ${a.description}<br>
    Uploaded by ${a.uploadedBy}<br>
    Downloads: ${a.downloads} | Likes: ${a.likesCount||0} | Comments: ${a.comments||0}<br>
    <button class="like-btn" onclick='likeAPK("${a.id}")'>Like</button>
    <button class="comment-btn" onclick='openCommentModal("${a.id}")'>Comment</button>
    <button class="report-btn" onclick='reportAPK("${a.id}")'>Report</button>
    ${a.uploadedBy===user?`<button class="delete-btn" onclick='deleteAPK("${a.id}")'>Delete</button>`:""}
    <div class="progress-container"><div class="progress-bar" id="p_${a.id}"></div></div>
    <button onclick='startDownload("${a.id}")'>${btnText}</button>
    ${a.telegramLink?`<br>Telegram: <a href="${a.telegramLink}" target="_blank">${a.telegramLink}</a>`:""}
  </div>`;
  return d;
}

// LIKE
function likeAPK(id){
  const likeRef = db.ref("apks/"+id+"/likes/"+user);
  likeRef.once("value", snap=>{
    if(snap.exists()){ alert("Already liked"); return; }
    likeRef.set(true);
    db.ref("apks/"+id+"/likes").once("value", snap2 => {
      db.ref("apks/"+id+"/likesCount").set(Object.keys(snap2.val()||{}).length);
      renderAPKs();
      loadProfile();
    });
  });
}

// DELETE
function deleteAPK(id){ if(confirm("Delete this APK?")) db.ref("apks/"+id).remove(); }

// DOWNLOAD
function startDownload(id){
  let a = data[id];
  let pb = document.getElementById("p_"+id);
  let status = downloadsStatus[id] || "";

  if(downloadIntervals[id]) clearInterval(downloadIntervals[id]);

  if(status === "done"){ window.open(a.apkURL,"_blank"); return; }

  let progress = 0;
  downloadIntervals[id] = setInterval(()=>{
    progress+=5; pb.style.width=progress+"%"; pb.innerText=Math.min(progress,100)+"%";
    if(progress>=100){
      clearInterval(downloadIntervals[id]);
      window.open(a.apkURL,"_blank");
      db.ref("downloadsStatus/"+user+"/"+id).set("done");
      db.ref("apks/"+id+"/downloads").transaction(n=>(n||0)+1);
      loadDownloadsStatus(); loadProfile();
      renderAPKs();
    }
  },200);
}

// COMMENTS
function openCommentModal(id){ currentCommentAPK=id; document.getElementById("commentModal").style.display="flex"; loadComments(id); }
function closeCommentModal(){ document.getElementById("commentModal").style.display="none"; }
function loadComments(id){
  let list=document.getElementById("commentList"); list.innerHTML="";
  db.ref("apks/"+id+"/comments").on("value", snap=>{
    let c = snap.val()||{};
    Object.values(c).forEach(cm=>{
      let div=document.createElement("div");
      div.innerHTML=`<b>${cm.user}</b>: ${cm.text}`;
      list.appendChild(div);
    });
  });
}
function postComment(){
  let text = document.getElementById("newComment").value;
  if(!text) return;
  db.ref("apks/"+currentCommentAPK+"/comments").push({user,text,time:Date.now()});
  db.ref("apks/"+currentCommentAPK+"/comments").once("value", snap=>{
    db.ref("apks/"+currentCommentAPK+"/comments").update({comments:Object.keys(snap.val()||{}).length});
    renderAPKs(); loadProfile();
  });
  document.getElementById("newComment").value="";
}

// REPORT
function reportAPK(id) {
  let reason = prompt("Why report this APK?");
  if (!reason) return;
  
  let reportId = db.ref("reports").push().key; // generate unique key
  
  db.ref("reports/" + reportId).set({
    apkId: id,
    reporter: user,
    reason: reason,
    status: "pending",
    time: Date.now()
  });
  
  sendReportToTelegram(reportId, id, user, reason); // send to bot
  showNotification("Report sent to admin via Telegram");
}
function sendReportToTelegram(reportId, apkId, reporter, reason){
  const botToken = "8689417895:AAFLxUaOv1-mZhd5KyVp0Dxow1pjn_m3bQg";
  const chatId = "8625443455"; // your admin Telegram ID

  let apkName = data[apkId]?.appName || "Unknown APK";

  let message = `
📌 New Report
APK: ${apkName}
Reporter: ${reporter}
Reason: ${reason}
Report ID: ${reportId}
`;

  // Approve / Decline / Ban buttons
  let buttons = {
    "inline_keyboard":[[
      {"text":"✅ Approve","callback_data":"approve_"+reportId},
      {"text":"❌ Decline","callback_data":"decline_"+reportId},
      {"text":"⛔ Ban 1d","callback_data":"ban_1d_"+reportId},
      {"text":"⛔ Ban 3d","callback_data":"ban_3d_"+reportId}
    ]]
  };

  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      reply_markup: buttons
    })
  });
}
// PROFILE
function loadProfile(){
  db.ref("users/"+user).once("value", snap=>{
    let u = snap.val()||{};
    document.getElementById("profileEmail").innerText = u.email||"";
    document.getElementById("profileTelegram").innerText = u.telegram||"";
  });

  db.ref("apks").once("value", snap=>{
    let all = snap.val()||{};
    let likes=0, comments=0, downloads=0;
    Object.values(all).forEach(a=>{
      if(a.uploadedBy===user){
        likes += a.likesCount||0;
        comments += a.comments||0;
        downloads += a.downloads||0;
      }
    });
    document.getElementById("profileLikes").innerText = likes;
    document.getElementById("profileComments").innerText = comments;
    document.getElementById("profileDownloads").innerText = downloads;
  });
}
function reportAPK(id){
  let reason = prompt("Why report this APK?");
  if(!reason) return;

  let reportId = db.ref("reports").push().key; // generate unique key

  db.ref("reports/"+reportId).set({
    apkId: id,
    reporter: user,
    reason: reason,
    status: "pending",
    time: Date.now()
  });

  sendReportToTelegram(reportId, id, user, reason); // send to bot
  showNotification("Report sent to admin via Telegram");
}
function sendReportToTelegram(reportId, apkId, reporter, reason){
  const botToken = "8689417895:AAFLxUaOv1-mZhd5KyVp0Dxow1pjn_m3bQg";
  const chatId = "8625443455"; // your admin Telegram ID

  let apkName = data[apkId]?.appName || "Unknown APK";

  let message = `
📌 New Report
APK: ${apkName}
Reporter: ${reporter}
Reason: ${reason}
Report ID: ${reportId}
`;

  // Approve / Decline / Ban buttons
  let buttons = {
    "inline_keyboard":[[
      {"text":"✅ Approve","callback_data":"approve_"+reportId},
      {"text":"❌ Decline","callback_data":"decline_"+reportId},
      {"text":"⛔ Ban 1d","callback_data":"ban_1d_"+reportId},
      {"text":"⛔ Ban 3d","callback_data":"ban_3d_"+reportId}
    ]]
  };

  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      reply_markup: buttons
    })
  });
}
// CHANGE USERNAME
function changeUsername(){
  let newUser = prompt("New username"); if(!newUser) return;
  db.ref("users/"+newUser).once("value", snap=>{
    if(snap.exists()){ alert("Username taken"); return; }
    db.ref("users/"+user).once("value", old=>{
      db.ref("users/"+newUser).set(old.val());
      db.ref("users/"+user).remove();
      db.ref("apks").once("value", snap2=>{
        let all = snap2.val()||{};
        Object.keys(all).forEach(id=>{
          if(all[id].uploadedBy===user) db.ref("apks/"+id+"/uploadedBy").set(newUser);
        });
      });
      user = newUser; localStorage.setItem("apkUser", newUser);
      document.getElementById("profileName").innerText = newUser; alert("Username changed!");
    });
  });
}

// CHANGE PASSWORD
function changePassword(){
  let newPass = prompt("New password"); if(!newPass) return;
  db.ref("users/"+user+"/password").set(newPass);
  alert("Password changed!");
}

// FRIENDS & MESSENGER
function loadFriends(){
  db.ref("friends/"+user+"/requests").on("value", snap=>{
    let div=document.getElementById("friendRequests"); div.innerHTML="";
    let req = snap.val()||{};
    Object.keys(req).forEach(r=>{
      let b=document.createElement("div");
      b.innerHTML=`${req[r].from} <button onclick='acceptFriend("${r}","${req[r].from}")'>Accept</button> <button onclick='rejectFriend("${r}")'>Cancel</button>`;
      div.appendChild(b);
    });
  });

  db.ref("friends/"+user+"/list").on("value", snap=>{
    let div=document.getElementById("friendList"); div.innerHTML="";
    let list = snap.val()||{};
    Object.keys(list).forEach(f=>{
      let b=document.createElement("div");
      b.innerHTML=`${f} <button onclick='openChat("${f}")'>Chat</button>`;
      div.appendChild(b);
    });
  });
}

function addFriend(){
  let f = document.getElementById("friendSearchInput").value;
  if(!f || f===user) return alert("Invalid user");
  db.ref("users/"+f).once("value", snap=>{
    if(!snap.exists()) return alert("User not found");
    db.ref("friends/"+f+"/requests").push({from:user, time:Date.now()});
    alert("Friend request sent");
  });
}

function acceptFriend(rid, f){ 
  db.ref("friends/"+user+"/list/"+f).set(true); 
  db.ref("friends/"+f+"/list/"+user).set(true);
  db.ref("friends/"+user+"/requests/"+rid).remove(); 
}

function rejectFriend(rid){ db.ref("friends/"+user+"/requests/"+rid).remove(); }

// CHAT
let chatWithCurrent = "";
function openChat(f){
  chatWithCurrent = f;
  document.getElementById("chatWith").innerText = f;
  document.getElementById("chatModal").style.display = "flex";
  loadChat(f);
}

function closeChatModal(){ document.getElementById("chatModal").style.display="none"; }

function loadChat(f){
  let chatDiv = document.getElementById("chatMessages"); chatDiv.innerHTML="";
  db.ref("messages/"+[user,f].sort().join("_")).on("value", snap=>{
    let all = snap.val()||{};
    chatDiv.innerHTML="";
    Object.values(all).forEach(m=>{
      let div = document.createElement("div");
      div.innerText = `${m.from}: ${m.text}`;
      chatDiv.appendChild(div);
    });
  });
}

function sendMessage(){
  let txt = document.getElementById("chatInput").value;
  if(!txt) return;
  db.ref("messages/"+[user,chatWithCurrent].sort().join("_")).push({from:user,text:txt,time:Date.now()});
  document.getElementById("chatInput").value="";
}

// CALL RENDER
loadAPKs(); loadDownloadsStatus(); loadProfile(); loadFriends();