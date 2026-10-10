// Lado "receptor": se conecta a la sala de Firebase con un ID único y reproduce el stream del emisor.
const remoteVideo = document.getElementById('remoteVideo');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const statusEl = document.getElementById('status');

let pc = null; // RTCPeerConnection activa para este espectador
let viewerRef = null; // Referencia en Firebase para este espectador específico
let roomRef = null;
let activeListenerRef = null;
let offerListenerRef = null;
let callerCandidatesRef = null;
let pendingCandidates = [];

function setStatus(text) {
  statusEl.textContent = text;
}

async function connect() {
  connectBtn.disabled = true;
  setStatus('Buscando emisor activo...');

  roomRef = db.ref(ROOM_PATH);

  // Verificar si hay una transmisión activa
  const activeSnapshot = await roomRef.child('active').once('value');
  if (!activeSnapshot.val()) {
    setStatus('No hay ninguna transmisión activa en este momento. El emisor debe iniciar primero.');
    connectBtn.disabled = false;
    return;
  }

  // Registrar a este espectador con un identificador único en /viewers
  viewerRef = roomRef.child('viewers').push();
  // Si el usuario cierra el navegador o se desconecta de red, Firebase limpia automáticamente el nodo
  viewerRef.onDisconnect().remove();

  pc = new RTCPeerConnection(RTC_CONFIG);
  pendingCandidates = [];

  // Al recibir el stream de audio/video
  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
      setStatus('Conectado. Recibiendo transmisión en vivo.');
    }
  };

  pc.onconnectionstatechange = () => {
    if (!pc) return;
    if (pc.connectionState === 'connected') {
      setStatus('Conectado. Recibiendo transmisión en vivo.');
    } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      setStatus('Conexión perdida con el emisor.');
    } else {
      setStatus('Estado de conexión: ' + pc.connectionState);
    }
  };

  // Enviar los ICE candidates de este espectador al emisor
  const calleeCandidatesRef = viewerRef.child('calleeCandidates');
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      calleeCandidatesRef.push(event.candidate.toJSON());
    }
  };

  // Escuchar cuando el emisor prepare y envíe la oferta SDP para este espectador
  offerListenerRef = viewerRef.child('offer');
  offerListenerRef.on('value', async (snapshot) => {
    const offer = snapshot.val();
    if (offer && pc && !pc.currentRemoteDescription) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Procesar candidatos ICE que hayan llegado antes del SDP offer
        for (const cand of pendingCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn);
        }
        pendingCandidates = [];

        // Generar respuesta SDP (answer)
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await viewerRef.child('answer').set({ type: answer.type, sdp: answer.sdp });

        setStatus('Respuesta enviada. Estableciendo conexión...');
      } catch (err) {
        console.error('Error procesando oferta del emisor:', err);
        setStatus('Error al procesar oferta: ' + err.message);
      }
    }
  });

  // Escuchar los ICE candidates enviados por el emisor para este espectador
  callerCandidatesRef = viewerRef.child('callerCandidates');
  callerCandidatesRef.on('child_added', async (snapshot) => {
    const candidate = snapshot.val();
    if (!candidate) return;

    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Error agregando ICE candidate del emisor:', err);
      }
    } else {
      pendingCandidates.push(candidate);
    }
  });

  // Escuchar si el emisor detiene la transmisión
  activeListenerRef = roomRef.child('active');
  activeListenerRef.on('value', (snapshot) => {
    if (snapshot.val() === null || snapshot.val() === false) {
      setStatus('El emisor ha finalizado la transmisión.');
      disconnect();
    }
  });

  // Notificar al emisor que el espectador está listo para recibir la oferta
  await viewerRef.child('ready').set(true);

  disconnectBtn.disabled = false;
}

function disconnect() {
  disconnectBtn.disabled = true;

  // Dejar de escuchar Firebase
  if (offerListenerRef) offerListenerRef.off();
  if (callerCandidatesRef) callerCandidatesRef.off();
  if (activeListenerRef) activeListenerRef.off();

  if (pc) {
    pc.close();
    pc = null;
  }

  if (viewerRef) {
    viewerRef.remove();
    viewerRef = null;
  }

  remoteVideo.srcObject = null;
  connectBtn.disabled = false;
  if (!statusEl.textContent.includes('finalizado')) {
    setStatus('Desconectado.');
  }
}

window.addEventListener('beforeunload', () => {
  if (viewerRef) {
    viewerRef.remove();
  }
});

connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);