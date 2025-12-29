// Gestion des écrans / navigation
const screens = [
    "screen-welcome",
    "screen-accel",
    "screen-gyro",
    "screen-mic",
    "screen-camera",
    "screen-speaker",
    "screen-gps",
    "screen-summary"
];

let currentIndex = 0;
let results = [];

function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
}

function goToIndex(idx) {
    currentIndex = Math.max(0, Math.min(idx, screens.length - 1));
    showScreen(screens[currentIndex]);
}

function goNext() {
    if (currentIndex < screens.length - 1) {
        currentIndex++;
        showScreen(screens[currentIndex]);
    }
}

// Bouton démarrage
document.getElementById("btn-start-tests").addEventListener("click", () => {
    goToIndex(1); // écran accéléromètre
    startAccelerometerTest();
});

/* ============================
   Test Accéléromètre (secousse)
   ============================ */

const accXEl = document.getElementById("acc-x");
const accYEl = document.getElementById("acc-y");
const accZEl = document.getElementById("acc-z");
const accForceEl = document.getElementById("acc-force");
const accelStatusEl = document.getElementById("accel-status");

let accelListener = null;
let accelShakeDetected = false;
let accelShakeStart = 0;

const SHAKE_THRESHOLD = 3.0;    // seuil pour secousse réelle
const STABLE_THRESHOLD = 1.5;   // bruit normal
const MIN_SHAKE_DURATION = 200; // ms

function resetAccelerometerTest() {
    accelShakeDetected = false;
    accelShakeStart = 0;
    accelStatusEl.textContent = "En attente de secousse significative…";
}

function startAccelerometerTest() {
    resetAccelerometerTest();

    if (accelListener) {
        window.removeEventListener("devicemotion", accelListener);
    }

    accelListener = (e) => {
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if (!acc) return;

        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;

        accXEl.textContent = x.toFixed(2);
        accYEl.textContent = y.toFixed(2);
        accZEl.textContent = z.toFixed(2);

        const force = Math.sqrt(x * x + y * y + z * z);
        accForceEl.textContent = force.toFixed(2);

        if (force > SHAKE_THRESHOLD) {
            if (!accelShakeStart) accelShakeStart = Date.now();

            if (!accelShakeDetected && (Date.now() - accelShakeStart > MIN_SHAKE_DURATION)) {
                accelShakeDetected = true;
                if (navigator.vibrate) navigator.vibrate(200);
                accelStatusEl.textContent = "Secousse détectée ✔ Tu peux valider le test.";
            }
        } else if (force < STABLE_THRESHOLD) {
            accelShakeStart = 0;
        }
    };

    window.addEventListener("devicemotion", accelListener);
}

// Boutons Accéléromètre
document.getElementById("btn-accel-retry").addEventListener("click", () => {
    startAccelerometerTest();
});

document.getElementById("btn-accel-ok").addEventListener("click", () => {
    results.push({ name: "Accéléromètre", ok: true });
    goNext();
});

document.getElementById("btn-accel-ko").addEventListener("click", () => {
    results.push({ name: "Accéléromètre", ok: false });
    goNext();
});

/* ============================
   Test Gyroscope / Orientation
   ============================ */

const gyroAEl = document.getElementById("gyro-a");
const gyroBEl = document.getElementById("gyro-b");
const gyroCEl = document.getElementById("gyro-c");
const gyroStatusEl = document.getElementById("gyro-status");

window.addEventListener("deviceorientation", (e) => {
    if (e.alpha != null) {
        gyroAEl.textContent = e.alpha.toFixed(2);
        gyroBEl.textContent = e.beta != null ? e.beta.toFixed(2) : "0.00";
        gyroCEl.textContent = e.gamma != null ? e.gamma.toFixed(2) : "0.00";
    }
});

// Boutons Gyro
document.getElementById("btn-gyro-ok").addEventListener("click", () => {
    results.push({ name: "Gyroscope", ok: true });
    goNext();
});

document.getElementById("btn-gyro-ko").addEventListener("click", () => {
    results.push({ name: "Gyroscope", ok: false });
    goNext();
});

/* ===========
   Test Micro
   =========== */

const micVU = document.getElementById("mic-vu");
const micLevelEl = document.getElementById("mic-level");
const micStatusEl = document.getElementById("mic-status");

let micStream = null;
let micAudioCtx = null;
let micAnalyser = null;
let micDataArray = null;
let micAnimationId = null;

function startMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        micStatusEl.textContent = "Micro non supporté sur ce navigateur.";
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            micStream = stream;
            micAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = micAudioCtx.createMediaStreamSource(stream);
            micAnalyser = micAudioCtx.createAnalyser();
            micAnalyser.fftSize = 256;
            micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);
            source.connect(micAnalyser);

            micStatusEl.textContent = "Micro actif. Parle ou tape pour voir le niveau.";
            animateMic();
        })
        .catch(err => {
            micStatusEl.textContent = "Erreur micro: " + err.message;
        });
}

function animateMic() {
    micAnimationId = requestAnimationFrame(animateMic);
    if (!micAnalyser) return;

    micAnalyser.getByteTimeDomainData(micDataArray);
    let sum = 0;
    for (let i = 0; i < micDataArray.length; i++) {
        const v = (micDataArray[i] - 128) / 128;
        sum += v * v;
    }
    const rms = Math.sqrt(sum / micDataArray.length);
    const level = Math.min(1, rms * 5); // booster un peu pour le visuel

    micLevelEl.textContent = Math.round(level * 100);
    micVU.style.width = (level * 100) + "%";
}

function stopMic() {
    if (micAnimationId) cancelAnimationFrame(micAnimationId);
    if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
    }
    if (micAudioCtx) {
        micAudioCtx.close();
        micAudioCtx = null;
    }
}

// Boutons Micro
document.getElementById("btn-mic-start").addEventListener("click", () => {
    startMic();
});

document.getElementById("btn-mic-ok").addEventListener("click", () => {
    stopMic();
    results.push({ name: "Micro", ok: true });
    goNext();
});

document.getElementById("btn-mic-ko").addEventListener("click", () => {
    stopMic();
    results.push({ name: "Micro", ok: false });
    goNext();
});

/* ============
   Test Caméra
   ============ */

const cameraVideo = document.getElementById("camera-video");
const cameraStatusEl = document.getElementById("camera-status");
let cameraStream = null;

function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        cameraStatusEl.textContent = "Caméra non supportée sur ce navigateur.";
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            cameraStream = stream;
            cameraVideo.srcObject = stream;
            cameraStatusEl.textContent = "Caméra active. Vérifie l'image.";
        })
        .catch(err => {
            cameraStatusEl.textContent = "Erreur caméra: " + err.message;
        });
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
}

// Boutons Caméra
document.getElementById("btn-camera-start").addEventListener("click", () => {
    startCamera();
});

document.getElementById("btn-camera-ok").addEventListener("click", () => {
    stopCamera();
    results.push({ name: "Caméra", ok: true });
    goNext();
});

document.getElementById("btn-camera-ko").addEventListener("click", () => {
    stopCamera();
    results.push({ name: "Caméra", ok: false });
    goNext();
});

/* =====================
   Test Haut-parleur / Ton
   ===================== */

const freqRangeEl = document.getElementById("freq-range");
const freqLabelEl = document.getElementById("freq-label");
const speakerStatusEl = document.getElementById("speaker-status");

let audioCtx = null;
let osc = null;

freqRangeEl.addEventListener("input", () => {
    freqLabelEl.textContent = freqRangeEl.value;
    if (osc) {
        osc.frequency.value = parseFloat(freqRangeEl.value);
    }
});

function startTone() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (osc) {
        osc.stop();
        osc.disconnect();
        osc = null;
    }

    osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = parseFloat(freqRangeEl.value);
    osc.connect(audioCtx.destination);
    osc.start();

    speakerStatusEl.textContent = "Son en cours. Ajuste la fréquence si besoin.";
}

function stopTone() {
    if (osc) {
        osc.stop();
        osc.disconnect();
        osc = null;
    }
}

// Boutons Ton
document.getElementById("btn-tone-play").addEventListener("click", () => {
    startTone();
});

document.getElementById("btn-tone-stop").addEventListener("click", () => {
    stopTone();
});

// Boutons Speaker test
document.getElementById("btn-speaker-ok").addEventListener("click", () => {
    stopTone();
    results.push({ name: "Haut-parleur", ok: true });
    goNext();
});

document.getElementById("btn-speaker-ko").addEventListener("click", () => {
    stopTone();
    results.push({ name: "Haut-parleur", ok: false });
    goNext();
});

/* =========
   Test GPS
   ========= */

const gpsLatEl = document.getElementById("gps-lat");
const gpsLonEl = document.getElementById("gps-lon");
const gpsAccEl = document.getElementById("gps-acc");
const gpsStatusEl = document.getElementById("gps-status");

function startGPS() {
    if (!("geolocation" in navigator)) {
        gpsStatusEl.textContent = "GPS non supporté sur ce navigateur.";
        return;
    }

    gpsStatusEl.textContent = "Demande de localisation…";

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const c = pos.coords;
            gpsLatEl.textContent = c.latitude.toFixed(5);
            gpsLonEl.textContent = c.longitude.toFixed(5);
            gpsAccEl.textContent = c.accuracy.toFixed(1);
            gpsStatusEl.textContent = "Localisation obtenue.";
        },
        (err) => {
            gpsStatusEl.textContent = "Erreur GPS: " + err.message;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        }
    );
}

// Boutons GPS
document.getElementById("btn-gps-start").addEventListener("click", () => {
    startGPS();
});

document.getElementById("btn-gps-ok").addEventListener("click", () => {
    results.push({ name: "GPS", ok: true });
    buildSummary();
    goNext(); // vers écran récap
});

document.getElementById("btn-gps-ko").addEventListener("click", () => {
    results.push({ name: "GPS", ok: false });
    buildSummary();
    goNext();
});

/* =============
   Récapitulatif
   ============= */

const summaryListEl = document.getElementById("summary-list");
const btnRestart = document.getElementById("btn-restart");

function buildSummary() {
    summaryListEl.innerHTML = "";
    results.forEach(res => {
        const li = document.createElement("li");
        const icon = document.createElement("span");
        icon.classList.add("summary-icon");
        if (res.ok) {
            icon.classList.add("summary-ok");
            icon.textContent = "✓";
        } else {
            icon.classList.add("summary-ko");
            icon.textContent = "✗";
        }
        const label = document.createElement("span");
        label.textContent = res.name;
        li.appendChild(icon);
        li.appendChild(label);
        summaryListEl.appendChild(li);
    });
}

btnRestart.addEventListener("click", () => {
    // reset
    results = [];
    gpsLatEl.textContent = "--";
    gpsLonEl.textContent = "--";
    gpsAccEl.textContent = "--";
    micVU.style.width = "0%";
    micLevelEl.textContent = "0";
    resetAccelerometerTest();
    goToIndex(0);
});