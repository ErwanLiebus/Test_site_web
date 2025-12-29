// === Gestion résultats (localStorage) ==================

const STORAGE_KEY = "cyberDiagResults";

function loadResults() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveResults(obj) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

function setResult(key, label, ok) {
    const res = loadResults();
    res[key] = { label, ok };
    saveResults(res);
}

function clearResults() {
    localStorage.removeItem(STORAGE_KEY);
}

// === Navigation entre pages ============================
// map du test -> page suivante
const nextPageMap = {
    welcome: "accel.html",
    accel: "gyro.html",
    gyro: "mic.html",
    mic: "camera.html",
    camera: "speaker.html",
    speaker: "gps.html",
    gps: "summary.html"
};

function goTo(page) {
    window.location.href = page;
}

function goNext(currentKey) {
    const next = nextPageMap[currentKey];
    if (next) goTo(next);
}

// === Détection de la page courante =====================

window.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    switch (page) {
        case "welcome": initWelcome(); break;
        case "accel":   initAccel();   break;
        case "gyro":    initGyro();    break;
        case "mic":     initMic();     break;
        case "camera":  initCamera();  break;
        case "speaker": initSpeaker(); break;
        case "gps":     initGPS();     break;
        case "summary": initSummary(); break;
    }
});

// === Page accueil ======================================

function initWelcome() {
    document.getElementById("btn-start-tests").addEventListener("click", () => {
        clearResults();
        goNext("welcome");
    });
}

// === Test Accéléromètre (secousse avec tolérance) =====

function initAccel() {
    const accXEl = document.getElementById("acc-x");
    const accYEl = document.getElementById("acc-y");
    const accZEl = document.getElementById("acc-z");
    const accForceEl = document.getElementById("acc-force");
    const statusEl = document.getElementById("accel-status");

    let accelListener = null;
    let shakeDetected = false;
    let shakeStart = 0;

    const SHAKE_THRESHOLD = 3.0;
    const STABLE_THRESHOLD = 1.5;
    const MIN_SHAKE_DURATION = 200;

    function reset() {
        shakeDetected = false;
        shakeStart = 0;
        statusEl.textContent = "En attente de secousse significative…";
    }

    function start() {
        reset();
        if (accelListener) window.removeEventListener("devicemotion", accelListener);

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
                if (!shakeStart) shakeStart = Date.now();
                if (!shakeDetected && (Date.now() - shakeStart > MIN_SHAKE_DURATION)) {
                    shakeDetected = true;
                    if (navigator.vibrate) navigator.vibrate(200);
                    statusEl.textContent = "Secousse détectée ✔ Tu peux valider le test.";
                }
            } else if (force < STABLE_THRESHOLD) {
                shakeStart = 0;
            }
        };

        window.addEventListener("devicemotion", accelListener);
    }

    document.getElementById("btn-accel-retry").addEventListener("click", start);

    document.getElementById("btn-accel-ok").addEventListener("click", () => {
        setResult("accel", "Accéléromètre", true);
        goNext("accel");
    });

    document.getElementById("btn-accel-ko").addEventListener("click", () => {
        setResult("accel", "Accéléromètre", false);
        goNext("accel");
    });

    // démarrer automatiquement
    start();
}

// === Test Gyroscope ====================================

function initGyro() {
    const aEl = document.getElementById("gyro-a");
    const bEl = document.getElementById("gyro-b");
    const cEl = document.getElementById("gyro-c");

    window.addEventListener("deviceorientation", (e) => {
        if (e.alpha != null) {
            aEl.textContent = e.alpha.toFixed(2);
            bEl.textContent = e.beta != null ? e.beta.toFixed(2) : "0.00";
            cEl.textContent = e.gamma != null ? e.gamma.toFixed(2) : "0.00";
        }
    });

    document.getElementById("btn-gyro-ok").addEventListener("click", () => {
        setResult("gyro", "Gyroscope", true);
        goNext("gyro");
    });

    document.getElementById("btn-gyro-ko").addEventListener("click", () => {
        setResult("gyro", "Gyroscope", false);
        goNext("gyro");
    });
}

// === Test Micro ========================================

let micStream = null;
let micAudioCtx = null;
let micAnalyser = null;
let micDataArray = null;
let micAnimationId = null;

function initMic() {
    const vu = document.getElementById("mic-vu");
    const levelEl = document.getElementById("mic-level");
    const statusEl = document.getElementById("mic-status");

    function animate() {
        micAnimationId = requestAnimationFrame(animate);
        if (!micAnalyser) return;
        micAnalyser.getByteTimeDomainData(micDataArray);
        let sum = 0;
        for (let i = 0; i < micDataArray.length; i++) {
            const v = (micDataArray[i] - 128) / 128;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / micDataArray.length);
        const level = Math.min(1, rms * 5);
        levelEl.textContent = Math.round(level * 100);
        vu.style.width = (level * 100) + "%";
    }

    function startMic() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            statusEl.textContent = "Micro non supporté sur ce navigateur.";
            return;
        }
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                micStream = stream;
                micAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const src = micAudioCtx.createMediaStreamSource(stream);
                micAnalyser = micAudioCtx.createAnalyser();
                micAnalyser.fftSize = 256;
                micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);
                src.connect(micAnalyser);
                statusEl.textContent = "Micro actif. Parle ou tape pour voir le niveau.";
                animate();
            })
            .catch(err => {
                statusEl.textContent = "Erreur micro: " + err.message;
            });
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

    document.getElementById("btn-mic-start").addEventListener("click", startMic);

    document.getElementById("btn-mic-ok").addEventListener("click", () => {
        stopMic();
        setResult("mic", "Micro", true);
        goNext("mic");
    });

    document.getElementById("btn-mic-ko").addEventListener("click", () => {
        stopMic();
        setResult("mic", "Micro", false);
        goNext("mic");
    });
}

// === Test Caméra =======================================

let cameraStream = null;

function initCamera() {
    const video = document.getElementById("camera-video");
    const statusEl = document.getElementById("camera-status");

    function startCam() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            statusEl.textContent = "Caméra non supportée sur ce navigateur.";
            return;
        }
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                cameraStream = stream;
                video.srcObject = stream;
                statusEl.textContent = "Caméra active. Vérifie l'image.";
            })
            .catch(err => {
                statusEl.textContent = "Erreur caméra: " + err.message;
            });
    }

    function stopCam() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
            cameraStream = null;
        }
    }

    document.getElementById("btn-camera-start").addEventListener("click", startCam);

    document.getElementById("btn-camera-ok").addEventListener("click", () => {
        stopCam();
        setResult("camera", "Caméra", true);
        goNext("camera");
    });

    document.getElementById("btn-camera-ko").addEventListener("click", () => {
        stopCam();
        setResult("camera", "Caméra", false);
        goNext("camera");
    });
}

// === Test Haut-parleur / Générateur ====================

let audioCtx = null;
let osc = null;

function initSpeaker() {
    const freqRange = document.getElementById("freq-range");
    const freqLabel = document.getElementById("freq-label");
    const statusEl = document.getElementById("speaker-status");

    freqRange.addEventListener("input", () => {
        freqLabel.textContent = freqRange.value;
        if (osc) osc.frequency.value = parseFloat(freqRange.value);
    });

    function startTone() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (osc) {
            osc.stop();
            osc.disconnect();
            osc = null;
        }
        osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = parseFloat(freqRange.value);
        osc.connect(audioCtx.destination);
        osc.start();
        statusEl.textContent = "Son en cours. Ajuste la fréquence si besoin.";
    }

    function stopTone() {
        if (osc) {
            osc.stop();
            osc.disconnect();
            osc = null;
        }
    }

    document.getElementById("btn-tone-play").addEventListener("click", startTone);
    document.getElementById("btn-tone-stop").addEventListener("click", stopTone);

    document.getElementById("btn-speaker-ok").addEventListener("click", () => {
        stopTone();
        setResult("speaker", "Haut-parleur", true);
        goNext("speaker");
    });

    document.getElementById("btn-speaker-ko").addEventListener("click", () => {
        stopTone();
        setResult("speaker", "Haut-parleur", false);
        goNext("speaker");
    });
}

// === Test GPS ==========================================

function initGPS() {
    const latEl = document.getElementById("gps-lat");
    const lonEl = document.getElementById("gps-lon");
    const accEl = document.getElementById("gps-acc");
    const statusEl = document.getElementById("gps-status");

    function startGPS() {
        if (!("geolocation" in navigator)) {
            statusEl.textContent = "GPS non supporté sur ce navigateur.";
            return;
        }
        statusEl.textContent = "Demande de localisation…";
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const c = pos.coords;
                latEl.textContent = c.latitude.toFixed(5);
                lonEl.textContent = c.longitude.toFixed(5);
                accEl.textContent = c.accuracy.toFixed(1);
                statusEl.textContent = "Localisation obtenue.";
            },
            (err) => {
                statusEl.textContent = "Erreur GPS: " + err.message;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );
    }

    document.getElementById("btn-gps-start").addEventListener("click", startGPS);

    document.getElementById("btn-gps-ok").addEventListener("click", () => {
        setResult("gps", "GPS", true);
        goNext("gps");
    });

    document.getElementById("btn-gps-ko").addEventListener("click", () => {
        setResult("gps", "GPS", false);
        goNext("gps");
    });
}

// === Récapitulatif =====================================

function initSummary() {
    const ul = document.getElementById("summary-list");
    const btnRestart = document.getElementById("btn-restart");
    const res = loadResults();
    ul.innerHTML = "";

    const order = [
        "accel",
        "gyro",
        "mic",
        "camera",
        "speaker",
        "gps"
    ];

    order.forEach(key => {
        const item = res[key];
        if (!item) return;
        const li = document.createElement("li");
        const icon = document.createElement("span");
        icon.classList.add("summary-icon");
        if (item.ok) {
            icon.classList.add("summary-ok");
            icon.textContent = "✓";
        } else {
            icon.classList.add("summary-ko");
            icon.textContent = "✗";
        }
        const label = document.createElement("span");
        label.textContent = item.label;
        li.appendChild(icon);
        li.appendChild(label);
        ul.appendChild(li);
    });

    btnRestart.addEventListener("click", () => {
        clearResults();
        goTo("index.html");
    });
}