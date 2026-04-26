/*
 * Copyright (c) 2016-2018 Jeffrey Hutzelman.
 * All Rights Reserved.
 * See LICENSE for licensing terms.
 */
var f_topdiv   = document.getElementById("topdiv");
var f_wfAlert  = document.getElementById("wf_alert");
var f_run      = document.getElementById("run");
var f_tod      = document.getElementById("tod");
var f_tod2     = document.getElementById("tod2");
var f_date     = document.getElementById("date");
var f_flag     = document.getElementById("flag");
var f_flagtext = document.getElementById("flagtext");
var f_laps     = document.getElementById("laps");
var f_estLaps2Go = document.getElementById("est_laps2go");
var f_laps2go  = document.getElementById("laps2go");
var f_projLaps = document.getElementById("proj_total_laps");
var f_totlaps = document.getElementById("sched_total_laps");
var f_elapsed  = document.getElementById("elapsed");
var f_proj_total = document.getElementById("proj_total_tm");
var f_proj_above = document.getElementById("projected_above");
var f_timeleft = document.getElementById("timeleft");
var f_proj_below = document.getElementById("projected_below");
var f_sched_total = document.getElementById("sched_total");
var f_leaders  = document.getElementById("leaders");
var f_clslead  = document.getElementById("clslead");
var f_progress = document.getElementById("progress");
var f_message  = document.getElementById("message");
var f_error    = document.getElementById("error");

var f_version  = document.getElementById("version");
var f_logo     = document.getElementById("logo");
var f_options  = document.getElementById("options");
var f_v_html   = document.getElementById("version_html");
var f_v_css    = document.getElementById("version_css");
var f_v_js     = document.getElementById("version_js");
var f_v_srv    = document.getElementById("version_srv");
var f_v_opts   = document.getElementById("version_opts");

var f_proj_elements = document.getElementsByClassName("projection-span");

var css_version = "";
var js_version = "1.3-@@@@@@-@@@@@@";
var data_port = "9999";

var timezone = "";
var server_tz = "";
var display_mode;
var display_modes = [ "raceinfo", "bigtod" ]
var maxLeaders = 3;
var cars = new Object;
var classes = new Object;
var car_class = new Object;
var is_qual = undefined;
var Gclass_lead = new Object;
var Gclass_lead_text = "";
var Gleaders = [];
var Gleaders_text = "";
var Hclass_lead_text = "";
var Hleaders = [];
var Hleaders_text = "";
var last_passing = new Object;
var progress_start = undefined;
var progress_length = undefined;
var planned_laps2go = undefined;
var estimated_laps2go = undefined;
var tod_is_local = false;
var opts_changed = false;
var hb_timeout;
var server_error = "";
var white_flag_warned = false;
console.log(`white_flag_warned initialized as ${white_flag_warned}`);
var cached_scheduled_total = undefined; // Performance cache for race duration
var last_messages = new Object(); // Stores the last raw string for each message type

// Move formatting to a shared helper
function fmt_time(t, includeMS) {
    var h = Math.floor(t / 3600);
    var m = Math.floor((t % 3600) / 60);
    var s = t % 60;
    
    // If includeMS is false, we round the seconds to the nearest integer
    var s_str = includeMS ? s.toFixed(3) : Math.round(s).toString();
    
    // Ensure leading zeros for seconds
    if (includeMS) {
        if (s < 10) s_str = "0" + s_str;
    } else {
        if (s < 10) s_str = "0" + s_str;
    }
    
    var m_str = (m < 10) ? "0" + m : m;
    if (h > 0) return h + ":" + m_str + ":" + s_str;
    return m_str + ":" + s_str;
}

function isNumeric(val){
  return !isNaN(parseFloat(val)) && isFinite(val);
}

function getCookie(name) {
    function escape(s) { return s.replace(/([.*+?\^${}()|\[\]\/\\])/g, '\\$1'); };
    var match = document.cookie.match(RegExp('(?:^|;\\s*)' + escape(name) + '=([^;]*)'));
    return match ? match[1] : null;
}

function process_opts(optstr) {
  if (optstr == null) {
    optstr = window.location.hash.replace(/^#/, '');
  }
  f_v_opts.textContent = optstr;
  opts_changed = true;

  var opts = new Map();
  var optlist = optstr.split(';');
  optlist.forEach(function(val,index,a) {
    if (val != "") {
      var kv = val.split('=', 2);
      if (kv.length < 2) { kv[1] = 1 }
      opts.set(kv[0], kv[1]);
    }
  });

  if (opts.has("mode")) display_mode = opts.get("mode").toLowerCase().trim();
  else display_mode = "raceinfo";
  
  f_topdiv.dataset.mode = display_mode;

  // Alias "timing" to use the raceinfo UI layout
  var show_mode = (display_mode === "timing") ? "raceinfo" : display_mode;

  for (var mode of display_modes) {
    var e = document.getElementById(mode);
    if (show_mode == mode) e.style.display = "block";
    else                   e.style.display = "none";
  }
  
  if (opts.has("tz")) {
    timezone = opts.get("tz");
  }
  if (opts.has("tz")) {
    timezone = opts.get("tz");
    if (tod_is_local) show_local_time();
  }

  f_topdiv.className = "top";
  if (opts.has("display")) { // [none], chromeHD, chromeTV, chrome43
    f_topdiv.classList.add(opts.get("display"));
  }

  if (opts.has("zoom")) {
    f_topdiv.style.zoom = opts.get("zoom");
  }

  if (opts.has("nologo")) {
    f_topdiv.dataset.nologo = true;
  } else {
    f_topdiv.dataset.nologo = false;
  }

  if (opts.has("version")) {
    f_topdiv.dataset.showversion = true;
  }
  
  // Ensure changes reflect immediately
  updateLaps2Go();
  if (typeof updateProjectedTime === "function") updateProjectedTime();
}

function show_local_time () {
  tod_is_local = true;
  var now = new Date();
  var todopts = { hour12:false, hour:'2-digit', minute:'2-digit' };
  var dayopts = { year:'numeric', month:'long', day:'numeric', weekday:'long' };
  if (timezone != "") {
    todopts['timeZone'] = timezone;
    dayopts['timeZone'] = timezone;
  } else if (server_tz != "") {
    todopts['timeZone'] = server_tz;
    dayopts['timeZone'] = server_tz;
  }
  f_tod2.textContent  = now.toLocaleTimeString(undefined, todopts);
  f_date.textContent = now.toLocaleDateString(undefined, dayopts);
}

function parse_time (t) {
  found = t.match(/^(\d+):(\d+):(\d+)(?:\.(\d+))?$/)
  if (found === null || found === undefined) {
    return undefined;
  }
  t = (found[1] * 3600) + (found[2] * 60) + (found[3] * 1);
  if (found[4] !== undefined) {
    t += (found[4] * .001);
  }
  return t
}

function showMessage(msg) {
  f_message.textContent = msg
}

function setFlag(flag) {
  flag = flag.trim();
  if (flag == "Finish") flag = "Checkered";
  if (flag == "") {
    f_flagtext.textContent = '';
    f_flag.className = "NoFlag";
  } else {
    f_flag.className = flag + "Flag";
    f_flagtext.textContent = flag + " Flag";
    f_topdiv.dataset.flag = flag;
  }
}

function updateProgress(elapsed) {
  msg = progress_start + ' / ' + progress_length + ' @ ' + elapsed;
  if (progress_start === undefined) {
    f_progress.style.width = '0%';
  } else {
    now = parse_time(elapsed);
    width = (now - progress_start) / (progress_length);
    msg = msg + ' -> ' + now + ' / ' + width;
    if (width < 0) {
      f_progress.style.width = '0%';
    } else if (width > 1) {
      width = 1;
      f_progress.style.backgroundColor = 'yellow';
    } else {
      f_progress.style.backgroundColor = 'green';
    }
    f_progress.style.width = (width * 100) + '%';
  }
  /* showMessage(msg); */
}

function updateLaps2Go() {
  if (estimated_laps2go !== undefined && estimated_laps2go < planned_laps2go) {
    f_estLaps2Go.textContent = estimated_laps2go;
  }
  if (planned_laps2go == 9999 || planned_laps2go === undefined) {
    f_laps2go.textContent = '';
  } else {
    f_laps2go.textContent = planned_laps2go;
  }
  f_topdiv.dataset.showProjLaps = (estimated_laps2go !== undefined && (estimated_laps2go < planned_laps2go || planned_laps2go === undefined)) ? "true" : "false";
}

function updateProjectedTime() {
  
  if (!f_proj_above || !f_proj_below || cached_scheduled_total === undefined) return;

  // Exit if data is missing or not in timing mode
  if (display_mode !== 'timing' || progress_length === undefined || progress_length <= 0 || progress_start === undefined) {
    delete f_topdiv.dataset.closefinish;
    if (f_proj_total) f_proj_total.textContent = "--:--:--";
    return;
  }

  // 1. Calculate Laps Remaining based strictly on the TIME LIMIT
  var time_to_limit = cached_scheduled_total - progress_start;
  var laps_by_time = Math.ceil(time_to_limit / progress_length);

  // 2. Get Laps Remaining based strictly on the LAP LIMIT (from $F)
  var laps_by_count = parseInt(planned_laps2go);
  // If Orbits sends 0 or 9999 for a timed race, we ignore the lap cap
  if (isNaN(laps_by_count) || laps_by_count <= 0 || laps_by_count > 500) {
      laps_by_count = 9999; 
  }

  // 3. THE CAP: True laps to go is the shorter of the two
  var true_laps_to_go = Math.min(laps_by_time, laps_by_count);
  if (isNumeric(f_laps.textContent)) {

    var projected_total_laps = parseInt(f_laps.textContent) + true_laps_to_go;
    console.log(`Completed laps (${parseInt(f_laps.textContent)}) + true_laps_to_go (${true_laps_to_go}) = ${projected_total_laps}`)
    if (f_projLaps.textContent != projected_total_laps.toString())
      f_projLaps.textContent = projected_total_laps.toString();
  }

  // 4. Calculate Projected Finish Time based on the CAP
  var time_after = progress_start + (true_laps_to_go * progress_length);
  var delta_after = time_after - cached_scheduled_total;

  // 5. Projected White Flag crossing (one lap before finish)
  var time_before = time_after - progress_length;
  var delta_before = time_before - cached_scheduled_total;

  // Update UI (Projected Total includes MS)
  if (f_proj_total) f_proj_total.textContent = fmt_time(time_after, true);

  // Radar Display (Offsets only)
  if (Math.abs(delta_before) <= 30 && delta_before !== 0) {
    f_proj_above.textContent = "(" + (delta_before > 0 ? "+" : "") + delta_before.toFixed(3) + " sec)";
    f_topdiv.dataset.closefinish = "before";
  } else if (Math.abs(delta_after) <= 30 && delta_after !== 0) {
    f_proj_below.textContent = "(" + (delta_after > 0 ? "+" : "") + delta_after.toFixed(3) + " sec)";
    f_topdiv.dataset.closefinish = "after";
  } else {
    delete f_topdiv.dataset.closefinish;
  }
  
  // Return the calculated laps to go so the calling function can use it for audio
  return true_laps_to_go;
}

function computePassing(passing) {
  progress_start = undefined;
  progress_length = undefined;

  if (passing !== undefined) {
    length = parse_time(passing.laptime);
    if (length > 0) {
      progress_start = parse_time(passing.elapsed);
      progress_length = length;
      
      if (f_timeleft.textContent != '') {
        var timeleft_ms = parse_time(f_timeleft.textContent);
        if (timeleft_ms !== undefined && timeleft_ms >= 0) {
          estimated_laps2go = Math.ceil(timeleft_ms / progress_length);
        }
      }
    }
  }
  updateProgress(f_elapsed.textContent);
  updateLaps2Go();
  
  // Run the projection and capture the resulting lap count
  var lapsLeft = updateProjectedTime();

  // AUDIO ALERT TRIGGER: Only runs when this function is called (on passing)
  // If lapsLeft is 2, the leader just crossed and has 2 laps left (Current + Final).
  if (lapsLeft === 2 && !white_flag_warned) {
    white_flag_warned = true;
    if (f_wfAlert && f_wfAlert.checked) {
      var activeUtterance = new SpeechSynthesisUtterance("Confirm White Flag call around.");
      window.speechSynthesis.speak(activeUtterance);
    }
  }
}

function showError(msg) {
  if (msg == '') {
    f_error.style.display = "none";
    f_message.style.display = "inline";
  } else {
    f_error.textContent = msg;
    f_message.style.display = "none";
    f_error.style.display = "inline";
  }
}

function reconnect(s) {
  console.log("Server heartbeat timeout");
  s.close(4000, "Server heartbeat timeout");
}

function heartbeat(e,s) {
  showError(server_error);
  if (hb_timeout !== undefined) {
    window.clearTimeout(hb_timeout);
  }
  hb_timeout = window.setTimeout(reconnect, 20000, s);
}

function doconnect() {
    try {
        var host = "ws://" + window.location.hostname + ":" + data_port + "/";
    	  if (window.location.protocol === "https:") {
          var host = "wss://" + window.location.hostname + "/bigclock-ws/";
        } 
        console.log("Host:", host);
        try {
          var s = new WebSocket(host);
        } catch (errror) {
          console.error(`failed to open connection to ${host}: ${errror}`);
        }
        if (!s) return;
        s.onopen = function (e) {
            console.log("Socket opened.");
            heartbeat(e,s);
            s.send(JSON.stringify(['%U', window.navigator.userAgent]));
            s.send(JSON.stringify(['%V', f_v_html.textContent,
                                  css_version, js_version]));
        };
        s.onclose = function (e) {
            console.log("Socket closed.");
            showError("Server connection lost");
            show_local_time();
            window.setTimeout(doconnect, 3000);
        };
        s.onmessage = function (e) {
            heartbeat(e,s);
            //console.log("Socket message:", e.data);
            if (opts_changed) {
              s.send(JSON.stringify(['%O', f_v_opts.textContent]));
              opts_changed = false;
            }
            if (e.data == "ping") {
              s.send("pong");
              return;
            }
            var fields = JSON.parse(e.data);
            if (last_messages[fields[0]] === e.data)
              return;
            last_messages[fields[0]] = e.data;
            //f_run.textContent = fields[0];
            /* Possible field formats:
             *   $A,regno,car,txno,first,last,nat,classno
             *   $COMP,regno,car,classno,first,last,nat,addl
             *   $B,runid,description
             *   $C,classno,description
             *   $E,setting,value
             *   $F,laps2go,timeleft,tod,elapsed,flag
             *   $G,pos,regno,laps,time
             *   $H,pos,regno,bestlap,besttime
             *   $I,tod,date (init/reset)
             *   $J,regno,laptime,time
             *   $SP,pos,car,bestlap,besttime,besttimems
             *   $SR,pos,car,laps,laptime,laptimems
             *   :V,server-version
             */
            if (fields[0] == '$A') {
              cars[fields[1]] = fields[2];
              car_class[fields[1]] = fields[7];

            } else if (fields[0] == '$B') {
              /* Run info: $B,id,description */
              if (f_run.textContent !== fields[2]) {
                white_flag_warned = false; 
                console.log(`white_flag_warned set to ${white_flag_warned}`);
                cached_scheduled_total = undefined;
              }
              f_run.textContent = fields[2];
              var run_is_qual = (
                                 fields[2].match(/qual|prac|test/i)
                                 && !fields[2].match(/race/i))
              console.log(`is_qual = ${is_qual} / run_is_qual = ${run_is_qual} / f_topdiv.dataset.session = ${f_topdiv.dataset.session}`);
              if (f_topdiv.dataset.session == undefined)
                f_topdiv.dataset.session = "race";
              if ((is_qual == undefined || !is_qual) && run_is_qual) {
                console.log('Switching to qual mode');
                is_qual = true;
                f_leaders.textContent = Hleaders_text;
                f_clslead.textContent = Hclass_lead_text;
                f_topdiv.dataset.session = "qual";
              } else if ((is_qual == undefined || is_qual) && !run_is_qual) {
                console.log('Switching to race mode');
                is_qual = false;
                f_leaders.textContent = Gleaders_text;
                f_clslead.textContent = Gclass_lead_text;
                f_topdiv.dataset.session = "race";
              }
              if (fields[1] == "95" && f_topdiv.dataset.status != "stopped") {
                f_topdiv.dataset.status = "stopped";
                delete f_topdiv.dataset.closefinish;
              } else if (fields[1] != "95" && f_topdiv.dataset.status != "running") {
                f_topdiv.dataset.status = "running";
              }
            } else if (fields[0] == '$C') {
              /* Class: $C,classno,description */
              classes[fields[1]] = fields[2];

            } else if (fields[0] == '$F') {
              /* flag info: $F,laps2go,remaining,tod,elapsed,flag */
              planned_laps2go = fields[1];
              f_timeleft .textContent = fields[2];
              f_tod      .textContent = fields[3];
              f_tod2     .textContent = fields[3];
              f_elapsed  .textContent = fields[4];
              if (cached_scheduled_total === undefined && fields[2] !== "00:00:00") {
                var t_left = parse_time(fields[2]);
                var t_elap = parse_time(fields[4]);
                if (t_left !== undefined && t_elap !== undefined) {
                    var total = t_elap + t_left;
                    // Smooth the +/- 1s jitter
                    var rem = Math.round(total) % 60;
                    if (rem === 59) total += 1;
                    else if (rem === 1) total -= 1;
                    
                    cached_scheduled_total = total;
                    
                    if (f_sched_total) f_sched_total.textContent = fmt_time(total, false);
                    var totLaps = undefined;
                    if (isNumeric(planned_laps2go)){
                      if (isNumeric(f_laps.textContent)) {
                        totLaps = parseInt(planned_laps2go) + parseInt(f_laps.textContent);
                      } else {
                        totLaps = parseInt(planned_laps2go) ;
                      }
                    }
                    if (totLaps > 9999) totLaps = 9999;
                    if (f_totlaps) {
                      f_totlaps.textContent = totLaps.toString();
                      f_topdiv.dataset.showSchdLaps = totLaps != 9999
                    }
                }
              }
              tod_is_local = false;
              setFlag(fields[5]);
              updateProgress(fields[4]);
              updateLaps2Go();
              updateProjectedTime();
            } else if (fields[0] == '$G') {
              var leaderstr;
              /* race info: $G,pos,regcode,laps,time */
              if (fields[1] == 1) {
                f_laps.textContent = fields[3];
                if (f_laps.textContent == "") f_laps.textContent = "0";
                computePassing(last_passing[fields[2]])
              }
              /* ignore cars with 0 time, except overall leader */
              if (fields[1] > 1 && (fields[4] == "00:00:00.000")) {
                Gleaders[fields[1]-1] = undefined;
              } else {
                Gleaders[fields[1]-1] = fields[2];
              }
              if (fields[1] <= maxLeaders) {
                leaderstr = '';
                for (var i = 0; i < Gleaders.length && i < maxLeaders; i++) {
                  if (Gleaders[i] === undefined) break;
                  if (leaderstr != '') leaderstr += ', ';
                  leaderstr += cars[Gleaders[i]];
                }
                Gleaders_text = leaderstr;
                if (!is_qual) {
                  f_leaders.textContent = Gleaders_text;
                }
              }
              var cls = car_class[fields[2]];
              if (cls !== undefined) {
                leaderstr = '';
                var n = 0;
                for (var i = 0; i < Gleaders.length && n < maxLeaders; i++) {
                  if (car_class[Gleaders[i]] != cls) continue;
                  if (Gleaders[i] === undefined) break;
                  if (leaderstr != '') leaderstr += ', ';
                  leaderstr += cars[Gleaders[i]];
                  n++;
                }
                if (Gclass_lead[cls] != leaderstr) {
                  Gclass_lead[cls] = leaderstr;
                  var clsleads = [];
                  for (var c in Gclass_lead) {
                    if (classes[c] === undefined) continue
                    if (Gclass_lead[c] == '') continue
                    clsleads.push(classes[c] + ': ' + Gclass_lead[c]);
                  }
                  clsleads.sort();
                  Gclass_lead_text = clsleads.join('; ');
                  if (!is_qual) {
                    f_clslead.textContent = Gclass_lead_text;
                  }
                }
              }

            } else if (fields[0] == '$H') {
              var leaderstr;
              /* race info: $G,pos,regcode,laps,time */
              /* qual info: $H,pos,regno,bestlap,besttime */
              /* ignore cars with 0 time, except overall leader */
              if (fields[1] > 1 && fields[4] == "00:00:00.000") { //XXX
                Hleaders[fields[1]-1] = undefined;
              } else {
                Hleaders[fields[1]-1] = fields[2];
              }
              if (fields[1] <= maxLeaders) {
                leaderstr = '';
                for (var i = 0; i < Hleaders.length && i < maxLeaders; i++) {
                  if (Hleaders[i] === undefined) break;
                  if (leaderstr != '') leaderstr += ', ';
                  leaderstr += cars[Hleaders[i]];
                }
                Hleaders_text = leaderstr;
                if (is_qual) {
                  f_leaders.textContent = Hleaders_text;
                }
              }
              var cls = car_class[fields[2]];
              if (cls !== undefined) {
                leaderstr = '';
                var n = 0;
                for (var i = 0; i < Hleaders.length && n < maxLeaders; i++) {
                  if (car_class[Hleaders[i]] != cls) continue;
                  if (Hleaders[i] === undefined) break;
                  if (leaderstr != '') leaderstr += ', ';
                  leaderstr += cars[Hleaders[i]];
                  n++;
                }
                if (Hclass_lead[cls] != leaderstr) {
                  Hclass_lead[cls] = leaderstr;
                  var clsleads = [];
                  for (var c in Hclass_lead) {
                    if (classes[c] === undefined) continue
                    if (Hclass_lead[c] == '') continue
                    clsleads.push(classes[c] + ': ' + Hclass_lead[c]);
                  }
                  clsleads.sort();
                  Hclass_lead_text = clsleads.join('; ');
                  if (is_qual) {
                    f_clslead.textContent = Hclass_lead_text;
                  }
                }
              }

            } else if (fields[0] == '$J') {
              last_passing[fields[1]] = {
                laptime: fields[2],
                elapsed: fields[3]
              }
              if (fields[1] == Gleaders[0]) {
                computePassing(last_passing[fields[1]])
              }

            } else if (fields[0] == '$I') {
              tod_is_local = false;
              f_tod.textContent = fields[1];
              f_tod2.textContent = fields[1];
              var date = new Date(fields[2]);
              f_date.textContent = date.toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric',
                month: 'long', day: 'numeric' });
              f_run      .textContent = '';
              setFlag('');
              f_laps     .textContent = '';
              f_estLaps2Go.textContent = '';
              f_laps2go  .textContent = '';
              f_proj_total.textContent = '--:--:--.---';
              f_proj_above.textContent = '';
              f_proj_below.textContent = '';
              f_sched_total.textContent = '--:--:--';
              planned_laps2go = undefined;
              estimated_laps2go = undefined;
              f_elapsed  .textContent = '--:--:--';
              f_projLaps.textContent = '';
              f_topdiv.dataset.showProjLaps = "false";
              f_timeleft .textContent = '--:--:--';
              f_leaders  .textContent = '';
              f_clslead  .textContent = '';
              cars = new Object;
              classes = new Object;
              car_class = new Object;
              is_qual = undefined;
              Gclass_lead = new Object;
              Gclass_lead_text = "";
              Gleaders = [];
              Gleaders_text = "";
              Hclass_lead = new Object;
              Hclass_lead_text = "";
              Hleaders = [];
              Hleaders_text = "";
              last_passing = new Object;
              progress_start = undefined;
              progress_length = undefined;
              white_flag_warned = false;
              console.log(`white_flag_warned set to ${white_flag_warned}`);
              cached_scheduled_total = undefined;
              updateProgress(undefined);
            } else if (fields[0] == ':E') {
              server_error = fields[1];
              showError(server_error);
            } else if (fields[0] == ':M') {
              showMessage(fields[1]);
            } else if (fields[0] == ':OPT') {
              process_opts(fields[1]);
            } else if (fields[0] == ':R') {
              document.location.reload(true)
            } else if (fields[0] == ':TZ') {
              server_tz = fields[1];
              if (tod_is_local) show_local_time();
            } else if (fields[0] == ':V') {
              f_v_srv.textContent = fields[1];
            }
        };
        s.onerror = function (e) {
            console.log("Socket error:", e);
        };
    } catch (ex) {
        console.log("Socket exception:", ex);
        window.setTimeout(doconnect, 3000);
    }
}

function onLoad() {
  /* Extract the version string components.
   * The CSS document's version is embedded in a style on the topdiv, and
   * our (JS) version is embedded in a variable declaration above.
   * The server version is not updated here; instead, it is set when the
   * server sends it to us.
   */
  var topstyle = window.getComputedStyle(f_topdiv);
  css_version = topstyle.getPropertyValue('--bigclock-version').trim();
  if (css_version.startsWith('"') && css_version.endsWith('"')) {
    css_version = css_version.slice(1, -1);
  }
  f_v_css.textContent  = css_version;
  f_v_js.textContent   = js_version;

  var port = getCookie('bigclock_port');
  if (port != null) data_port = port;

  process_opts();
  show_local_time();
  doconnect();
}
